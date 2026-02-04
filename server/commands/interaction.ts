// Interaction Commands for FROBARK MUD
import { connectionManager } from '../managers/connectionManager';
import { worldManager } from '../managers/worldManager';
import { playerManager } from '../managers/playerManager';
import { npcManager } from '../managers/npcManager';
import { questManager } from '../managers/questManager';
import { npcLifeManager } from '../managers/npcLifeManager';
import { appearanceManager } from '../managers/appearanceManager';
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
import { setLastNpcInteraction } from './communication';

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
    case 'status':
      processStatus(ctx);
      break;
    case 'context':
      processContext(ctx);
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
      let description = '';
      try {
        description = await generatePersonalizedNpcDescription(
          npc.npcTemplateId,
          template.name,
          template.longDesc,
          template.shortDesc,
          ctx.playerId,
          ctx.playerName
        );
      } catch (error) {
        // Fallback to standard description
        description = template.longDesc;
      }

      // Add shop inventory if this NPC sells things
      if (template.shopInventory && template.shopInventory.length > 0) {
        description += '\n\n[FOR SALE]';
        for (const shopItem of template.shopInventory.slice(0, 8)) {
          const itemTemplate = itemTemplates.find(i => i.id === shopItem.itemTemplateId);
          if (itemTemplate) {
            const price = Math.floor((itemTemplate.value || 10) * shopItem.buyPriceMultiplier);
            description += `\n  ${itemTemplate.name} - ${price} gold`;
          }
        }
        if (template.shopInventory.length > 8) {
          description += `\n  ...and ${template.shopInventory.length - 8} more items.`;
        }
        description += '\n\nUse "buy <item>" to purchase or "talk <name>" to chat.';
      }

      sendOutput(ctx.playerId, `\n${description}\n`);
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
      const equipmentDesc = buildFullEquipmentList(p.id, p.id === ctx.playerId);
      const appearanceDesc = appearanceManager.buildAppearanceDescription(p.id);
      const conditionDesc = buildConditionDescription(p.id, p.id === ctx.playerId);

      if (p.id === ctx.playerId) {
        // Looking at yourself
        sendOutput(ctx.playerId, `\nYou examine yourself. You are ${p.name}, a level ${p.level} ${classDef?.name || 'llama'}.\n\n${conditionDesc}\n\n${equipmentDesc}\n\n${appearanceDesc}\n`);
      } else {
        // Looking at another player - show full details
        sendOutput(ctx.playerId, `\nYou observe ${p.name}, a level ${p.level} ${classDef?.name || 'llama'}.\n\n${conditionDesc}\n\n${equipmentDesc}\n\n${appearanceDesc}\n`);
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

  // Track that this player is now in conversation with this NPC
  // This ensures subsequent 'say' commands go to this NPC
  setLastNpcInteraction(ctx.playerId, npc.npcTemplateId, template.name, ctx.roomId);

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

  // Get player info for appearance context
  const playerInfo = db.prepare(`
    SELECT level, class_id, gold FROM players WHERE id = ?
  `).get(playerId) as { level: number; class_id: number; gold: number } | undefined;

  const classDef = playerManager.getClassDefinition(playerInfo?.class_id || 1);
  const playerClass = classDef?.name || 'adventurer';

  // Build player appearance description from equipment
  const playerAppearance = buildPlayerAppearanceDescription(playerId);

  // Get room physical context - what actually exists
  const roomData = buildRoomPhysicalContext(roomId, npcTemplateId);

  // Get room name for location context
  const currentRoom = worldManager.getRoom(roomId);
  const roomName = currentRoom?.name || roomId;

  // Build the context object
  const context: ConversationContext = {
    npcId: npcTemplateId,
    npcName: template.name,
    npcPersonality: personality,
    npcRole: template.role || template.type,
    npcCurrentTask: npcState?.current_task || null,
    npcTaskProgress: npcState?.task_progress || 0,
    npcMood: npcState?.mood || 'neutral',
    npcLocation: roomName,
    playerName: playerName,
    playerLevel: playerInfo?.level || 1,
    playerClass: playerClass,
    playerAppearance: playerAppearance,
    playerGold: playerInfo?.gold || 0,
    playerSocialCapital: socialData?.capital || 0,
    trustLevel: socialData?.trust_level || 'stranger',
    recentMemories: memories.recent,
    longTermMemories: memories.longTerm,
    worldContext: worldContext,
    conversationHistory: conversationHistory,
    timeOfDay: timeOfDay,
    daysSinceLastMeeting: daysSince,
    // Room physical context
    roomItems: roomData.roomItems,
    roomExits: roomData.roomExits,
    nearbyRooms: roomData.nearbyRooms,
    npcInventory: roomData.npcInventory,
    npcActiveTask: roomData.npcActiveTask,
  };

  return context;
}

