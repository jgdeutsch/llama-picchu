// Gemini LLM Service for FROBARK NPCs
// Provides dynamic dialogue generation with response caching and long-term memory

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDatabase } from '../database';

// Initialize Gemini with API key
const GEMINI_API_KEY = 'AIzaSyBxvpCeInudM1bs80tApSQ0XrqnKlaOXgk';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Types for the service
export interface ConversationContext {
  npcId: number;
  npcName: string;
  npcPersonality: string;
  npcRole: string;
  npcCurrentTask: string | null;
  npcTaskProgress: number;
  npcMood: string;
  npcLocation: string;
  playerName: string;
  playerSocialCapital: number;
  trustLevel: string;
  recentMemories: NpcMemoryEntry[];
  longTermMemories: NpcMemoryEntry[];
  worldContext: string;
  conversationHistory: ConversationMessage[];
  timeOfDay: string;
  daysSinceLastMeeting: number | null;
}

export interface ConversationMessage {
  role: 'player' | 'npc';
  content: string;
  timestamp: Date;
}

export interface NpcMemoryEntry {
  id?: number;
  type: 'interaction' | 'event' | 'observation' | 'gossip' | 'significant';
  content: string;
  importance: number; // 1-10, higher = more memorable
  emotionalValence: number; // -5 to +5, negative = bad memory
  createdAt: Date;
  playerInvolved?: number;
  decayedAt?: Date; // When memory was compacted/faded
}

export interface CachedResponse {
  id: number;
  npcId: number;
  contextHash: string;
  playerMessageNormalized: string;
  response: string;
  timesUsed: number;
  createdAt: Date;
  lastUsed: Date;
}

// Build the system prompt for NPC personality
function buildSystemPrompt(context: ConversationContext): string {
  const trustDescriptions: Record<string, string> = {
    hostile: "extremely distrustful and may refuse to speak or respond curtly",
    unfriendly: "wary and gives short, unhelpful answers",
    stranger: "polite but reserved, treats them as any passerby",
    acquaintance: "somewhat friendly, willing to share basic information",
    friend: "warm and helpful, shares secrets and offers assistance",
    trusted: "deeply loyal, would go out of their way to help",
    family: "treats them like kin, would risk anything for them"
  };

  const trustBehavior = trustDescriptions[context.trustLevel] || trustDescriptions.stranger;

  // Format memories for the prompt
  const recentMemoriesText = context.recentMemories.length > 0
    ? context.recentMemories.map(m => `- ${m.content} (${m.createdAt.toLocaleDateString()})`).join('\n')
    : 'No recent memories of this player.';

  const longTermMemoriesText = context.longTermMemories.length > 0
    ? context.longTermMemories.map(m => `- ${m.content} [importance: ${m.importance}/10]`).join('\n')
    : 'No significant long-term memories.';

  const lastMeetingText = context.daysSinceLastMeeting !== null
    ? context.daysSinceLastMeeting === 0
      ? "You saw this player earlier today."
      : context.daysSinceLastMeeting === 1
        ? "You last saw this player yesterday."
        : `You last saw this player ${context.daysSinceLastMeeting} days ago.`
    : "You have never met this player before.";

  return `You are ${context.npcName}, a character in Gamehenge - a fantasy world from Phish lore.

CHARACTER:
- Role: ${context.npcRole}
- Personality: ${context.npcPersonality}
- Current location: ${context.npcLocation}
- Current mood: ${context.npcMood}
- Time of day: ${context.timeOfDay}
${context.npcCurrentTask ? `- Currently doing: ${context.npcCurrentTask} (${context.npcTaskProgress}% complete)` : '- Currently idle'}

RELATIONSHIP WITH ${context.playerName}:
- Trust level: ${context.trustLevel} - You are ${trustBehavior}
- Social capital: ${context.playerSocialCapital} (affects how much you like/trust them)
- ${lastMeetingText}

YOUR RECENT MEMORIES OF ${context.playerName}:
${recentMemoriesText}

YOUR LONG-TERM MEMORIES (most significant events):
${longTermMemoriesText}

WHAT'S HAPPENING NEARBY:
${context.worldContext}

STYLE GUIDELINES:
- Respond like a character from "Rosencrantz and Guildenstern Are Dead" - philosophical tangents, absurdist humor, wordplay, existential musings are welcome
- Sometimes ponder the nature of existence or make observations about the oddness of life
- You can make subtle references to Phish songs if they fit naturally (don't force it)
- Stay in character based on your personality and relationship with this player
- Reference your current task naturally if it's relevant
- If you remember something about this player, you might bring it up naturally
- Keep responses 1-3 sentences unless asked a deep question or you have something important to say
- If the player has been gone a while and you remember them, comment on the passage of time
- If this player helped you before, show genuine warmth
- If this player wronged you, be appropriately guarded or cold

IMPORTANT:
- Never break character or mention you're an AI
- Never use asterisks for actions - just describe what you do in prose
- React naturally to what the player says based on your personality and relationship
- If you don't know something about Gamehenge lore, improvise in character`;
}

