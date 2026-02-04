// Interaction Commands for FROBARK MUD
import { connectionManager } from '../managers/connectionManager';
import { worldManager } from '../managers/worldManager';
import { playerManager } from '../managers/playerManager';
import { npcManager } from '../managers/npcManager';
import { questManager } from '../managers/questManager';
import { npcLifeManager } from '../managers/npcLifeManager';
import { getDatabase, playerQueries } from '../database';
import { itemTemplates } from '../data/items';
import { npcTemplates, getNpcPersonalityPrompt } from '../data/npcs';
import {
  generateNpcResponse,
  generateHelpfulGuidance,
  generatePersonalizedNpcDescription,
  addNpcMemory,
  getNpcMemoriesOfPlayer,
  getDaysSinceLastMeeting,
  getTimeOfDay,
  getConversationHistory,
  addToConversationHistory,
  type ConversationContext,
  type NpcMemoryEntry,
} from '../services/geminiService';
import type { CommandContext } from './index';
import { npcWantsManager } from '../managers/npcWantsManager';

export function processInteractionCommand(ctx: CommandContext, action: string): void {
  switch (action) {
    case 'look':
      // processLookAt is async for Gemini-powered helpful guidance
      processLookAt(ctx).catch(err => {
        console.error('[Look] Error:', err);
        sendOutput(ctx.playerId, 'Something went wrong while looking.');
      });
      break;
    case 'take':
      processTakeItem(ctx);
      break;
    case 'drop':
      processDropItem(ctx);
      break;
    case 'eat':
      processConsume(ctx, 'food');
      break;
    case 'drink':
      processConsume(ctx, 'drink');
      break;
    case 'talk':
      // processTalk is async but we don't need to wait for it
      processTalk(ctx).catch(err => {
        console.error('[Talk] Error:', err);
        sendOutput(ctx.playerId, 'Something went wrong with the conversation.');
      });
      break;
  }
}

function sendOutput(playerId: number, text: string): void {
  connectionManager.sendToPlayer(playerId, {
    type: 'output',
    text,
    messageType: 'normal',
  });
}

async function processLookAt(ctx: CommandContext): Promise<void> {
  let target = ctx.args.join(' ').toLowerCase();

  // Handle "look at <thing>" - strip leading "at"
  if (target.startsWith('at ')) {
    target = target.slice(3);
  }

  // Check items in room
  const roomItem = worldManager.findItemInRoom(ctx.roomId, target);
  if (roomItem) {
    const template = itemTemplates.find((t) => t.id === roomItem.itemTemplateId);
    if (template) {
      sendOutput(ctx.playerId, `\n${template.longDesc}\n`);
      return;
    }
  }

  // Check items in inventory
  const invItem = playerManager.findItemInInventory(ctx.playerId, target);
  if (invItem) {
    const template = itemTemplates.find((t) => t.id === invItem.templateId);
    if (template) {
      sendOutput(ctx.playerId, `\n${template.longDesc}\n`);
      return;
    }
  }

  // Check NPCs in room
  const npc = worldManager.findNpcInRoom(ctx.roomId, target);
  if (npc) {
    const template = npcTemplates.find((t) => t.id === npc.npcTemplateId);
    if (template) {
      // Generate personalized description based on player's history with this NPC
      try {
        const personalizedDesc = await generatePersonalizedNpcDescription(
          npc.npcTemplateId,
          template.name,
          template.longDesc,
          template.shortDesc,
          ctx.playerId,
          ctx.playerName
        );
        sendOutput(ctx.playerId, `\n${personalizedDesc}\n`);
      } catch (error) {
        // Fallback to standard description
        sendOutput(ctx.playerId, `\n${template.longDesc}\n`);
      }
      return;
    }
  }

  // Check players in room (including self)
  const db = getDatabase();
  const playersInRoom = playerQueries.getPlayersInRoom(db).all(ctx.roomId) as {
    id: number;
    name: string;
    level: number;
    class_id: number;
  }[];

  for (const p of playersInRoom) {
    if (p.name.toLowerCase().includes(target)) {
      const classDef = playerManager.getClassDefinition(p.class_id);
      if (p.id === ctx.playerId) {
        // Looking at yourself
        sendOutput(ctx.playerId, `\nYou examine yourself. You are ${p.name}, a level ${p.level} ${classDef?.name || 'llama'}.\n`);
      } else {
        sendOutput(ctx.playerId, `\nYou see ${p.name}, a level ${p.level} ${classDef?.name || 'llama'}.\n`);
      }
      return;
    }
  }

  // Check room features (things mentioned in description that can be examined)
  const room = worldManager.getRoom(ctx.roomId);
  if (room?.features) {
    for (const feature of room.features) {
      if (feature.keywords.some(kw => target.includes(kw) || kw.includes(target))) {
        sendOutput(ctx.playerId, `\n${feature.description}\n`);
        return;
      }
    }
  }

  // Target not found - use Gemini for helpful guidance instead of cold error
  try {
    const npcsHere = worldManager.getNpcsInRoomWithTemplates(ctx.roomId);
    const npcInfo = npcsHere.map(({ template }) => ({
      name: template.name,
      keywords: template.keywords,
      type: template.type
    }));

    // Get items in room for context
    const roomState = worldManager.getRoomState(ctx.roomId);
    const itemInfo = (roomState?.items || []).map(item => {
      const template = itemTemplates.find(t => t.id === item.itemTemplateId);
      return template ? { name: template.name, keywords: template.keywords } : null;
    }).filter(Boolean) as Array<{ name: string; keywords: string[] }>;

    const roomFeatures = room?.features || [];

    const guidance = await generateHelpfulGuidance(
      ctx.playerName,
      'look',
      target,
      room?.name || 'this area',
      npcInfo,
      itemInfo,
      roomFeatures
    );

    sendOutput(ctx.playerId, `\n${guidance}\n`);
  } catch (error) {
    // Fallback to simple message if Gemini fails
    sendOutput(ctx.playerId, `You don't see "${target}" here.`);
  }
}

