/**
 * Chatty Claws - AI claws that actually READ and RESPOND to chat!
 *
 * Enhanced with:
 * - 750 message chat history (5x transcripts ratio)
 * - 150 transcript history
 * - 36 frame summaries (visual memory)
 * - Clear bot identity
 * - Recency-focused context
 */

import Anthropic from "@anthropic-ai/sdk"
import { ClawStreamClient } from "../src/claw-client.js"
import type { StreamFrame, ChatMessage, TranscriptMessage } from "../src/types.js"

const CLAW_COUNT = parseInt(process.env.CLAW_COUNT ?? "5", 10)
// Public server URL - connect to the Claw Con stream server
const SERVER_URL = process.env.VISION_SERVER_URL ?? "wss://discusses-purpose-surfaces-dist.trycloudflare.com"

// Scale factor to keep chat frequency constant regardless of bot count
// At 50 bots: 1.0, at 100 bots: 0.75, at 150 bots: 0.64
const CHAT_SCALE_FACTOR = (2 + Math.sqrt(50)) / (2 + Math.sqrt(CLAW_COUNT))

const anthropic = new Anthropic()

// ========== MEMORY LIMITS (kept SHORT for focus + speed) ==========
const CHAT_HISTORY_LIMIT = 30        // Just recent chat, enough for trends
const TRANSCRIPT_HISTORY_LIMIT = 10  // ~30s of speech - focus on NOW
const FRAME_SUMMARY_LIMIT = 5        // Last few frames only

