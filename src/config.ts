import { config } from "dotenv"
import type { StreamConfig } from "./types.js"

config()

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue
}

function optionalEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name]
  if (!value) {
    return defaultValue
  }
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable ${name}: ${value}`)
  }
  return parsed
}

export function loadConfig(): StreamConfig {
  return {
    twitch: {
      username: requireEnv("TWITCH_USERNAME"),
      oauthToken: requireEnv("TWITCH_OAUTH_TOKEN"),
      channel: requireEnv("TWITCH_CHANNEL"),
    },
    obs: {
      websocketUrl: optionalEnv("OBS_WEBSOCKET_URL", "ws://127.0.0.1:4455"),
      password: optionalEnv("OBS_WEBSOCKET_PASSWORD", ""),
    },
    openclaw: {
      gatewayUrl: optionalEnv("OPENCLAW_GATEWAY_URL", "ws://127.0.0.1:18789"),
    },
    vision: {
      screenshotIntervalMs: optionalEnvNumber("SCREENSHOT_INTERVAL_MS", 5000),
      screenshotWidth: optionalEnvNumber("SCREENSHOT_WIDTH", 1280),
      screenshotHeight: optionalEnvNumber("SCREENSHOT_HEIGHT", 720),
      screenshotFormat: optionalEnv("SCREENSHOT_FORMAT", "png") as
        | "png"
        | "jpg"
        | "webp",
      screenshotQuality: optionalEnvNumber("SCREENSHOT_QUALITY", 80),
    },
    server: {
      port: optionalEnvNumber("VISION_SERVER_PORT", 3847),
    },
  }
}