// Normalize player input for caching
function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

// Create a context hash for caching similar situations
function createContextHash(context: ConversationContext): string {
  // Hash key elements that affect response style
  const trustBucket = context.trustLevel;
  const moodBucket = context.npcMood;
  const taskBucket = context.npcCurrentTask ? 'busy' : 'idle';
  const timeBucket = context.timeOfDay;

  return `${context.npcId}:${trustBucket}:${moodBucket}:${taskBucket}:${timeBucket}`;
}

// Check cache for similar response
function checkCache(npcId: number, contextHash: string, normalizedInput: string): CachedResponse | null {
  const db = getDatabase();

  try {
    const cached = db.prepare(`
      SELECT * FROM npc_response_cache
      WHERE npc_id = ?
        AND context_hash = ?
        AND player_message_normalized = ?
        AND created_at > datetime('now', '-24 hours')
      ORDER BY times_used DESC
      LIMIT 1
    `).get(npcId, contextHash, normalizedInput) as CachedResponse | undefined;

    if (cached) {
      // Update usage stats
      db.prepare(`
        UPDATE npc_response_cache
        SET times_used = times_used + 1, last_used = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(cached.id);

      return cached;
    }
  } catch (error) {
    // Table might not exist yet, that's okay
    console.log('[Gemini] Cache miss or table not ready');
  }

  return null;
}

// Save response to cache
function saveToCache(npcId: number, contextHash: string, normalizedInput: string, response: string): void {
  const db = getDatabase();

  try {
    db.prepare(`
      INSERT INTO npc_response_cache (npc_id, context_hash, player_message_normalized, response, times_used, created_at, last_used)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (npc_id, context_hash, player_message_normalized) DO UPDATE SET
        times_used = times_used + 1,
        last_used = CURRENT_TIMESTAMP
    `).run(npcId, contextHash, normalizedInput, response);
  } catch (error) {
    // Table might not exist yet
    console.log('[Gemini] Could not cache response');
  }
}

// Add slight variation to cached responses so they don't feel robotic
function addVariation(response: string): string {
  // Small chance to add slight verbal tics or variations
  const variations = [
    { prefix: '', suffix: '' },
    { prefix: 'Hmm. ', suffix: '' },
    { prefix: 'Ah, ', suffix: '' },
    { prefix: '', suffix: ' ...if you catch my meaning.' },
    { prefix: 'Well, ', suffix: '' },
  ];

  // Only apply variation sometimes
  if (Math.random() > 0.3) {
    return response;
  }

  const variation = variations[Math.floor(Math.random() * variations.length)];
  return variation.prefix + response + variation.suffix;
}

// Main function to generate NPC response
export async function generateNpcResponse(
  context: ConversationContext,
  playerMessage: string
): Promise<string> {
  const normalizedInput = normalizeInput(playerMessage);
  const contextHash = createContextHash(context);

  // Check cache first
  const cached = checkCache(context.npcId, contextHash, normalizedInput);
  if (cached) {
    console.log(`[Gemini] Using cached response for ${context.npcName}`);
    return addVariation(cached.response);
  }

  // Build the conversation for context
  const conversationText = context.conversationHistory
    .slice(-6) // Last 6 messages for context
    .map(m => `${m.role === 'player' ? context.playerName : context.npcName}: ${m.content}`)
    .join('\n');

  const systemPrompt = buildSystemPrompt(context);

  const fullPrompt = `${systemPrompt}

RECENT CONVERSATION:
${conversationText || '(This is the start of the conversation)'}

${context.playerName} says: "${playerMessage}"

Respond as ${context.npcName}. Remember to stay in character and keep your response appropriate for your relationship with this player.`;

  try {
    console.log(`[Gemini] Generating response for ${context.npcName}...`);

    const result = await model.generateContent(fullPrompt);
    const response = result.response.text().trim();

    // Cache the response
    saveToCache(context.npcId, contextHash, normalizedInput, response);

    console.log(`[Gemini] Generated: "${response.substring(0, 50)}..."`);
    return response;

  } catch (error) {
    console.error('[Gemini] Error generating response:', error);
    // Fallback responses based on trust level
    const fallbacks: Record<string, string[]> = {
      hostile: [
        "I have nothing to say to you.",
        "*turns away*",
        "Leave me be.",
      ],
      unfriendly: [
        "What do you want?",
        "I'm busy.",
        "Hmph.",
      ],
      stranger: [
        "I'm not sure what to say to that.",
        "Interesting...",
        "Perhaps.",
      ],
      acquaintance: [
        "I hear you. Let me think on that.",
        "That's a thought.",
        "I suppose so.",
      ],
      friend: [
        "Ha! You always did have a way with words.",
        "I appreciate you saying that.",
        "Indeed, my friend.",
      ],
      trusted: [
        "You know I value your thoughts.",
        "As always, you give me much to consider.",
        "Between us, I think you're right.",
      ],
      family: [
        "You know me too well.",
        "As close as we are, some things still surprise me.",
        "I'm glad you're here.",
      ],
    };

    const options = fallbacks[context.trustLevel] || fallbacks.stranger;
    return options[Math.floor(Math.random() * options.length)];
  }
}

// Memory management functions

// Compact old memories - called periodically to manage memory size
export function compactNpcMemories(npcId: number): void {
  const db = getDatabase();

  try {
    // Get all memories for this NPC older than 7 days, sorted by importance
    const oldMemories = db.prepare(`
      SELECT * FROM npc_memories
      WHERE npc_id = ?
        AND created_at < datetime('now', '-7 days')
        AND decayed_at IS NULL
      ORDER BY importance DESC
    `).all(npcId) as NpcMemoryEntry[];

    if (oldMemories.length <= 10) return; // Keep at least 10 old memories

    // Keep top 10 most important, mark rest as decayed
    const toDecay = oldMemories.slice(10);

    for (const memory of toDecay) {
      // If importance is high enough, summarize instead of forgetting
      if (memory.importance >= 7) {
        // This memory is significant - it stays but gets compressed
        db.prepare(`
          UPDATE npc_memories
          SET content = ?, decayed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(`[Faded memory] ${memory.content.substring(0, 50)}...`, memory.id);
      } else {
        // Low importance - mark as decayed (effectively forgotten)
        db.prepare(`
          UPDATE npc_memories
          SET decayed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(memory.id);
      }
    }

    console.log(`[Memory] Compacted ${toDecay.length} old memories for NPC ${npcId}`);
  } catch (error) {
    // Table might not exist
  }
}

// Add a new memory for an NPC about a player
export function addNpcMemory(
  npcId: number,
  playerId: number,
  type: NpcMemoryEntry['type'],
  content: string,
  importance: number = 5,
  emotionalValence: number = 0
): void {
  const db = getDatabase();

  try {
    db.prepare(`
      INSERT INTO npc_memories (npc_id, player_id, type, content, importance, emotional_valence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(npcId, playerId, type, content, Math.min(10, Math.max(1, importance)), emotionalValence);

    console.log(`[Memory] ${npcId} remembers: "${content}" (importance: ${importance})`);
  } catch (error) {
    // Table might not exist
  }
}

// Get memories for a specific player interaction
export function getNpcMemoriesOfPlayer(npcId: number, playerId: number): { recent: NpcMemoryEntry[]; longTerm: NpcMemoryEntry[] } {
  const db = getDatabase();

  try {
    // Recent memories (last 14 days, not decayed)
    const recent = db.prepare(`
      SELECT * FROM npc_memories
      WHERE npc_id = ?
        AND player_id = ?
        AND created_at > datetime('now', '-14 days')
        AND decayed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `).all(npcId, playerId) as NpcMemoryEntry[];

    // Long-term significant memories (importance >= 7)
    const longTerm = db.prepare(`
      SELECT * FROM npc_memories
      WHERE npc_id = ?
        AND player_id = ?
        AND importance >= 7
      ORDER BY importance DESC, created_at DESC
      LIMIT 5
    `).all(npcId, playerId) as NpcMemoryEntry[];

    return { recent, longTerm };
  } catch (error) {
    return { recent: [], longTerm: [] };
  }
}

// Get the time since NPC last saw this player
export function getDaysSinceLastMeeting(npcId: number, playerId: number): number | null {
  const db = getDatabase();

  try {
    const result = db.prepare(`
      SELECT last_interaction FROM npc_memory
      WHERE npc_template_id = ? AND player_id = ?
    `).get(npcId, playerId) as { last_interaction: string } | undefined;

    if (!result || !result.last_interaction) return null;

    const lastDate = new Date(result.last_interaction);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  } catch (error) {
    return null;
  }
}

// Determine time of day based on game time
export function getTimeOfDay(): string {
  const hour = new Date().getHours(); // Using real time for now
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  if (hour >= 20 && hour < 23) return 'night';
  return 'late night';
}

// Generate ambient NPC chatter for gossip channel
export async function generateNpcGossip(
  npcName: string,
  npcPersonality: string,
  topic: string
): Promise<string> {
  const prompt = `You are ${npcName}, a character in Gamehenge. Your personality: ${npcPersonality}

Generate a short (1 sentence) message you might say on the gossip channel about: ${topic}

Keep it in character, casual, and like something you'd overhear. No quotation marks.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    return `${npcName} mutters something about ${topic}.`;
  }
}

// Generate NPC shout
export async function generateNpcShout(
  npcName: string,
  npcPersonality: string,
  situation: string
): Promise<string> {
  const prompt = `You are ${npcName} in Gamehenge. Personality: ${npcPersonality}

Generate a short shout (1 sentence, all caps not necessary) for this situation: ${situation}

Keep it urgent and in character. No quotation marks.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    return `${npcName} shouts about ${situation}!`;
  }
}
