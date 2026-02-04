// Communication Commands for FROBARK MUD
import { connectionManager } from '../managers/connectionManager';
import { worldManager } from '../managers/worldManager';
import { playerManager } from '../managers/playerManager';
import { npcManager } from '../managers/npcManager';
import { getDatabase, playerQueries, roomNpcQueries } from '../database';
import { generateNpcSpeechReaction, addNpcMemory, addToConversationHistory } from '../services/geminiService';
import { npcTemplates, getNpcPersonalityPrompt } from '../data/npcs';
import { itemTemplates } from '../data/items';
import type { CommandContext } from './index';

// === NPC ITEM GIVING SYSTEM ===
// NPCs can give items when they promise them in dialogue
// Maps NPC template IDs to items they can freely give (value 0 or very cheap items)

interface NpcGivableItem {
  keywords: string[];     // Words in NPC speech that trigger giving this item
  itemId: number;         // Item template ID
  itemName: string;       // For logging
  requiresGoodRelation?: boolean; // Only give if player has positive social capital
}

// NPCs and the free/cheap items they can give
const npcGivableItems: Record<number, NpcGivableItem[]> = {
  // Innkeeper Antelope (id: 9)
  9: [
    { keywords: ['water', 'here\'s water', 'have some water', 'free water', 'give you water'], itemId: 212, itemName: 'River Water' },
    { keywords: ['bread', 'here\'s bread', 'have some bread'], itemId: 200, itemName: 'Fresh Bread Loaf', requiresGoodRelation: true },
  ],
  // Baker Possum (id: 11)
  11: [
    { keywords: ['bread', 'here\'s bread', 'have this', 'take this'], itemId: 200, itemName: 'Fresh Bread Loaf', requiresGoodRelation: true },
    { keywords: ['crust', 'old bread', 'stale'], itemId: 56, itemName: 'Stale Bread Crust' },
  ],
  // Farmer Rutherford (id: 7)
  7: [
    { keywords: ['apple', 'here\'s an apple', 'have an apple', 'take this apple'], itemId: 213, itemName: 'Gamehenge Apple' },
    { keywords: ['water', 'have some water'], itemId: 212, itemName: 'River Water' },
  ],
  // Healer Esther (id: 14)
  14: [
    { keywords: ['water', 'drink this', 'have some water'], itemId: 212, itemName: 'River Water' },
  ],
  // Vegetable Vendor Marge (id: 15)
  15: [
    { keywords: ['apple', 'have this', 'try one'], itemId: 213, itemName: 'Gamehenge Apple', requiresGoodRelation: true },
  ],
};