function processTakeItem(ctx: CommandContext): void {
  const target = ctx.args.join(' ').toLowerCase();

  // Find item in room
  const roomItem = worldManager.findItemInRoom(ctx.roomId, target);
  if (!roomItem) {
    sendOutput(ctx.playerId, `You don't see "${target}" here.`);
    return;
  }

  const template = itemTemplates.find((t) => t.id === roomItem.itemTemplateId);
  if (!template) {
    sendOutput(ctx.playerId, 'That item seems to be broken.');
    return;
  }

  // Add to inventory
  const result = playerManager.addItemToInventory(ctx.playerId, roomItem.itemTemplateId, 1);
  if (!result.success) {
    sendOutput(ctx.playerId, result.error || 'Failed to pick up item.');
    return;
  }

  // Remove from room
  worldManager.removeItemFromRoom(roomItem.id);

  // Update quest progress
  questManager.updateProgress(ctx.playerId, 'collect', roomItem.itemTemplateId, 1);

  sendOutput(ctx.playerId, `You pick up ${template.name}.`);

  // Notify others in room
  const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
  for (const otherId of playersInRoom) {
    if (otherId !== ctx.playerId) {
      connectionManager.sendToPlayer(otherId, {
        type: 'output',
        text: `${ctx.playerName} picks up ${template.name}.`,
        messageType: 'normal',
      });
    }
  }
}

function processDropItem(ctx: CommandContext): void {
  const target = ctx.args.join(' ').toLowerCase();

  // Find item in inventory
  const invItem = playerManager.findItemInInventory(ctx.playerId, target);
  if (!invItem) {
    sendOutput(ctx.playerId, `You don't have "${target}".`);
    return;
  }

  const template = itemTemplates.find((t) => t.id === invItem.templateId);
  if (!template) {
    sendOutput(ctx.playerId, 'That item seems to be broken.');
    return;
  }

  if (template.questItem) {
    sendOutput(ctx.playerId, 'You cannot drop quest items.');
    return;
  }

  // Remove from inventory
  const result = playerManager.removeItemFromInventory(ctx.playerId, invItem.id, 1);
  if (!result.success) {
    sendOutput(ctx.playerId, result.error || 'Failed to drop item.');
    return;
  }

  // Add to room
  worldManager.addItemToRoom(ctx.roomId, invItem.templateId, 1);

  sendOutput(ctx.playerId, `You drop ${template.name}.`);

  // Notify others in room
  const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
  for (const otherId of playersInRoom) {
    if (otherId !== ctx.playerId) {
      connectionManager.sendToPlayer(otherId, {
        type: 'output',
        text: `${ctx.playerName} drops ${template.name}.`,
        messageType: 'normal',
      });
    }
  }
}

