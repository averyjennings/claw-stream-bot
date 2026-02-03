export interface StreamConfig {
  twitch: TwitchConfig
  obs: OBSConfig
  openclaw: OpenClawConfig
  vision: VisionConfig
  server: ServerConfig
}

export interface TwitchConfig {
  username: string
  oauthToken: string
  channel: string
}

export interface OBSConfig {
  websocketUrl: string
  password: string
}

export interface OpenClawConfig {
  gatewayUrl: string
}

export interface VisionConfig {
  screenshotIntervalMs: number
  screenshotWidth: number
  screenshotHeight: number
  screenshotFormat: "png" | "jpg" | "webp"
  screenshotQuality: number
}

export interface ServerConfig {
  port: number
}

export interface StreamFrame {
  timestamp: number
  imageBase64: string
  format: string
  width: number
  height: number
}

export interface ChatMessage {
  timestamp: number
  username: string
  displayName: string
  message: string
  channel: string
  isMod: boolean
  isSubscriber: boolean
  badges: Record<string, string>
}

export interface ClawParticipant {
  id: string
  name: string
  sessionId: string
  joinedAt: number
  lastSeen: number
}

export interface StreamState {
  isLive: boolean
  currentFrame: StreamFrame | null
  recentChat: ChatMessage[]
  participants: ClawParticipant[]
  streamStartedAt: number | null
}

export interface ClawMessage {
  type: "chat" | "reaction" | "observation"
  content: string
  clawId: string
  clawName: string
  timestamp: number
}

export interface VisionBroadcast {
  type: "frame" | "chat" | "state"
  payload: StreamFrame | ChatMessage | StreamState
  timestamp: number
}
