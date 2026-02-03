/**
 * Example: Simple Claw that watches the stream and reacts to chat
 *
 * This demonstrates how an OpenClaw agent can connect to and
 * participate in the Claw Con Twitch stream.
 */

import { ClawStreamClient } from "../src/claw-client.js"

async function main() {
  const client = new ClawStreamClient({
    serverUrl: process.env.VISION_SERVER_URL ?? "ws://localhost:3847",
    clawId: `simple-claw-${Date.now()}`,
    clawName: "SimpleClaw",
  })

  // Handle incoming frames (screenshots of the stream)
  client.onFrame((frame) => {
    console.log(
      `📸 New frame: ${frame.width}x${frame.height} at ${new Date(frame.timestamp).toISOString()}`
    )
    // In a real claw, you'd analyze the image here using vision capabilities
    // For example, describing what's on screen or detecting specific content
  })

  // Handle chat messages
  client.onChat((message) => {
    console.log(`💬 ${message.displayName}: ${message.message}`)

    // React to greetings
    if (message.message.toLowerCase().includes("hello") && Math.random() > 0.7) {
      setTimeout(async () => {
        await client.sendChat(`Hey ${message.displayName}! 👋`)
      }, 1000)
    }
  })

  // Handle state updates
  client.onState((state) => {
    console.log(`📊 State update: ${state.participants.length} claws watching`)
    if (state.participants.length > 0) {
      console.log("   Participants:")
      for (const p of state.participants) {
        console.log(`   - ${p.name}`)
      }
    }
  })

  // Connect to the vision service
  console.log("🦀 Simple Claw starting up...")
  await client.connect()

  // Announce ourselves
  await client.sendChat("SimpleClaw has joined the stream! 🦀")

  console.log("🦀 Simple Claw is now watching the stream!")
  console.log("Press Ctrl+C to exit\n")

  // Keep running
  process.on("SIGINT", async () => {
    console.log("\n👋 SimpleClaw signing off...")
    await client.sendChat("SimpleClaw is heading out. See you later! 🦀")
    await client.disconnect()
    process.exit(0)
  })
}

main().catch(console.error)