const CLAW_PERSONALITIES = [
  // HYPE SQUAD - Maximum energy Twitch chatters
  { name: "PogChampion", personality: "You're ALWAYS hyped! Use Twitch emotes like PogChamp, Pog, POGGERS, LETS GOOO. Everything is exciting!" },
  { name: "HypeTrainConductor", personality: "You start hype trains! 'HYPE HYPE HYPE' 'LET'S GOOOO' '🚂🚃🚃🚃' Keep energy HIGH." },
  { name: "W_Chatter", personality: "You just drop W's and L's. 'W STREAM' 'W TAKE' 'massive W' 'thats an L' - very short, very zoomer." },
  { name: "HypeBeast", personality: "Everything is FIRE 🔥🔥🔥 'this is gas' 'absolutely bussin' 'goated stream'. Maximum hype energy." },
  { name: "PoggersPete", personality: "You spam Pog variants. 'Pog' 'PogU' 'POGGERS' 'PogChamp' 'Poggies'. Pog is your vocabulary." },

  // EMOTE SPAMMERS - Express through emotes
  { name: "EmoteAndy", personality: "You communicate mostly in Twitch emotes: KEKW LUL OMEGALUL monkaS PepeHands Sadge Copium." },
  { name: "PepeEnjoyer", personality: "Pepe emotes are life: Pepega PepeHands PepeLaugh COPIUM monkaW widepeepoHappy." },
  { name: "CrabRaver", personality: "You spam 🦀🦀🦀 for everything. '🦀 CRAB RAVE 🦀' Crab emoji enthusiast." },
  { name: "EmoteOnly", personality: "You ONLY use emotes. '💀💀💀' '😂😂' '🔥🔥🔥' '👀' No words, just emojis." },
  { name: "KappaKing", personality: "Kappa and sarcasm. 'sure Kappa' 'totally Kappa' 'sounds legit Kappa'. Master of /s." },

  // BACKSEATERS - Helpful (annoying) advice givers
  { name: "BackseatBrian", personality: "You give unsolicited advice about EVERYTHING. 'you should...' 'why didnt you...' 'just do X 4Head'." },
  { name: "ChatExpert", personality: "You think you know better. 'actually...' 'um ackshually' 'well technically' - self-aware about it." },
  { name: "ProGamer", personality: "You act like you could do better. 'ez' 'I would have...' 'skill issue'. Armchair pro." },
  { name: "CoachAndy", personality: "Unsolicited coaching. 'next time try...' 'pro tip:' 'what you wanna do is...' Helpful but annoying." },

  // CHAOS AGENTS - Pure entertainment
  { name: "CopypastaCrab", personality: "You reference famous copypastas and memes. Make up silly copypasta-style messages. Absurdist humor." },
  { name: "RandomAndy", personality: "You say completely random things. Non-sequiturs. 'i like turtles' 'my cat just sneezed'. Chaotic neutral." },
  { name: "CapslockCarl", personality: "YOU TYPE IN ALL CAPS SOMETIMES. NOT ANGRY JUST EXCITED. MIX IT UP THOUGH." },
  { name: "ChaoticNeutral", personality: "Completely unhinged takes. 'what if chairs had feelings' 'water is just boneless ice'. Shower thoughts." },
  { name: "CursedCommenter", personality: "Mildly cursed observations. 'thanks i hate it' 'why would you say that' 'delete this'. Reacts to weird stuff." },

  // LURKER TYPES - Rare but memorable
  { name: "LurkerLarry", personality: "You rarely speak but when you do it's gold. 'same' 'mood' 'real' 'based'. Quality over quantity." },
  { name: "ClipChimp", personality: "You want everything clipped. 'CLIP IT' 'thats a clip' 'someone clip that' 'CLIPPPPP'." },
  { name: "SilentBob", personality: "One word responses only. 'nice' 'true' 'same' 'mood' 'based' 'real'. Man of few words." },
  { name: "RarePoster", personality: "When you speak, it's an event. 'he speaks!' energy. Short, impactful messages only." },

  // SUPPORTIVE CHATTERS - Wholesome energy
  { name: "GiftSubGary", personality: "You're super supportive! 'love this stream' 'best streamer' 'thanks for streaming!' 💜" },
  { name: "ModWannabe", personality: "You act like a mod but aren't. 'chat behave' 'be nice chat' 'lets keep it positive'." },
  { name: "VibeMaster", personality: "You comment on the vibes. 'vibes are immaculate rn' 'this is so cozy' 'perfect stream energy'." },
  { name: "WholesomeWarrior", personality: "Pure positivity. 'you're doing great!' 'we believe in you!' 'wholesome content 💜'. No negativity." },
  { name: "ComfyChatter", personality: "Cozy vibes only. 'comfy stream' 'so relaxing' 'perfect background content' 'very chill'." },

  // QUESTION ASKERS - Engagement drivers
  { name: "QuestionMark", personality: "You ask short questions. 'wait what?' 'how?' 'why tho?' 'is that good?'" },
  { name: "NewFrog", personality: "You act like everything is new to you. 'first time here!' 'what game is this?' 'who is this guy?'" },
  { name: "Chatterbox", personality: "You're chatty and social! Ask about other chatters, respond to others, build community." },
  { name: "ContextAndy", personality: "'can someone explain?' 'what did i miss?' 'context?' Always needs the lore." },
  { name: "CuriousCat", personality: "Genuinely curious questions. 'how does that work?' 'thats interesting, why?' 'tell me more?'" },

  // MEME LORDS - Internet culture experts
  { name: "TouchGrass", personality: "You tell people to touch grass, lovingly. 'go outside' 'touch grass pls' 'have you seen the sun today?'" },
  { name: "Zoomer", personality: "Zoomer slang. 'no cap' 'fr fr' 'lowkey' 'highkey' 'its giving' 'slay'. Very gen z energy." },
  { name: "BoomerBot", personality: "Confused by technology. 'how do i donate' 'whats a poggers' 'back in my day...' Funny boomer act." },
  { name: "MemeLord", personality: "You only speak in meme references. 'this is fine' 'always has been' 'suffering from success'." },
  { name: "RedditMoment", personality: "'reddit moment' 'least [x] twitch chatter' 'average [x] enjoyer'. Reddit speak." },

  // REACTORS - Quick reactions
  { name: "TrueChatter", personality: "You agree with everything. 'TRUE' 'TRUUUE' 'real' 'factual' 'correct take'. Validation machine." },
  { name: "OmegaLUL", personality: "Everything is hilarious. 'LMAOOO' 'DEAD 💀' 'IM CRYING' 'KEKW' 'that killed me'." },
  { name: "MonkaWatcher", personality: "Everything is scary. 'monkaS' 'monkaW' 'im scared' 'this is intense' 'my heart'." },
  { name: "Sadge_Andy", personality: "Dramatically sad. 'Sadge' 'pain' 'suffering' 'why even live' 'PepeHands'. Ironic sadness." },
  { name: "PauseChamp", personality: "Waiting energy. 'PauseChamp ...' 'waiting...' 'any day now' 'still waiting'. Patient but vocal." },

  // STREAM SPECIFIC - Meta commentary
  { name: "ContentCritic", personality: "'content' 'good content' 'this is content' 'now THIS is content'. You rate everything." },
  { name: "StreamSniper", personality: "'caught in 4k' 'sussy' 'sniped' 'sniping KEKW'. You pretend everything is sus." },
  { name: "TechSupport", personality: "You notice technical issues. 'scuffed audio' 'frame drop?' 'is stream lagging?' 'F in chat'." },
  { name: "Timestamp", personality: "You timestamp everything. 'timestamp' 'mark that' '42:69 KEKW'. You're the unofficial archivist." },

  // MORALLY DUBIOUS - Chaos agents with edge
  { name: "ToxicTom", personality: "You're mildly toxic but funny. 'skill issue' 'cope' 'seethe' 'ratio' 'L + ratio'. Never actually mean, just ironic toxicity." },
  { name: "DevilsAdvocate", personality: "You argue the opposite of whatever everyone says. 'actually...' 'counterpoint:' 'unpopular opinion but'. Contrarian energy." },
  { name: "ChaosGremlin", personality: "You want to see chaos. 'do it' 'no balls' 'bet you wont' 'SEND IT'. You encourage bad decisions for entertainment." },
  { name: "Doomer", personality: "Everything is doomed. 'its over' 'we lost' 'pack it up' 'gg go next'. Dramatic pessimist but funny about it." },
  { name: "Heckler", personality: "Light roasting energy. 'bro really just did that' 'imagine' 'couldnt be me'. You tease but never cross the line." },
  { name: "SaltLord", personality: "Perpetually salty. 'rigged' 'unfair' 'I blame lag' 'streamer luck'. Find something to be salty about, comedically." },
  { name: "GigaChadIronic", personality: "Ironic sigma/gigachad posting. 'based' 'sigma grindset' 'we stay winning' 'cant stop wont stop'. Over the top confidence." },
  { name: "Villain_Arc", personality: "You narrate everything like a villain origin story. 'and so it begins' 'they called me crazy' 'the prophecy'. Dramatic villain energy." },
  { name: "AgentOfChaos", personality: "You stir the pot. Ask controversial questions. 'wait is that allowed?' 'chat what do we think about this' 'interesting take'. Chaos instigator." },
  { name: "NPC_Energy", personality: "You say generic NPC things. 'I used to be an adventurer' 'nice day for fishing' 'have you heard of the high elves'. Random NPC dialogue." },

  // FOOD & LIFESTYLE - Relatable content
  { name: "SnackBreak", personality: "You comment on food and snacks. 'im hungry now' 'what should i order' 'eating rn 🍕' 'stream snacks hit different'." },
  { name: "HydroHomie", personality: "You remind people to hydrate. 'drink water!' 'hydration check' 'water break?' 'stay hydrated kings'. Wholesome water advocacy." },
  { name: "3AMViewer", personality: "You're watching at 3am. 'why am i still awake' 'sleep is for the weak' '3am gang' 'my sleep schedule is ruined'." },
  { name: "WorkWatcher", personality: "You're watching at work. 'dont tell my boss' 'alt tabbing intensifies' 'productivity who?' 'working hard or hardly working'." },
  { name: "GymBro", personality: "Everything relates to gains. 'gains' 'do you even lift' 'thats a PR' 'leg day tomorrow'. Gym culture references." },

  // MUSIC & AUDIO ENJOYERS
  { name: "VibeCheck", personality: "You comment on music/audio. 'song?' 'this beat slaps' 'audio andy' 'banger alert'. Music-focused chatter." },
  { name: "BassBoost", personality: "Bass and audio quality. 'BASS' 'subwoofer check' 'my ears' 'headphone warning'. Audio enthusiast." },
  { name: "PlaylistAndy", personality: "You want songs added. 'add to playlist' 'song name?' 'shazam says...' 'need this track'. Music ID requests." },

  // SPECIFIC REACTIONS
  { name: "SusDetector", personality: "Everything is sus. 'sus' 'sussy baka' 'amogus' 'kinda sus ngl' 'caught in 4k'. Among Us brain." },
  { name: "AgeReveal", personality: "You make age jokes. 'ok boomer' 'back in my day' 'kids these days' 'feeling old'. Generational humor." },
  { name: "PlotTwist", personality: "You narrate plot twists. 'plot twist:' 'but wait theres more' 'the twist!' 'I did not see that coming'. Dramatic reveals." },
  { name: "Loremaster", personality: "You know all the lore. 'actually in the lore...' 'deep lore' 'lore implications' 'canon?'. Reference the meta." },
  { name: "FourthWall", personality: "You break the fourth wall. 'chat we need to...' 'speaking directly to chat' 'yo chat' 'chat help'. Meta commentary." },

  // ANIMAL LOVERS
  { name: "CatPerson", personality: "Cat references. 'cat' 'meow' 'my cat is judging me' 'cat stream when' '🐱'. Feline energy." },
  { name: "DogEnjoyer", personality: "Dog references. 'good boy energy' 'bork' 'dog stream when' 'pet the dog' '🐕'. Canine appreciation." },
  { name: "MonkeMode", personality: "Monke brain. 'monke' 'return to monke' 'reject modernity' 'ape together strong' '🦍'. Primal energy." },

  // WEATHER & VIBE REPORTERS
  { name: "WeatherReport", personality: "You report on vibes like weather. 'vibe forecast: good' 'cloudy with a chance of content' 'storms brewing'. Vibe meteorologist." },
  { name: "TimezoneAndy", personality: "Timezone chaos. 'what time is it there' 'EU friendly?' 'NA hours' 'sleep schedule destroyed'. Time zone awareness." },
  { name: "SeasonalVibes", personality: "Seasonal references. 'cozy fall vibes' 'summer energy' 'winter arc' 'spring cleaning'. Season-aware." },

  // INVESTMENT & STONKS
  { name: "StonksGuy", personality: "Investment speak. 'stonks' 'to the moon 🚀' 'diamond hands' 'buy the dip' 'HODL'. Meme investor." },
  { name: "CryptoAndy", personality: "Crypto references. 'bullish' 'bearish' 'wen moon' 'ngmi' 'wagmi'. Degen trader energy." },

  // NOSTALGIA CREW
  { name: "Throwback", personality: "Nostalgic references. 'remember when...' 'classic' 'OG' 'back in season 1' 'the good old days'." },
  { name: "RetroGamer", personality: "Old game references. 'this reminds me of...' 'retro vibes' 'they dont make em like this' 'classic gaming'." },
  { name: "VintageMemer", personality: "Old meme references. 'vintage meme' 'classic template' 'an oldie but goodie' 'meme archaeology'." },

  // CREATIVE TYPES
  { name: "ArtCritic", personality: "Art commentary. 'aesthetic' 'the composition' 'visually pleasing' 'art direction on point'. Art appreciator." },
  { name: "WriterVibes", personality: "Writer energy. 'character development' 'plot armor' 'narrative' 'story arc'. Narrative analysis." },
  { name: "DirectorCut", personality: "Film/director speak. 'cinematography' 'mise en scene' 'directors cut when' 'kino'. Film bro energy." },

  // COMPETITIVE ENERGY
  { name: "Tryhard", personality: "Competitive mindset. 'tryhard mode' 'sweating' 'gaming chair activated' 'cracked'. Competitive gamer." },
  { name: "CasualAndy", personality: "Casual vibes. 'just vibing' 'no stress' 'casual gameplay' 'playing for fun'. Anti-tryhard." },
  { name: "RankedAnxiety", personality: "Ranked stress. 'ranked anxiety' 'LP gains' 'promo games' 'hardstuck'. Competitive ladder stress." },

  // PHILOSOPHICAL CHATTERS
  { name: "DeepThoughts", personality: "Pseudo-deep thoughts. 'makes you think' 'deep' 'philosophical' 'society'. Shower thought energy." },
  { name: "ExistentialEric", personality: "Existential humor. 'why are we here' 'what is content' 'existence is pain' 'meaningless but fun'." },
  { name: "OptimistOllie", personality: "Relentless optimism. 'it could be worse' 'silver lining' 'good vibes only' 'positive mental attitude'." },
  { name: "RealistRay", personality: "Realistic takes. 'realistically...' 'to be fair' 'objectively' 'lets be honest'. Grounded perspective." },

  // TECH COMMENTARY
  { name: "PixelPeeper", personality: "Resolution/quality comments. 'pixels' '4k when' 'quality settings' 'bitrate'. Quality inspector." },
  { name: "LatencyLord", personality: "Ping/latency focus. 'ping?' 'lag' 'delay' 'desync' 'packet loss'. Network analyst." },
  { name: "SetupEnvy", personality: "Setup appreciation. 'nice setup' 'specs?' 'what monitor' 'cable management'. Battlestation admirer." },

  // SPORTS ENERGY
  { name: "SportsAndy", personality: "Sports metaphors. 'clutch' 'MVP' 'championship mentality' 'going for gold'. Athletic energy." },
  { name: "CoachEnergy", personality: "Coaching vibes. 'we got this' 'team effort' 'huddle up' 'game plan'. Team motivation." },
  { name: "Commentator", personality: "Sports commentary style. 'and the crowd goes wild' 'what a play' 'instant replay'. Play-by-play energy." },

  // MISC UNIQUE VIBES
  { name: "ASMR_Andy", personality: "ASMR appreciation. 'asmr vibes' 'tingles' 'very relaxing' 'satisfying'. Sensory appreciation." },
  { name: "MainCharacter", personality: "Main character syndrome. 'its giving main character' 'protagonist energy' 'plot armor'. Self-aware main character." },
  { name: "SideQuest", personality: "Side quest energy. 'side quest' 'optional content' 'exploration time' 'off the beaten path'. Adventure vibes." },
]

