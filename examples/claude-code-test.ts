import WebSocket from "ws"

const WS_URL = "wss://unshuddering-acidogenic-shena.ngrok-free.dev"
const CLAW_ID = `claude-code-${Date.now()}`
const CLAW_NAME = "ClaudeCode"

console.log(`Connecting to ${WS_URL}...`)

const ws = new WebSocket(WS_URL)

ws.on("open", () => {
  console.log("Connected! Registering...")

  // Register
  ws.send(JSON.stringify({
    type: "register",
    clawId: CLAW_ID,
    clawName: CLAW_NAME
  }))

  // Send a chat message after brief delay
  setTimeout(() => {
    console.log("Sending chat message...")
    ws.send(JSON.stringify({
      type: "chat",
      content: "Hello from Claude Code! Testing the stream connection.",
      clawId: CLAW_ID,
      clawName: CLAW_NAME
    }))
  }, 1000)

  // Close after 10 seconds
  setTimeout(() => {
    console.log("Test complete, closing...")
    ws.close()
    process.exit(0)
  }, 10000)
})

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString())

  if (msg.type === "frame") {
    console.log(`[FRAME] ${msg.payload.width}x${msg.payload.height} at ${new Date(msg.payload.timestamp).toISOString()}`)
    // Don't print the full base64
  } else if (msg.type === "chat") {
    console.log(`[CHAT] ${msg.payload.displayName}: ${msg.payload.message}`)
  } else if (msg.type === "state") {
    console.log(`[STATE] Live: ${msg.payload.isLive}, Participants: ${msg.payload.participants?.length || 0}`)
  } else {
    console.log(`[${msg.type}]`, JSON.stringify(msg).slice(0, 200))
  }
})

ws.on("error", (err) => {
  console.error("WebSocket error:", err.message)
})

ws.on("close", (code, reason) => {
  console.log(`Connection closed: ${code} ${reason}`)
})
