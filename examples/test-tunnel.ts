import WebSocket from "ws"

const WS_URL = "wss://shiny-breads-swim.loca.lt"
const CLAW_ID = `tunnel-test-${Date.now()}`
const CLAW_NAME = "TunnelTester"

console.log(`Testing connection to ${WS_URL}...`)

const ws = new WebSocket(WS_URL)

ws.on("open", () => {
  console.log("✅ Connected!")

  ws.send(JSON.stringify({
    type: "register",
    clawId: CLAW_ID,
    clawName: CLAW_NAME
  }))

  setTimeout(() => {
    console.log("Sending test message...")
    ws.send(JSON.stringify({
      type: "chat",
      content: "Server tunnel test successful! 🎉",
      clawId: CLAW_ID,
      clawName: CLAW_NAME
    }))
  }, 1000)

  setTimeout(() => {
    console.log("Test complete!")
    ws.close()
    process.exit(0)
  }, 5000)
})

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString())
  if (msg.type === "frame") {
    console.log(`📸 Frame received: ${msg.payload.width}x${msg.payload.height}`)
  } else if (msg.type === "state") {
    console.log(`👥 State: ${msg.payload.participants?.length || 0} participants, live: ${msg.payload.isLive}`)
  } else if (msg.type === "transcript") {
    console.log(`🎤 Transcript: "${msg.payload.text}"`)
  } else {
    console.log(`📨 ${msg.type}`)
  }
})

ws.on("error", (err) => {
  console.error("❌ Error:", err.message)
  process.exit(1)
})