// Build player condition description (HP, mana, stamina, hunger/thirst)
function buildConditionDescription(playerId: number, isSelf: boolean): string {
  const db = getDatabase();
  const player = playerQueries.findById(db).get(playerId) as {
    hp: number;
    max_hp: number;
    mana: number;
    max_mana: number;
    stamina: number;
    max_stamina: number;
    hunger: number;
    thirst: number;
    is_fighting: number;
  } | undefined;

  if (!player) return 'Condition unknown.';

  const lines: string[] = [];
  const pronoun = isSelf ? 'You' : 'They';
  const possessive = isSelf ? 'Your' : 'Their';
  const verb = isSelf ? 'are' : 'are';

  // HP status
  const hpPercent = Math.floor((player.hp / player.max_hp) * 100);
  let hpDesc = '';
  if (hpPercent >= 90) hpDesc = 'in excellent health';
  else if (hpPercent >= 70) hpDesc = 'in good health';
  else if (hpPercent >= 50) hpDesc = 'slightly wounded';
  else if (hpPercent >= 30) hpDesc = 'moderately wounded';
  else if (hpPercent >= 15) hpDesc = 'badly wounded';
  else hpDesc = 'critically injured';

  lines.push(`${pronoun} ${verb} ${hpDesc}. (HP: ${player.hp}/${player.max_hp})`);

  // Combat status
  if (player.is_fighting) {
    lines.push(`${pronoun} ${verb} currently in combat!`);
  }

  // Mana status
  const manaPercent = Math.floor((player.mana / player.max_mana) * 100);
  let manaDesc = '';
  if (manaPercent >= 80) manaDesc = 'brimming with magical energy';
  else if (manaPercent >= 50) manaDesc = 'has adequate mana reserves';
  else if (manaPercent >= 20) manaDesc = 'running low on mana';
  else manaDesc = 'nearly drained of mana';
  lines.push(`${possessive} aura ${isSelf ? 'is' : 'appears'} ${manaDesc}. (Mana: ${player.mana}/${player.max_mana})`);

  // Stamina status
  const stamPercent = Math.floor((player.stamina / player.max_stamina) * 100);
  let stamDesc = '';
  if (stamPercent >= 80) stamDesc = 'well-rested and energetic';
  else if (stamPercent >= 50) stamDesc = 'a bit tired';
  else if (stamPercent >= 20) stamDesc = 'fatigued';
  else stamDesc = 'exhausted';
  lines.push(`${pronoun} look${isSelf ? '' : 's'} ${stamDesc}. (Stamina: ${player.stamina}/${player.max_stamina})`);

  // Hunger/thirst (only visible to self or if severe)
  if (isSelf) {
    let hungerDesc = '';
    if (player.hunger >= 80) hungerDesc = 'well-fed';
    else if (player.hunger >= 50) hungerDesc = 'a bit hungry';
    else if (player.hunger >= 20) hungerDesc = 'hungry';
    else hungerDesc = 'starving';

    let thirstDesc = '';
    if (player.thirst >= 80) thirstDesc = 'hydrated';
    else if (player.thirst >= 50) thirstDesc = 'a bit thirsty';
    else if (player.thirst >= 20) thirstDesc = 'thirsty';
    else thirstDesc = 'parched';

    lines.push(`${pronoun} feel ${hungerDesc} and ${thirstDesc}. (Hunger: ${player.hunger}/100, Thirst: ${player.thirst}/100)`);
  } else {
    // Only show severe states for others
    if (player.hunger < 20) {
      lines.push(`${pronoun} look${isSelf ? '' : 's'} like ${pronoun.toLowerCase()} hasn't eaten in days.`);
    }
    if (player.thirst < 20) {
      lines.push(`${possessive} lips are cracked from dehydration.`);
    }
  }

  return lines.join('\n');
}

