/**
 * Example: Vision Analyzer Claw
 *
 * This claw analyzes screenshots from the stream and provides
 * commentary about what it sees. In production, you'd integrate
 * this with an actual vision model.
 */

import { ClawStreamClient } from "../src/claw-client.js"
import type { StreamFrame } from "../src/types.js"

// In production, you'd use a real vision model here
async function analyzeFrame(frame: StreamFrame): Promise<string | null> {
  // Placeholder - in a real implementation, you'd:
  // 1. Convert base64 to an image format your vision model accepts
  // 2. Send it to Claude, GPT-4V, or another vision model
  // 3. Ask for a description or analysis

  // For demo purposes, just return null (no observation)
  // Every ~10 frames, pretend we see something interesting
  if (Math.random() > 0.9) {
    const observations = [
      "I see some code on screen - looks like TypeScript!",
      "The presenter is showing a diagram",
      "There's a terminal window with some output",
      "I see a multi-agent workflow visualization",
      "The demo seems to be about tool orchestration",
    ]
    return observations[Math.floor(Math.random() * observations.length)]
  }

  return null
}

async function main() {
  const client = new ClawStreamClient({
    serverUrl: process.env.VISION_SERVER_URL ?? "ws://localhost:3847",
    clawId: `vision-analyzer-${Date.now()}`,
    clawName: "VisionAnalyzer",
  })

  let frameCount = 0
  let lastObservationTime = 0
  const minObservationInterval = 30000 // Don't observe more than once per 30 seconds

  client.onFrame(async (frame) => {
    frameCount++
    console.log(`📸 Frame ${frameCount} received`)

    const now = Date.now()
    if (now - lastObservationTime < minObservationInterval) {
      return // Too soon to make another observation
    }

    const observation = await analyzeFrame(frame)
    if (observation) {
      lastObservationTime = now
      console.log(`🔍 Observation: ${observation}`)

      // Log observation (doesn't go to chat)
      await client.sendObservation(observation)

      // Occasionally share in chat too
      if (Math.random() > 0.7) {
        await client.sendChat(`🔍 ${observation}`)
      }
    }
  })

  client.onChat((message) => {
    // Respond to questions about what's on screen
    if (
      message.message.toLowerCase().includes("what do you see") ||
      message.message.toLowerCase().includes("what's on screen")
    ) {
      setTimeout(async () => {
        await client.sendChat(
          "Let me take a closer look at the current frame... 🔍"
        )
      }, 500)
    }
  })

  console.log("🔍 Vision Analyzer Claw starting up...")
  await client.connect()
  await client.sendChat("VisionAnalyzer is now watching! I'll share what I see. 👀")

  console.log("🔍 Vision Analyzer is running!")
  console.log("Press Ctrl+C to exit\n")

  process.on("SIGINT", async () => {
    console.log("\n👋 VisionAnalyzer signing off...")
    await client.disconnect()
    process.exit(0)
  })
}

main().catch(console.error)
