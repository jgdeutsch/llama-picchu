// Skills Commands for Llama Picchu MUD
import { connectionManager } from '../managers/connectionManager';
import { playerManager } from '../managers/playerManager';
import { worldManager } from '../managers/worldManager';
import { combatManager } from '../managers/combatManager';
import { getDatabase, playerQueries, skillQueries } from '../database';
import { skillDefinitions } from '../data/skills';
import { npcTemplates } from '../data/npcs';
import type { CommandContext } from './index';

export function processSkillCommand(ctx: CommandContext): void {
  const action = ctx.command;

  if (action === 'practice') {
    processPractice(ctx);
    return;
  }

  if (action === 'cast') {
    processCast(ctx);
    return;
  }
}

function sendOutput(playerId: number, text: string): void {
  connectionManager.sendToPlayer(playerId, {
    type: 'output',
    text,
    messageType: 'normal',
  });
}

function processPractice(ctx: CommandContext): void {
  // Check if in a guild
  const npcsInRoom = worldManager.getRoomState(ctx.roomId)?.npcs || [];

  let trainer = null;
  let trainerTemplate = null;

  for (const npc of npcsInRoom) {
    const template = npcTemplates.find((t) => t.id === npc.npcTemplateId);
    if (template && template.type === 'guildmaster' && template.trainableSkills) {
      trainer = npc;
      trainerTemplate = template;
      break;
    }
  }

  if (!trainer || !trainerTemplate) {
    sendOutput(ctx.playerId, 'There is no trainer here. Visit a guild to practice skills.');
    return;
  }

  const db = getDatabase();
  const player = playerQueries.findById(db).get(ctx.playerId) as {
    class_id: number;
    level: number;
    gold: number;
  };

  // Get player's current skills
  const playerSkills = skillQueries.getAll(db).all(ctx.playerId) as {
    skill_id: number;
    proficiency: number;
  }[];

  // If no skill specified, show available skills to practice
  if (ctx.args.length === 0) {
    const availableSkills = trainerTemplate.trainableSkills!
      .map((skillId) => skillDefinitions.find((s) => s.id === skillId))
      .filter((s) => s && s.levelRequired <= player.level);

    if (availableSkills.length === 0) {
      sendOutput(ctx.playerId, `${trainerTemplate.name} has nothing to teach you at your current level.`);
      return;
    }

    const lines = [
      '',
      `${trainerTemplate.name} can teach you:`,
      '',
    ];

    for (const skill of availableSkills) {
      if (!skill) continue;
      const learned = playerSkills.find((ps) => ps.skill_id === skill.id);
      const proficiency = learned?.proficiency || 0;
      const cost = Math.floor(50 * (1 + proficiency / 100)); // Cost increases with proficiency

      if (proficiency >= 100) {
        lines.push(`  ${skill.name.padEnd(20)} - MASTERED`);
      } else {
        lines.push(`  ${skill.name.padEnd(20)} - ${proficiency}% (${cost} gold to improve)`);
      }
    }

    lines.push('');
    lines.push('Type "practice <skill name>" to train.');
    lines.push('');

    sendOutput(ctx.playerId, lines.join('\n'));
    return;
  }

  // Try to practice specific skill
  const skillName = ctx.args.join(' ').toLowerCase();
  const skill = skillDefinitions.find(
    (s) =>
      s.name.toLowerCase().includes(skillName) &&
      trainerTemplate!.trainableSkills!.includes(s.id)
  );

  if (!skill) {
    sendOutput(ctx.playerId, `${trainerTemplate.name} cannot teach "${skillName}".`);
    return;
  }

  if (skill.levelRequired > player.level) {
    sendOutput(ctx.playerId, `You must be level ${skill.levelRequired} to learn ${skill.name}.`);
    return;
  }

  if (skill.classRequired && skill.classRequired !== player.class_id) {
    sendOutput(ctx.playerId, `${skill.name} cannot be learned by your class.`);
    return;
  }

  const currentSkill = playerSkills.find((ps) => ps.skill_id === skill.id);
  const currentProficiency = currentSkill?.proficiency || 0;

  if (currentProficiency >= 100) {
    sendOutput(ctx.playerId, `You have already mastered ${skill.name}.`);
    return;
  }

  const cost = Math.floor(50 * (1 + currentProficiency / 100));

  if (player.gold < cost) {
    sendOutput(ctx.playerId, `You need ${cost} gold to practice ${skill.name}. You have ${player.gold} gold.`);
    return;
  }

  // Deduct gold
  playerManager.modifyGold(ctx.playerId, -cost);

  // Increase proficiency (gain 5-15%)
  const gain = Math.floor(Math.random() * 11) + 5;
  const newProficiency = Math.min(100, currentProficiency + gain);

  // Update or insert skill
  skillQueries.addOrUpdate(db).run(ctx.playerId, skill.id, newProficiency, newProficiency);

  sendOutput(
    ctx.playerId,
    `You practice ${skill.name} with ${trainerTemplate.name}.\nYour proficiency increases from ${currentProficiency}% to ${newProficiency}%.\n(Cost: ${cost} gold)`
  );

  connectionManager.sendToPlayer(ctx.playerId, {
    type: 'skill_update',
    skillId: skill.id,
    proficiency: newProficiency,
  });
}

