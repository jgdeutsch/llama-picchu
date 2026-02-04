// Combat Manager for Llama Picchu MUD
import { getDatabase, playerQueries, roomNpcQueries } from '../database';
import { connectionManager } from './connectionManager';
import { worldManager } from './worldManager';
import { playerManager } from './playerManager';
import { appearanceManager } from './appearanceManager';
import { npcTemplates } from '../data/npcs';
import { itemTemplates } from '../data/items';
import {
  XP_FORMULA,
  PLAYER_ATTACK_MESSAGES,
  PLAYER_DEFENSE_MESSAGES,
  DEATH_MESSAGES,
  FLEE_CHANCE_BASE,
  FLEE_CHANCE_DEX_BONUS,
} from '../../shared/types/combat';
import type { CombatRoundResult, DamageResult } from '../../shared/types/combat';
import type { NpcTemplate } from '../../shared/types/npc';

interface ActiveCombat {
  playerId: number;
  npcInstanceId: number;
  npcTemplateId: number;
  roomId: string;
  round: number;
  playerName: string;
  npcName: string;
}

class CombatManager {
  private activeCombats: Map<number, ActiveCombat> = new Map(); // playerId -> combat

  // Start combat between player and NPC
  startCombat(playerId: number, npcInstanceId: number): { success: boolean; error?: string } {
    const db = getDatabase();

    // Check if player already in combat
    if (this.activeCombats.has(playerId)) {
      return { success: false, error: 'You are already in combat!' };
    }

    // Get player info
    const player = playerQueries.findById(db).get(playerId) as {
      id: number;
      name: string;
      current_room: string;
      is_fighting: number;
    };

    if (!player) {
      return { success: false, error: 'Player not found.' };
    }

    // Check if room is safe
    if (worldManager.isRoomSafe(player.current_room)) {
      return { success: false, error: 'This is a safe area. Combat is not allowed here.' };
    }

    // Get NPC info
    const npc = roomNpcQueries.getByRoom(db).all(player.current_room).find(
      (n: { id: number }) => n.id === npcInstanceId
    ) as {
      id: number;
      npc_template_id: number;
      hp_current: number;
      combat_target: number | null;
    } | undefined;

    if (!npc) {
      return { success: false, error: 'That creature is not here.' };
    }

    if (npc.hp_current <= 0) {
      return { success: false, error: 'That creature is already dead.' };
    }

    const npcTemplate = npcTemplates.find((t) => t.id === npc.npc_template_id);
    if (!npcTemplate) {
      return { success: false, error: 'Invalid creature.' };
    }

    if (npcTemplate.type !== 'enemy') {
      return { success: false, error: `You cannot attack ${npcTemplate.name}.` };
    }

    // Start combat
    const combat: ActiveCombat = {
      playerId,
      npcInstanceId,
      npcTemplateId: npc.npc_template_id,
      roomId: player.current_room,
      round: 0,
      playerName: player.name,
      npcName: npcTemplate.name,
    };

    this.activeCombats.set(playerId, combat);

    // Update database states
    playerQueries.updateCombatState(db).run(1, playerId);
    roomNpcQueries.setCombatTarget(db).run(playerId, npcInstanceId);

    // Send combat start message
    connectionManager.sendToPlayer(playerId, {
      type: 'output',
      text: `\nYou attack ${npcTemplate.name}!\n`,
      messageType: 'combat',
    });

    connectionManager.sendToPlayer(playerId, {
      type: 'combat_update',
      combat: {
        inCombat: true,
        target: { type: 'npc', id: npcInstanceId, name: npcTemplate.name },
        round: 0,
        lastRoundTime: Date.now(),
      },
    });

    // Notify others in room
    const playersInRoom = worldManager.getPlayersInRoom(player.current_room);
    for (const otherId of playersInRoom) {
      if (otherId !== playerId) {
        connectionManager.sendToPlayer(otherId, {
          type: 'output',
          text: `${player.name} attacks ${npcTemplate.name}!`,
          messageType: 'combat',
        });
      }
    }

    return { success: true };
  }

