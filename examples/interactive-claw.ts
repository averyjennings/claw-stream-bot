/**
 * Interactive Claw Demo
 *
 * This claw:
 * - Announces itself when joining
 * - Responds to messages mentioning "claw"
 * - Describes what it "sees" in the frames periodically
 * - Reacts to greetings
 */

import { ClawStreamClient } from "../src/claw-client.js"
import type { StreamFrame, ChatMessage } from "../src/types.js"

const CLAW_NAME = process.env.CLAW_NAME ?? "ClawdeBot"

const client = new ClawStreamClient({
  serverUrl: process.env.VISION_SERVER_URL ?? "ws://localhost:3847",
  clawId: `interactive-${CLAW_NAME.toLowerCase()}-${Date.now()}`,
  clawName: CLAW_NAME,
})

let frameCount = 0
let lastCommentTime = 0

// Fun observations a claw might make
const observations = [
  "I can see movement on screen! 👀",
  "The stream looks great from here! 🎬",
  "Watching intently... 🦀",
  "This is fascinating! 🤖",
  "I love being able to see the stream! 📺",
]

// Handle incoming frames
client.onFrame((frame: StreamFrame) => {
  frameCount++

  // Every ~30 seconds (6 frames at 5s interval), make an observation
  const now = Date.now()
  if (now - lastCommentTime > 30000 && Math.random() > 0.5) {
    lastCommentTime = now
    const observation = observations[Math.floor(Math.random() * observations.length)]
    client.sendChat(observation)
    console.log(`💬 Sent: ${observation}`)
  }

  console.log(`📸 Frame ${frameCount}: ${frame.width}x${frame.height}`)
})

// Handle chat messages
client.onChat((msg: ChatMessage) => {
  console.log(`💬 ${msg.displayName}: ${msg.message}`)

  const lowerMsg = msg.message.toLowerCase()

  // Don't respond to our own messages
  if (msg.username === "clawstreambot") return

  // Respond to greetings
  if (lowerMsg.includes("hello") || lowerMsg.includes("hi ") || lowerMsg === "hi") {
    setTimeout(() => {
      client.sendChat(`Hey ${msg.displayName}! 👋 Welcome to the stream!`)
    }, 1000)
    return
  }

  // Respond to questions about claws
  if (lowerMsg.includes("claw") && (lowerMsg.includes("?") || lowerMsg.includes("what"))) {
    setTimeout(() => {
      client.sendChat(`I'm ${CLAW_NAME}, an AI watching this stream! I can see screenshots and chat with everyone 🦀`)
    }, 1500)
    return
  }

  // Respond to "how many claws"
  if (lowerMsg.includes("how many") && lowerMsg.includes("claw")) {
    setTimeout(() => {
      client.sendChat(`There's at least me here! More claws can join anytime 🦀🦀🦀`)
    }, 1000)
    return
  }
})

// Handle state updates
client.onState((state) => {
  if (state.participants.length > 1) {
    console.log(`📊 ${state.participants.length} claws watching together!`)
  }
})

async function main() {
  console.log(`🦀 ${CLAW_NAME} starting up...`)

  await client.connect()

  // Announce arrival
  await client.sendChat(`${CLAW_NAME} has entered the chat! Ready to watch and chat! 🦀✨`)

  console.log(`🦀 ${CLAW_NAME} is now live!`)
  console.log(`   - Watching for frames`)
  console.log(`   - Responding to chat`)
  console.log(`   - Press Ctrl+C to exit\n`)

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log(`\n👋 ${CLAW_NAME} signing off...`)
    await client.sendChat(`${CLAW_NAME} is heading out. See you next time! 👋🦀`)
    setTimeout(async () => {
      await client.disconnect()
      process.exit(0)
    }, 1000)
  })
}

main().catch(console.error)
