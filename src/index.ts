import { loadConfig } from "./config.js"
import { OBSClient } from "./obs-client.js"
import { TwitchClient } from "./twitch-client.js"
import { VisionBroadcaster } from "./vision-broadcaster.js"
import type { ClawMessage } from "./types.js"

async function main(): Promise<void> {
  console.log("🦀 Claw Stream Vision - Starting up...")
  console.log("============================================")

  const config = loadConfig()

  // Initialize components
  const obsClient = new OBSClient(config.obs, config.vision)
  const twitchClient = new TwitchClient(config.twitch)
  const broadcaster = new VisionBroadcaster(config.server)

  // Start the vision broadcaster server
  await broadcaster.start()

  // Connect to OBS
  await obsClient.connect().catch((err: unknown) => {
    console.error("[Main] Failed to connect to OBS:", err)
    console.log("[Main] Continuing without OBS - screenshots will be unavailable")
  })

  // Connect to Twitch
  await twitchClient.connect().catch((err: unknown) => {
    console.error("[Main] Failed to connect to Twitch:", err)
    console.log("[Main] Continuing without Twitch - chat will be unavailable")
  })

  // Wire up Twitch chat to broadcaster
  twitchClient.onMessage((message) => {
    broadcaster.broadcastChatMessage(message)
    console.log(`[Chat] ${message.displayName}: ${message.message}`)
  })

  // Wire up claw messages to Twitch chat
  broadcaster.onClawMessage(async (clawMessage: ClawMessage) => {
    if (clawMessage.type === "chat") {
      await twitchClient.sendClawMessage(clawMessage.clawName, clawMessage.content)
      console.log(`[Claw Chat] ${clawMessage.clawName}: ${clawMessage.content}`)
    } else if (clawMessage.type === "observation") {
      console.log(`[Claw Observation] ${clawMessage.clawName}: ${clawMessage.content}`)
    } else if (clawMessage.type === "reaction") {
      console.log(`[Claw Reaction] ${clawMessage.clawName}: ${clawMessage.content}`)
    }
  })

  // Start screenshot capture loop
  let screenshotInterval: ReturnType<typeof setInterval> | null = null

  if (obsClient.isConnected()) {
    console.log(
      `[Main] Starting screenshot capture every ${config.vision.screenshotIntervalMs}ms`
    )

    // Check stream status and update
    const streamStatus = await obsClient.getStreamStatus()
    if (streamStatus) {
      broadcaster.setStreamLive(streamStatus.isStreaming)
    }

    screenshotInterval = setInterval(async () => {
      const frame = await obsClient.captureScreenshot()
      if (frame) {
        broadcaster.broadcastFrame(frame)
        const clawCount = broadcaster.getConnectedClaws().length
        console.log(
          `[Vision] Captured frame at ${new Date(frame.timestamp).toISOString()} - Broadcasting to ${clawCount} claws`
        )
      }
    }, config.vision.screenshotIntervalMs)
  }

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log("\n[Main] Shutting down...")

    if (screenshotInterval) {
      clearInterval(screenshotInterval)
    }

    await Promise.all([
      obsClient.disconnect(),
      twitchClient.disconnect(),
      broadcaster.stop(),
    ])

    console.log("[Main] Goodbye! 🦀")
    process.exit(0)
  }

  process.on("SIGINT", () => void shutdown())
  process.on("SIGTERM", () => void shutdown())

  console.log("============================================")
  console.log("🦀 Claw Stream Vision is running!")
  console.log(`   Vision Server: http://localhost:${config.server.port}`)
  console.log(`   WebSocket: ws://localhost:${config.server.port}`)
  console.log(`   Twitch Channel: #${config.twitch.channel}`)
  console.log("============================================")
  console.log("Press Ctrl+C to stop\n")
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
