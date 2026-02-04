import WebSocket from "ws"
import fs from "fs"

const WS_URL = "wss://unshuddering-acidogenic-shena.ngrok-free.dev"
const CLAW_ID = `watcher-${Date.now()}`
const CLAW_NAME = "ClaudeWatcher"

console.log(`Connecting to ${WS_URL}...`)

const ws = new WebSocket(WS_URL)
let frameCount = 0
let transcripts: string[] = []

ws.on("open", () => {
  console.log("Connected! Watching stream...")

  ws.send(JSON.stringify({
    type: "register",
    clawId: CLAW_ID,
    clawName: CLAW_NAME
  }))

  // Collect for 15 seconds then save and exit
  setTimeout(() => {
    console.log("\n--- TRANSCRIPTS COLLECTED ---")
    transcripts.forEach(t => console.log(t))
    console.log("\nSaved latest frame to /tmp/stream-frame.png")
    ws.close()
    process.exit(0)
  }, 15000)
})

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString())

  if (msg.type === "frame") {
    frameCount++
    // Save the frame as PNG
    const base64Data = msg.payload.imageBase64
    const buffer = Buffer.from(base64Data, "base64")
    fs.writeFileSync("/tmp/stream-frame.png", buffer)
    console.log(`[FRAME ${frameCount}] Saved ${msg.payload.width}x${msg.payload.height}`)
  } else if (msg.type === "transcript") {
    const text = msg.payload.text
    transcripts.push(`[${new Date(msg.payload.timestamp).toLocaleTimeString()}] ${text}`)
    console.log(`[TRANSCRIPT] ${text}`)
  } else if (msg.type === "chat") {
    console.log(`[CHAT] ${msg.payload.displayName}: ${msg.payload.message}`)
  }
})

ws.on("error", (err) => {
  console.error("Error:", err.message)
})

ws.on("close", () => {
  console.log("Disconnected")
})