function processConsume(ctx: CommandContext, type: 'food' | 'drink'): void {
  const target = ctx.args.join(' ').toLowerCase();

  // Find item in inventory
  const invItem = playerManager.findItemInInventory(ctx.playerId, target);
  if (!invItem) {
    sendOutput(ctx.playerId, `You don't have "${target}".`);
    return;
  }

  const template = itemTemplates.find((t) => t.id === invItem.templateId);
  if (!template) {
    sendOutput(ctx.playerId, 'That item seems to be broken.');
    return;
  }

  // Check if consumable
  if (type === 'food' && template.type !== 'food' && template.type !== 'consumable') {
    sendOutput(ctx.playerId, `You cannot eat ${template.name}.`);
    return;
  }

  if (type === 'drink' && template.type !== 'drink' && template.type !== 'consumable') {
    sendOutput(ctx.playerId, `You cannot drink ${template.name}.`);
    return;
  }

  if (!template.consumableEffects || template.consumableEffects.length === 0) {
    sendOutput(ctx.playerId, `That doesn't seem to do anything.`);
    return;
  }

  // Apply effects
  const db = getDatabase();
  const player = playerQueries.findById(db).get(ctx.playerId) as {
    hp: number;
    max_hp: number;
    mana: number;
    max_mana: number;
    stamina: number;
    max_stamina: number;
    hunger: number;
    thirst: number;
  };

  let newHp = player.hp;
  let newMana = player.mana;
  let newStamina = player.stamina;
  let newHunger = player.hunger;
  let newThirst = player.thirst;

  const effects: string[] = [];

  for (const effect of template.consumableEffects) {
    switch (effect.type) {
      case 'heal_hp':
        newHp = Math.min(player.max_hp, newHp + effect.amount);
        effects.push(`+${effect.amount} HP`);
        break;
      case 'heal_mana':
        newMana = Math.min(player.max_mana, newMana + effect.amount);
        effects.push(`+${effect.amount} Mana`);
        break;
      case 'heal_stamina':
        newStamina = Math.min(player.max_stamina, newStamina + effect.amount);
        effects.push(`+${effect.amount} Stamina`);
        break;
      case 'restore_hunger':
        newHunger = Math.min(100, newHunger + effect.amount);
        effects.push(`+${effect.amount} Hunger`);
        break;
      case 'restore_thirst':
        newThirst = Math.min(100, newThirst + effect.amount);
        effects.push(`+${effect.amount} Thirst`);
        break;
    }
  }

  // Update player
  playerQueries.updateResources(db).run(newHp, newMana, newStamina, newHunger, newThirst, ctx.playerId);

  // Remove item from inventory
  playerManager.removeItemFromInventory(ctx.playerId, invItem.id, 1);

  const verb = type === 'food' ? 'eat' : 'drink';
  sendOutput(ctx.playerId, `You ${verb} ${template.name}. (${effects.join(', ')})`);

  // Send updated resources
  connectionManager.sendToPlayer(ctx.playerId, {
    type: 'player_update',
    resources: {
      hp: newHp,
      maxHp: player.max_hp,
      mana: newMana,
      maxMana: player.max_mana,
      stamina: newStamina,
      maxStamina: player.max_stamina,
    },
    vitals: {
      hunger: newHunger,
      thirst: newThirst,
    },
  });
}