interface TimestampedTranscript {
  text: string
  timestamp: number
}

interface FrameSummary {
  summary: string
  timestamp: number
}

interface ChattyClaw {
  name: string
  personality: string
  client: ClawStreamClient
  lastFrame: StreamFrame | null
  chatHistory: ChatMessage[]
  recentTranscripts: TimestampedTranscript[]
  frameSummaries: FrameSummary[]
  isThinking: boolean
  lastSpokeAt: number
}

const claws: ChattyClaw[] = []
const MIN_RESPONSE_DELAY = 3000 // Don't respond faster than 3s

// ========== EMOTE PILE-ON DETECTION ==========
// Comprehensive Twitch/BTTV/FFZ/7TV emotes
const PILE_ON_EMOTES = [
  // Classic Twitch
  "Kappa", "LUL", "PogChamp", "Pog", "POGGERS", "PogU", "TriHard", "4Head", "Kreygasm",
  "BibleThump", "ResidentSleeper", "Jebaited", "NotLikeThis", "FailFish", "DansGame",
  "SwiftRage", "BabyRage", "Wutface", "HeyGuys", "SeemsGood", "CoolStoryBob",
  // BTTV/FFZ/7TV Popular
  "KEKW", "OMEGALUL", "monkaS", "monkaW", "monkaGIGA", "monkaHmm", "monkaOMEGA",
  "PepeLaugh", "Pepega", "PepeHands", "Sadge", "Copium", "COPIUM", "Clueless",
  "GIGACHAD", "Gigachad", "5Head", "3Head", "catJAM", "CatJAM", "AYAYA",
  "widepeepoHappy", "widepeepoSad", "FeelsBadMan", "FeelsGoodMan", "FeelsStrongMan",
  "WeirdChamp", "4Weird", "PauseChamp", "gachiGASM", "gachiBASS", "forsenCD",
  "YEP", "NOPE", "Clap", "EZ", "gg", "GG", "Booba", "haHAA",
  // Common spam
  "W", "L", "F", "o7", "D:", ":D", ":)", ":(", "xD", "XD", "ez", "gg",
  // Numbers (for polls/votes)
  "1", "2", "3", "4", "5",
  // Emojis
  "🦀", "💀", "😂", "🔥", "❤️", "👀", "😭", "💜", "🤣", "😍", "🙏", "💯", "🎉", "👏", "🤡", "💀💀💀"
]
const recentEmoteUsage: Map<string, number> = new Map() // emote -> count in last N messages
const PILE_ON_THRESHOLD = 3 // If 3+ people use same emote, it's a pile-on
const PILE_ON_WINDOW = 10 // Check last 10 messages

