// Combat Commands for Llama Picchu MUD
import { connectionManager } from '../managers/connectionManager';
import { worldManager } from '../managers/worldManager';
import { combatManager } from '../managers/combatManager';
import { npcTemplates } from '../data/npcs';
import { getDatabase, playerQueries } from '../database';
import type { CommandContext } from './index';

export function processCombatCommand(ctx: CommandContext, action: string): void {
  switch (action) {
    case 'kill':
      processKill(ctx);
      break;
    case 'consider':
      processConsider(ctx);
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

function processKill(ctx: CommandContext): void {
  const target = ctx.args.join(' ').toLowerCase();

  // Check if already in combat
  if (combatManager.isInCombat(ctx.playerId)) {
    sendOutput(ctx.playerId, 'You are already in combat!');
    return;
  }

  // Find NPC in room
  const npc = worldManager.findNpcInRoom(ctx.roomId, target);
  if (!npc) {
    sendOutput(ctx.playerId, `You don't see "${target}" here.`);
    return;
  }

  // Start combat
  const result = combatManager.startCombat(ctx.playerId, npc.id);
  if (!result.success) {
    sendOutput(ctx.playerId, result.error || 'Failed to start combat.');
  }
}

function processConsider(ctx: CommandContext): void {
  const target = ctx.args.join(' ').toLowerCase();

  // Find NPC in room
  const npc = worldManager.findNpcInRoom(ctx.roomId, target);
  if (!npc) {
    sendOutput(ctx.playerId, `You don't see "${target}" here.`);
    return;
  }

  const template = npcTemplates.find((t) => t.id === npc.npcTemplateId);
  if (!template) {
    sendOutput(ctx.playerId, 'You cannot evaluate that.');
    return;
  }

  // Get player level
  const db = getDatabase();
  const player = playerQueries.findById(db).get(ctx.playerId) as { level: number };

  const levelDiff = template.level - player.level;
  let assessment: string;

  if (levelDiff >= 10) {
    assessment = 'You would be completely destroyed!';
  } else if (levelDiff >= 5) {
    assessment = 'This would be suicide.';
  } else if (levelDiff >= 3) {
    assessment = 'You would need a lot of luck.';
  } else if (levelDiff >= 1) {
    assessment = 'This will be a tough fight.';
  } else if (levelDiff === 0) {
    assessment = 'This should be a fair fight.';
  } else if (levelDiff >= -2) {
    assessment = 'You should win without too much trouble.';
  } else if (levelDiff >= -5) {
    assessment = 'This should be an easy victory.';
  } else {
    assessment = 'Why would you even bother?';
  }

  sendOutput(ctx.playerId, `\n${template.name} (Level ${template.level})\n${assessment}\n`);
}
