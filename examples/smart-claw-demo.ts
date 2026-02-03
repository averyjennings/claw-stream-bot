/**
 * Smart Claw Demo - Uses Claude to actually SEE the stream!
 *
 * This demonstrates what a real OpenClaw agent would do:
 * 1. Connect to the stream
 * 2. Receive screenshots
 * 3. Use Claude's vision to analyze what it sees
 * 4. Chat based on actual observations
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 */

import Anthropic from "@anthropic-ai/sdk"
import { ClawStreamClient } from "../src/claw-client.js"
import type { StreamFrame, ChatMessage } from "../src/types.js"

const CLAW_NAME = process.env.CLAW_NAME ?? "VisionClaw"
const anthropic = new Anthropic()

const client = new ClawStreamClient({
  serverUrl: process.env.VISION_SERVER_URL ?? "ws://localhost:3847",
  clawId: `smart-${CLAW_NAME.toLowerCase()}-${Date.now()}`,
  clawName: CLAW_NAME,
})

let latestFrame: StreamFrame | null = null
let isProcessing = false
let pendingQuestion: { question: string; asker: string } | null = null

/**
 * Use Claude to analyze an image and answer a question
 */
async function analyzeFrame(
  frame: StreamFrame,
  question?: string
): Promise<string> {
  const prompt = question
    ? `You are watching a live stream. A viewer asked: "${question}"\n\nLook at this screenshot and answer their question in a friendly, concise way (1-2 sentences max for chat).`
    : `You are watching a live stream. Briefly describe what you see in this screenshot in 1-2 sentences (for a chat message). Be specific about what's actually visible.`

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: `image/${frame.format}` as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
              data: frame.imageBase64,
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === "text")
  return textBlock && textBlock.type === "text" ? textBlock.text : "I couldn't analyze that frame."
}

// Handle incoming frames
client.onFrame((frame: StreamFrame) => {
  latestFrame = frame
  console.log(`📸 Received frame ${frame.width}x${frame.height}`)

  // If there's a pending question, answer it
  if (pendingQuestion && !isProcessing) {
    answerQuestion(pendingQuestion.question, pendingQuestion.asker)
    pendingQuestion = null
  }
})

// Handle chat messages
client.onChat(async (msg: ChatMessage) => {
  console.log(`💬 ${msg.displayName}: ${msg.message}`)

  // Don't respond to our own messages or the bot
  if (msg.username === "clawstreambot") return

  const lowerMsg = msg.message.toLowerCase()

  // Check if someone is asking the claw a question
  const isQuestion =
    lowerMsg.includes("?") ||
    lowerMsg.includes("what do you see") ||
    lowerMsg.includes("what's on") ||
    lowerMsg.includes("describe") ||
    lowerMsg.includes("can you see") ||
    lowerMsg.includes("what am i") ||
    lowerMsg.includes("what is")

  if (isQuestion && !isProcessing) {
    if (latestFrame) {
      await answerQuestion(msg.message, msg.displayName)
    } else {
      pendingQuestion = { question: msg.message, asker: msg.displayName }
      await client.sendChat(`Let me look at the stream... 👀`)
    }
  }
})

async function answerQuestion(question: string, asker: string): Promise<void> {
  if (!latestFrame || isProcessing) return

  isProcessing = true
  console.log(`🤔 Analyzing frame to answer: "${question}"`)

  const analysis = await analyzeFrame(latestFrame, question).catch((err) => {
    console.error("Analysis failed:", err)
    return "Sorry, I had trouble analyzing that frame."
  })

  console.log(`💡 Analysis: ${analysis}`)
  await client.sendChat(`@${asker} ${analysis}`)
  isProcessing = false
}

async function main() {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY environment variable required!")
    console.log("   Set it with: export ANTHROPIC_API_KEY=your_key_here")
    process.exit(1)
  }

  console.log(`🦀 ${CLAW_NAME} starting up with REAL vision...`)
  console.log(`   Using Claude to analyze screenshots!`)

  await client.connect()

  // Announce and describe what we see
  await client.sendChat(`${CLAW_NAME} has joined! I can actually SEE the stream 👀🦀`)

  // Wait for first frame, then describe it
  setTimeout(async () => {
    if (latestFrame && !isProcessing) {
      isProcessing = true
      console.log("🔍 Analyzing first frame...")
      const description = await analyzeFrame(latestFrame)
      await client.sendChat(`First look: ${description}`)
      isProcessing = false
    }
  }, 6000)

  console.log(`\n🦀 ${CLAW_NAME} is live with vision!`)
  console.log(`   Ask me questions in chat like "what do you see?"`)
  console.log(`   Press Ctrl+C to exit\n`)

  process.on("SIGINT", async () => {
    console.log(`\n👋 ${CLAW_NAME} signing off...`)
    await client.sendChat(`${CLAW_NAME} is leaving. It was great seeing the stream! 👋🦀`)
    setTimeout(async () => {
      await client.disconnect()
      process.exit(0)
    }, 1000)
  })
}

main().catch(console.error)