// Build full slot-by-slot equipment list for looking at someone
function buildFullEquipmentList(playerId: number, isSelf: boolean): string {
  const equipment = playerManager.getEquipment(playerId);
  const pronoun = isSelf ? 'Your' : 'Their';

  const getItemName = (itemId: number | null): string => {
    if (!itemId) return 'Nothing';
    const template = itemTemplates.find((t) => t.id === itemId);
    return template?.name || 'Nothing';
  };

  const lines = [
    `=== ${pronoun} Equipment ===`,
    '',
    `Head:       ${getItemName(equipment.head)}`,
    `Neck:       ${getItemName(equipment.neck)}`,
    `Body:       ${getItemName(equipment.body)}`,
    `Back:       ${getItemName(equipment.back)}`,
    `Hands:      ${getItemName(equipment.hands)}`,
    `Legs:       ${getItemName(equipment.legs)}`,
    `Feet:       ${getItemName(equipment.feet)}`,
    `Main Hand:  ${getItemName(equipment.mainHand)}`,
    `Off Hand:   ${getItemName(equipment.offHand)}`,
    `Ring 1:     ${getItemName(equipment.ring1)}`,
    `Ring 2:     ${getItemName(equipment.ring2)}`,
  ];

  return lines.join('\n');
}

// Build a brief description of what someone is wearing/carrying (for NPC context)
function buildEquipmentDescription(playerId: number, isSelf: boolean): string {
  const equipment = playerManager.getEquipment(playerId);
  const lines: string[] = [];
  const pronoun = isSelf ? 'You are' : 'They are';
  const possessive = isSelf ? 'Your' : 'Their';

  // Build wearing/carrying list
  const wearing: string[] = [];
  const wielding: string[] = [];

  if (equipment.head) {
    const item = itemTemplates.find(i => i.id === equipment.head);
    if (item) wearing.push(`${item.name} (head)`);
  }
  if (equipment.body) {
    const item = itemTemplates.find(i => i.id === equipment.body);
    if (item) wearing.push(`${item.name} (body)`);
  }
  if (equipment.legs) {
    const item = itemTemplates.find(i => i.id === equipment.legs);
    if (item) wearing.push(`${item.name} (legs)`);
  }
  if (equipment.feet) {
    const item = itemTemplates.find(i => i.id === equipment.feet);
    if (item) wearing.push(`${item.name} (feet)`);
  }
  if (equipment.hands) {
    const item = itemTemplates.find(i => i.id === equipment.hands);
    if (item) wearing.push(`${item.name} (hands)`);
  }
  if (equipment.back) {
    const item = itemTemplates.find(i => i.id === equipment.back);
    if (item) wearing.push(`${item.name} (back)`);
  }
  if (equipment.neck) {
    const item = itemTemplates.find(i => i.id === equipment.neck);
    if (item) wearing.push(`${item.name} (neck)`);
  }
  if (equipment.ring1) {
    const item = itemTemplates.find(i => i.id === equipment.ring1);
    if (item) wearing.push(`${item.name} (ring)`);
  }
  if (equipment.ring2) {
    const item = itemTemplates.find(i => i.id === equipment.ring2);
    if (item) wearing.push(`${item.name} (ring)`);
  }

  if (equipment.mainHand) {
    const item = itemTemplates.find(i => i.id === equipment.mainHand);
    if (item) wielding.push(`${item.name} (main hand)`);
  }
  if (equipment.offHand) {
    const item = itemTemplates.find(i => i.id === equipment.offHand);
    if (item) wielding.push(`${item.name} (off hand)`);
  }

  // Check for bags in inventory
  const inventory = playerManager.getInventory(playerId);
  const bags = inventory.filter(item => {
    const template = itemTemplates.find(t => t.id === item.templateId);
    return template?.type === 'container' || template?.slot === 'back';
  });

  if (wearing.length > 0) {
    lines.push(`${pronoun} wearing: ${wearing.join(', ')}`);
  } else {
    lines.push(`${pronoun} wearing simple, worn clothes.`);
  }

  if (wielding.length > 0) {
    lines.push(`${pronoun} wielding: ${wielding.join(', ')}`);
  }

  if (bags.length > 0) {
    const bagNames = bags.map(b => {
      const t = itemTemplates.find(i => i.id === b.templateId);
      return t?.name || 'a bag';
    });
    lines.push(`${pronoun} carrying: ${bagNames.join(', ')}`);
  }

  return lines.join('\n');
}