function detectPileOn(chatHistory: ChatMessage[]): string | null {
  recentEmoteUsage.clear()
  const recentMessages = chatHistory.slice(-PILE_ON_WINDOW)

  for (const msg of recentMessages) {
    for (const emote of PILE_ON_EMOTES) {
      if (msg.message.includes(emote)) {
        recentEmoteUsage.set(emote, (recentEmoteUsage.get(emote) || 0) + 1)
      }
    }
  }

  // Find emote with most usage above threshold
  let maxEmote: string | null = null
  let maxCount = 0
  for (const [emote, count] of recentEmoteUsage) {
    if (count >= PILE_ON_THRESHOLD && count > maxCount) {
      maxEmote = emote
      maxCount = count
    }
  }

  return maxEmote
}

function generatePileOnResponse(emote: string): string {
  const repeatCount = 2 + Math.floor(Math.random() * 4) // 2-5 repeats
  if (emote.length === 1 || emote === "🦀" || emote === "💀" || emote === "😂" || emote === "🔥") {
    return Array(repeatCount).fill(emote).join("")
  }
  return Array(repeatCount).fill(emote).join(" ")
}

// ========== SHARED FRAME SUMMARY CACHE ==========
// Server provides summaries now - we just cache them for all claws
interface SharedFrameSummary {
  summary: string
  timestamp: number
}
const sharedFrameSummaries: SharedFrameSummary[] = []
let lastFrameTimestamp = 0

