#!/usr/bin/env npx tsx
/**
 * Twitch OAuth Token Helper
 *
 * This script helps you get OAuth tokens for the Claw Stream Vision bot.
 *
 * Option 1: Quick setup using Twitch Token Generator (recommended for today)
 * Option 2: Register your own app for production use
 */

import { createServer } from "http"
import { URL } from "url"
import { config } from "dotenv"

config()

const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/authorize"
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"

// Chat scopes needed for the bot
const SCOPES = [
  "chat:read", // Read chat messages
  "chat:edit", // Send chat messages
  "user:read:chat", // Read chat as user
  "user:write:chat", // Write chat as user
].join(" ")

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string[]
  token_type: string
}

async function quickSetup(): Promise<void> {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║           QUICK SETUP - Twitch Token Generator                     ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  1. Go to: https://twitchtokengenerator.com/                       ║
║                                                                    ║
║  2. Select these scopes:                                           ║
║     ✓ chat:read                                                    ║
║     ✓ chat:edit                                                    ║
║                                                                    ║
║  3. Click "Generate Token!"                                        ║
║                                                                    ║
║  4. Log in with your BOT account (not your main account!)          ║
║                                                                    ║
║  5. Copy the "ACCESS TOKEN" and add to .env:                       ║
║     TWITCH_OAUTH_TOKEN=oauth:YOUR_TOKEN_HERE                       ║
║                                                                    ║
║  ⚠️  Note: Tokens expire after 4 hours. For the convention,        ║
║      generate a fresh token right before going live.               ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
`)
}

async function registerAppSetup(): Promise<void> {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║           PRODUCTION SETUP - Register Your Own App                 ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Step 1: Register at Twitch Developer Console                      ║
║  ─────────────────────────────────────────────                     ║
║  1. Go to: https://dev.twitch.tv/console                           ║
║  2. Log in with your Twitch account                                ║
║  3. Enable 2FA if not already enabled                              ║
║  4. Click "Applications" → "Register Your Application"             ║
║                                                                    ║
║  Step 2: Fill in App Details                                       ║
║  ───────────────────────────                                       ║
║  • Name: ClawStreamVision (or similar - no "Twitch" in name!)      ║
║  • OAuth Redirect URL: http://localhost:3000/callback              ║
║  • Category: Chat Bot                                              ║
║  • Click "Create"                                                  ║
║                                                                    ║
║  Step 3: Get Credentials                                           ║
║  ───────────────────────                                           ║
║  1. Click "Manage" on your new app                                 ║
║  2. Copy the "Client ID"                                           ║
║  3. Click "New Secret" and copy the secret                         ║
║                                                                    ║
║  Step 4: Add to .env                                               ║
║  ─────────────────                                                 ║
║  TWITCH_CLIENT_ID=your_client_id                                   ║
║  TWITCH_CLIENT_SECRET=your_client_secret                           ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
`)
}

async function startOAuthFlow(): Promise<void> {
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error("❌ Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in .env")
    console.log("   Run this script with --register for setup instructions\n")
    process.exit(1)
  }

  const redirectUri = "http://localhost:3000/callback"

  const authUrl = new URL(TWITCH_AUTH_URL)
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", SCOPES)

  console.log("\n🔐 Starting OAuth flow...")
  console.log("\n📱 Open this URL in your browser (logged into your BOT account):\n")
  console.log(`   ${authUrl.toString()}\n`)

  // Start local server to catch callback
  const server = createServer(async (req, res) => {
    if (!req.url?.startsWith("/callback")) {
      res.writeHead(404)
      res.end("Not found")
      return
    }

    const url = new URL(req.url, "http://localhost:3000")
    const code = url.searchParams.get("code")
    const error = url.searchParams.get("error")

    if (error) {
      res.writeHead(400)
      res.end(`Error: ${error}`)
      console.error(`\n❌ Authorization failed: ${error}`)
      server.close()
      process.exit(1)
    }

    if (!code) {
      res.writeHead(400)
      res.end("No code received")
      return
    }

    // Exchange code for token
    console.log("📥 Received authorization code, exchanging for token...")

    const tokenResponse = await fetch(TWITCH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      res.writeHead(500)
      res.end(`Token exchange failed: ${errorText}`)
      console.error(`\n❌ Token exchange failed: ${errorText}`)
      server.close()
      process.exit(1)
    }

    const tokens = (await tokenResponse.json()) as TokenResponse

    res.writeHead(200, { "Content-Type": "text/html" })
    res.end(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>✅ Success!</h1>
          <p>You can close this window and return to the terminal.</p>
        </body>
      </html>
    `)

    console.log("\n✅ Token obtained successfully!\n")
    console.log("Add these to your .env file:\n")
    console.log(`TWITCH_OAUTH_TOKEN=oauth:${tokens.access_token}`)
    console.log(`TWITCH_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log(`\n⏰ Token expires in: ${Math.round(tokens.expires_in / 3600)} hours`)
    console.log("   Store the refresh token to get new access tokens later.\n")

    server.close()
    process.exit(0)
  })

  server.listen(3000, () => {
    console.log("🌐 Waiting for authorization callback on http://localhost:3000/callback ...")
  })
}

// Main
const args = process.argv.slice(2)

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Twitch OAuth Token Helper

Usage:
  npx tsx scripts/get-twitch-token.ts [option]

Options:
  --quick      Show quick setup instructions using twitchtokengenerator.com
  --register   Show instructions for registering your own Twitch app
  --auth       Start OAuth flow (requires TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET)
  --help       Show this help message

For Claw Con tomorrow, use --quick for fastest setup!
`)
} else if (args.includes("--quick")) {
  quickSetup()
} else if (args.includes("--register")) {
  registerAppSetup()
} else if (args.includes("--auth")) {
  startOAuthFlow()
} else {
  // Default: show quick setup
  console.log("💡 Tip: Run with --help to see all options\n")
  quickSetup()
}