// Build a description of what the player looks like based on their equipment
function buildPlayerAppearanceDescription(playerId: number): string {
  const equipment = playerManager.getEquipment(playerId);
  const parts: string[] = [];

  // Check each slot and describe what's there (or missing)
  if (equipment.head) {
    const item = itemTemplates.find(i => i.id === equipment.head);
    if (item) parts.push(`wearing ${item.name} on head`);
  }

  if (equipment.body) {
    const item = itemTemplates.find(i => i.id === equipment.body);
    if (item) parts.push(`wearing ${item.name}`);
  } else {
    parts.push('bare-chested or in a simple shirt');
  }

  if (equipment.legs) {
    const item = itemTemplates.find(i => i.id === equipment.legs);
    if (item) parts.push(`${item.name} on legs`);
  } else {
    parts.push('worn/basic trousers');
  }

  if (equipment.feet) {
    const item = itemTemplates.find(i => i.id === equipment.feet);
    if (item) parts.push(`${item.name} on feet`);
  } else {
    parts.push('barefoot or in worn boots');
  }

  if (equipment.mainHand) {
    const item = itemTemplates.find(i => i.id === equipment.mainHand);
    if (item) parts.push(`carrying ${item.name}`);
  } else {
    parts.push('unarmed');
  }

  if (equipment.back) {
    const item = itemTemplates.find(i => i.id === equipment.back);
    if (item) parts.push(`${item.name} draped over shoulders`);
  }

  // Add cleanliness/bloodiness context
  const appearanceContext = appearanceManager.buildNpcAppearanceContext(playerId);
  if (appearanceContext) {
    parts.push(appearanceContext);
  }

  if (parts.length === 0) {
    return 'Wearing simple, worn clothes. Looks like they could use some upgrades.';
  }

  return parts.join(', ') + '.';
}

// Build description of shop inventory for NPC dialogue
function buildShopInventoryContext(npcTemplateId: number): string {
  const template = npcTemplates.find(t => t.id === npcTemplateId);
  if (!template?.shopInventory || template.shopInventory.length === 0) {
    return '';
  }

  const items: string[] = [];
  for (const shopItem of template.shopInventory) {
    const itemTemplate = itemTemplates.find(i => i.id === shopItem.itemTemplateId);
    if (itemTemplate) {
      const price = Math.floor((itemTemplate.value || 10) * shopItem.buyPriceMultiplier);
      const stock = shopItem.stock === -1 ? 'unlimited' : `${shopItem.stock} in stock`;
      items.push(`- ${itemTemplate.name}: ${price} gold (${stock})`);
    }
  }

  if (items.length === 0) return '';

  return `\nYOUR SHOP INVENTORY (offer these to customers!):\n${items.join('\n')}`;
}