  // Process a single round of combat for all active combats
  processCombatRound(): void {
    const db = getDatabase();

    for (const [playerId, combat] of this.activeCombats) {
      try {
        combat.round++;

        // Get current states
        const player = playerQueries.findById(db).get(playerId) as {
          id: number;
          name: string;
          level: number;
          str: number;
          dex: number;
          con: number;
          hp: number;
          max_hp: number;
          current_room: string;
        };

        const npcRow = db.prepare('SELECT * FROM room_npcs WHERE id = ?').get(combat.npcInstanceId) as {
          id: number;
          hp_current: number;
        } | undefined;

        if (!player || !npcRow) {
          this.endCombat(playerId, 'invalid');
          continue;
        }

        const npcTemplate = npcTemplates.find((t) => t.id === combat.npcTemplateId);
        if (!npcTemplate) {
          this.endCombat(playerId, 'invalid');
          continue;
        }

        const actions: DamageResult[] = [];

        // Player attacks NPC
        const playerDamage = this.calculatePlayerDamage(player, npcTemplate);
        actions.push(playerDamage);

        let newNpcHp = npcRow.hp_current - (playerDamage.isHit ? playerDamage.damage : 0);

        // Check if NPC died
        if (newNpcHp <= 0) {
          newNpcHp = 0;
          roomNpcQueries.markDead(db).run(npcTemplate.respawnSeconds, combat.npcInstanceId);

          // Calculate and award XP
          const xpGained = XP_FORMULA.xpFromKill(player.level, npcTemplate.level, npcTemplate.experienceValue);
          const { leveledUp, newLevel } = playerManager.awardExperience(playerId, xpGained);

          // Generate loot
          const loot = this.generateLoot(npcTemplate);
          let goldDropped = 0;

          // Drop loot in room
          if (loot.gold > 0) {
            goldDropped = loot.gold;
            playerManager.modifyGold(playerId, loot.gold);
          }

          for (const item of loot.items) {
            worldManager.addItemToRoom(combat.roomId, item.itemTemplateId, item.quantity);
          }

          // Send victory message
          connectionManager.sendToPlayer(playerId, {
            type: 'combat_round',
            result: {
              round: combat.round,
              actions,
              combatEnded: true,
              winner: 'player',
              experienceGained: xpGained,
              lootDropped: loot.items,
              goldDropped,
            },
          });

          const victoryMsg = [
            `\n${DEATH_MESSAGES.npcDeath(npcTemplate.name)}`,
            `You gain ${xpGained} experience points.`,
            goldDropped > 0 ? `You find ${goldDropped} gold.` : '',
            loot.items.length > 0 ? 'Items dropped on the ground.' : '',
          ].filter(Boolean).join('\n');

          connectionManager.sendToPlayer(playerId, {
            type: 'output',
            text: victoryMsg + '\n',
            messageType: 'combat',
          });

          this.endCombat(playerId, 'victory');
          continue;
        }

        // Update NPC HP
        roomNpcQueries.updateHp(db).run(newNpcHp, combat.npcInstanceId);

        // NPC attacks player
        const npcDamage = this.calculateNpcDamage(npcTemplate, player);
        actions.push(npcDamage);

        let newPlayerHp = player.hp - (npcDamage.isHit ? npcDamage.damage : 0);

        // Check if player died
        if (newPlayerHp <= 0) {
          newPlayerHp = 1; // Don't actually die, just set to 1 HP
          // In a full MUD, death would involve respawn, XP loss, etc.
          // For now, we'll just end combat and teleport to safety

          connectionManager.sendToPlayer(playerId, {
            type: 'combat_round',
            result: {
              round: combat.round,
              actions,
              combatEnded: true,
              winner: 'npc',
            },
          });

          connectionManager.sendToPlayer(playerId, {
            type: 'output',
            text: `\n${DEATH_MESSAGES.playerDeath}\n${DEATH_MESSAGES.playerRespawn}\n`,
            messageType: 'combat',
          });

          // Respawn at spring (safe room)
          playerQueries.updateRoom(db).run('spring', playerId);
          db.prepare('UPDATE players SET hp = max_hp / 2 WHERE id = ?').run(playerId);

          this.endCombat(playerId, 'death');

          // Clear NPC's combat target
          roomNpcQueries.setCombatTarget(db).run(null, combat.npcInstanceId);

          // Send room description for new location
          const roomDesc = worldManager.getRoomDescription('spring', playerId);
          connectionManager.sendToPlayer(playerId, {
            type: 'output',
            text: roomDesc,
            messageType: 'normal',
          });

          continue;
        }

        // Update player HP
        db.prepare('UPDATE players SET hp = ? WHERE id = ?').run(newPlayerHp, playerId);

        // Add blood from combat damage (both taking and dealing melee damage)
        if (npcDamage.isHit && npcDamage.damage > 0) {
          // Taking damage splatters blood on you
          appearanceManager.addBlood(playerId, Math.min(30, npcDamage.damage * 2));
        }
        if (playerDamage.isHit && playerDamage.damage > 0) {
          // Dealing melee damage also gets some blood on you
          appearanceManager.addBlood(playerId, Math.min(15, playerDamage.damage));
        }

        // Send round result
        connectionManager.sendToPlayer(playerId, {
          type: 'combat_round',
          result: {
            round: combat.round,
            actions,
            combatEnded: false,
          },
        });

        // Send combat messages
        const roundMsg = actions.map((a) => a.message).join('\n');
        connectionManager.sendToPlayer(playerId, {
          type: 'output',
          text: roundMsg,
          messageType: 'combat',
        });

        // Update player resources display
        connectionManager.sendToPlayer(playerId, {
          type: 'player_update',
          resources: {
            hp: newPlayerHp,
            maxHp: player.max_hp,
          },
        });

      } catch (error) {
        console.error(`Error processing combat for player ${playerId}:`, error);
        this.endCombat(playerId, 'error');
      }
    }
  }