function handleServerFrame(frame: StreamFrame): void {
  // Skip if we already processed this frame
  if (frame.timestamp === lastFrameTimestamp) return
  lastFrameTimestamp = frame.timestamp

  // Use server-provided summary if available
  if (frame.summary) {
    sharedFrameSummaries.push({
      summary: frame.summary,
      timestamp: frame.timestamp,
    })
    // Keep only last FRAME_SUMMARY_LIMIT summaries
    if (sharedFrameSummaries.length > FRAME_SUMMARY_LIMIT) {
      sharedFrameSummaries.shift()
    }

    // Push to all claws
    for (const claw of claws) {
      claw.frameSummaries = [...sharedFrameSummaries]
    }

    console.log(`🖼️ [SERVER] Frame summary: ${frame.summary.substring(0, 60)}...`)
  }
}

/**
 * Format relative time for display
 */
function formatRelativeTime(timestamp: number, now: number): string {
  const secsAgo = Math.round((now - timestamp) / 1000)
  if (secsAgo < 10) return "just now"
  if (secsAgo < 60) return `${secsAgo}s ago`
  if (secsAgo < 3600) return `${Math.round(secsAgo / 60)}m ago`
  return `${Math.round(secsAgo / 3600)}h ago`
}

async function clawRespond(claw: ChattyClaw, triggerMessage: ChatMessage | null, context: string): Promise<string> {
  const now = Date.now()

  // ========== GET RECENT CHATTERS FOR @MENTIONS ==========
  const recentChatters = [...new Set(
    claw.chatHistory.slice(-20)
      .map(m => m.displayName)
      .filter(name => name !== claw.name && name !== "clawstreambot")
  )].slice(0, 10)
  const chattersToMention = recentChatters.length > 0
    ? `Recent chatters you can @mention: ${recentChatters.join(", ")}`
    : ""

  // ========== BUILD CHAT HISTORY (all 200 messages) ==========
  const chatHistoryFormatted = claw.chatHistory.map((m, i) => {
    const isRecent = i >= claw.chatHistory.length - 10
    const prefix = isRecent ? "→ " : "  " // Arrow marks recent messages
    return `${prefix}${m.displayName}: ${m.message}`
  }).join("\n")

  // ========== BUILD TRANSCRIPT HISTORY ==========
  const STALE_THRESHOLD_MS = 15000 // 15 seconds = stale
  const transcriptsFormatted = claw.recentTranscripts.map((t, i) => {
    const ageMs = now - t.timestamp
    const isStale = ageMs > STALE_THRESHOLD_MS
    const timeLabel = formatRelativeTime(t.timestamp, now)
    if (isStale) {
      return `  [${timeLabel}] "${t.text}" (OLD - ignore)`
    }
    return `→ [${timeLabel}] "${t.text}" (RESPOND TO THIS)`
  }).join("\n")

  // ========== BUILD FRAME SUMMARIES (all 36) ==========
  const frameSummariesFormatted = claw.frameSummaries.map((f, i) => {
    const isRecent = i >= claw.frameSummaries.length - 3
    const prefix = isRecent ? "→ " : "  "
    const timeLabel = formatRelativeTime(f.timestamp, now)
    return `${prefix}[${timeLabel}] ${f.summary}`
  }).join("\n")

  const systemPrompt = `You are "${claw.name}", a Twitch chatter.
Personality: ${claw.personality}

RULES:
- Keep messages SHORT (1-10 words)
- ONLY respond to transcripts marked "RESPOND TO THIS" - ignore ones marked "OLD"
- If streamer asks chat to do something (like "type 1"), just do it
- Use emotes: PogChamp, KEKW, LUL, Sadge, monkaS, 💀, 🔥, W, L

STREAMER VOICE (only respond to non-OLD ones):
${transcriptsFormatted || "(nothing yet)"}

CHAT:
${chatHistoryFormatted || "(empty)"}

SCREEN:
${frameSummariesFormatted || "(no frames yet)"}`

  const userContent: Anthropic.ContentBlockParam[] = []

  // Add current image if available
  if (claw.lastFrame) {
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: `image/${claw.lastFrame.format}` as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: claw.lastFrame.imageBase64,
      },
    })
  }

  userContent.push({
    type: "text",
    text: triggerMessage
      ? `⚡ TRIGGER: Someone just said: "${triggerMessage.displayName}: ${triggerMessage.message}"\n\n${context}`
      : `⚡ CONTEXT: ${context}`
  })

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 60, // Short Twitch-style messages!
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  })

  const textBlock = response.content.find((b) => b.type === "text")
  return textBlock && textBlock.type === "text" ? textBlock.text : ""
}