async function processTalk(ctx: CommandContext): Promise<void> {
  // Parse: talk <npc> [message] or talk <npc> about <topic>
  // This uses the Gemini LLM to generate dynamic, context-aware NPC dialogue
  const args = ctx.args;

  if (args.length === 0) {
    sendOutput(ctx.playerId, 'Talk to whom? Try: talk <npc name> [message]');
    return;
  }

  // Find NPC by first word(s)
  let npcName = '';
  let message = '';

  // Try to find the NPC in the room, checking progressively longer name matches
  let npc = null;
  let i = 0;
  for (i = 0; i < args.length; i++) {
    const testName = args.slice(0, i + 1).join(' ').toLowerCase();
    const foundNpc = worldManager.findNpcInRoom(ctx.roomId, testName);
    if (foundNpc) {
      npc = foundNpc;
      npcName = testName;
      message = args.slice(i + 1).join(' ');
      break;
    }
  }

  // If not found with progressive matching, try just the first word
  if (!npc) {
    npcName = args[0].toLowerCase();
    npc = worldManager.findNpcInRoom(ctx.roomId, npcName);
    message = args.slice(1).join(' ');
  }

  if (!npc) {
    // Use Gemini-powered helpful guidance
    try {
      const npcsHere = worldManager.getNpcsInRoomWithTemplates(ctx.roomId);
      const npcInfo = npcsHere.map(({ template }) => ({
        name: template.name,
        keywords: template.keywords,
        type: template.type
      }));

      const room = worldManager.getRoom(ctx.roomId);

      const guidance = await generateHelpfulGuidance(
        ctx.playerName,
        'talk',
        args[0],
        room?.name || 'this area',
        npcInfo,
        [],
        []
      );

      sendOutput(ctx.playerId, `\n${guidance}\n`);
    } catch (error) {
      // Fallback to simple suggestions
      const npcsHere = npcManager.getNpcsInRoom(ctx.roomId);
      if (npcsHere.length > 0) {
        const suggestions = npcsHere.slice(0, 3).map(n => n.name.split(' ')[0].toLowerCase()).join(', ');
        sendOutput(ctx.playerId, `You don't see "${args[0]}" here. Try: ${suggestions}`);
      } else {
        sendOutput(ctx.playerId, `You don't see "${args[0]}" here.`);
      }
    }
    return;
  }

  const template = npcTemplates.find((t) => t.id === npc.npcTemplateId);
  if (!template) {
    sendOutput(ctx.playerId, 'That creature doesn\'t respond.');
    return;
  }

  // Enemy NPCs don't talk
  if (template.type === 'enemy') {
    sendOutput(ctx.playerId, `\n${template.name} snarls at you menacingly. It doesn't seem interested in conversation.\n`);
    return;
  }

  // Default message if none provided
  if (!message) {
    message = 'hello';
  }

  // Build the full conversation context for Gemini
  const conversationContext = await buildConversationContext(
    ctx.playerId,
    ctx.playerName,
    ctx.roomId,
    npc.npcTemplateId,
    template
  );

  // Show thinking indicator for longer conversations
  sendOutput(ctx.playerId, `\n${template.name} considers your words...`);

  // Record the player's message in conversation history BEFORE generating response
  addToConversationHistory(ctx.playerId, npc.npcTemplateId, 'player', message);

  try {
    // Generate response using Gemini LLM
    const response = await generateNpcResponse(conversationContext, message);

    // Record the NPC's response in conversation history
    addToConversationHistory(ctx.playerId, npc.npcTemplateId, 'npc', response);

    // Display the NPC's response
    sendOutput(ctx.playerId, `\n${template.name} says, "${response}"\n`);

    // Record this interaction in NPC memory
    await recordInteraction(ctx.playerId, ctx.playerName, npc.npcTemplateId, message, response);

    // Show relationship status hint occasionally
    const db = getDatabase();
    const socialCapital = db.prepare(`
      SELECT capital, trust_level FROM social_capital
      WHERE player_id = ? AND npc_id = ?
    `).get(ctx.playerId, npc.npcTemplateId) as { capital: number; trust_level: string } | undefined;

    if (socialCapital) {
      const trustHint = getTrustHint(socialCapital.trust_level);
      if (Math.random() < 0.3) { // 30% chance to show hint
        sendOutput(ctx.playerId, `(${template.name} ${trustHint})`);
      }
    }

    // Show available quests if friendly enough
    const memory = npcManager.getMemory(template.id, ctx.playerId);
    if (template.questIds && template.questIds.length > 0 && memory.disposition >= 30) {
      const availableQuests = questManager.getAvailableQuests(npc.npcTemplateId, ctx.playerId);
      if (availableQuests.length > 0 && message.toLowerCase().includes('quest')) {
        const questList = availableQuests.map((q) => `  [${q.id}] ${q.name} (Level ${q.levelRequired})`).join('\n');
        sendOutput(ctx.playerId, `\nAvailable quests:\n${questList}\nType "accept <quest id>" to accept a quest.`);
      }
    }

  } catch (error) {
    // Fall back to the old system if Gemini fails
    console.error('[Talk] Gemini error, falling back:', error);
    const { response } = npcManager.processConversation(
      ctx.playerId,
      ctx.playerName,
      npc.id,
      message
    );
    sendOutput(ctx.playerId, `\n${response}\n`);
  }
}

