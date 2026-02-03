// Game Loop for Llama Picchu MUD
import { getDatabase, roomNpcQueries, playerQueries } from './database';
import { connectionManager } from './managers/connectionManager';
import { worldManager } from './managers/worldManager';
import { combatManager } from './managers/combatManager';
import { npcManager } from './managers/npcManager';
import {
  TICK_RATE_MS,
  COMBAT_TICK_MS,
  REGEN_TICK_MS,
  HUNGER_TICK_MS,
  NPC_AI_TICK_MS,
  SAVE_TICK_MS,
} from '../shared/types';

class GameLoop {
  private running = false;
  private lastTick = 0;
  private lastCombatTick = 0;
  private lastRegenTick = 0;
  private lastHungerTick = 0;
  private lastNpcTick = 0;
  private lastSaveTick = 0;
  private tickCount = 0;

  start(): void {
    if (this.running) return;

    this.running = true;
    this.lastTick = Date.now();
    this.lastCombatTick = Date.now();
    this.lastRegenTick = Date.now();
    this.lastHungerTick = Date.now();
    this.lastNpcTick = Date.now();
    this.lastSaveTick = Date.now();

    console.log('Game loop started');
    this.tick();
  }

  stop(): void {
    this.running = false;
    console.log('Game loop stopped');
  }

  private tick(): void {
    if (!this.running) return;

    const now = Date.now();
    this.tickCount++;

    // Combat tick (every 3 seconds)
    if (now - this.lastCombatTick >= COMBAT_TICK_MS) {
      this.processCombat();
      this.lastCombatTick = now;
    }

    // Regeneration tick (every 10 seconds)
    if (now - this.lastRegenTick >= REGEN_TICK_MS) {
      this.processRegeneration();
      this.lastRegenTick = now;
    }

    // Hunger/thirst tick (every 5 minutes)
    if (now - this.lastHungerTick >= HUNGER_TICK_MS) {
      this.processHungerThirst();
      this.lastHungerTick = now;
    }

    // NPC AI tick (every 5 seconds)
    if (now - this.lastNpcTick >= NPC_AI_TICK_MS) {
      this.processNpcAi();
      this.lastNpcTick = now;
    }

    // Auto-save tick (every minute)
    if (now - this.lastSaveTick >= SAVE_TICK_MS) {
      this.processAutoSave();
      this.lastSaveTick = now;
    }

    // Process respawns every tick
    this.processRespawns();

    // Clean up stale connections every 30 ticks
    if (this.tickCount % 30 === 0) {
      connectionManager.cleanup();
    }

    // NPC forgiveness tick - every 60 ticks (about once per minute)
    // NPCs slowly forgive players who were rude to them
    if (this.tickCount % 60 === 0) {
      npcManager.applyForgiveness();
    }

    // Schedule next tick
    const elapsed = Date.now() - now;
    const delay = Math.max(0, TICK_RATE_MS - elapsed);
    setTimeout(() => this.tick(), delay);
  }

  private processCombat(): void {
    try {
      combatManager.processCombatRound();
    } catch (error) {
      console.error('Error processing combat:', error);
    }
  }

  private processRegeneration(): void {
    const db = getDatabase();
    const connectedPlayerIds = connectionManager.getConnectedPlayerIds();

    for (const playerId of connectedPlayerIds) {
      try {
        const player = playerQueries.findById(db).get(playerId) as {
          id: number;
          hp: number;
          max_hp: number;
          mana: number;
          max_mana: number;
          stamina: number;
          max_stamina: number;
          hunger: number;
          thirst: number;
          is_resting: number;
          is_fighting: number;
        };

        if (!player || player.is_fighting) continue;

        // Calculate regen amounts
        let hpRegen = 1;
        let manaRegen = 2;
        let staminaRegen = 5;

        // Double regen while resting
        if (player.is_resting) {
          hpRegen *= 2;
          manaRegen *= 2;
          staminaRegen *= 2;
        }

        // No regen if starving or dehydrated
        if (player.hunger <= 0 || player.thirst <= 0) {
          hpRegen = 0;
          manaRegen = 0;
        }

        // Apply regeneration (don't exceed max)
        const newHp = Math.min(player.max_hp, player.hp + hpRegen);
        const newMana = Math.min(player.max_mana, player.mana + manaRegen);
        const newStamina = Math.min(player.max_stamina, player.stamina + staminaRegen);

        // Only update if something changed
        if (newHp !== player.hp || newMana !== player.mana || newStamina !== player.stamina) {
          playerQueries.updateResources(db).run(
            newHp,
            newMana,
            newStamina,
            player.hunger,
            player.thirst,
            playerId
          );

          // Notify player if they regained health
          if (newHp > player.hp || newMana > player.mana) {
            connectionManager.sendToPlayer(playerId, {
              type: 'player_update',
              resources: {
                hp: newHp,
                maxHp: player.max_hp,
                mana: newMana,
                maxMana: player.max_mana,
                stamina: newStamina,
                maxStamina: player.max_stamina,
              },
            });
          }
        }
      } catch (error) {
        console.error(`Error processing regen for player ${playerId}:`, error);
      }
    }
  }

