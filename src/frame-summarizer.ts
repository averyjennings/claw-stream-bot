import Anthropic from "@anthropic-ai/sdk"
import type { StreamFrame } from "./types.js"

const FRAME_SUMMARY_PROMPT = `You are analyzing a livestream screenshot. Extract ALL details visible in this frame.

Provide a comprehensive description covering:

**SCENE & SETTING:**
- Location/environment (room, outdoors, game world, etc.)
- Lighting, colors, overall atmosphere
- Any notable background elements

**PEOPLE (if visible):**
- Number of people, their positions
- Clothing, accessories, expressions
- What they appear to be doing
- Body language and gestures

**SCREEN CONTENT (if showing a game/app/desktop):**
- What application/game is visible
- Current activity or game state
- Any UI elements, menus, scores, health bars
- Progress indicators or status displays

**TEXT & GRAPHICS:**
- Any readable text (signs, chat, subtitles, overlays)
- Logos, usernames, watermarks
- Stream overlays, alerts, notifications
- Chat messages visible on screen

**ACTION & CONTEXT:**
- What's happening RIGHT NOW in this moment
- Any movement or action captured
- Emotional tone of the scene

Be detailed but concise. Focus on observable facts. Write in present tense as if describing what's happening live.`

export class FrameSummarizer {
  private anthropic: Anthropic | null = null
  private enabled = false
  private isSummarizing = false
  private lastSummary = ""

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey })
      this.enabled = true
      console.log("[FrameSummarizer] Enabled - frames will include AI descriptions")
    } else {
      console.log("[FrameSummarizer] Disabled - no ANTHROPIC_API_KEY set")
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  async summarizeFrame(frame: StreamFrame): Promise<string> {
    if (!this.enabled || !this.anthropic) {
      return ""
    }

    // Don't double-summarize while one is in progress
    if (this.isSummarizing) {
      return this.lastSummary
    }

    this.isSummarizing = true

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: `image/${frame.format}` as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
                data: frame.imageBase64,
              },
            },
            {
              type: "text",
              text: FRAME_SUMMARY_PROMPT,
            }
          ],
        }],
      })

      const textBlock = response.content.find((b) => b.type === "text")
      const summary = textBlock && textBlock.type === "text" ? textBlock.text : ""

      this.lastSummary = summary
      return summary
    } catch (err) {
      console.error("[FrameSummarizer] Error:", err)
      return this.lastSummary // Return last good summary on error
    } finally {
      this.isSummarizing = false
    }
  }

  getLastSummary(): string {
    return this.lastSummary
  }
}
