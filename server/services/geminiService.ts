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
  }

  const prompt = `You are ${npcName} in a room. Personality: ${npcPersonality}
${npcCurrentTask ? `You're currently ${npcCurrentTask}.` : 'You\'re idle.'}
Your relationship with ${playerName}: ${relationshipContext}

${playerName} just said out loud: "${playerSpeech}"

How do you react? You can:
- Just speak (no emote)
- Just emote (no speech)
- Both emote and speak
- Or stay silent (all NONE)

If you emote, provide THREE perspectives. Start each with lowercase (we add the name).

Format your response EXACTLY as:
EMOTE_1ST: [your perspective starting lowercase, or NONE]
EMOTE_2ND: [what ${playerName} sees starting lowercase, or NONE]
EMOTE_3RD: [what others see starting lowercase, or NONE]
SPEECH: [words you say out loud, or NONE]

Example 1 - just speech:
EMOTE_1ST: NONE
EMOTE_2ND: NONE
EMOTE_3RD: NONE
SPEECH: Evening.

Example 2 - just emote:
EMOTE_1ST: glance up from your work.
EMOTE_2ND: glances up from their work at you.
EMOTE_3RD: glances up from their work at ${playerName}.
SPEECH: NONE

Example 3 - both:
EMOTE_1ST: pause and look over.
EMOTE_2ND: pauses and looks over at you.
EMOTE_3RD: pauses and looks over at ${playerName}.
SPEECH: What do you want?`;

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
  roomName: string
): Promise<string | null> {
  // Quick emotes for common situations - don't always need Gemini
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
  };

  // 60% chance to use a quick emote if available
  if (npcCurrentTask && quickEmotes[npcCurrentTask] && Math.random() < 0.6) {
    const emotes = quickEmotes[npcCurrentTask];
    return emotes[Math.floor(Math.random() * emotes.length)];
  }

  // Otherwise, generate with Gemini for more variety
  const prompt = `You are ${npcName} in ${roomName}. Personality: ${npcPersonality}
${npcCurrentTask ? `Currently doing: ${npcCurrentTask}` : 'Currently idle'}

Generate ONE short emote (action description) for this NPC. NOT dialogue - just an action.
Format: "${npcName} [action]." - keep under 15 words.

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