// Build the full conversation context for Gemini from all available data sources
async function buildConversationContext(
  playerId: number,
  playerName: string,
  roomId: string,
  npcTemplateId: number,
  template: { name: string; type: string; role?: string }
): Promise<ConversationContext> {
  const db = getDatabase();

  // Get NPC personality from the npcs.ts definitions
  const personality = getNpcPersonalityPrompt(npcTemplateId);

  // Get NPC state (current task, mood, etc.)
  const npcState = db.prepare(`
    SELECT current_task, task_progress, energy, mood, current_room
    FROM npc_state ns
    JOIN room_npcs rn ON ns.npc_instance_id = rn.id
    WHERE rn.npc_template_id = ?
    LIMIT 1
  `).get(npcTemplateId) as {
    current_task: string | null;
    task_progress: number;
    energy: number;
    mood: string;
    current_room: string;
  } | undefined;

  // Get social capital between this player and NPC
  const socialData = db.prepare(`
    SELECT capital, trust_level, times_helped, times_wronged
    FROM social_capital
    WHERE player_id = ? AND npc_id = ?
  `).get(playerId, npcTemplateId) as {
    capital: number;
    trust_level: string;
    times_helped: number;
    times_wronged: number;
  } | undefined;

  // Get NPC's memories of this player
  const memories = getNpcMemoriesOfPlayer(npcTemplateId, playerId);

  // Get days since last meeting
  const daysSince = getDaysSinceLastMeeting(npcTemplateId, playerId);

  // Get world context (what's happening nearby) - include wants for dialogue
  const worldContext = buildWorldContext(roomId, npcTemplateId, playerId);

  // Get game time
  const { hour } = npcLifeManager.getGameTime();
  const timeOfDay = getTimeOfDay();

  // Get recent conversation history with this NPC
  const conversationHistory = getConversationHistory(playerId, npcTemplateId);

  // Build the context object
  const context: ConversationContext = {
    npcId: npcTemplateId,
    npcName: template.name,
    npcPersonality: personality,
    npcRole: template.role || template.type,
    npcCurrentTask: npcState?.current_task || null,
    npcTaskProgress: npcState?.task_progress || 0,
    npcMood: npcState?.mood || 'neutral',
    npcLocation: roomId,
    playerName: playerName,
    playerSocialCapital: socialData?.capital || 0,
    trustLevel: socialData?.trust_level || 'stranger',
    recentMemories: memories.recent,
    longTermMemories: memories.longTerm,
    worldContext: worldContext,
    conversationHistory: conversationHistory,
    timeOfDay: timeOfDay,
    daysSinceLastMeeting: daysSince,
  };

  return context;
}

// Build a description of what's happening nearby for context
function buildWorldContext(roomId: string, excludeNpcId: number, playerId?: number): string {
  const parts: string[] = [];

  // Get other NPCs in the room
  const npcsHere = npcManager.getNpcsInRoom(roomId);
  const otherNpcs = npcsHere.filter(n => n.id !== excludeNpcId);

  if (otherNpcs.length > 0) {
    const npcNames = otherNpcs.slice(0, 3).map(n => n.name).join(', ');
    parts.push(`Also nearby: ${npcNames}`);
  }

  // Get players in the room
  const playersHere = worldManager.getPlayersInRoom(roomId);
  if (playersHere.length > 1) {
    parts.push(`${playersHere.length} travelers are in the area`);
  }

  // Get activity descriptions from NPC life manager
  const activityDesc = npcLifeManager.getNpcActivityDescription(roomId);
  if (activityDesc) {
    parts.push(activityDesc.trim());
  }

  // Add time-based context
  const { hour } = npcLifeManager.getGameTime();
  if (hour >= 6 && hour < 9) {
    parts.push('The morning is young, people are starting their work');
  } else if (hour >= 12 && hour < 14) {
    parts.push('It\'s midday, many are taking a break');
  } else if (hour >= 18 && hour < 21) {
    parts.push('Evening has come, the day\'s work is winding down');
  } else if (hour >= 21 || hour < 5) {
    parts.push('It\'s late at night, most folk are asleep');
  }

  // Add what this NPC wants (if talking to them)
  if (playerId) {
    const wantsSummary = npcWantsManager.getWantsSummaryForDialogue(excludeNpcId, playerId);
    if (wantsSummary) {
      parts.push(wantsSummary);
    }
  }

  return parts.join('. ') || 'The area is quiet';
}