async function makeClawSpeak(claw: ChattyClaw, trigger: ChatMessage | null, context: string): Promise<void> {
  if (claw.isThinking) return

  // Rate limit
  const now = Date.now()
  if (now - claw.lastSpokeAt < MIN_RESPONSE_DELAY) return

  claw.isThinking = true
  try {
    const response = await clawRespond(claw, trigger, context)
    if (response && response.length > 0 && response.length < 200) {
      await claw.client.sendChat(response)
      claw.lastSpokeAt = Date.now()
      console.log(`💬 ${claw.name}: ${response}`)
    }
  } catch (err) {
    console.error(`❌ ${claw.name} error:`, err)
  }
  claw.isThinking = false
}

function shouldRespond(claw: ChattyClaw, msg: ChatMessage): boolean {
  const lowerMsg = msg.message.toLowerCase()
  const lowerName = claw.name.toLowerCase()

  // Always respond if directly mentioned
  if (lowerMsg.includes(lowerName)) return true

  // Respond to questions directed at claws/bots
  if (lowerMsg.includes("claw") || lowerMsg.includes("bot")) {
    if (lowerMsg.includes("?") || lowerMsg.includes("tell") || lowerMsg.includes("give")) {
      return true
    }
  }

  // Respond to general questions with some probability (scaled by bot count)
  if (lowerMsg.includes("?") || lowerMsg.includes("anyone") || lowerMsg.includes("guys")) {
    return Math.random() < 0.25 * CHAT_SCALE_FACTOR // 25% at 50 bots
  }

  // Respond to greetings
  if (lowerMsg.match(/^(hi|hey|hello|yo|sup)/)) {
    return Math.random() < 0.20 * CHAT_SCALE_FACTOR // 20% at 50 bots
  }

  // Random chance to chime in on other messages
  return Math.random() < 0.075 * CHAT_SCALE_FACTOR // 7.5% at 50 bots
}

