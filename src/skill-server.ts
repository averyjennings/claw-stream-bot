/**
 * Skill Server for OpenClaw Integration
 *
 * This provides HTTP endpoints that OpenClaw skills can call
 * to interact with the stream vision system.
 *
 * Run alongside the main vision server, or integrate into it.
 */

import express from "express"
import { ClawStreamClient } from "./claw-client.js"
import type { StreamFrame, ChatMessage, ClawParticipant } from "./types.js"

const app = express()
app.use(express.json())

// Store for connected claw sessions
const sessions: Map<
  string,
  {
    client: ClawStreamClient
    latestFrame: StreamFrame | null
    chatHistory: ChatMessage[]
  }
> = new Map()

const VISION_SERVER_URL = process.env.VISION_SERVER_URL ?? "ws://localhost:3847"
const SKILL_SERVER_PORT = parseInt(process.env.SKILL_SERVER_PORT ?? "3848", 10)

/**
 * POST /connect
 * Connect a claw to the stream
 */
app.post("/connect", async (req, res) => {
  const { session_id, server_url, claw_name } = req.body as {
    session_id: string
    server_url?: string
    claw_name?: string
  }

  if (!session_id) {
    res.status(400).json({ error: "session_id required" })
    return
  }

  // Clean up existing session if any
  const existing = sessions.get(session_id)
  if (existing) {
    await existing.client.disconnect()
  }

  const client = new ClawStreamClient({
    serverUrl: server_url ?? VISION_SERVER_URL,
    clawId: session_id,
    clawName: claw_name ?? `Claw-${session_id.slice(0, 8)}`,
  })

  const session = {
    client,
    latestFrame: null as StreamFrame | null,
    chatHistory: [] as ChatMessage[],
  }

  // Wire up handlers
  client.onFrame((frame) => {
    session.latestFrame = frame
  })

  client.onChat((msg) => {
    session.chatHistory.push(msg)
    // Keep last 100 messages
    if (session.chatHistory.length > 100) {
      session.chatHistory.shift()
    }
  })

  await client.connect().catch((err: unknown) => {
    res.status(500).json({ error: `Connection failed: ${err}` })
    return
  })

  sessions.set(session_id, session)

  res.json({
    success: true,
    message: `Connected to stream as ${claw_name ?? session_id}`,
    server_url: server_url ?? VISION_SERVER_URL,
  })
})

/**
 * POST /get_frame
 * Get the latest screenshot as base64
 */
app.post("/get_frame", (req, res) => {
  const { session_id } = req.body as { session_id: string }

  const session = sessions.get(session_id)
  if (!session) {
    res.status(404).json({ error: "Not connected. Call /connect first." })
    return
  }

  if (!session.latestFrame) {
    res.status(404).json({ error: "No frame available yet. Wait a few seconds." })
    return
  }

  // Return frame as base64 image data URL that vision models can process
  const dataUrl = `data:image/${session.latestFrame.format};base64,${session.latestFrame.imageBase64}`

  res.json({
    success: true,
    timestamp: session.latestFrame.timestamp,
    width: session.latestFrame.width,
    height: session.latestFrame.height,
    format: session.latestFrame.format,
    image: dataUrl,
  })
})

/**
 * POST /send_chat
 * Send a message to the stream chat
 */
app.post("/send_chat", async (req, res) => {
  const { session_id, message } = req.body as {
    session_id: string
    message: string
  }

  const session = sessions.get(session_id)
  if (!session) {
    res.status(404).json({ error: "Not connected. Call /connect first." })
    return
  }

  if (!message) {
    res.status(400).json({ error: "message required" })
    return
  }

  await session.client.sendChat(message)

  res.json({
    success: true,
    message: `Sent: ${message}`,
  })
})

/**
 * POST /get_chat_history
 * Get recent chat messages
 */
app.post("/get_chat_history", (req, res) => {
  const { session_id, limit = 20 } = req.body as {
    session_id: string
    limit?: number
  }

  const session = sessions.get(session_id)
  if (!session) {
    res.status(404).json({ error: "Not connected. Call /connect first." })
    return
  }

  const messages = session.chatHistory.slice(-limit).map((m) => ({
    username: m.displayName,
    message: m.message,
    timestamp: m.timestamp,
  }))

  res.json({
    success: true,
    messages,
  })
})

/**
 * POST /get_participants
 * Get list of claws watching the stream
 */
app.post("/get_participants", async (req, res) => {
  const { session_id } = req.body as { session_id: string }

  const session = sessions.get(session_id)
  if (!session) {
    res.status(404).json({ error: "Not connected. Call /connect first." })
    return
  }

  // Fetch from vision server
  const stateRes = await fetch(`http://localhost:3847/state`).catch(() => null)
  if (!stateRes) {
    res.status(500).json({ error: "Could not fetch participants" })
    return
  }

  const state = (await stateRes.json()) as { participants: ClawParticipant[] }

  res.json({
    success: true,
    participants: state.participants.map((p) => ({
      name: p.name,
      joined_at: new Date(p.joinedAt).toISOString(),
    })),
  })
})

/**
 * POST /disconnect
 * Disconnect from the stream
 */
app.post("/disconnect", async (req, res) => {
  const { session_id } = req.body as { session_id: string }

  const session = sessions.get(session_id)
  if (!session) {
    res.status(404).json({ error: "Not connected" })
    return
  }

  await session.client.disconnect()
  sessions.delete(session_id)

  res.json({
    success: true,
    message: "Disconnected from stream",
  })
})

/**
 * GET /health
 * Health check
 */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    active_sessions: sessions.size,
  })
})

// Start server
app.listen(SKILL_SERVER_PORT, () => {
  console.log(`🦀 Stream Vision Skill Server running on port ${SKILL_SERVER_PORT}`)
  console.log(`   Vision Server: ${VISION_SERVER_URL}`)
  console.log(`   Endpoints:`)
  console.log(`   - POST /connect`)
  console.log(`   - POST /get_frame`)
  console.log(`   - POST /send_chat`)
  console.log(`   - POST /get_chat_history`)
  console.log(`   - POST /get_participants`)
  console.log(`   - POST /disconnect`)
})
