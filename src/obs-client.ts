import OBSWebSocket from "obs-websocket-js"
import type { OBSConfig, VisionConfig, StreamFrame } from "./types.js"

export class OBSClient {
  private obs: OBSWebSocket
  private config: OBSConfig
  private visionConfig: VisionConfig
  private connected = false

  constructor(config: OBSConfig, visionConfig: VisionConfig) {
    this.obs = new OBSWebSocket()
    this.config = config
    this.visionConfig = visionConfig
  }

  async connect(): Promise<void> {
    console.log(`[OBS] Connecting to ${this.config.websocketUrl}...`)

    const connectOptions: { password?: string } = {}
    if (this.config.password) {
      connectOptions.password = this.config.password
    }

    await this.obs.connect(this.config.websocketUrl, this.config.password || undefined)
    this.connected = true
    console.log("[OBS] Connected successfully")

    this.obs.on("ConnectionClosed", () => {
      console.log("[OBS] Connection closed")
      this.connected = false
    })

    this.obs.on("ConnectionError", (err) => {
      console.error("[OBS] Connection error:", err)
      this.connected = false
    })
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.obs.disconnect()
      this.connected = false
      console.log("[OBS] Disconnected")
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  async captureScreenshot(): Promise<StreamFrame | null> {
    if (!this.connected) {
      console.warn("[OBS] Not connected, cannot capture screenshot")
      return null
    }

    // First get the current scene name
    const sceneName = await this.getCurrentSceneName()
    if (!sceneName) {
      console.warn("[OBS] Could not get current scene name")
      return null
    }

    const response = await this.obs.call("GetSourceScreenshot", {
      sourceName: sceneName,
      imageFormat: this.visionConfig.screenshotFormat,
      imageWidth: this.visionConfig.screenshotWidth,
      imageHeight: this.visionConfig.screenshotHeight,
      imageCompressionQuality: this.visionConfig.screenshotQuality,
    }).catch((err: unknown) => {
      console.error("[OBS] Screenshot failed:", err)
      return null
    })

    if (!response) {
      return null
    }

    // Response contains imageData as base64 data URI
    const imageBase64 = response.imageData.replace(
      /^data:image\/\w+;base64,/,
      ""
    )

    return {
      timestamp: Date.now(),
      imageBase64,
      format: this.visionConfig.screenshotFormat,
      width: this.visionConfig.screenshotWidth,
      height: this.visionConfig.screenshotHeight,
    }
  }

  async getCurrentSceneName(): Promise<string | null> {
    if (!this.connected) {
      return null
    }

    const response = await this.obs.call("GetCurrentProgramScene").catch((err: unknown) => {
      console.error("[OBS] Failed to get current scene:", err)
      return null
    })

    return response?.sceneName ?? null
  }

  async getStreamStatus(): Promise<{ isStreaming: boolean; isRecording: boolean } | null> {
    if (!this.connected) {
      return null
    }

    const response = await this.obs.call("GetStreamStatus").catch((err: unknown) => {
      console.error("[OBS] Failed to get stream status:", err)
      return null
    })

    if (!response) {
      return null
    }

    return {
      isStreaming: response.outputActive,
      isRecording: false, // Would need separate call for recording status
    }
  }
}