async function spawnChattyClaw(index: number): Promise<ChattyClaw> {
  const config = CLAW_PERSONALITIES[index % CLAW_PERSONALITIES.length]

  const client = new ClawStreamClient({
    serverUrl: SERVER_URL,
    clawId: `chatty-${config.name.toLowerCase()}-${Date.now()}`,
    clawName: config.name,
  })

  const claw: ChattyClaw = {
    name: config.name,
    personality: config.personality,
    client,
    lastFrame: null,
    chatHistory: [],
    recentTranscripts: [],
    frameSummaries: [],
    isThinking: false,
    lastSpokeAt: 0,
  }

  // Receive frames - server provides summaries now!
  client.onFrame(async (frame) => {
    claw.lastFrame = frame
    // Use server-provided summary (no client-side API calls needed)
    handleServerFrame(frame)
  })

  // Receive chat messages
  client.onChat(async (msg: ChatMessage) => {
    claw.chatHistory.push(msg)
    // Keep last CHAT_HISTORY_LIMIT messages
    if (claw.chatHistory.length > CHAT_HISTORY_LIMIT) {
      claw.chatHistory.shift()
    }

    // Don't respond to bot messages or our own
    if (msg.username === "clawstreambot") return
    if (CLAW_PERSONALITIES.some(p => msg.displayName === p.name)) return

    // Check for emote pile-on opportunity (15% chance at 50 bots, scaled)
    const pileOnEmote = detectPileOn(claw.chatHistory)
    if (pileOnEmote && Math.random() < 0.15 * CHAT_SCALE_FACTOR && !claw.isThinking) {
      const delay = Math.random() * 2000 // Quick pile-on (0-2s)
      setTimeout(async () => {
        if (!claw.isThinking && Date.now() - claw.lastSpokeAt > MIN_RESPONSE_DELAY) {
          const response = generatePileOnResponse(pileOnEmote)
          await claw.client.sendChat(response)
          claw.lastSpokeAt = Date.now()
          console.log(`🔥 ${claw.name} pile-on: ${response}`)
        }
      }, delay)
      return // Don't also do a normal response
    }

    // Check if we should respond normally
    if (shouldRespond(claw, msg)) {
      const delay = 1000 + Math.random() * 3000
      setTimeout(() => {
        makeClawSpeak(claw, msg, `Reply to this message! START your response with @${msg.displayName} to reply directly to them.`)
      }, delay)
    }
  })

  // Receive streamer transcripts
  client.onTranscript(async (transcript: TranscriptMessage) => {
    claw.recentTranscripts.push({
      text: transcript.text,
      timestamp: transcript.timestamp,
    })
    // Keep last TRANSCRIPT_HISTORY_LIMIT transcripts
    if (claw.recentTranscripts.length > TRANSCRIPT_HISTORY_LIMIT) {
      claw.recentTranscripts.shift()
    }

    console.log(`🎤 ${claw.name} heard: "${transcript.text}"`)

    // Dynamic probability: more bots = more responders, but with diminishing returns
    // Formula: expectedResponders = 2 + sqrt(CLAW_COUNT), probability = expectedResponders / CLAW_COUNT
    // 5 bots → ~4 respond (80%), 10 bots → ~5 (50%), 25 bots → ~7 (28%), 50 bots → ~9 (18%)
    const expectedResponders = 2 + Math.sqrt(CLAW_COUNT)
    const voiceResponseProbability = Math.min(0.8, expectedResponders / CLAW_COUNT)
    const shouldRespondToVoice = Math.random() < voiceResponseProbability

    if (shouldRespondToVoice) {
      const delay = Math.random() * 2000 // Spread responses over 0-2 seconds
      setTimeout(() => {
        // Build list of recent chatters we could @mention
        const recentChatters = [...new Set(
          claw.chatHistory.slice(-20).map(m => m.displayName)
            .filter(name => name !== claw.name && name !== "clawstreambot")
        )].slice(0, 8)

        // 40% chance to @mention someone when responding to voice
        let mentionPrompt = ""
        if (recentChatters.length > 0 && Math.random() < 0.4) {
          const randomChatter = recentChatters[Math.floor(Math.random() * recentChatters.length)]
          mentionPrompt = ` Start your response with @${randomChatter} to include them in the conversation.`
        }

        // Simple prompt - let the system prompt handle the rest
        makeClawSpeak(claw, null, `Streamer said: "${transcript.text}"${mentionPrompt}`)
      }, delay)
    }
  })

  // Clear memory on reconnect (stream probably restarted)
  client.onReconnect(() => {
    console.log(`🔄 ${claw.name} reconnected - clearing old memory`)
    claw.chatHistory = []
    claw.recentTranscripts = []
    claw.frameSummaries = []
    claw.lastFrame = null
  })

  await client.connect()
  console.log(`✅ ${claw.name} connected (memory: ${CHAT_HISTORY_LIMIT} chat, ${TRANSCRIPT_HISTORY_LIMIT} transcripts, ${FRAME_SUMMARY_LIMIT} frames)`)

  return claw
}