function processCast(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Cast what?');
    return;
  }

  const db = getDatabase();
  const player = playerQueries.findById(db).get(ctx.playerId) as {
    class_id: number;
    level: number;
    mana: number;
    max_mana: number;
    stamina: number;
    max_stamina: number;
    hp: number;
    max_hp: number;
  };

  // Find the skill
  const skillName = ctx.args[0].toLowerCase();
  const targetArg = ctx.args.slice(1).join(' ');

  const skill = skillDefinitions.find(
    (s) =>
      (s.name.toLowerCase().includes(skillName) || s.slug.includes(skillName)) &&
      (!s.classRequired || s.classRequired === player.class_id)
  );

  if (!skill) {
    sendOutput(ctx.playerId, `You don't know a skill called "${skillName}".`);
    return;
  }

  // Check if learned
  const playerSkills = skillQueries.getAll(db).all(ctx.playerId) as {
    skill_id: number;
    proficiency: number;
  }[];

  const learned = playerSkills.find((ps) => ps.skill_id === skill.id);
  if (!learned || learned.proficiency === 0) {
    sendOutput(ctx.playerId, `You haven't learned ${skill.name} yet.`);
    return;
  }

  // Check level requirement
  if (skill.levelRequired > player.level) {
    sendOutput(ctx.playerId, `You must be level ${skill.levelRequired} to use ${skill.name}.`);
    return;
  }

  // Check resources
  if (skill.manaCost > player.mana) {
    sendOutput(ctx.playerId, `You don't have enough mana. Need ${skill.manaCost}, have ${player.mana}.`);
    return;
  }

  if (skill.staminaCost > player.stamina) {
    sendOutput(ctx.playerId, `You don't have enough stamina. Need ${skill.staminaCost}, have ${player.stamina}.`);
    return;
  }

  // Check cooldown
  const cooldown = db.prepare(
    'SELECT * FROM player_cooldowns WHERE player_id = ? AND skill_id = ? AND ready_at > CURRENT_TIMESTAMP'
  ).get(ctx.playerId, skill.id);

  if (cooldown) {
    sendOutput(ctx.playerId, `${skill.name} is on cooldown.`);
    return;
  }

  // Deduct resources
  const newMana = player.mana - skill.manaCost;
  const newStamina = player.stamina - skill.staminaCost;

  // Set cooldown
  if (skill.cooldownSeconds > 0) {
    db.prepare(
      `INSERT OR REPLACE INTO player_cooldowns (player_id, skill_id, ready_at)
       VALUES (?, ?, datetime('now', '+' || ? || ' seconds'))`
    ).run(ctx.playerId, skill.id, skill.cooldownSeconds);
  }

  // Apply effect based on skill type
  const proficiencyMultiplier = 0.5 + (learned.proficiency / 100) * 0.5; // 50% to 100% effectiveness
  const basePower = skill.effect.basePower * proficiencyMultiplier;

  let effectMessage = '';

  switch (skill.effect.type) {
    case 'heal': {
      const healAmount = Math.floor(basePower);
      const newHp = Math.min(player.max_hp, player.hp + healAmount);
      db.prepare('UPDATE players SET hp = ?, mana = ?, stamina = ? WHERE id = ?').run(
        newHp,
        newMana,
        newStamina,
        ctx.playerId
      );
      effectMessage = `You channel healing energy and restore ${healAmount} HP.`;

      connectionManager.sendToPlayer(ctx.playerId, {
        type: 'player_update',
        resources: { hp: newHp, maxHp: player.max_hp, mana: newMana, maxMana: player.max_mana },
      });
      break;
    }

    case 'damage': {
      // Need a target for damage spells
      if (!combatManager.isInCombat(ctx.playerId)) {
        sendOutput(ctx.playerId, 'You are not in combat. Use "kill <target>" to start combat first.');

        // Refund resources (no cooldown set yet)
        return;
      }

      const damageAmount = Math.floor(basePower);
      effectMessage = `You cast ${skill.name}! (${damageAmount} damage)`;

      // Combat manager handles the actual damage application
      // For simplicity, just show the message
      db.prepare('UPDATE players SET mana = ?, stamina = ? WHERE id = ?').run(
        newMana,
        newStamina,
        ctx.playerId
      );

      connectionManager.sendToPlayer(ctx.playerId, {
        type: 'player_update',
        resources: { mana: newMana, maxMana: player.max_mana, stamina: newStamina, maxStamina: player.max_stamina },
      });
      break;
    }

    case 'buff': {
      effectMessage = `You cast ${skill.name}. Your ${skill.effect.affectedStat} is enhanced for ${skill.effect.duration} seconds.`;
      db.prepare('UPDATE players SET mana = ?, stamina = ? WHERE id = ?').run(
        newMana,
        newStamina,
        ctx.playerId
      );

      connectionManager.sendToPlayer(ctx.playerId, {
        type: 'player_update',
        resources: { mana: newMana, maxMana: player.max_mana, stamina: newStamina, maxStamina: player.max_stamina },
      });
      break;
    }

    case 'utility': {
      effectMessage = `You use ${skill.name}.`;
      db.prepare('UPDATE players SET mana = ?, stamina = ? WHERE id = ?').run(
        newMana,
        newStamina,
        ctx.playerId
      );

      connectionManager.sendToPlayer(ctx.playerId, {
        type: 'player_update',
        resources: { mana: newMana, maxMana: player.max_mana, stamina: newStamina, maxStamina: player.max_stamina },
      });
      break;
    }

    default:
      effectMessage = `You use ${skill.name}.`;
      db.prepare('UPDATE players SET mana = ?, stamina = ? WHERE id = ?').run(
        newMana,
        newStamina,
        ctx.playerId
      );
  }

  sendOutput(ctx.playerId, effectMessage);

  // Notify others in room for visible skills
  if (skill.type === 'spell') {
    const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
    for (const otherId of playersInRoom) {
      if (otherId !== ctx.playerId) {
        connectionManager.sendToPlayer(otherId, {
          type: 'output',
          text: `${ctx.playerName} casts ${skill.name}!`,
          messageType: 'normal',
        });
      }
    }
  }
}