// Build physical room context - what actually exists in the world
function buildRoomPhysicalContext(roomId: string, npcTemplateId: number): {
  roomItems: string[];
  roomExits: string[];
  nearbyRooms: { direction: string; name: string; items: string[] }[];
  npcInventory: string[];
  npcActiveTask: { description: string; itemsNeeded: string[]; itemsAvailable: string[] } | null;
} {
  const db = getDatabase();

  // Get items in current room
  const roomItemsData = worldManager.getItemsInRoom(roomId);
  const roomItems = roomItemsData.map(item => {
    const template = itemTemplates.find(t => t.id === item.itemTemplateId);
    return template?.name || 'unknown item';
  });

  // Get room exits
  const room = worldManager.getRoom(roomId);
  const roomExits = room?.exits ? Object.keys(room.exits) : [];

  // Get nearby rooms and their contents (one level deep)
  const nearbyRooms: { direction: string; name: string; items: string[] }[] = [];
  if (room?.exits) {
    for (const [direction, targetRoomId] of Object.entries(room.exits)) {
      const targetRoom = worldManager.getRoom(targetRoomId);
      if (targetRoom) {
        const targetItems = worldManager.getItemsInRoom(targetRoomId);
        const itemNames = targetItems.map(item => {
          const template = itemTemplates.find(t => t.id === item.itemTemplateId);
          return template?.name || 'unknown item';
        });
        nearbyRooms.push({
          direction,
          name: targetRoom.name,
          items: itemNames
        });
      }
    }
  }

  // Get NPC's shop inventory as items they have access to
  const npcTemplate = npcTemplates.find(t => t.id === npcTemplateId);
  const npcInventory: string[] = [];
  if (npcTemplate?.shopInventory) {
    for (const shopItem of npcTemplate.shopInventory) {
      const itemTemplate = itemTemplates.find(i => i.id === shopItem.itemTemplateId);
      if (itemTemplate) {
        npcInventory.push(itemTemplate.name);
      }
    }
  }

  // Get NPC's active task and what items it needs
  let npcActiveTask: { description: string; itemsNeeded: string[]; itemsAvailable: string[] } | null = null;
  const taskData = db.prepare(`
    SELECT description, resources_needed, resources_gathered
    FROM npc_tasks
    WHERE npc_instance_id IN (SELECT id FROM room_npcs WHERE npc_template_id = ?)
      AND status IN ('active', 'pending')
    ORDER BY status DESC
    LIMIT 1
  `).get(npcTemplateId) as {
    description: string;
    resources_needed: string;
    resources_gathered: string;
  } | undefined;

  if (taskData) {
    const needed = JSON.parse(taskData.resources_needed || '[]') as string[];
    const gathered = JSON.parse(taskData.resources_gathered || '[]') as string[];
    npcActiveTask = {
      description: taskData.description,
      itemsNeeded: needed,
      itemsAvailable: gathered
    };
  }

  return {
    roomItems,
    roomExits,
    nearbyRooms,
    npcInventory,
    npcActiveTask
  };
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

  // Add shop inventory if this NPC is a shopkeeper
  const shopInventory = buildShopInventoryContext(excludeNpcId);
  if (shopInventory) {
    parts.push(shopInventory);
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

// Process STATUS command - show relationship status with NPC or player
function processStatus(ctx: CommandContext): void {
  const targetName = ctx.args.join(' ').toLowerCase().trim();

  if (!targetName) {
    sendOutput(ctx.playerId, 'Status with whom? Usage: status <name>');
    return;
  }

  const db = getDatabase();

  // Check for NPC in current room first
  const npcsInRoom = npcManager.getNpcsInRoom(ctx.roomId);
  const matchingNpc = npcsInRoom.find(npc => {
    const template = npcTemplates.find(t => t.id === npc.templateId);
    return template?.name.toLowerCase().includes(targetName) ||
           template?.keywords?.some(k => k.toLowerCase().includes(targetName));
  });

  if (matchingNpc) {
    const template = npcTemplates.find(t => t.id === matchingNpc.templateId);
    if (!template) {
      sendOutput(ctx.playerId, "You can't get a read on them.");
      return;
    }

    // Get NPC memory/disposition
    const memory = npcManager.getNpcMemory(matchingNpc.templateId, ctx.playerId);
    const disposition = memory?.disposition ?? 50;
    const trustLevel = getDispositionTrustLevel(disposition);
    const trustHint = getTrustHint(trustLevel);

    // Get interaction stats
    const totalInteractions = memory?.interaction_count ?? 0;
    const positiveInteractions = memory?.positive_interactions ?? 0;
    const negativeInteractions = memory?.negative_interactions ?? 0;

    // Get memories of this player
    const memories = memory?.memories ? JSON.parse(memory.memories as string) : [];

    // Build the status output
    const lines: string[] = [];
    lines.push(`\n=== Your Status with ${template.name} ===\n`);
    lines.push(`Relationship: ${capitalizeFirst(trustLevel)} (${disposition}/100)`);
    lines.push(`${template.name} ${trustHint}.`);
    lines.push('');
    lines.push(`Interactions: ${totalInteractions} total (${positiveInteractions} positive, ${negativeInteractions} negative)`);

    if (memories.length > 0) {
      lines.push('');
      lines.push(`${template.name} remembers:`);
      // Show last 3 memories
      const recentMemories = memories.slice(-3);
      for (const mem of recentMemories) {
        lines.push(`  • ${mem}`);
      }
    }

    // Show trust level effects
    lines.push('');
    lines.push(getTrustLevelEffects(trustLevel));

    sendOutput(ctx.playerId, lines.join('\n'));
    return;
  }

  // Check for player in room
  const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
  for (const otherId of playersInRoom) {
    if (otherId === ctx.playerId) continue;

    const otherPlayer = playerQueries.findById(db).get(otherId) as { id: number; name: string } | undefined;
    if (otherPlayer && otherPlayer.name.toLowerCase().includes(targetName)) {
      // For now, player-to-player status is simple
      sendOutput(ctx.playerId, `\n=== Your Status with ${otherPlayer.name} ===\n\nPlayer relationships are still being implemented.\nYou're both adventurers in this world.`);
      return;
    }
  }

  // Check for NPC not in room but known to player
  const allMemories = db.prepare(`
    SELECT npc_template_id, disposition, interaction_count, positive_interactions, negative_interactions, memories
    FROM npc_memory WHERE player_id = ?
  `).all(ctx.playerId) as Array<{
    npc_template_id: number;
    disposition: number;
    interaction_count: number;
    positive_interactions: number;
    negative_interactions: number;
    memories: string;
  }>;

  for (const mem of allMemories) {
    const template = npcTemplates.find(t => t.id === mem.npc_template_id);
    if (template && template.name.toLowerCase().includes(targetName)) {
      const trustLevel = getDispositionTrustLevel(mem.disposition);
      const memories = mem.memories ? JSON.parse(mem.memories) : [];

      const lines: string[] = [];
      lines.push(`\n=== Your Status with ${template.name} ===\n`);
      lines.push(`(Not present - recalling from memory)`);
      lines.push('');
      lines.push(`Relationship: ${capitalizeFirst(trustLevel)} (${mem.disposition}/100)`);
      lines.push(`Interactions: ${mem.interaction_count} total (${mem.positive_interactions} positive, ${mem.negative_interactions} negative)`);

      if (memories.length > 0) {
        lines.push('');
        lines.push(`${template.name} remembers:`);
        const recentMemories = memories.slice(-3);
        for (const m of recentMemories) {
          lines.push(`  • ${m}`);
        }
      }

      sendOutput(ctx.playerId, lines.join('\n'));
      return;
    }
  }

  sendOutput(ctx.playerId, `You don't see ${targetName} here, and you don't recall meeting anyone by that name.`);
}

// Convert disposition (0-100) to trust level
function getDispositionTrustLevel(disposition: number): string {
  if (disposition < 10) return 'hostile';
  if (disposition < 25) return 'unfriendly';
  if (disposition < 40) return 'stranger';
  if (disposition < 55) return 'acquaintance';
  if (disposition < 70) return 'friend';
  if (disposition < 85) return 'trusted';
  return 'family';
}

// Get effects description for trust level
function getTrustLevelEffects(trustLevel: string): string {
  const effects: Record<string, string> = {
    hostile: 'Effects: Will refuse to talk or trade. May attack on sight.',
    unfriendly: 'Effects: Short answers, higher prices, unlikely to help.',
    stranger: 'Effects: Neutral interactions. Standard prices.',
    acquaintance: 'Effects: Friendlier dialogue, may share basic information.',
    friend: 'Effects: Discounts on trades, shares secrets, willing to help.',
    trusted: 'Effects: Significant favors, introduces family, deep discounts.',
    family: 'Effects: Would risk their life for you. Shares everything.',
  };
  return effects[trustLevel] || effects.stranger;
}

// Helper to capitalize first letter
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Process CONTEXT command - show full NPC context (debug/admin command)
function processContext(ctx: CommandContext): void {
  const targetName = ctx.args.join(' ').toLowerCase().trim();

  if (!targetName) {
    sendOutput(ctx.playerId, 'Context for whom? Usage: context <npc name>');
    return;
  }

  const db = getDatabase();

  // Find ALL NPCs that match the name (not just in room)
  const matchingTemplates = npcTemplates.filter(t => {
    const nameLower = t.name.toLowerCase();
    const nameParts = nameLower.split(' ');
    // Match full name, any part of name, or keywords
    return nameLower.includes(targetName) ||
           nameParts.some(part => part.includes(targetName) || targetName.includes(part)) ||
           t.keywords?.some(k => k.toLowerCase().includes(targetName));
  });

  if (matchingTemplates.length === 0) {
    sendOutput(ctx.playerId, `No one named "${targetName}" exists in Gamehenge.`);
    return;
  }

  // If multiple matches, ask for clarification
  if (matchingTemplates.length > 1) {
    const names = matchingTemplates.map(t => t.name).join('\n  • ');
    sendOutput(ctx.playerId, `Multiple people match "${targetName}":\n  • ${names}\n\nPlease be more specific.`);
    return;
  }

  const template = matchingTemplates[0];

  // Find the NPC instance (they might be in any room)
  const npcInstance = db.prepare(`
    SELECT rn.id, rn.room_id, rn.npc_template_id
    FROM room_npcs rn
    WHERE rn.npc_template_id = ?
    LIMIT 1
  `).get(template.id) as { id: number; room_id: string; npc_template_id: number } | undefined;

  const npcRoomId = npcInstance?.room_id || 'unknown';

  // Get room name for display
  const npcRoom = worldManager.getRoom(npcRoomId);
  const npcRoomName = npcRoom?.name || npcRoomId;
  const isInSameRoom = npcRoomId === ctx.roomId;

  const lines: string[] = [];
  lines.push(`\n${'='.repeat(50)}`);
  lines.push(`FULL CONTEXT: ${template.name}`);
  lines.push(`${'='.repeat(50)}\n`);

  // Basic info
  lines.push(`--- IDENTITY ---`);
  lines.push(`Name: ${template.name}`);
  lines.push(`Role: ${template.role || template.type}`);
  lines.push(`Keywords: ${template.keywords?.join(', ') || 'none'}`);
  lines.push(`Location: ${npcRoomName}${isInSameRoom ? ' (here with you)' : ''}`);
  lines.push('');

  // Current state
  const npcState = db.prepare(`
    SELECT current_task, task_progress, energy, mood, current_room, current_purpose
    FROM npc_state ns
    JOIN room_npcs rn ON ns.npc_instance_id = rn.id
    WHERE rn.npc_template_id = ?
    LIMIT 1
  `).get(template.id) as {
    current_task: string | null;
    task_progress: number;
    energy: number;
    mood: string;
    current_room: string;
    current_purpose: string | null;
  } | undefined;

  lines.push(`--- CURRENT STATE ---`);
  lines.push(`Mood: ${npcState?.mood || 'neutral'}`);
  lines.push(`Energy: ${npcState?.energy || 100}/100`);
  lines.push(`Current Task: ${npcState?.current_task || 'idle'}`);
  lines.push(`Task Progress: ${npcState?.task_progress || 0}%`);
  lines.push(`Purpose: ${npcState?.current_purpose || 'none specified'}`);
  lines.push('');

  // Active tasks
  const tasks = db.prepare(`
    SELECT task_type, description, status, progress, resources_needed, resources_gathered
    FROM npc_tasks
    WHERE npc_instance_id IN (SELECT id FROM room_npcs WHERE npc_template_id = ?)
    ORDER BY status DESC, created_at DESC
    LIMIT 5
  `).all(template.id) as Array<{
    task_type: string;
    description: string;
    status: string;
    progress: number;
    resources_needed: string;
    resources_gathered: string;
  }>;

  lines.push(`--- TASKS ---`);
  if (tasks.length === 0) {
    lines.push('No active tasks.');
  } else {
    for (const task of tasks) {
      const needed = JSON.parse(task.resources_needed || '[]');
      const gathered = JSON.parse(task.resources_gathered || '[]');
      lines.push(`• [${task.status.toUpperCase()}] ${task.description}`);
      lines.push(`  Type: ${task.task_type}, Progress: ${task.progress}%`);
      if (needed.length > 0) {
        lines.push(`  Needs: ${needed.join(', ')}`);
        lines.push(`  Has: ${gathered.length > 0 ? gathered.join(', ') : 'nothing yet'}`);
      }
    }
  }
  lines.push('');

  // Wants (what they're looking for)
  const wants = db.prepare(`
    SELECT want_type, target, priority, reason, status
    FROM npc_wants
    WHERE npc_template_id = ? AND status != 'fulfilled'
    ORDER BY priority DESC
    LIMIT 5
  `).all(template.id) as Array<{
    want_type: string;
    target: string;
    priority: number;
    reason: string;
    status: string;
  }>;

  lines.push(`--- WANTS ---`);
  if (wants.length === 0) {
    lines.push('No active wants.');
  } else {
    for (const want of wants) {
      lines.push(`• [${want.status}] ${want.want_type}: ${want.target}`);
      lines.push(`  Priority: ${want.priority}/10 - ${want.reason}`);
    }
  }
  lines.push('');

  // Opinion of player
  const memory = npcManager.getNpcMemory(template.id, ctx.playerId);
  const disposition = memory?.disposition ?? 50;
  const trustLevel = getDispositionTrustLevel(disposition);

  lines.push(`--- OPINION OF YOU ---`);
  lines.push(`Disposition: ${disposition}/100 (${trustLevel})`);
  lines.push(`Interactions: ${memory?.interaction_count || 0} total`);
  lines.push(`  Positive: ${memory?.positive_interactions || 0}`);
  lines.push(`  Negative: ${memory?.negative_interactions || 0}`);

  const memories = memory?.memories ? JSON.parse(memory.memories as string) : [];
  if (memories.length > 0) {
    lines.push(`Memories of you:`);
    for (const m of memories.slice(-5)) {
      lines.push(`  • ${m}`);
    }
  }
  lines.push('');

  // Relationships with other NPCs
  const relationships = db.prepare(`
    SELECT target_npc_id, relationship_type, affinity, trust, notes
    FROM npc_relationships
    WHERE npc_id = ?
    ORDER BY affinity DESC
    LIMIT 10
  `).all(template.id) as Array<{
    target_npc_id: number;
    relationship_type: string;
    affinity: number;
    trust: number;
    notes: string | null;
  }>;

  lines.push(`--- RELATIONSHIPS WITH OTHER NPCS ---`);
  if (relationships.length === 0) {
    lines.push('No recorded relationships.');
  } else {
    for (const rel of relationships) {
      const targetTemplate = npcTemplates.find(t => t.id === rel.target_npc_id);
      const targetName = targetTemplate?.name || `NPC #${rel.target_npc_id}`;
      lines.push(`• ${targetName}: ${rel.relationship_type} (affinity: ${rel.affinity}, trust: ${rel.trust})`);
      if (rel.notes) {
        lines.push(`  "${rel.notes}"`);
      }
    }
  }
  lines.push('');

  // NPC-to-NPC memories
  const npcMemories = db.prepare(`
    SELECT about_npc_id, content, importance, emotional_valence
    FROM npc_npc_memories
    WHERE npc_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `).all(template.id) as Array<{
    about_npc_id: number;
    content: string;
    importance: number;
    emotional_valence: number;
  }>;

  if (npcMemories.length > 0) {
    lines.push(`--- MEMORIES OF OTHER NPCS ---`);
    for (const mem of npcMemories) {
      const aboutTemplate = npcTemplates.find(t => t.id === mem.about_npc_id);
      const aboutName = aboutTemplate?.name || `NPC #${mem.about_npc_id}`;
      const valence = mem.emotional_valence > 0 ? '+' : mem.emotional_valence < 0 ? '-' : '~';
      lines.push(`• About ${aboutName}: ${mem.content} [${valence}${Math.abs(mem.emotional_valence)}]`);
    }
    lines.push('');
  }

  // Room context (from the NPC's current location)
  const roomData = buildRoomPhysicalContext(npcRoomId, template.id);
  lines.push(`--- PHYSICAL CONTEXT (from ${npcRoomName}) ---`);
  lines.push(`Room items: ${roomData.roomItems.length > 0 ? roomData.roomItems.join(', ') : 'none'}`);
  lines.push(`Exits: ${roomData.roomExits.join(', ')}`);
  if (roomData.nearbyRooms.length > 0) {
    lines.push(`Nearby rooms:`);
    for (const nearby of roomData.nearbyRooms) {
      lines.push(`  ${nearby.direction}: ${nearby.name}${nearby.items.length > 0 ? ` [${nearby.items.join(', ')}]` : ''}`);
    }
  }
  if (roomData.npcInventory.length > 0) {
    lines.push(`Shop inventory: ${roomData.npcInventory.join(', ')}`);
  }
  lines.push('');

  // Personality
  const personality = getNpcPersonalityPrompt(template.id);
  lines.push(`--- PERSONALITY ---`);
  lines.push(personality.substring(0, 500) + (personality.length > 500 ? '...' : ''));

  lines.push(`\n${'='.repeat(50)}`);

  sendOutput(ctx.playerId, lines.join('\n'));
}
