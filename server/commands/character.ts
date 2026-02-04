// Character Commands for Llama Picchu MUD
import { connectionManager } from '../managers/connectionManager';
import { playerManager } from '../managers/playerManager';
import { worldManager } from '../managers/worldManager';
import { getDatabase, playerQueries, skillQueries } from '../database';
import { itemTemplates } from '../data/items';
import { skillDefinitions } from '../data/skills';
import type { CommandContext } from './index';

export function processCharacterCommand(ctx: CommandContext, action: string): void {
  switch (action) {
    case 'equipment':
      processEquipment(ctx);
      break;
    case 'wear':
      processWear(ctx);
      break;
    case 'remove':
      processRemove(ctx);
      break;
    case 'skills':
      processSkills(ctx);
      break;
    case 'rest':
      processRest(ctx);
      break;
    case 'wake':
      processWake(ctx);
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

function processEquipment(ctx: CommandContext): void {
  const equipment = playerManager.getEquipment(ctx.playerId);

  const getItemName = (itemId: number | null): string => {
    if (!itemId) return 'Nothing';
    const template = itemTemplates.find((t) => t.id === itemId);
    return template?.name || 'Nothing';
  };

  const lines = [
    '',
    '=== Equipment ===',
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
    '',
    'Use "inventory" or "i" to see carried items and appearance.',
    '',
  ];

  sendOutput(ctx.playerId, lines.join('\n'));
}

function processWear(ctx: CommandContext): void {
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

  // Try to equip
  const result = playerManager.equipItem(ctx.playerId, invItem.id);
  if (!result.success) {
    sendOutput(ctx.playerId, result.error || 'Failed to equip item.');
    return;
  }

  sendOutput(ctx.playerId, `You equip ${template.name}.`);

  // Update equipment display
  connectionManager.sendToPlayer(ctx.playerId, {
    type: 'equipment_update',
    slot: result.slot!,
    item: {
      id: invItem.id,
      templateId: invItem.templateId,
      name: template.name,
      slot: result.slot!,
    },
  });
}

function processRemove(ctx: CommandContext): void {
  const slot = ctx.args[0]?.toLowerCase();

  // Map common slot names
  const slotMap: Record<string, string> = {
    head: 'head',
    neck: 'neck',
    body: 'body',
    chest: 'body',
    torso: 'body',
    back: 'back',
    cloak: 'back',
    cape: 'back',
    legs: 'legs',
    feet: 'feet',
    boots: 'feet',
    shoes: 'feet',
    hands: 'hands',
    gloves: 'hands',
    weapon: 'mainHand',
    'main hand': 'mainHand',
    mainhand: 'mainHand',
    shield: 'offHand',
    'off hand': 'offHand',
    offhand: 'offHand',
    ring1: 'ring1',
    ring2: 'ring2',
    ring: 'ring1',
  };

  const normalizedSlot = slotMap[slot];
  if (!normalizedSlot) {
    sendOutput(ctx.playerId, 'Invalid slot. Valid slots: head, neck, body, back, legs, feet, hands, weapon, shield, ring1, ring2');
    return;
  }

  const result = playerManager.unequipItem(ctx.playerId, normalizedSlot);
  if (!result.success) {
    sendOutput(ctx.playerId, result.error || 'Failed to remove item.');
    return;
  }

  sendOutput(ctx.playerId, `You remove your ${slot}.`);

  connectionManager.sendToPlayer(ctx.playerId, {
    type: 'equipment_update',
    slot: normalizedSlot,
    item: null,
  });
}

function processSkills(ctx: CommandContext): void {
  const db = getDatabase();
  const player = playerQueries.findById(db).get(ctx.playerId) as {
    class_id: number;
    level: number;
  };

  const playerSkills = skillQueries.getAll(db).all(ctx.playerId) as {
    skill_id: number;
    proficiency: number;
  }[];

  // Get class skills
  const classSkills = skillDefinitions.filter(
    (s) => (!s.classRequired || s.classRequired === player.class_id) && s.levelRequired <= player.level
  );

  const lines = [
    '',
    '╔════════════════════════════════════════════════════╗',
    '║                    SKILLS                          ║',
    '╠════════════════════════════════════════════════════╣',
  ];

  for (const skill of classSkills) {
    const learned = playerSkills.find((ps) => ps.skill_id === skill.id);
    const proficiency = learned?.proficiency || 0;
    const status = proficiency > 0 ? `${proficiency}%` : 'Not Learned';
    const typeIcon = skill.type === 'spell' ? '[S]' : skill.type === 'passive' ? '[P]' : '[A]';

    lines.push(
      `║  ${typeIcon} ${skill.name.padEnd(20)} Lv${String(skill.levelRequired).padStart(2)}  ${status.padStart(10)}  ║`
    );
  }

  lines.push('╠════════════════════════════════════════════════════╣');
  lines.push('║  [S] = Spell  [A] = Active  [P] = Passive          ║');
  lines.push('║  Visit a guild to practice skills.                 ║');
  lines.push('╚════════════════════════════════════════════════════╝');
  lines.push('');

  sendOutput(ctx.playerId, lines.join('\n'));
}

function processRest(ctx: CommandContext): void {
  const db = getDatabase();
  const player = playerQueries.findById(db).get(ctx.playerId) as {
    is_resting: number;
    is_fighting: number;
    gold: number;
  };

  if (player.is_fighting) {
    sendOutput(ctx.playerId, 'You cannot rest while in combat!');
    return;
  }

  if (player.is_resting) {
    sendOutput(ctx.playerId, 'You are already resting.');
    return;
  }

  // Check if room allows resting
  const isRestRoom = worldManager.isRestRoom(ctx.roomId);
  const restCost = worldManager.getRestCost(ctx.roomId);

  if (!isRestRoom && !worldManager.isRoomSafe(ctx.roomId)) {
    sendOutput(ctx.playerId, 'This is not a safe place to rest. Find an inn or safe area.');
    return;
  }

  if (restCost > 0 && player.gold < restCost) {
    sendOutput(ctx.playerId, `You need ${restCost} gold to rest here.`);
    return;
  }

  // Deduct cost and start resting
  if (restCost > 0) {
    playerManager.modifyGold(ctx.playerId, -restCost);
  }

  playerQueries.updateRestState(db).run(1, ctx.playerId);

  sendOutput(
    ctx.playerId,
    restCost > 0
      ? `You pay ${restCost} gold and settle in for a rest. Your recovery rate is doubled.`
      : 'You settle down to rest. Your recovery rate is doubled.'
  );

  // Notify others
  const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
  for (const otherId of playersInRoom) {
    if (otherId !== ctx.playerId) {
      connectionManager.sendToPlayer(otherId, {
        type: 'output',
        text: `${ctx.playerName} settles down to rest.`,
        messageType: 'normal',
      });
    }
  }
}

function processWake(ctx: CommandContext): void {
  const db = getDatabase();
  const player = playerQueries.findById(db).get(ctx.playerId) as {
    is_resting: number;
  };

  if (!player.is_resting) {
    sendOutput(ctx.playerId, 'You are not resting.');
    return;
  }

  playerQueries.updateRestState(db).run(0, ctx.playerId);
  sendOutput(ctx.playerId, 'You stand up and stretch.');

  // Notify others
  const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
  for (const otherId of playersInRoom) {
    if (otherId !== ctx.playerId) {
      connectionManager.sendToPlayer(otherId, {
        type: 'output',
        text: `${ctx.playerName} stands up.`,
        messageType: 'normal',
      });
    }
  }
}