  // Calculate player's damage to NPC
  private calculatePlayerDamage(
    player: { str: number; dex: number; level: number },
    npc: NpcTemplate
  ): DamageResult {
    // Base hit chance
    const hitChance = 80 + (player.level - npc.level) * 2 + (player.dex - npc.stats.dex);

    const roll = Math.random() * 100;
    if (roll > hitChance) {
      return {
        attacker: 'You',
        defender: npc.name,
        damage: 0,
        isCritical: false,
        isHit: false,
        isMiss: true,
        isDodge: false,
        isParry: false,
        message: PLAYER_ATTACK_MESSAGES.miss[Math.floor(Math.random() * PLAYER_ATTACK_MESSAGES.miss.length)],
      };
    }

    // Calculate base damage
    let damage = Math.floor(Math.random() * 6) + 1 + Math.floor(player.str / 3);

    // Check for critical hit
    const critChance = Math.floor(player.dex / 4);
    const isCritical = Math.random() * 100 < critChance;
    if (isCritical) {
      damage = Math.floor(damage * 1.5);
    }

    // Apply armor reduction (simplified)
    damage = Math.max(1, damage - Math.floor(npc.level / 2));

    const message = isCritical
      ? PLAYER_ATTACK_MESSAGES.critical[Math.floor(Math.random() * PLAYER_ATTACK_MESSAGES.critical.length)] + ` (${damage} damage)`
      : PLAYER_ATTACK_MESSAGES.hit[Math.floor(Math.random() * PLAYER_ATTACK_MESSAGES.hit.length)] + ` (${damage} damage)`;

    return {
      attacker: 'You',
      defender: npc.name,
      damage,
      isCritical,
      isHit: true,
      isMiss: false,
      isDodge: false,
      isParry: false,
      message,
    };
  }

  // Calculate NPC's damage to player
  private calculateNpcDamage(
    npc: NpcTemplate,
    player: { dex: number; con: number; level: number; name: string }
  ): DamageResult {
    // Base hit chance for NPC
    const hitChance = 70 + (npc.level - player.level) * 2 + (npc.stats.dex - player.dex);

    const roll = Math.random() * 100;
    if (roll > hitChance) {
      return {
        attacker: npc.name,
        defender: player.name,
        damage: 0,
        isCritical: false,
        isHit: false,
        isMiss: false,
        isDodge: true,
        isParry: false,
        message: PLAYER_DEFENSE_MESSAGES.dodge[Math.floor(Math.random() * PLAYER_DEFENSE_MESSAGES.dodge.length)],
      };
    }

    // Calculate damage
    let damage = Math.floor(Math.random() * npc.level * 2) + npc.level + Math.floor(npc.stats.str / 3);

    // Apply player's defense (CON-based)
    damage = Math.max(1, damage - Math.floor(player.con / 3));

    return {
      attacker: npc.name,
      defender: player.name,
      damage,
      isCritical: false,
      isHit: true,
      isMiss: false,
      isDodge: false,
      isParry: false,
      message: `${npc.attackMessage} (${damage} damage)`,
    };
  }