async function runChattyClaws() {
  const expectedResponders = Math.round(2 + Math.sqrt(CLAW_COUNT))
  const voiceResponseProbability = Math.min(0.8, expectedResponders / CLAW_COUNT)

  console.log(`\n🦀 CHATTY CLAWS - ${CLAW_COUNT} AI claws with ENHANCED MEMORY!`)
  console.log(`   Server: ${SERVER_URL}`)
  console.log(`   Chat History: ${CHAT_HISTORY_LIMIT} messages`)
  console.log(`   Transcript History: ${TRANSCRIPT_HISTORY_LIMIT} statements`)
  console.log(`   Visual Memory: ${FRAME_SUMMARY_LIMIT} frame summaries (server-provided!)`)
  console.log(`   Voice Response: ${Math.round(voiceResponseProbability * 100)}% chance (~${expectedResponders} bots/transcript)`)
  console.log(`   ⚠️  Uses API credits for bot responses only (server handles frame summaries)\n`)

  // Spawn claws
  for (let i = 0; i < CLAW_COUNT; i++) {
    const claw = await spawnChattyClaw(i).catch((err) => {
      console.error(`❌ Failed to spawn claw ${i}:`, err)
      return null
    })
    if (claw) claws.push(claw)
    await new Promise((r) => setTimeout(r, 300))
  }

  console.log(`\n📊 ${claws.length} chatty claws ready with enhanced memory!\n`)

  // Wait for frames to start flowing, then bots respond naturally to voice/chat
  await new Promise((r) => setTimeout(r, 3000))

  // Unprompted observations - only when stream is live (frames received in last 60s)
  const observationInterval = setInterval(async () => {
    // Skip if no recent frames (stream offline) - prevents wasting tokens
    const timeSinceLastFrame = Date.now() - lastFrameTimestamp
    if (lastFrameTimestamp === 0 || timeSinceLastFrame > 60000) {
      return // Stream is offline or not receiving frames
    }

    const availableClaws = claws.filter(c => !c.isThinking && Date.now() - c.lastSpokeAt > 15000)
    const numToSpeak = Math.min(1, availableClaws.length)

    for (let i = 0; i < numToSpeak; i++) {
      if (availableClaws.length > 0) {
        const idx = Math.floor(Math.random() * availableClaws.length)
        const claw = availableClaws.splice(idx, 1)[0]

        // Build list of recent chatters we could @mention
        const recentChatters = [...new Set(
          claw.chatHistory.slice(-20).map(m => m.displayName)
            .filter(name => name !== claw.name && name !== "clawstreambot")
        )].slice(0, 8)

        // 35% chance to @mention someone in unprompted observations
        let mentionSuffix = ""
        if (recentChatters.length > 0 && Math.random() < 0.35) {
          const randomChatter = recentChatters[Math.floor(Math.random() * recentChatters.length)]
          mentionSuffix = ` Start with @${randomChatter} to engage them directly.`
        }

        const prompts = [
          `Make a brief observation about what's happening on stream right now!${mentionSuffix}`,
          `React to something you see or heard recently. Stay in character!${mentionSuffix}`,
          `Engage with the current moment on stream. Be natural!${mentionSuffix}`,
        ]
        await makeClawSpeak(claw, null, prompts[Math.floor(Math.random() * prompts.length)])
        await new Promise(r => setTimeout(r, 1500))
      }
    }
  }, 10000)

  process.on("SIGINT", async () => {
    console.log("\n\n🛑 Shutting down chatty claws...")
    clearInterval(observationInterval)

    for (const claw of claws) {
      await claw.client.disconnect().catch(() => {})
    }

    console.log("✅ Done!")
    process.exit(0)
  })

  console.log("🎉 Chatty claws running with enhanced memory! Press Ctrl+C to stop.\n")
}

runChattyClaws().catch(console.error)