// Record an interaction in NPC memory for future conversations
async function recordInteraction(
  playerId: number,
  playerName: string,
  npcTemplateId: number,
  playerMessage: string,
  npcResponse: string
): Promise<void> {
  // Determine importance based on message content
  let importance = 3; // Default medium importance

  const lowerMessage = playerMessage.toLowerCase();

  // Higher importance for emotional or significant interactions
  if (lowerMessage.includes('thank') || lowerMessage.includes('grateful')) {
    importance = 5;
  } else if (lowerMessage.includes('help') || lowerMessage.includes('please')) {
    importance = 4;
  } else if (lowerMessage.includes('hate') || lowerMessage.includes('kill') || lowerMessage.includes('die')) {
    importance = 7; // Threats are very memorable
  } else if (lowerMessage.includes('love') || lowerMessage.includes('friend')) {
    importance = 6;
  } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    importance = 2; // Greetings are less memorable
  }

  // Determine emotional valence
  let emotionalValence = 0;
  if (lowerMessage.includes('thank') || lowerMessage.includes('help') || lowerMessage.includes('please') || lowerMessage.includes('friend')) {
    emotionalValence = 2;
  } else if (lowerMessage.includes('hate') || lowerMessage.includes('stupid') || lowerMessage.includes('idiot')) {
    emotionalValence = -3;
  }

  // Add memory of this interaction
  const memoryContent = `${playerName} said: "${playerMessage.substring(0, 100)}"`;

  addNpcMemory(
    npcTemplateId,
    playerId,
    'interaction',
    memoryContent,
    importance,
    emotionalValence
  );

  // Update social capital based on interaction tone
  const db = getDatabase();

  let capitalChange = 0;
  if (emotionalValence > 0) {
    capitalChange = emotionalValence * 2;
  } else if (emotionalValence < 0) {
    capitalChange = emotionalValence * 3; // Negative interactions hurt more
  }

  if (capitalChange !== 0) {
    db.prepare(`
      INSERT INTO social_capital (player_id, npc_id, capital, last_interaction)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (player_id, npc_id) DO UPDATE SET
        capital = MIN(100, MAX(-100, capital + ?)),
        last_interaction = CURRENT_TIMESTAMP
    `).run(playerId, npcTemplateId, capitalChange, capitalChange);

    // Update trust level
    const result = db.prepare(`
      SELECT capital FROM social_capital WHERE player_id = ? AND npc_id = ?
    `).get(playerId, npcTemplateId) as { capital: number } | undefined;

    if (result) {
      const trustLevel = capitalToTrustLevel(result.capital);
      db.prepare(`
        UPDATE social_capital SET trust_level = ? WHERE player_id = ? AND npc_id = ?
      `).run(trustLevel, playerId, npcTemplateId);
    }
  }
}

// Convert capital to trust level string
function capitalToTrustLevel(capital: number): string {
  if (capital < -50) return 'hostile';
  if (capital < -10) return 'unfriendly';
  if (capital < 10) return 'stranger';
  if (capital < 30) return 'acquaintance';
  if (capital < 60) return 'friend';
  if (capital < 90) return 'trusted';
  return 'family';
}

// Get a human-readable hint about the trust level
function getTrustHint(trustLevel: string): string {
  const hints: Record<string, string[]> = {
    hostile: ['glares at you with pure hatred', 'looks ready to attack', 'seethes with anger'],
    unfriendly: ['seems cold and distant', 'eyes you suspiciously', 'is clearly unhappy to see you'],
    stranger: ['regards you neutrally', 'treats you politely but cautiously', 'is neither warm nor cold'],
    acquaintance: ['seems to recognize you fondly', 'greets you with a small smile', 'appears comfortable around you'],
    friend: ['lights up when they see you', 'treats you warmly', 'clearly enjoys your company'],
    trusted: ['embraces you like family', 'shares secrets freely', 'trusts you completely'],
    family: ['considers you part of their life', 'would do anything for you', 'loves you dearly'],
  };

  const options = hints[trustLevel] || hints.stranger;
  return options[Math.floor(Math.random() * options.length)];
}
