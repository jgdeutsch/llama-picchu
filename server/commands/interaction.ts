// Interaction Commands for Llama Picchu MUD
import { connectionManager } from '../managers/connectionManager';
import { worldManager } from '../managers/worldManager';
import { playerManager } from '../managers/playerManager';
import { npcManager } from '../managers/npcManager';
import { questManager } from '../managers/questManager';
import { getDatabase, playerQueries } from '../database';
import { itemTemplates } from '../data/items';
import { npcTemplates } from '../data/npcs';
import type { CommandContext } from './index';

export function processInteractionCommand(ctx: CommandContext, action: string): void {
  switch (action) {
    case 'look':
      processLookAt(ctx);
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
      processTalk(ctx);
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

function processLookAt(ctx: CommandContext): void {
  const target = ctx.args.join(' ').toLowerCase();

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
      sendOutput(ctx.playerId, `\n${template.longDesc}\n`);
      return;
    }
  }

  // Check players in room
  const db = getDatabase();
  const playersInRoom = playerQueries.getPlayersInRoom(db).all(ctx.roomId) as {
    id: number;
    name: string;
    level: number;
    class_id: number;
  }[];

  for (const p of playersInRoom) {
    if (p.name.toLowerCase().includes(target) && p.id !== ctx.playerId) {
      const classDef = playerManager.getClassDefinition(p.class_id);
      sendOutput(ctx.playerId, `\nYou see ${p.name}, a level ${p.level} ${classDef?.name || 'llama'}.\n`);
      return;
    }
  }

  sendOutput(ctx.playerId, `You don't see "${target}" here.`);
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

function processTalk(ctx: CommandContext): void {
  // Parse: talk <npc> [message] or talk <npc> about <topic>
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
    sendOutput(ctx.playerId, `You don't see "${args[0]}" here.`);

    // Suggest NPCs that ARE in the room
    const npcsHere = npcManager.getNpcsInRoom(ctx.roomId);
    if (npcsHere.length > 0) {
      const suggestions = npcsHere.slice(0, 3).map(n => n.name.split(' ')[0].toLowerCase()).join(', ');
      sendOutput(ctx.playerId, `Try talking to: ${suggestions}`);
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

  // If no message provided, show greeting and relationship status
  if (!message) {
    // Use the conversation system to get a context-aware greeting
    const { response } = npcManager.processConversation(
      ctx.playerId,
      ctx.playerName,
      npc.id,
      'hello'
    );

    sendOutput(ctx.playerId, `\n${response}\n`);

    // Show relationship hint
    const memory = npcManager.getMemory(template.id, ctx.playerId);
    if (memory.interaction_count > 3) {
      const relationshipHint = npcManager.getDispositionDescription(memory.disposition);
      sendOutput(ctx.playerId, `(${template.name} ${relationshipHint})`);
    }

    // Show available quests if any
    if (template.questIds && template.questIds.length > 0 && memory.disposition >= 30) {
      const availableQuests = questManager.getAvailableQuests(npc.npcTemplateId, ctx.playerId);
      if (availableQuests.length > 0) {
        const questList = availableQuests.map((q) => `  [${q.id}] ${q.name} (Level ${q.levelRequired})`).join('\n');
        sendOutput(ctx.playerId, `\nAvailable quests:\n${questList}\nType "accept <quest id>" to accept a quest.`);
      }
    } else if (template.questIds && template.questIds.length > 0 && memory.disposition < 30) {
      sendOutput(ctx.playerId, `\n(${template.name} might have quests, but doesn't seem willing to help you right now.)`);
    }

    // Show conversation tips
    sendOutput(ctx.playerId, '\n(Tip: You can say things like "talk elder hello", "talk elder about quests", or "talk elder thank you")');
    return;
  }

  // Process the conversation with the message
  const { response, dispositionChange } = npcManager.processConversation(
    ctx.playerId,
    ctx.playerName,
    npc.id,
    message
  );

  sendOutput(ctx.playerId, `\n${response}\n`);

  // Show disposition change feedback
  if (dispositionChange > 0) {
    sendOutput(ctx.playerId, `(${template.name}'s opinion of you improved)`);
  } else if (dispositionChange < 0) {
    sendOutput(ctx.playerId, `(${template.name}'s opinion of you worsened)`);
  }
}