// Check if an NPC's response indicates they're giving an item
function checkNpcGivingItem(
  npcTemplateId: number,
  npcResponse: string,
  playerId: number
): { itemId: number; itemName: string } | null {
  const givableItems = npcGivableItems[npcTemplateId];
  if (!givableItems) return null;

  const responseLower = npcResponse.toLowerCase();

  // Check for giving patterns in the response
  const givingPatterns = [
    /here('s| is)/i,
    /take (this|it)/i,
    /have (some|this|a)/i,
    /give you/i,
    /hands you/i,
    /passes you/i,
    /offers you/i,
  ];

  const hasGivingLanguage = givingPatterns.some(pattern => pattern.test(npcResponse));
  if (!hasGivingLanguage) return null;

  // Check which item matches
  for (const item of givableItems) {
    // Check if any keyword appears in the response
    const hasKeyword = item.keywords.some(keyword => responseLower.includes(keyword.toLowerCase()));
    if (hasKeyword) {
      // Check if good relation required
      if (item.requiresGoodRelation) {
        const db = getDatabase();
        const relationship = db.prepare(`
          SELECT capital FROM social_capital
          WHERE player_id = ? AND npc_id = ?
        `).get(playerId, npcTemplateId) as { capital: number } | undefined;

        if (!relationship || relationship.capital < 10) {
          continue; // Skip this item, need better relationship
        }
      }

      return { itemId: item.itemId, itemName: item.itemName };
    }
  }

  return null;
}

// Track the last NPC each player interacted with (for "reply" command)
const lastNpcInteraction: Map<number, { npcId: number; npcName: string; roomId: string }> = new Map();

// Track the last speaker in each room (for contextual social reactions)
// When an NPC speaks in a room, we record it so that if a player does a solo
// social (like "laugh") shortly after, we know who they're laughing at
interface RoomLastSpeaker {
  speakerType: 'npc' | 'player';
  speakerId: number;  // NPC template ID or player ID
  speakerName: string;
  whatTheySaid: string;
  timestamp: number;
}
const roomLastSpeaker: Map<string, RoomLastSpeaker> = new Map();

// Record when someone speaks in a room (call this when NPC or player says something)
export function recordRoomSpeaker(
  roomId: string,
  speakerType: 'npc' | 'player',
  speakerId: number,
  speakerName: string,
  whatTheySaid: string
): void {
  roomLastSpeaker.set(roomId, {
    speakerType,
    speakerId,
    speakerName,
    whatTheySaid,
    timestamp: Date.now()
  });
}

// Get the last speaker in a room (returns undefined if too old - 60 seconds)
export function getLastRoomSpeaker(roomId: string): RoomLastSpeaker | undefined {
  const speaker = roomLastSpeaker.get(roomId);
  if (!speaker) return undefined;

  // Only return if within 60 seconds (relevant context window)
  const ageMs = Date.now() - speaker.timestamp;
  if (ageMs > 60000) return undefined;

  return speaker;
}

// Get the last NPC a player spoke to
export function getLastNpcInteraction(playerId: number): { npcId: number; npcName: string; roomId: string } | undefined {
  return lastNpcInteraction.get(playerId);
}

// Update the last NPC a player spoke to
export function setLastNpcInteraction(playerId: number, npcId: number, npcName: string, roomId: string): void {
  lastNpcInteraction.set(playerId, { npcId, npcName, roomId });
}

export function processCommunicationCommand(ctx: CommandContext, action: string): void {
  switch (action) {
    case 'say':
      processSay(ctx);
      break;
    case 'shout':
      processShout(ctx);
      break;
    case 'gossip':
      processGossip(ctx);
      break;
    case 'tell':
      processTell(ctx);
      break;
    case 'who':
      processWho(ctx);
      break;
  }
}

function sendOutput(playerId: number, text: string, type: 'normal' | 'chat' = 'normal'): void {
  connectionManager.sendToPlayer(playerId, {
    type: 'output',
    text,
    messageType: type === 'chat' ? 'chat' : 'normal',
  });
}

function processSay(ctx: CommandContext): void {
  const message = ctx.args.join(' ');

  // Send to speaker
  sendOutput(ctx.playerId, `You say, "${message}"`, 'chat');

  // Send to others in room
  const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
  for (const otherId of playersInRoom) {
    if (otherId !== ctx.playerId) {
      connectionManager.sendToPlayer(otherId, {
        type: 'chat',
        channel: 'say',
        from: ctx.playerName,
        message,
      });
    }
  }

  // NPCs in the room may react to what was said
  triggerNpcSpeechReactions(ctx, message);
}

// NPCs react to player speech - makes the world feel alive
async function triggerNpcSpeechReactions(ctx: CommandContext, message: string): Promise<void> {
  const db = getDatabase();

  // Get NPCs in this room
  const npcsInRoom = roomNpcQueries.getByRoom(db).all(ctx.roomId) as {
    id: number;
    npcTemplateId: number;
  }[];

  // Filter to friendly NPCs only
  const friendlyNpcs = npcsInRoom.filter(npc => {
    const template = npcTemplates.find(t => t.id === npc.npcTemplateId);
    return template && template.type !== 'enemy';
  });

  if (friendlyNpcs.length === 0) return;

  // Check if any NPC is specifically mentioned by name in the message
  const messageLower = message.toLowerCase();
  let mentionedNpc: typeof friendlyNpcs[0] | null = null;
  let mentionedTemplate: typeof npcTemplates[0] | null = null;

  for (const npc of friendlyNpcs) {
    const template = npcTemplates.find(t => t.id === npc.npcTemplateId);
    if (!template) continue;

    // Check if NPC's name is mentioned - check all parts of their name
    // For "Vegetable Vendor Marge", check: "vegetable", "vendor", "marge"
    const nameParts = template.name.toLowerCase().split(' ');
    const fullName = template.name.toLowerCase();

    // Check full name first
    if (messageLower.includes(fullName)) {
      mentionedNpc = npc;
      mentionedTemplate = template;
      console.log(`[NPC Speech] "${template.name}" was mentioned by full name in the message`);
      break;
    }

    // Check each part of the name (prioritize last name / personal name)
    // Common patterns: "Farmer Rutherford", "Vegetable Vendor Marge", "Old Gossip Gertrude"
    for (const part of nameParts) {
      // Skip very short words and common titles
      if (part.length < 3 || ['the', 'old', 'young', 'sir', 'lady'].includes(part)) continue;

      if (messageLower.includes(part)) {
        mentionedNpc = npc;
        mentionedTemplate = template;
        console.log(`[NPC Speech] "${template.name}" was mentioned (matched "${part}") in the message`);
        break;
      }
    }
    if (mentionedNpc) break;
  }

  // If an NPC was mentioned by name, ONLY they respond - no one else
  if (mentionedNpc && mentionedTemplate) {
    console.log(`[NPC Speech] Only ${mentionedTemplate.name} will respond (was addressed directly)`);
    await generateAndSendNpcReaction(ctx, mentionedNpc, mentionedTemplate, message, true);
    return;
  }

  // No one was mentioned specifically - check if there's a recent speaker they're replying to
  // This handles messages like "rhyming?" or "sure" or "thanks" - replies to whoever just spoke
  const lastSpeaker = getLastRoomSpeaker(ctx.roomId);
  if (lastSpeaker && lastSpeaker.speakerType === 'npc') {
    // Check if the message seems like a reply (short, or a question about what was said)
    const isShortReply = message.length < 15;
    const isQuestionAboutLastMessage = message.includes('?') && message.length < 30;
    // Check if the player's message references something from the last speaker's message
    const lastMessageWords = lastSpeaker.whatTheySaid.toLowerCase().split(/\s+/);
    const playerWords = message.toLowerCase().split(/\s+/);
    const hasOverlap = playerWords.some(w => w.length > 3 && lastMessageWords.includes(w));

    if (isShortReply || isQuestionAboutLastMessage || hasOverlap) {
      const lastNpc = friendlyNpcs.find(n => n.npcTemplateId === lastSpeaker.speakerId);
      const lastTemplate = lastNpc ? npcTemplates.find(t => t.id === lastNpc.npcTemplateId) : null;
      if (lastNpc && lastTemplate) {
        console.log(`[NPC Speech] Reply "${message}" - routing to last speaker: ${lastTemplate.name}`);
        await generateAndSendNpcReaction(ctx, lastNpc, lastTemplate, message, true);
        return;
      }
    }
  }

  // Generic speech - one random NPC responds
  const primaryNpc = friendlyNpcs[Math.floor(Math.random() * friendlyNpcs.length)];
  const primaryTemplate = npcTemplates.find(t => t.id === primaryNpc.npcTemplateId);
  if (!primaryTemplate) return;

  console.log(`[NPC Speech] Generic speech - ${primaryTemplate.name} will respond`);
  await generateAndSendNpcReaction(ctx, primaryNpc, primaryTemplate, message, false);

  // Very small chance (10%) for ONE other NPC to also chime in - but only for general statements
  // NOT for short replies
  if (message.length > 10 && friendlyNpcs.length > 1 && Math.random() < 0.1) {
    const otherNpcs = friendlyNpcs.filter(n => n.npcTemplateId !== primaryNpc.npcTemplateId);
    if (otherNpcs.length > 0) {
      const secondaryNpc = otherNpcs[Math.floor(Math.random() * otherNpcs.length)];
      const secondaryTemplate = npcTemplates.find(t => t.id === secondaryNpc.npcTemplateId);
      if (secondaryTemplate) {
        // Small delay before secondary NPC responds
        setTimeout(() => {
          generateAndSendNpcReaction(ctx, secondaryNpc, secondaryTemplate, message, false);
        }, 2000);
      }
    }
  }
}

// Generate and send an NPC's reaction to player speech
async function generateAndSendNpcReaction(
  ctx: CommandContext,
  npc: { id: number; npcTemplateId: number },
  template: typeof npcTemplates[0],
  message: string,
  wasMentioned: boolean
): Promise<void> {
  const db = getDatabase();

  // Get NPC's relationship with player
  const relationship = db.prepare(`
    SELECT trust_level FROM social_capital
    WHERE player_id = ? AND npc_id = ?
  `).get(ctx.playerId, npc.npcTemplateId) as { trust_level: string } | undefined;

  const trustLevel = relationship?.trust_level || 'stranger';
  const personality = getNpcPersonalityPrompt(npc.npcTemplateId);

  // Get NPC's current task
  const npcState = db.prepare(`
    SELECT current_task FROM npc_state
    WHERE npc_template_id = ?
  `).get(npc.npcTemplateId) as { current_task: string | null } | undefined;

  console.log(`[NPC Speech] Generating reaction from ${template.name} (id: ${npc.npcTemplateId}) to "${message}"`);
  console.log(`[NPC Speech] Context: trustLevel=${trustLevel}, task=${npcState?.current_task || 'none'}`);

  try {
    const reaction = await generateNpcSpeechReaction(
      npc.npcTemplateId,
      template.name,
      personality,
      npcState?.current_task || null,
      ctx.playerId,
      ctx.playerName,
      message,
      trustLevel
    );
    console.log(`[NPC Speech] Gemini returned:`, JSON.stringify(reaction));

    // Record this interaction in NPC memory regardless of reaction
    addNpcMemory(
      npc.npcTemplateId,
      ctx.playerId,
      'interaction',
      `${ctx.playerName} said: "${message.substring(0, 80)}"`,
      3, // Medium importance
      0  // Neutral valence by default
    );

    // Check if we got a meaningful reaction
    const hasReaction = reaction && (reaction.emote || reaction.response);
    console.log(`[NPC Speech] ${template.name} reaction:`, JSON.stringify(reaction), `hasReaction: ${hasReaction}`);

    if (hasReaction) {
      // Send emote if present - use 2nd person POV for the target player
      if (reaction.emote) {
        // Capitalize and add NPC name prefix
        const emote2nd = reaction.emote.second.charAt(0).toUpperCase() + reaction.emote.second.slice(1);
        const emote3rd = reaction.emote.third.charAt(0).toUpperCase() + reaction.emote.third.slice(1);

        console.log(`[NPC Speech] Sending emote (2nd person): "${template.name} ${emote2nd}"`);
        sendOutput(ctx.playerId, `\n${template.name} ${emote2nd}`);

        // Send 3rd person to other players in room
        const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
        for (const otherId of playersInRoom) {
          if (otherId !== ctx.playerId) {
            sendOutput(otherId, `\n${template.name} ${emote3rd}`);
          }
        }
      }

      // Send response if present - same for everyone
      if (reaction.response) {
        // Small delay if there was an emote
        if (reaction.emote) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        console.log(`[NPC Speech] Sending response: "${template.name} says, ${reaction.response}"`);
        sendOutput(ctx.playerId, `${template.name} says, "${reaction.response}"`);

        // Send to other players too
        const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
        for (const otherId of playersInRoom) {
          if (otherId !== ctx.playerId) {
            sendOutput(otherId, `${template.name} says, "${reaction.response}"`);
          }
        }

        // Track this NPC as the last one the player talked to (for "reply" command)
        setLastNpcInteraction(ctx.playerId, npc.npcTemplateId, template.name, ctx.roomId);

        // Record this NPC as the last speaker in the room (for contextual social reactions)
        recordRoomSpeaker(ctx.roomId, 'npc', npc.npcTemplateId, template.name, reaction.response);

        // Add to conversation history for context in future exchanges
        addToConversationHistory(ctx.playerId, npc.npcTemplateId, 'player', message);
        addToConversationHistory(ctx.playerId, npc.npcTemplateId, 'npc', reaction.response);

        // Check if NPC is giving an item in their response
        const givenItem = checkNpcGivingItem(npc.npcTemplateId, reaction.response, ctx.playerId);
        if (givenItem) {
          // Actually give the item to the player
          const result = playerManager.addItemToInventory(ctx.playerId, givenItem.itemId, 1);
          if (result.success) {
            const itemTemplate = itemTemplates.find(t => t.id === givenItem.itemId);
            const itemDisplayName = itemTemplate?.name || givenItem.itemName;
            sendOutput(ctx.playerId, `\n[${template.name} gives you ${itemDisplayName}.]`);
            console.log(`[NPC Give] ${template.name} gave ${itemDisplayName} to ${ctx.playerName}`);

            // Record this in memory as a positive interaction
            addNpcMemory(
              npc.npcTemplateId,
              ctx.playerId,
              'interaction',
              `Gave ${ctx.playerName} ${itemDisplayName}`,
              4, // Moderate importance
              1  // Positive valence
            );
          }
        }
      }
    } else {
      // Fallback: NPC always does something minimal
      const fallbackEmotes2nd = [
        `${template.name} glances up at you briefly.`,
        `${template.name} looks over at you.`,
        `${template.name} pauses for a moment.`,
        `${template.name} tilts their head slightly towards you.`,
        `${template.name} acknowledges you with a nod.`,
      ];
      const fallbackEmotes3rd = [
        `${template.name} glances up at ${ctx.playerName} briefly.`,
        `${template.name} looks over at ${ctx.playerName}.`,
        `${template.name} pauses for a moment.`,
        `${template.name} tilts their head slightly towards ${ctx.playerName}.`,
        `${template.name} acknowledges ${ctx.playerName} with a nod.`,
      ];
      const idx = Math.floor(Math.random() * fallbackEmotes2nd.length);
      console.log(`[NPC Speech] Using fallback: "${fallbackEmotes2nd[idx]}"`);
      sendOutput(ctx.playerId, `\n${fallbackEmotes2nd[idx]}`);

      // Send 3rd person to others
      const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
      for (const otherId of playersInRoom) {
        if (otherId !== ctx.playerId) {
          sendOutput(otherId, `\n${fallbackEmotes3rd[idx]}`);
        }
      }
    }
  } catch (error) {
    // Fallback on error - NPC still reacts
    console.error(`[NPC Speech] Error for ${template.name}:`, error);
    console.log(`[NPC Speech] Error fallback: "${template.name} looks up at you."`);
    sendOutput(ctx.playerId, `\n${template.name} looks up at you.`);
  }
}

function processShout(ctx: CommandContext): void {
  const message = ctx.args.join(' ');

  // Send to shouter
  sendOutput(ctx.playerId, `You shout, "${message}"`, 'chat');

  // Get current room's area
  const currentRoom = worldManager.getRoom(ctx.roomId);
  if (!currentRoom) return;

  // Send to all players in same area
  const allRoomIds = worldManager.getAllRoomIds();
  for (const roomId of allRoomIds) {
    const room = worldManager.getRoom(roomId);
    if (room && room.area === currentRoom.area) {
      const playersInRoom = worldManager.getPlayersInRoom(roomId);
      for (const otherId of playersInRoom) {
        if (otherId !== ctx.playerId) {
          connectionManager.sendToPlayer(otherId, {
            type: 'chat',
            channel: 'shout',
            from: ctx.playerName,
            message,
          });
        }
      }
    }
  }
}

function processGossip(ctx: CommandContext): void {
  const message = ctx.args.join(' ');

  // Send to speaker
  sendOutput(ctx.playerId, `[Gossip] You: ${message}`, 'chat');

  // Broadcast to all other connected players
  connectionManager.broadcastExcept(
    {
      type: 'chat',
      channel: 'gossip',
      from: ctx.playerName,
      message,
    },
    ctx.playerId
  );
}

function processTell(ctx: CommandContext): void {
  const targetName = ctx.args[0];
  const message = ctx.args.slice(1).join(' ');

  if (!message) {
    sendOutput(ctx.playerId, 'Tell them what? Use: tell <name> <message>');
    return;
  }

  // First check if this is an NPC in the room
  const db = getDatabase();
  const npcsInRoom = roomNpcQueries.getByRoom(db).all(ctx.roomId) as {
    id: number;
    npcTemplateId: number;
  }[];

  const targetNameLower = targetName.toLowerCase();
  let matchedNpc: typeof npcsInRoom[0] | null = null;
  let matchedTemplate: typeof npcTemplates[0] | null = null;

  for (const npc of npcsInRoom) {
    const template = npcTemplates.find(t => t.id === npc.npcTemplateId);
    if (!template) continue;

    const fullName = template.name.toLowerCase();
    const nameParts = fullName.split(' ');

    // Match if:
    // 1. Full name starts with target (e.g., "tailor" matches "Tailor Lydia")
    // 2. Any significant name part matches (e.g., "lydia" matches "Tailor Lydia")
    if (fullName.startsWith(targetNameLower)) {
      matchedNpc = npc;
      matchedTemplate = template;
      break;
    }

    // Check each name part (skip common titles like "old", "the")
    for (const part of nameParts) {
      if (part.length < 3 || ['the', 'old', 'young', 'sir', 'lady'].includes(part)) continue;
      if (part === targetNameLower || part.startsWith(targetNameLower)) {
        matchedNpc = npc;
        matchedTemplate = template;
        break;
      }
    }
    if (matchedNpc) break;
  }

  // If we found an NPC, tell them directly
  if (matchedNpc && matchedTemplate) {
    sendOutput(ctx.playerId, `You tell ${matchedTemplate.name}, "${message}"`, 'chat');

    // Generate NPC response directly to this player
    triggerDirectNpcResponse(ctx, matchedNpc, matchedTemplate, message);
    return;
  }

  // Otherwise, try to find a player
  const targetPlayer = playerQueries.findByName(db).get(targetName) as {
    id: number;
    name: string;
  } | undefined;

  if (!targetPlayer) {
    sendOutput(ctx.playerId, `No one named "${targetName}" is here.`);
    return;
  }

  // Check if online
  if (!connectionManager.isPlayerConnected(targetPlayer.id)) {
    sendOutput(ctx.playerId, `${targetPlayer.name} is not online.`);
    return;
  }

  // Send to sender
  sendOutput(ctx.playerId, `You tell ${targetPlayer.name}, "${message}"`, 'chat');

  // Send to recipient
  connectionManager.sendToPlayer(targetPlayer.id, {
    type: 'whisper',
    from: ctx.playerName,
    message,
  });
}

// Generate a direct NPC response when a player uses "tell" to speak directly to them
async function triggerDirectNpcResponse(
  ctx: CommandContext,
  npc: { id: number; npcTemplateId: number },
  template: typeof npcTemplates[0],
  message: string
): Promise<void> {
  const db = getDatabase();

  // Get NPC's relationship with player
  const relationship = db.prepare(`
    SELECT trust_level FROM social_capital
    WHERE player_id = ? AND npc_id = ?
  `).get(ctx.playerId, npc.npcTemplateId) as { trust_level: string } | undefined;

  const trustLevel = relationship?.trust_level || 'stranger';
  const personality = getNpcPersonalityPrompt(npc.npcTemplateId);

  // Get NPC's current task
  const npcState = db.prepare(`
    SELECT current_task FROM npc_state
    WHERE npc_template_id = ?
  `).get(npc.npcTemplateId) as { current_task: string | null } | undefined;

  console.log(`[NPC Tell] ${ctx.playerName} tells ${template.name}: "${message}"`);

  try {
    const reaction = await generateNpcSpeechReaction(
      npc.npcTemplateId,
      template.name,
      personality,
      npcState?.current_task || null,
      ctx.playerId,
      ctx.playerName,
      message,
      trustLevel
    );

    // Record this interaction in NPC memory
    addNpcMemory(
      npc.npcTemplateId,
      ctx.playerId,
      'interaction',
      `${ctx.playerName} privately told me: "${message.substring(0, 80)}"`,
      4, // Slightly higher importance for direct conversation
      0
    );

    // Track this NPC for "reply" command
    setLastNpcInteraction(ctx.playerId, npc.npcTemplateId, template.name, ctx.roomId);

    if (reaction && reaction.response) {
      // Send emote if present
      if (reaction.emote) {
        const emote2nd = reaction.emote.second.charAt(0).toUpperCase() + reaction.emote.second.slice(1);
        sendOutput(ctx.playerId, `\n${template.name} ${emote2nd}`);
      }

      // Send response only to the player who asked
      sendOutput(ctx.playerId, `${template.name} tells you, "${reaction.response}"`);

      // Track conversation history for context
      addToConversationHistory(ctx.playerId, npc.npcTemplateId, 'player', message);
      addToConversationHistory(ctx.playerId, npc.npcTemplateId, 'npc', reaction.response);

      // Record room speaker for contextual socials
      recordRoomSpeaker(ctx.roomId, 'npc', npc.npcTemplateId, template.name, reaction.response);

      // Check if NPC is giving an item in their response
      const givenItem = checkNpcGivingItem(npc.npcTemplateId, reaction.response, ctx.playerId);
      if (givenItem) {
        // Actually give the item to the player
        const result = playerManager.addItemToInventory(ctx.playerId, givenItem.itemId, 1);
        if (result.success) {
          const itemTemplate = itemTemplates.find(t => t.id === givenItem.itemId);
          const itemDisplayName = itemTemplate?.name || givenItem.itemName;
          sendOutput(ctx.playerId, `\n[${template.name} gives you ${itemDisplayName}.]`);
          console.log(`[NPC Give] ${template.name} gave ${itemDisplayName} to ${ctx.playerName}`);

          // Record this in memory as a positive interaction
          addNpcMemory(
            npc.npcTemplateId,
            ctx.playerId,
            'interaction',
            `Gave ${ctx.playerName} ${itemDisplayName}`,
            4, // Moderate importance
            1  // Positive valence
          );
        }
      }
    } else {
      // Minimal acknowledgment
      sendOutput(ctx.playerId, `\n${template.name} nods at you but doesn't respond.`);
    }
  } catch (error) {
    console.error(`[NPC Tell] Error:`, error);
    sendOutput(ctx.playerId, `\n${template.name} seems distracted and doesn't respond.`);
  }
}

// Process the "reply" command - continues conversation with last NPC
export function processReply(ctx: CommandContext): void {
  const lastInteraction = getLastNpcInteraction(ctx.playerId);

  if (!lastInteraction) {
    sendOutput(ctx.playerId, "You haven't spoken to anyone recently.");
    return;
  }

  const message = ctx.args.join(' ');
  if (!message) {
    sendOutput(ctx.playerId, `Reply what to ${lastInteraction.npcName}? Use: reply <message>`);
    return;
  }

  // Check if we're still in the same room as the NPC
  if (ctx.roomId !== lastInteraction.roomId) {
    sendOutput(ctx.playerId, `${lastInteraction.npcName} isn't here anymore.`);
    return;
  }

  // Find the NPC in the room
  const db = getDatabase();
  const npcsInRoom = roomNpcQueries.getByRoom(db).all(ctx.roomId) as {
    id: number;
    npcTemplateId: number;
  }[];

  const npc = npcsInRoom.find(n => n.npcTemplateId === lastInteraction.npcId);
  if (!npc) {
    sendOutput(ctx.playerId, `${lastInteraction.npcName} isn't here anymore.`);
    return;
  }

  const template = npcTemplates.find(t => t.id === npc.npcTemplateId);
  if (!template) {
    sendOutput(ctx.playerId, `${lastInteraction.npcName} isn't here anymore.`);
    return;
  }

  // Send the reply
  sendOutput(ctx.playerId, `You tell ${template.name}, "${message}"`, 'chat');
  triggerDirectNpcResponse(ctx, npc, template, message);
}

function processWho(ctx: CommandContext): void {
  const connectedPlayerIds = connectionManager.getConnectedPlayerIds();

  if (connectedPlayerIds.length === 0) {
    sendOutput(ctx.playerId, '\nNo other players online.\n');
    return;
  }

  const db = getDatabase();
  const lines: string[] = [
    '',
    '╔════════════════════════════════════════╗',
    '║         PLAYERS ONLINE                 ║',
    '╠════════════════════════════════════════╣',
  ];

  for (const playerId of connectedPlayerIds) {
    const player = playerQueries.findById(db).get(playerId) as {
      name: string;
      level: number;
      class_id: number;
    } | undefined;

    if (player) {
      const classDef = playerManager.getClassDefinition(player.class_id);
      const className = classDef?.name || 'Unknown';
      const you = playerId === ctx.playerId ? ' (You)' : '';
      lines.push(`║  ${player.name.padEnd(15)} Lv${String(player.level).padStart(2)} ${className.padEnd(15)}${you.padEnd(5)} ║`);
    }
  }

  lines.push('╚════════════════════════════════════════╝');
  lines.push(`Total: ${connectedPlayerIds.length} player(s) online`);
  lines.push('');

  sendOutput(ctx.playerId, lines.join('\n'));
}