  // Attempt to flee from combat
  flee(playerId: number): { success: boolean; message: string } {
    const combat = this.activeCombats.get(playerId);
    if (!combat) {
      return { success: false, message: 'You are not in combat.' };
    }

    const db = getDatabase();
    const player = playerQueries.findById(db).get(playerId) as {
      dex: number;
      current_room: string;
    };

    const npcTemplate = npcTemplates.find((t) => t.id === combat.npcTemplateId);
    if (!npcTemplate) {
      this.endCombat(playerId, 'flee');
      return { success: true, message: DEATH_MESSAGES.flee };
    }

    // Calculate flee chance
    const fleeChance = FLEE_CHANCE_BASE + (player.dex - npcTemplate.stats.dex) * FLEE_CHANCE_DEX_BONUS;
    const roll = Math.random() * 100;

    if (roll > fleeChance) {
      return { success: false, message: DEATH_MESSAGES.fleeFail };
    }

    // Find a random exit
    const room = worldManager.getRoom(player.current_room);
    if (!room || room.exits.length === 0) {
      return { success: false, message: 'There is nowhere to flee to!' };
    }

    const randomExit = room.exits[Math.floor(Math.random() * room.exits.length)];

    // End combat
    this.endCombat(playerId, 'flee');

    // Clear NPC's combat target
    roomNpcQueries.setCombatTarget(db).run(null, combat.npcInstanceId);

    // Move player
    playerQueries.updateRoom(db).run(randomExit.targetRoom, playerId);

    // Get new room description
    const roomDesc = worldManager.getRoomDescription(randomExit.targetRoom, playerId);

    return {
      success: true,
      message: `${DEATH_MESSAGES.flee}\nYou flee ${randomExit.direction}!\n${roomDesc}`,
    };
  }

  // End combat
  private endCombat(playerId: number, reason: 'victory' | 'death' | 'flee' | 'invalid' | 'error'): void {
    const db = getDatabase();

    this.activeCombats.delete(playerId);
    playerQueries.updateCombatState(db).run(0, playerId);

    connectionManager.sendToPlayer(playerId, {
      type: 'combat_update',
      combat: {
        inCombat: false,
        target: null,
        round: 0,
        lastRoundTime: Date.now(),
      },
    });
  }

  // Generate loot from NPC
  private generateLoot(npc: NpcTemplate): { gold: number; items: { itemTemplateId: number; quantity: number }[] } {
    const items: { itemTemplateId: number; quantity: number }[] = [];

    // Calculate gold drop
    const gold = npc.lootTable
      ? Math.floor(Math.random() * (npc.lootTable.goldMax - npc.lootTable.goldMin + 1)) + npc.lootTable.goldMin
      : Math.floor(npc.level * (Math.random() * 3 + 1));

    // Roll for items
    if (npc.lootTable) {
      for (const entry of npc.lootTable.entries) {
        if (Math.random() * 100 < entry.chance) {
          const quantity = Math.floor(Math.random() * (entry.maxQuantity - entry.minQuantity + 1)) + entry.minQuantity;
          items.push({ itemTemplateId: entry.itemTemplateId, quantity });
        }
      }
    }

    return { gold, items };
  }

  // Check if player is in combat
  isInCombat(playerId: number): boolean {
    return this.activeCombats.has(playerId);
  }

  // Get combat info for player
  getCombatInfo(playerId: number): ActiveCombat | undefined {
    return this.activeCombats.get(playerId);
  }

  // Get all active combats count
  getActiveCombatCount(): number {
    return this.activeCombats.size;
  }
}

export const combatManager = new CombatManager();
export default combatManager;
