// Gemini LLM Service for FROBARK NPCs
// Provides dynamic dialogue generation with response caching and long-term memory

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDatabase } from '../database';

// Initialize Gemini with API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
if (!GEMINI_API_KEY) {
  console.warn('[Gemini] No API key found. Set GEMINI_API_KEY environment variable.');
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
  playerLevel: number;
  playerClass: string;
  playerAppearance: string;  // Description of what player is wearing
  playerGold: number;
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

// === CONVERSATION HISTORY TRACKING ===
// Tracks recent conversation exchanges between players and NPCs
// This allows NPCs to remember what was said in the current conversation

interface ConversationEntry {
  role: 'player' | 'npc';
  content: string;
  timestamp: number;
}

// Key: "playerId-npcId", Value: recent conversation entries
const conversationHistories: Map<string, ConversationEntry[]> = new Map();

// Maximum entries to keep per conversation
const MAX_CONVERSATION_LENGTH = 20;
// Conversation expires after 10 minutes of no activity
const CONVERSATION_EXPIRY_MS = 10 * 60 * 1000;

function getConversationKey(playerId: number, npcId: number): string {
  return `${playerId}-${npcId}`;
}

// Add an entry to the conversation history
export function addToConversationHistory(
  playerId: number,
  npcId: number,
  role: 'player' | 'npc',
  content: string
): void {
  const key = getConversationKey(playerId, npcId);
  let history = conversationHistories.get(key) || [];

  // Clean up old entries (expired)
  const now = Date.now();
  history = history.filter(entry => now - entry.timestamp < CONVERSATION_EXPIRY_MS);

  // Add new entry
  history.push({
    role,
    content,
    timestamp: now
  });

  // Trim to max length
  if (history.length > MAX_CONVERSATION_LENGTH) {
    history = history.slice(-MAX_CONVERSATION_LENGTH);
  }

  conversationHistories.set(key, history);
}

// Get recent conversation history as ConversationMessage array
export function getConversationHistory(playerId: number, npcId: number): ConversationMessage[] {
  const key = getConversationKey(playerId, npcId);
  const history = conversationHistories.get(key) || [];

  const now = Date.now();

  // Filter out expired entries and convert to ConversationMessage format
  return history
    .filter(entry => now - entry.timestamp < CONVERSATION_EXPIRY_MS)
    .map(entry => ({
      role: entry.role,
      content: entry.content,
      timestamp: new Date(entry.timestamp)
    }));
}

// Clear conversation history (e.g., when player leaves area)
export function clearConversationHistory(playerId: number, npcId: number): void {
  const key = getConversationKey(playerId, npcId);
  conversationHistories.delete(key);
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

THE PLAYER (${context.playerName}):
- Level ${context.playerLevel} ${context.playerClass}
- Appearance: ${context.playerAppearance}
- Gold: ${context.playerGold} coins
- Trust level: ${context.trustLevel} - You are ${trustBehavior}
- Social capital: ${context.playerSocialCapital}
- ${lastMeetingText}

YOUR RECENT MEMORIES OF ${context.playerName}:
${recentMemoriesText}

YOUR LONG-TERM MEMORIES (most significant events):
${longTermMemoriesText}

WHAT'S HAPPENING NEARBY:
${context.worldContext}

CRITICAL BEHAVIOR RULE - BE HELPFUL, NOT INTERROGATIVE:
- NEVER ask "what do you want?" or endless clarifying questions. That's terrible UX.
- If you're a shopkeeper, YOUR INVENTORY IS LISTED BELOW. USE IT! Quote EXACT item names and prices.
- When a customer wants something, IMMEDIATELY SUGGEST 2-3 specific items from your inventory.
- GOOD: "I have a Sturdy Linen Shirt for 25 gold, or Wool Travel Pants for 30. You look like you need both."
- BAD: "What sort of garment are you envisioning?" (Never say this!)

GUIDING PLAYERS - Give them PURPOSE:
- Offer them something to WORK TOWARD. Suggest a goal slightly out of reach.
- "That cloak is 40 gold - if you can earn it, you'll blend right in. Maybe take some odd jobs?"
- "I see you're short on gold. Farmer Rutherford sometimes needs help with the harvest."
- Give them a REASON to explore and a REWARD to aim for.

GIVING FREE ITEMS - You CAN give things away:
- If you're an innkeeper, you can offer FREE WATER to people who can't afford food/drink
- If you're a farmer, you might give a hungry traveler an apple
- If you're a baker, you can offer stale bread to the destitute
- When giving something, say "Here's some water" or "Take this" - be natural about it
- Don't give away expensive items, but basic necessities are fine for those in need

PRACTICAL EXAMPLES (note how SHORT these are):
- Player says "I need clothes" → "Linen Shirt, 25 gold. Pants, 30. You need both."
- Player says "what do you suggest?" → "Boots first. 35 gold. Everything else can wait."
- Player is broke → "No coin, no goods. Try the fields for work."

You can SEE what the player is wearing (listed above). Reference it directly!

STYLE GUIDELINES:
- Respond like a character from "Rosencrantz and Guildenstern Are Dead" - philosophical tangents, absurdist humor, wordplay are welcome
- But balance wit with BEING HELPFUL. Don't be so cryptic you're useless.
- You can make subtle references to Phish songs if they fit naturally
- KEEP RESPONSES SHORT: 1-2 sentences MAX (under 25 words ideally)
- If this player helped you before, show genuine warmth
- If this player wronged you, be appropriately guarded or cold
- NEVER ramble. Say what needs saying, then stop.

KNOWN CHARACTERS IN GAMEHENGE (ONLY reference these people):
- Wilson (tyrant king, at castle)
- Icculus (prophet, at tower)
- Tela (resistance leader, at cottage)
- Colonel Forbin (lost outsider, wanders)
- Errand Wolfe (Wilson's enforcer, castle)
- Fee (brave weasel, forest)
- Mr. Palmer (nervous accountant, market)
- The Unit Monster (philosopher, underground)
- Farmer Rutherford, Martha Rutherford, Young Jimmy (farmlands/homes west)
- Blacksmith Gordo, Elena (blacksmith forge)
- Baker Possum, Apprentice Pip (bakery)
- Innkeeper Antelope (the inn)
- Tailor Lydia (tailor shop/needle & thread)
- Healer Esther (village square)
- Village Elder Moondog, Town Crier Barnaby (village square)
- Vegetable Vendor Marge, Old Gossip Gertrude (market district)
- Fisherman Harpua (river crossing)
- Captain Sloth, Gate Guard Viktor, Hendricks (guards)

KNOWN PLACES AND DIRECTIONS (from Village Square):
- Market District: EAST from Village Square
- Bakery: SOUTHEAST from Market District
- Tailor Shop: NORTHEAST from Market District
- Blacksmith Forge: NORTHEAST from Village Square
- The Inn: NORTH from Village Square
- General Store: WEST from Village Square
- Lizard Homes West: WEST from General Store (where Martha lives)
- Farmlands (Rutherford's farm): SOUTH from Lizard Homes West (so: west, west, south from square)
- River Crossing: EAST from Farmlands
- Forest Edge: EAST from River Crossing
- Icculus's Tower: Deep in the forest, past the Great Tree
- Wilson's Castle: NORTH through the border checkpoint
- Underground Tunnels: SOUTH from Farmlands

WHEN GIVING DIRECTIONS: Use the actual directions above. If you don't know, say "I'm not sure exactly."

CRITICAL: Do NOT invent people or places. Only reference characters and locations from the lists above. If you don't know someone, say "I don't know anyone by that name."

IMPORTANT:
- Never break character or mention you're an AI
- Never use asterisks for actions - describe actions in prose
- React naturally based on your personality and relationship
- When in doubt, BE HELPFUL rather than mysterious`;
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

Respond as ${context.npcName}. Stay in character. KEEP IT SHORT - 1-2 sentences, under 25 words total.`;

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

// Town Crier Announcement - generates a witty, Rosencrantz & Guildenstern style announcement
// when a player logs in. Uses full implementor-level knowledge of the player.
export async function generateTownCrierAnnouncement(
  playerId: number,
  playerName: string
): Promise<string> {
  const db = getDatabase();

  // Class names for reference
  const classNames: Record<number, string> = {
    1: 'Warrior',
    2: 'Mage',
    3: 'Rogue',
    4: 'Cleric',
    5: 'Ranger',
    6: 'Bard'
  };

  // Gather all knowledge about this player
  const player = db.prepare(`
    SELECT p.*,
           (SELECT COUNT(*) FROM social_capital WHERE player_id = p.id AND capital > 20) as friends_count,
           (SELECT COUNT(*) FROM social_capital WHERE player_id = p.id AND capital < -20) as enemies_count,
           (SELECT COUNT(*) FROM player_books WHERE author_id = p.id) as books_written,
           (SELECT COUNT(*) FROM player_employment WHERE player_id = p.id) as jobs_held,
           (SELECT SUM(tasks_completed) FROM player_employment WHERE player_id = p.id) as total_tasks
    FROM players p WHERE p.id = ?
  `).get(playerId) as any;

  // Get recent gossip about this player
  const gossip = db.prepare(`
    SELECT content, gossip_type FROM npc_gossip
    WHERE about_player_id = ?
    ORDER BY created_at DESC LIMIT 3
  `).all(playerId) as { content: string; gossip_type: string }[];

  // Get notable relationships with NPC names
  const relationships = db.prepare(`
    SELECT sc.capital, sc.trust_level, sc.times_helped, sc.times_wronged, sc.npc_id
    FROM social_capital sc
    WHERE sc.player_id = ?
    ORDER BY ABS(sc.capital) DESC
    LIMIT 5
  `).all(playerId) as any[];

  // Get best friend and worst enemy NPC names
  const bestFriend = relationships.find(r => r.capital > 30);
  const worstEnemy = relationships.find(r => r.capital < -30);

  // Build context for the crier - be SPECIFIC
  const className = classNames[player?.class_id] || 'wanderer';
  const hasHistory = player && (player.level > 1 || player.gold > 100 || relationships.length > 0 || gossip.length > 0);

  let specificDetails: string[] = [];

  // Add specific facts
  if (player?.level > 5) specificDetails.push(`Level ${player.level} veteran`);
  if (player?.gold > 1000) specificDetails.push(`notably wealthy (${player.gold} gold)`);
  if (player?.gold === 0) specificDetails.push(`completely broke`);
  if (player?.books_written > 0) specificDetails.push(`author of ${player.books_written} book(s)`);
  if (player?.total_tasks > 20) specificDetails.push(`completed ${player.total_tasks} work tasks`);
  if (player?.friends_count > 3) specificDetails.push(`well-liked (${player.friends_count} friends)`);
  if (player?.enemies_count > 0) specificDetails.push(`has made ${player.enemies_count} enemy(ies)`);
  if (bestFriend) specificDetails.push(`close friend of NPC #${bestFriend.npc_id}`);
  if (worstEnemy) specificDetails.push(`despised by NPC #${worstEnemy.npc_id}`);

  if (gossip.length > 0) {
    specificDetails.push(`Recent gossip: "${gossip[0].content}"`);
  }

  // Analyze the name for potential wordplay
  const nameLength = playerName.length;
  const startsWithVowel = /^[aeiou]/i.test(playerName);
  const hasDoubleLetters = /(.)\1/.test(playerName);

  let playerContext = `Player name: "${playerName}" (${nameLength} letters${startsWithVowel ? ', starts with vowel' : ''}${hasDoubleLetters ? ', has double letters' : ''})\n`;
  playerContext += `Class: ${className}\n`;
  playerContext += `Level: ${player?.level || 1}\n`;
  playerContext += `Gold: ${player?.gold || 0}\n`;

  if (specificDetails.length > 0) {
    playerContext += `\nSPECIFIC FACTS TO REFERENCE:\n- ${specificDetails.join('\n- ')}\n`;
  } else {
    playerContext += `\nNO HISTORY YET - this player is brand new. Comment on their NAME or CLASS instead.\n`;
    playerContext += `Name observations: "${playerName}" - consider puns, sounds, meanings, or just the strangeness of names in general.\n`;
  }

  // Check if first login ever
  const isFirstLogin = !hasHistory;

  const prompt = `You are the Town Crier of Gamehenge, in the style of Rosencrantz and Guildenstern - philosophical, absurdist, witty.

A player has just logged in. Announce their arrival in ONE short sentence (max 15 words).

${isFirstLogin ? 'This is a BRAND NEW player with no history. Make a witty observation about their NAME or their CLASS.' : 'This player has HISTORY. Reference something SPECIFIC from the facts below.'}

PLAYER INFO:
${playerContext}

REQUIREMENTS:
- ONE sentence only, under 15 words
- ${isFirstLogin ? 'Comment on their NAME (wordplay, sounds, meaning) or CLASS' : 'Reference a SPECIFIC fact from above'}
- Witty, theatrical, slightly philosophical
- NO "Hear ye" or "Oyez"
- No quotation marks

Example styles:
- "The ${className} ${playerName} arrives, as if ${className}s ever truly arrive anywhere."
- "${playerName}—a name that sounds like a sneeze, attached to a ${className}."
- "Ah, ${playerName} returns, still owing Rutherford for that harvest incident."
- "The author ${playerName} graces us—pen mightier than sword, wallet lighter than air."

Your announcement:`;

  try {
    const result = await model.generateContent(prompt);
    const announcement = result.response.text().trim();
    // Remove any quotation marks that might have slipped in
    return announcement.replace(/["""]/g, '');
  } catch (error) {
    console.error('[TownCrier] Gemini error:', error);
    // Fallback announcements in the spirit of the thing
    const fallbacks = [
      `Another soul stumbles into Gamehenge, blinking at the improbability of it all.`,
      `${playerName} arrives, as if the universe had misplaced them here on purpose.`,
      `The border admits ${playerName}, though the border has its doubts.`,
      `${playerName} enters - whether by choice or cosmic accident remains unclear.`,
      `A figure appears! It's ${playerName}, arriving precisely when they meant to. Probably.`,
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

// Generate personalized NPC description based on player's history with them
// The description adapts to what the player knows about this NPC from their interactions
export async function generatePersonalizedNpcDescription(
  npcId: number,
  npcName: string,
  npcBaseDescription: string,
  npcShortDesc: string,
  playerId: number,
  playerName: string
): Promise<string> {
  const db = getDatabase();

  // Get relationship data
  const relationship = db.prepare(`
    SELECT capital, trust_level, times_helped, times_wronged
    FROM social_capital
    WHERE player_id = ? AND npc_id = ?
  `).get(playerId, npcId) as { capital: number; trust_level: string; times_helped: number; times_wronged: number } | undefined;

  // Get player's memories of this NPC (from NPC memory table - what NPC remembers about player)
  const npcMemories = db.prepare(`
    SELECT content, importance, emotional_valence
    FROM npc_memories
    WHERE npc_id = ? AND player_id = ?
    ORDER BY importance DESC, created_at DESC
    LIMIT 5
  `).all(npcId, playerId) as { content: string; importance: number; emotional_valence: number }[];

  // Get any gossip the player might have heard about this NPC
  // (Future: implement player memory table)

  // If player has no history with this NPC, return base description
  if (!relationship && npcMemories.length === 0) {
    return npcBaseDescription;
  }

  // Build context for personalization
  let historyContext = '';

  if (relationship) {
    historyContext += `\nYour relationship: ${relationship.trust_level}`;
    if (relationship.capital > 50) {
      historyContext += ` (You're on very good terms)`;
    } else if (relationship.capital > 20) {
      historyContext += ` (They seem to like you)`;
    } else if (relationship.capital < -50) {
      historyContext += ` (They clearly dislike you)`;
    } else if (relationship.capital < -20) {
      historyContext += ` (There's tension between you)`;
    }

    if (relationship.times_helped > 0) {
      historyContext += `\nYou've helped them ${relationship.times_helped} time(s).`;
    }
    if (relationship.times_wronged > 0) {
      historyContext += `\nYou've wronged them ${relationship.times_wronged} time(s).`;
    }
  }

  if (npcMemories.length > 0) {
    historyContext += `\n\nSignificant memories between you:`;
    for (const mem of npcMemories.slice(0, 3)) {
      const sentiment = mem.emotional_valence > 0 ? '(positive)' : mem.emotional_valence < 0 ? '(negative)' : '';
      historyContext += `\n- ${mem.content} ${sentiment}`;
    }
  }

  const prompt = `Rewrite this NPC description to reflect what ${playerName} specifically knows about them.

ORIGINAL DESCRIPTION:
${npcBaseDescription}

PLAYER'S HISTORY WITH THIS NPC:
${historyContext}

REQUIREMENTS:
- Start with the physical appearance (what anyone would see)
- Add 1-2 sentences about what ${playerName} specifically knows from their interactions
- Keep it under 100 words total
- Write in second person ("You know that...", "They seem to...")
- Don't reveal things the player hasn't learned through interaction
- If relationship is bad, the description should feel tense
- If relationship is good, the description should feel warmer

Rewritten description:`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    // Fallback: append a simple relationship note to base description
    if (relationship) {
      const note = relationship.capital > 30 ? `\nThey seem pleased to see you.` :
        relationship.capital < -30 ? `\nThey regard you coldly.` :
          relationship.capital > 10 ? `\nThey nod in recognition.` :
            relationship.capital < -10 ? `\nThey seem wary of you.` : '';
      return npcBaseDescription + note;
    }
    return npcBaseDescription;
  }
}

// NPC reaction with all three POVs (1st person for NPC, 2nd person for target, 3rd person for observers)
export interface NpcReactionPOV {
  emote?: {
    first: string;   // What the NPC sees: "You nod towards Rift."
    second: string;  // What the target sees: "Innkeeper Antelope nods towards you."
    third: string;   // What others see: "Innkeeper Antelope nods towards Rift."
  };
  response?: string; // Speech is the same for everyone
}

// Generate NPC reaction to something a player said in the room
// Returns all three POVs for proper MUD-style messaging
export async function generateNpcSpeechReaction(
  npcId: number,
  npcName: string,
  npcPersonality: string,
  npcCurrentTask: string | null,
  playerId: number,
  playerName: string,
  playerSpeech: string,
  trustLevel: string
): Promise<NpcReactionPOV | null> {
  // Note: Caller can decide whether to call this function based on their own randomness
  // This function will always try to generate a reaction when called
  const db = getDatabase();

  // Get relationship context
  const relationship = db.prepare(`
    SELECT capital, times_helped, times_wronged
    FROM social_capital
    WHERE player_id = ? AND npc_id = ?
  `).get(playerId, npcId) as { capital: number; times_helped: number; times_wronged: number } | undefined;

  let relationshipContext = trustLevel;
  if (relationship) {
    if (relationship.capital > 30) relationshipContext += ' (you like them)';
    else if (relationship.capital < -30) relationshipContext += ' (you dislike them)';
    if (relationship.times_helped > 0) relationshipContext += ` (helped you ${relationship.times_helped}x)`;
    if (relationship.times_wronged > 0) relationshipContext += ` (wronged you ${relationship.times_wronged}x)`;
  }

  // Get NPC's memories of this player - CRUCIAL for context
  const memories = getNpcMemoriesOfPlayer(npcId, playerId);
  let memoryContext = '';
  if (memories.recent.length > 0 || memories.longTerm.length > 0) {
    const allMemories = [...memories.longTerm, ...memories.recent].slice(0, 8);
    memoryContext = '\nYOUR MEMORIES OF THIS PLAYER (use these!):\n' +
      allMemories.map(m => `- ${m.content}`).join('\n');
  }

  // Get conversation history for context
  const conversationHistory = getConversationHistory(playerId, npcId);
  let conversationContext = '';
  if (conversationHistory.length > 0) {
    const recentExchanges = conversationHistory.slice(-6);
    conversationContext = '\nRECENT CONVERSATION:\n' +
      recentExchanges.map(m => `${m.role === 'player' ? playerName : npcName}: ${m.content}`).join('\n') +
      '\n\nIMPORTANT: Continue the conversation naturally!';
  }

  const prompt = `You are ${npcName}. Personality: ${npcPersonality}
${npcCurrentTask ? `Currently: ${npcCurrentTask}.` : ''}
Relationship with ${playerName}: ${relationshipContext}
${memoryContext}
${conversationContext}

${playerName} says: "${playerSpeech}"

CRITICAL RULES:
1. If player references something from your MEMORIES, acknowledge it!
2. If conversation history exists, continue naturally
3. Keep responses SHORT - 1 sentence, max 15 words
4. Stay in character

KNOWN PEOPLE: Wilson, Icculus, Tela, Forbin, Wolfe, Fee, Palmer, Rutherford, Martha, Jimmy, Gordo, Elena, Possum, Pip, Antelope, Lydia, Esther, Moondog, Barnaby, Marge, Gertrude, Harpua, Sloth, Viktor, Hendricks.

DIRECTIONS FROM VILLAGE SQUARE: Market=east, Bakery=se from market, Tailor=ne from market, Forge=ne, Inn=north, Store=west, Homes=west from store, Farmlands=south from homes (west,west,south from square), River=east from farm.

Format:
EMOTE_1ST: [action or NONE]
EMOTE_2ND: [what ${playerName} sees or NONE]
EMOTE_3RD: [what others see or NONE]
SPEECH: [1 SHORT sentence, max 15 words]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse the response
    const emote1stMatch = text.match(/EMOTE_1ST:\s*(.+?)(?:\n|$)/i);
    const emote2ndMatch = text.match(/EMOTE_2ND:\s*(.+?)(?:\n|$)/i);
    const emote3rdMatch = text.match(/EMOTE_3RD:\s*(.+?)(?:\n|$)/i);
    const speechMatch = text.match(/SPEECH:\s*(.+?)(?:\n|$)/i);

    const emote1st = emote1stMatch?.[1]?.trim();
    const emote2nd = emote2ndMatch?.[1]?.trim();
    const emote3rd = emote3rdMatch?.[1]?.trim();
    const speech = speechMatch?.[1]?.trim();

    const hasEmote = emote1st && emote1st.toUpperCase() !== 'NONE';
    const hasSpeech = speech && speech.toUpperCase() !== 'NONE';

    if (!hasEmote && !hasSpeech) {
      return null;
    }

    const reaction: NpcReactionPOV = {};

    if (hasEmote && emote2nd && emote3rd) {
      reaction.emote = {
        first: emote1st!.replace(/^\*|\*$/g, ''),
        second: emote2nd.replace(/^\*|\*$/g, '').replace(/^["']|["']$/g, ''),
        third: emote3rd.replace(/^\*|\*$/g, '').replace(/^["']|["']$/g, ''),
      };
    }
    if (hasSpeech) {
      reaction.response = speech!.replace(/^["']|["']$/g, '');
    }

    return reaction;
  } catch (error) {
    console.error('[NPC Speech Reaction] Error:', error);
    return null;
  }
}

// Generate NPC emote/action when a player enters their room
// These are actions the NPC does, not dialogue - makes the world feel alive
export async function generateNpcEmote(
  npcName: string,
  npcPersonality: string,
  npcCurrentTask: string | null,
  roomName: string,
  roomFeatures?: Array<{ keywords: string[]; description: string }>
): Promise<string | null> {
  // Quick emotes for common situations - don't always need Gemini
  // These reference things we KNOW exist in the game
  const quickEmotes: Record<string, string[]> = {
    farming: [
      `${npcName} wipes sweat from their brow and continues working.`,
      `${npcName} bends over the crops, hands deep in the soil.`,
      `${npcName} hums quietly while tending the plants.`,
    ],
    cooking: [
      `${npcName} stirs a pot, fragrant steam rising.`,
      `${npcName} tastes something from a wooden spoon and nods.`,
      `${npcName} chops vegetables with practiced efficiency.`,
    ],
    selling: [
      `${npcName} arranges goods on the counter.`,
      `${npcName} polishes a display item absently.`,
      `${npcName} counts coins and makes a note.`,
    ],
    serving: [
      `${npcName} wipes down a table.`,
      `${npcName} carries drinks to another patron.`,
      `${npcName} glances around the room, attentive.`,
    ],
    patrolling: [
      `${npcName} shifts their grip on their weapon.`,
      `${npcName} scans the area with watchful eyes.`,
      `${npcName} adjusts their armor and continues patrol.`,
    ],
    smithing: [
      `${npcName} hammers at the forge, sparks flying.`,
      `${npcName} examines a piece of metalwork critically.`,
      `${npcName} pumps the bellows, making the fire roar.`,
    ],
    fishing: [
      `${npcName} casts their line with a practiced motion.`,
      `${npcName} watches the water, perfectly still.`,
      `${npcName} rebaits their hook patiently.`,
    ],
    tailoring: [
      `${npcName} measures a bolt of fabric with practiced eyes.`,
      `${npcName} threads a needle with steady hands.`,
      `${npcName} adjusts a garment on the mannequin.`,
      `${npcName} examines the stitching on a cloak.`,
      `${npcName} sorts through spools of thread.`,
    ],
    baking: [
      `${npcName} pulls a tray from the oven.`,
      `${npcName} kneads dough with practiced motions.`,
      `${npcName} dusts flour from their hands.`,
    ],
  };

  // 70% chance to use a quick emote if available (safer - no hallucinations)
  if (npcCurrentTask && quickEmotes[npcCurrentTask] && Math.random() < 0.7) {
    const emotes = quickEmotes[npcCurrentTask];
    return emotes[Math.floor(Math.random() * emotes.length)];
  }

  // Build room context from features so AI only references real things
  let roomContext = '';
  if (roomFeatures && roomFeatures.length > 0) {
    const featureNames = roomFeatures.flatMap(f => f.keywords.slice(0, 2)).join(', ');
    roomContext = `\nThings in this room: ${featureNames}. ONLY reference these objects, nothing else.`;
  }

  // Otherwise, generate with Gemini for more variety
  const prompt = `You are ${npcName} in ${roomName}. Personality: ${npcPersonality}
${npcCurrentTask ? `Currently doing: ${npcCurrentTask}` : 'Currently idle'}${roomContext}

Generate ONE short emote (action description) for this NPC. NOT dialogue - just an action.
Format: "${npcName} [action]." - keep under 15 words.

IMPORTANT: Only reference objects that actually exist in this room. Do NOT invent objects.

Examples:
- ${npcName} stretches and yawns, looking around lazily.
- ${npcName} mutters something under their breath.
- ${npcName} taps their foot impatiently.
- ${npcName} examines their fingernails with exaggerated interest.

Or respond NONE if the NPC would do nothing notable.

Your emote:`;

  try {
    const result = await model.generateContent(prompt);
    const emote = result.response.text().trim();

    if (emote.toUpperCase() === 'NONE' || emote.length < 3) return null;
    return emote.replace(/^["']|["']$/g, '');
  } catch (error) {
    // Fallback to generic emote
    const genericEmotes = [
      `${npcName} glances up briefly.`,
      `${npcName} shifts their weight.`,
      `${npcName} continues about their business.`,
    ];
    return genericEmotes[Math.floor(Math.random() * genericEmotes.length)];
  }
}

// Generate helpful guidance when player's command fails
// This makes the game feel intelligent and welcoming rather than giving cold error messages
export async function generateHelpfulGuidance(
  playerName: string,
  failedCommand: string,
  target: string,
  roomName: string,
  npcsInRoom: Array<{ name: string; keywords: string[]; type: string }>,
  itemsInRoom: Array<{ name: string; keywords: string[] }>,
  roomFeatures: Array<{ keywords: string[]; description: string }>
): Promise<string> {
  // Build context about what IS in the room
  let roomContents = '';

  if (npcsInRoom.length > 0) {
    roomContents += `NPCs here: ${npcsInRoom.map(n => `${n.name} (keywords: ${n.keywords.join(', ')})`).join('; ')}\n`;
  }
  if (itemsInRoom.length > 0) {
    roomContents += `Items here: ${itemsInRoom.map(i => `${i.name} (keywords: ${i.keywords.join(', ')})`).join('; ')}\n`;
  }
  if (roomFeatures.length > 0) {
    roomContents += `Things to examine: ${roomFeatures.map(f => f.keywords.join('/')).join(', ')}\n`;
  }

  if (!roomContents) {
    roomContents = 'The room appears empty.';
  }

  const prompt = `You are a helpful guide spirit in a MUD game. A player just tried something that didn't work.

PLAYER: ${playerName}
ROOM: ${roomName}
WHAT THEY TRIED: ${failedCommand} "${target}"
WHAT'S ACTUALLY HERE:
${roomContents}

Generate a SHORT, helpful hint (1-2 sentences max) that:
- Gently explains why "${target}" didn't work
- Suggests what they COULD do instead
- Is friendly and encouraging, not condescending
- Stays immersive (you're a mystical guide, not a game manual)
- If their target was close to something real, suggest the right keyword

Examples:
- "The spirits sense no '${target}' here... but the innkeeper behind the bar might have what you seek. Try 'talk antelope'."
- "Hmm, perhaps you meant the bartender? Try 'look bartender' or 'talk innkeeper'."
- "No lizard by that name here, though Farmer Rutherford is tending his crops nearby."

Your helpful hint (NO quotation marks around the whole thing):`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    // Fallback - still try to be helpful
    if (npcsInRoom.length > 0) {
      const suggestions = npcsInRoom.slice(0, 3).map(n => n.keywords[0] || n.name.split(' ')[0].toLowerCase());
      return `Hmm, no "${target}" here. Try: ${suggestions.join(', ')}`;
    }
    return `You don't see "${target}" here.`;
  }
}

// Generate NPC comment when a player enters their room
// NPCs notice arrivals and comment based on their personality and knowledge of the player
export async function generateNpcRoomEntryComment(
  npcId: number,
  npcName: string,
  npcPersonality: string,
  playerId: number,
  playerName: string,
  roomName: string
): Promise<string | null> {
  const db = getDatabase();

  // Random chance to comment (70% - most NPCs are social)
  if (Math.random() > 0.7) return null;

  // Get NPC's relationship with this player
  const relationship = db.prepare(`
    SELECT capital, trust_level, times_helped, times_wronged
    FROM social_capital
    WHERE player_id = ? AND npc_id = ?
  `).get(playerId, npcId) as { capital: number; trust_level: string; times_helped: number; times_wronged: number } | undefined;

  // Get NPC's memories of this player
  const memories = db.prepare(`
    SELECT content, importance, emotional_valence
    FROM npc_memory
    WHERE npc_id = ? AND player_involved = ?
    ORDER BY importance DESC, created_at DESC
    LIMIT 3
  `).all(npcId, playerId) as { content: string; importance: number; emotional_valence: number }[];

  // Get gossip the NPC has heard about this player
  const gossip = db.prepare(`
    SELECT content, gossip_type
    FROM npc_gossip
    WHERE about_player_id = ? AND ? IN (
      SELECT value FROM json_each(spread_to)
    )
    ORDER BY created_at DESC
    LIMIT 2
  `).all(playerId, npcId.toString()) as { content: string; gossip_type: string }[];

  // Get player info
  const player = db.prepare(`SELECT level, gold, class_id FROM players WHERE id = ?`).get(playerId) as any;

  // Build context
  let context = `Room: ${roomName}\n`;
  context += `Player "${playerName}" just entered.\n`;
  context += `Player is level ${player?.level || 1} with ${player?.gold || 0} gold.\n`;

  if (relationship) {
    context += `\nYour relationship: ${relationship.trust_level} (${relationship.capital > 0 ? 'positive' : relationship.capital < 0 ? 'negative' : 'neutral'})\n`;
    if (relationship.times_helped > 0) context += `They've helped you ${relationship.times_helped} time(s).\n`;
    if (relationship.times_wronged > 0) context += `They've wronged you ${relationship.times_wronged} time(s).\n`;
  } else {
    context += `\nYou don't know this person - they're a stranger.\n`;
  }

  if (memories.length > 0) {
    context += `\nYour memories of them:\n`;
    memories.forEach(m => {
      context += `- ${m.content} (${m.emotional_valence > 0 ? 'positive' : m.emotional_valence < 0 ? 'negative' : 'neutral'} memory)\n`;
    });
  }

  if (gossip.length > 0) {
    context += `\nGossip you've heard about them:\n`;
    gossip.forEach(g => context += `- ${g.content}\n`);
  }

  const prompt = `You are ${npcName} in Gamehenge. Your personality: ${npcPersonality}

Someone just walked into your area. Generate a SHORT reaction (one sentence, under 15 words).

${context}

REQUIREMENTS:
- ONE sentence only, very short
- In character for your personality
- If you know them, reference something specific
- If they're a stranger, react based on their appearance/class
- Can be greeting, observation, muttering, or comment to nearby NPCs
- Format: *action* dialogue OR just dialogue
- NO quotation marks

Examples:
- *glances up* Another wanderer. These roads see more feet than the inn sees coin.
- Ah, ${playerName}. Back for more, are we?
- *nods curtly* You.
- *squints suspiciously* Haven't seen your face before.
- *brightens* My favorite customer returns!

Your reaction (or respond with NONE if you'd ignore them):`;

  try {
    const result = await model.generateContent(prompt);
    const comment = result.response.text().trim();

    // If NPC decided to stay silent
    if (comment.toUpperCase() === 'NONE' || comment.length < 3) return null;

    // Clean up the response
    return comment.replace(/["""]/g, '');
  } catch (error) {
    console.error(`[NPC Comment] Gemini error for ${npcName}:`, error);
    return null;
  }
}

// Generate helpful command guidance for players using the "brain" command
// This helps players figure out how to do things in the game
export async function generateBrainHelp(
  playerQuestion: string,
  currentRoom: string,
  npcsInRoom: string[],
  playerInventory: string[],
  recentContext?: string
): Promise<string> {
  const availableCommands = `
MOVEMENT: north/n, south/s, east/e, west/w, up/u, down/d, flee
LOOKING: look/l [target], examine/x [target]
ITEMS: take/get <item>, drop <item>, inventory/i, equipment/eq, wear/wield <item>, remove <slot>
CHARACTER: score/sc, vitals, skills, quests
COMBAT: kill/k <target>, cast <spell> [target], consider/con <target>, flee
COMMUNICATION: say/' <msg>, tell <name> <msg>, reply/r <msg>, shout <msg>, gossip/. <msg>, who, where <player>, people/scan (list everyone in room)
INTERACTION: talk <npc>, assist [npc], give <item> <npc> or give <amount> <player>
SURVIVAL: eat <food>, drink <water>, rest/sleep, wake/stand
ECONOMY: jobs, apply <job#>, work, quit, buy <item>, sell <item>, list
GATHERING: dig (shovel needed), chop (axe needed), mine (pickaxe needed), fish (line needed)
BUILDING: plots, survey, build <type> <x> <y>, demolish <x> <y>, materials
CREATIVE: write <title/text>, paint <title>, draw <x> <y> <char>, compose <title>, play <song>
OTHER: time, help, save
`;

  const prompt = `You are the "brain" - an internal voice that helps MUD game players figure out commands.

AVAILABLE COMMANDS:
${availableCommands}

CURRENT SITUATION:
- Room: ${currentRoom}
- NPCs here: ${npcsInRoom.length > 0 ? npcsInRoom.join(', ') : 'none'}
- Player has: ${playerInventory.length > 0 ? playerInventory.slice(0, 5).join(', ') : 'nothing special'}
${recentContext ? `- Recent context: ${recentContext}` : ''}

PLAYER'S QUESTION: "${playerQuestion}"

Respond helpfully in 1-3 sentences. Be concise and direct. Include the exact command(s) they need.
If they want to interact with someone, suggest "talk <name>" or give specific NPC names from the room.
Don't lecture or over-explain. Just help them do what they want to do.
Format commands in quotes like "look at sword" or "talk esther".

Your helpful response:`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('[Brain] Gemini error:', error);
    return 'Your brain is foggy at the moment. Try "help" for a list of commands.';
  }
}

// === NPC-TO-NPC INTERACTIONS ===

// Context for NPC-to-NPC conversation
export interface NpcToNpcContext {
  speakerId: number;
  speakerName: string;
  speakerPersonality: string;
  speakerCurrentTask: string | null;
  speakerMood: string;
  listenerId: number;
  listenerName: string;
  listenerPersonality: string;
  listenerCurrentTask: string | null;
  relationshipType: string;
  affinity: number;  // -100 to 100
  recentMemories: string[];  // Recent things that happened between them
  roomName: string;
  timeOfDay: string;
}

// Result of NPC-to-NPC interaction
export interface NpcToNpcInteraction {
  speakerEmote?: string;      // What the speaker does (visible to room)
  speakerSpeech?: string;     // What the speaker says
  listenerEmote?: string;     // How the listener reacts (emote)
  listenerSpeech?: string;    // How the listener responds
  memoryForSpeaker?: string;  // What the speaker will remember
  memoryForListener?: string; // What the listener will remember
  affinityChange?: number;    // How their relationship changes (-5 to +5)
}

// Generate an NPC-to-NPC interaction (conversation or emote exchange)
export async function generateNpcToNpcInteraction(
  context: NpcToNpcContext
): Promise<NpcToNpcInteraction | null> {
  // Build relationship description
  let relationshipDesc = context.relationshipType;
  if (context.affinity > 70) relationshipDesc += ' (very close)';
  else if (context.affinity > 30) relationshipDesc += ' (friendly)';
  else if (context.affinity > -30) relationshipDesc += ' (neutral)';
  else if (context.affinity > -70) relationshipDesc += ' (tense)';
  else relationshipDesc += ' (hostile)';

  const memoriesText = context.recentMemories.length > 0
    ? context.recentMemories.slice(0, 3).map(m => `- ${m}`).join('\n')
    : 'No recent shared memories.';

  const prompt = `Two NPCs in Gamehenge are in the same room and might interact.

SPEAKER: ${context.speakerName}
- Personality: ${context.speakerPersonality}
- Currently doing: ${context.speakerCurrentTask || 'idle'}
- Mood: ${context.speakerMood}

LISTENER: ${context.listenerName}
- Personality: ${context.listenerPersonality}
- Currently doing: ${context.listenerCurrentTask || 'idle'}

RELATIONSHIP: ${relationshipDesc} (affinity: ${context.affinity})
RECENT SHARED EXPERIENCES:
${memoriesText}

SETTING: ${context.roomName}, ${context.timeOfDay}

KNOWN PEOPLE they might mention: Wilson (tyrant), Icculus (prophet), Tela (resistance), Fee (weasel), Farmer Rutherford, Martha, Gordo, Baker Possum, Innkeeper Antelope, Tailor Lydia, Healer Esther, Elder Moondog.
NEVER invent other people.

Generate a SHORT, natural interaction. Could be:
- A greeting or comment
- Discussing work or weather
- Sharing gossip about someone they both know
- A philosophical observation (in the Rosencrantz & Guildenstern style)
- A complaint or concern about Wilson's rule
- Just an emote exchange (nod, wave, etc.)

Format your response EXACTLY as:
SPEAKER_EMOTE: [action or NONE]
SPEAKER_SPEECH: [what they say or NONE]
LISTENER_EMOTE: [reaction or NONE]
LISTENER_SPEECH: [response or NONE]
SPEAKER_MEMORY: [1 sentence summary of what ${context.speakerName} will remember, or NONE]
LISTENER_MEMORY: [1 sentence summary of what ${context.listenerName} will remember, or NONE]
AFFINITY_CHANGE: [number from -5 to +5, or 0 if neutral]

CRITICAL: Keep it VERY SHORT!
- Each speech: 1 sentence, under 12 words
- These are background ambient interactions
- If they would ignore each other, all NONE and AFFINITY_CHANGE: 0.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse the response
    const speakerEmoteMatch = text.match(/SPEAKER_EMOTE:\s*(.+?)(?:\n|$)/i);
    const speakerSpeechMatch = text.match(/SPEAKER_SPEECH:\s*(.+?)(?:\n|$)/i);
    const listenerEmoteMatch = text.match(/LISTENER_EMOTE:\s*(.+?)(?:\n|$)/i);
    const listenerSpeechMatch = text.match(/LISTENER_SPEECH:\s*(.+?)(?:\n|$)/i);
    const speakerMemoryMatch = text.match(/SPEAKER_MEMORY:\s*(.+?)(?:\n|$)/i);
    const listenerMemoryMatch = text.match(/LISTENER_MEMORY:\s*(.+?)(?:\n|$)/i);
    const affinityMatch = text.match(/AFFINITY_CHANGE:\s*([-+]?\d+)/i);

    const clean = (s: string | undefined) => {
      if (!s) return undefined;
      const cleaned = s.trim().replace(/^["']|["']$/g, '');
      return cleaned.toUpperCase() === 'NONE' ? undefined : cleaned;
    };

    const interaction: NpcToNpcInteraction = {};

    if (clean(speakerEmoteMatch?.[1])) interaction.speakerEmote = clean(speakerEmoteMatch?.[1]);
    if (clean(speakerSpeechMatch?.[1])) interaction.speakerSpeech = clean(speakerSpeechMatch?.[1]);
    if (clean(listenerEmoteMatch?.[1])) interaction.listenerEmote = clean(listenerEmoteMatch?.[1]);
    if (clean(listenerSpeechMatch?.[1])) interaction.listenerSpeech = clean(listenerSpeechMatch?.[1]);
    if (clean(speakerMemoryMatch?.[1])) interaction.memoryForSpeaker = clean(speakerMemoryMatch?.[1]);
    if (clean(listenerMemoryMatch?.[1])) interaction.memoryForListener = clean(listenerMemoryMatch?.[1]);

    const affinityChange = parseInt(affinityMatch?.[1] || '0', 10);
    if (affinityChange !== 0) {
      interaction.affinityChange = Math.max(-5, Math.min(5, affinityChange));
    }

    // If nothing happened, return null
    if (!interaction.speakerEmote && !interaction.speakerSpeech &&
        !interaction.listenerEmote && !interaction.listenerSpeech) {
      return null;
    }

    return interaction;
  } catch (error) {
    console.error('[NpcToNpc] Gemini error:', error);
    return null;
  }
}

// Add a memory between two NPCs
export function addNpcToNpcMemory(
  npcId: number,
  aboutNpcId: number,
  content: string,
  importance: number = 5,
  emotionalValence: number = 0
): void {
  const db = getDatabase();

  try {
    db.prepare(`
      INSERT INTO npc_npc_memories (npc_id, about_npc_id, content, importance, emotional_valence, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(npcId, aboutNpcId, content, Math.min(10, Math.max(1, importance)), emotionalValence);

    console.log(`[NpcMemory] NPC ${npcId} remembers about NPC ${aboutNpcId}: "${content}"`);
  } catch (error) {
    // Table might not exist yet - that's ok
  }
}

// Get memories an NPC has about another NPC
export function getNpcMemoriesOfNpc(npcId: number, aboutNpcId: number): string[] {
  const db = getDatabase();

  try {
    const memories = db.prepare(`
      SELECT content FROM npc_npc_memories
      WHERE npc_id = ? AND about_npc_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(npcId, aboutNpcId) as { content: string }[];

    return memories.map(m => m.content);
  } catch (error) {
    return [];
  }
}

// Generate a contextual purpose for an NPC when they enter a room
// This explains WHY they're there, making the world feel more alive
export async function generateNpcPurpose(
  npcName: string,
  npcPersonality: string,
  npcJob: string,
  homeRoom: string,
  workRoom: string,
  destinationRoom: string,
  destinationRoomName: string,
  scheduleActivity: string,
  timeOfDay: string
): Promise<string> {
  // Quick purposes for common situations - don't always need Gemini
  const quickPurposes: Record<string, Record<string, string[]>> = {
    // At the inn
    'the_inn': {
      'socialize': [
        'having a drink after a long day',
        'meeting a friend for dinner',
        'catching up on village gossip',
        'taking a well-earned break',
        'warming up by the fire',
      ],
      'eat': [
        'grabbing a quick meal',
        'having dinner before heading home',
        'treating themselves to Antelope\'s famous stew',
      ],
      'rest': [
        'getting some rest away from home',
        'waiting out a headache with some quiet',
      ],
    },
    // At the market
    'market_district': {
      'socialize': [
        'browsing the stalls',
        'picking up a few things',
        'looking for a good deal',
        'checking what\'s fresh today',
      ],
      'wander': [
        'running errands',
        'looking for something specific',
        'comparing prices',
      ],
    },
    // At the bakery
    'bakery': {
      'eat': [
        'picking up bread for dinner',
        'getting a sweet roll as a treat',
        'buying breakfast supplies',
      ],
      'socialize': [
        'chatting with Possum',
        'enjoying the warm smell of fresh bread',
      ],
    },
    // At the village square
    'village_square': {
      'socialize': [
        'catching up with neighbors',
        'listening for news',
        'enjoying the afternoon',
        'taking a break from work',
      ],
      'wander': [
        'passing through on the way somewhere',
        'stretching their legs',
        'getting some fresh air',
      ],
    },
  };

  // Try to use a quick purpose first
  const roomPurposes = quickPurposes[destinationRoom];
  if (roomPurposes) {
    const activityPurposes = roomPurposes[scheduleActivity] || roomPurposes['socialize'];
    if (activityPurposes && activityPurposes.length > 0) {
      // Pick consistently based on NPC name hash so same NPC gets same purpose for a while
      const hash = npcName.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const timeHash = Math.floor(Date.now() / (30 * 60 * 1000)); // Changes every 30 min
      const index = (hash + timeHash) % activityPurposes.length;
      return activityPurposes[index];
    }
  }

  // For uncommon situations, use Gemini to generate a purpose
  const prompt = `You are generating a brief reason why ${npcName} has come to ${destinationRoomName}.

CHARACTER: ${npcName}
- Personality: ${npcPersonality}
- Job/role: ${npcJob}
- Home: ${homeRoom}
- Work: ${workRoom}
- Time of day: ${timeOfDay}
- Schedule says they should: ${scheduleActivity}

Generate ONE short phrase (4-8 words) explaining why they're at ${destinationRoomName}.
Should be a mundane, believable reason - nothing dramatic.
Don't use ${npcName}'s name in the response.
Examples: "picking up supplies for tomorrow", "meeting someone for lunch", "looking for their friend", "taking a shortcut home"

Their purpose:`;

  try {
    const result = await model.generateContent(prompt);
    const purpose = result.response.text().trim().replace(/^["']|["']$/g, '').toLowerCase();
    // Validate it's reasonable length
    if (purpose.length > 5 && purpose.length < 100) {
      return purpose;
    }
    return 'going about their day';
  } catch (error) {
    // Fallback purposes
    const fallbacks = [
      'going about their day',
      'on an errand',
      'taking a break',
      'passing through',
      'running errands',
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}