  private processHungerThirst(): void {
    const db = getDatabase();
    const connectedPlayerIds = connectionManager.getConnectedPlayerIds();

    for (const playerId of connectedPlayerIds) {
      try {
        const player = playerQueries.findById(db).get(playerId) as {
          id: number;
          hp: number;
          mana: number;
          stamina: number;
          hunger: number;
          thirst: number;
        };

        if (!player) continue;

        const newHunger = Math.max(0, player.hunger - 1);
        const newThirst = Math.max(0, player.thirst - 1);

        // Update database
        playerQueries.updateResources(db).run(
          player.hp,
          player.mana,
          player.stamina,
          newHunger,
          newThirst,
          playerId
        );

        // Notify player
        connectionManager.sendToPlayer(playerId, {
          type: 'player_update',
          resources: {
            hp: player.hp,
            mana: player.mana,
            stamina: player.stamina,
          },
          vitals: {
            hunger: newHunger,
            thirst: newThirst,
          },
        });

        // Warning messages
        if (newHunger === 20 && player.hunger > 20) {
          connectionManager.sendToPlayer(playerId, {
            type: 'output',
            text: 'Your stomach growls loudly. You should find some food soon.',
            messageType: 'system',
          });
        } else if (newHunger === 0 && player.hunger > 0) {
          connectionManager.sendToPlayer(playerId, {
            type: 'output',
            text: 'You are starving! Find food immediately or suffer the consequences.',
            messageType: 'system',
          });
        }

        if (newThirst === 20 && player.thirst > 20) {
          connectionManager.sendToPlayer(playerId, {
            type: 'output',
            text: 'Your throat is parched. You need water soon.',
            messageType: 'system',
          });
        } else if (newThirst === 0 && player.thirst > 0) {
          connectionManager.sendToPlayer(playerId, {
            type: 'output',
            text: 'You are severely dehydrated! Find water immediately!',
            messageType: 'system',
          });
        }
      } catch (error) {
        console.error(`Error processing hunger/thirst for player ${playerId}:`, error);
      }
    }
  }

  private processNpcAi(): void {
    try {
      npcManager.processAi();
    } catch (error) {
      console.error('Error processing NPC AI:', error);
    }
  }

  private processAutoSave(): void {
    // Players are saved on important actions, but this ensures periodic save
    console.log(`Auto-save tick. ${connectionManager.getPlayerCount()} players online.`);
  }

  private processRespawns(): void {
    const db = getDatabase();

    try {
      // Get NPCs ready to respawn
      const respawnableNpcs = roomNpcQueries.getRespawnable(db).all() as {
        id: number;
        npc_template_id: number;
        room_id: string;
      }[];

      for (const npc of respawnableNpcs) {
        // Get max HP from template
        const template = npcManager.getNpcTemplate(npc.npc_template_id);
        if (template) {
          roomNpcQueries.respawn(db).run(template.maxHp, npc.id);
          console.log(`Respawned NPC ${template.name} in room ${npc.room_id}`);

          // Notify players in room
          const playersInRoom = worldManager.getPlayersInRoom(npc.room_id);
          for (const playerId of playersInRoom) {
            connectionManager.sendToPlayer(playerId, {
              type: 'npc_action',
              npcName: template.name,
              action: 'appears in the area',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing respawns:', error);
    }
  }

  getTickCount(): number {
    return this.tickCount;
  }

  isRunning(): boolean {
    return this.running;
  }
}

export const gameLoop = new GameLoop();
export default gameLoop;
