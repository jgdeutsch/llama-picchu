// NPC Life Manager for FROBARK
// Makes NPCs feel alive - they have schedules, tasks, moods, and routines
// Key insight: NPCs only "tick" when players are nearby, then catch up on elapsed time

import { getDatabase, playerQueries } from '../database';
import { worldManager } from './worldManager';
import { connectionManager } from './connectionManager';
import { getNpcById, getNpcPersonalityPrompt } from '../data/npcs';
import { generateNpcGossip, generateNpcShout, getTimeOfDay, generateNpcRoomEntryComment, generateNpcEmote } from '../services/geminiService';

// Types
interface NpcState {
  npcInstanceId: number;
  npcTemplateId: number;
  currentRoom: string;
  currentTask: string | null;
  taskProgress: number;
  taskTarget: string | null;
  energy: number;
  mood: string;
  homeRoom: string;
  workRoom: string;
  schedule: ScheduleEntry[];
  lastPlayerNearby: Date | null;
  lastTaskTick: Date | null;
  isActive: boolean;
}

interface ScheduleEntry {
  hour: number;        // 0-23 game hours
  task: string;        // 'sleep', 'eat', 'work', 'socialize', 'patrol', 'rest'
  location: string;    // Room ID
  duration: number;    // Hours
  interruptible: boolean;
  taskType?: string;   // Specific task like 'farming', 'cooking'
  taskTarget?: string; // What they're working on
}

interface NpcTask {
  id: number;
  npcInstanceId: number;
  taskType: string;
  description: string;
  location: string;
  progress: number;
  estimatedTicks: number;
  status: string;
  helpAccepted: boolean;
  helperPlayerIds: number[];
}

// Default schedules for different NPC types
const DEFAULT_SCHEDULES: Record<string, ScheduleEntry[]> = {
  farmer: [
    { hour: 5, task: 'wake', location: 'home', duration: 1, interruptible: false },
    { hour: 6, task: 'eat', location: 'home', duration: 1, interruptible: true },
    { hour: 7, task: 'work', location: 'work', duration: 5, interruptible: true, taskType: 'farming', taskTarget: 'crops' },
    { hour: 12, task: 'eat', location: 'the_inn', duration: 1, interruptible: true },
    { hour: 13, task: 'work', location: 'work', duration: 4, interruptible: true, taskType: 'farming', taskTarget: 'crops' },
    { hour: 17, task: 'rest', location: 'home', duration: 2, interruptible: true },
    { hour: 19, task: 'socialize', location: 'the_inn', duration: 2, interruptible: true },
    { hour: 21, task: 'sleep', location: 'home', duration: 8, interruptible: false },
  ],
  shopkeeper: [
    { hour: 6, task: 'wake', location: 'home', duration: 1, interruptible: false },
    { hour: 7, task: 'eat', location: 'home', duration: 1, interruptible: true },
    { hour: 8, task: 'work', location: 'work', duration: 4, interruptible: true, taskType: 'selling' },
    { hour: 12, task: 'eat', location: 'work', duration: 1, interruptible: true },
    { hour: 13, task: 'work', location: 'work', duration: 5, interruptible: true, taskType: 'selling' },
    { hour: 18, task: 'rest', location: 'home', duration: 2, interruptible: true },
    { hour: 20, task: 'socialize', location: 'the_inn', duration: 2, interruptible: true },
    { hour: 22, task: 'sleep', location: 'home', duration: 8, interruptible: false },
  ],
  guard: [
    { hour: 6, task: 'wake', location: 'guard_barracks', duration: 1, interruptible: false },
    { hour: 7, task: 'eat', location: 'castle_kitchen', duration: 1, interruptible: true },
    { hour: 8, task: 'work', location: 'work', duration: 4, interruptible: false, taskType: 'patrolling' },
    { hour: 12, task: 'eat', location: 'castle_kitchen', duration: 1, interruptible: true },
    { hour: 13, task: 'work', location: 'work', duration: 5, interruptible: false, taskType: 'patrolling' },
    { hour: 18, task: 'rest', location: 'guard_barracks', duration: 3, interruptible: true },
    { hour: 21, task: 'sleep', location: 'guard_barracks', duration: 9, interruptible: false },
  ],
  innkeeper: [
    { hour: 6, task: 'wake', location: 'the_inn', duration: 1, interruptible: false },
    { hour: 7, task: 'work', location: 'the_inn', duration: 5, interruptible: true, taskType: 'cooking', taskTarget: 'breakfast' },
    { hour: 12, task: 'work', location: 'the_inn', duration: 6, interruptible: true, taskType: 'serving' },
    { hour: 18, task: 'work', location: 'the_inn', duration: 4, interruptible: true, taskType: 'serving' },
    { hour: 22, task: 'work', location: 'the_inn', duration: 1, interruptible: true, taskType: 'cleaning' },
    { hour: 23, task: 'sleep', location: 'the_inn', duration: 7, interruptible: false },
  ],
  tailor: [
    { hour: 7, task: 'wake', location: 'home', duration: 1, interruptible: false },
    { hour: 8, task: 'work', location: 'work', duration: 4, interruptible: true, taskType: 'tailoring' },
    { hour: 12, task: 'eat', location: 'the_inn', duration: 1, interruptible: true },
    { hour: 13, task: 'work', location: 'work', duration: 5, interruptible: true, taskType: 'tailoring' },
    { hour: 18, task: 'rest', location: 'home', duration: 3, interruptible: true },
    { hour: 21, task: 'sleep', location: 'home', duration: 10, interruptible: false },
  ],
  baker: [
    { hour: 4, task: 'wake', location: 'home', duration: 1, interruptible: false },
    { hour: 5, task: 'work', location: 'work', duration: 3, interruptible: true, taskType: 'baking', taskTarget: 'bread' },
    { hour: 8, task: 'work', location: 'work', duration: 4, interruptible: true, taskType: 'selling' },
    { hour: 12, task: 'eat', location: 'work', duration: 1, interruptible: true },
    { hour: 13, task: 'work', location: 'work', duration: 5, interruptible: true, taskType: 'selling' },
    { hour: 18, task: 'rest', location: 'home', duration: 4, interruptible: true },
    { hour: 22, task: 'sleep', location: 'home', duration: 6, interruptible: false },
  ],
  wanderer: [
    { hour: 0, task: 'wander', location: 'random', duration: 24, interruptible: true },
  ],
  stationary: [
    { hour: 0, task: 'idle', location: 'work', duration: 24, interruptible: true },
  ],
};

// NPC assignments to schedule types
const NPC_SCHEDULE_TYPES: Record<number, string> = {
  // Major characters
  1: 'stationary',   // Wilson - sits on throne
  2: 'stationary',   // Icculus - meditates
  3: 'stationary',   // Tela - at cottage
  4: 'wanderer',     // Forbin - wanders lost
  6: 'wanderer',     // Fee - scampers around
  7: 'wanderer',     // Mr. Palmer - nervous wandering
  9: 'wanderer',     // AC/DC Bag - appears randomly

  // Village/Farm folk
  10: 'farmer',      // Farmer Rutherford
  113: 'baker',      // Baker Possum
  114: 'innkeeper',  // Innkeeper Antelope
  115: 'shopkeeper', // Blacksmith Gordo
  116: 'shopkeeper', // Elena
  120: 'stationary', // Fisherman Harpua - always fishing
  121: 'shopkeeper', // Healer Esther
  125: 'baker',      // Apprentice Baker Pip
  126: 'tailor',     // Tailor Lydia

  // Guards
  106: 'guard',      // Gate Guard Viktor
  108: 'guard',      // Captain Sloth
  109: 'guard',      // Hendricks
  111: 'guard',      // Border Guard Thorne
};

// Home and work rooms for NPCs
const NPC_LOCATIONS: Record<number, { home: string; work: string }> = {
  10: { home: 'lizard_homes_west', work: 'farmlands' },           // Rutherford
  113: { home: 'bakery', work: 'bakery' },                        // Baker Possum
  114: { home: 'the_inn', work: 'the_inn' },                      // Innkeeper Antelope
  115: { home: 'blacksmith_forge', work: 'blacksmith_forge' },    // Gordo
  116: { home: 'blacksmith_forge', work: 'blacksmith_forge' },    // Elena
  118: { home: 'lizard_homes_west', work: 'lizard_homes_west' },  // Martha Rutherford
  119: { home: 'lizard_homes_west', work: 'lizard_homes_west' },  // Jimmy
  120: { home: 'river_crossing', work: 'river_crossing' },        // Harpua
  121: { home: 'village_square', work: 'village_square' },        // Healer Esther
  125: { home: 'bakery', work: 'bakery' },                        // Apprentice Baker Pip
  126: { home: 'tailor_shop', work: 'tailor_shop' },              // Tailor Lydia
  106: { home: 'guard_barracks', work: 'prussia_gate' },          // Viktor
  108: { home: 'guard_barracks', work: 'guard_barracks' },        // Sloth
  109: { home: 'guard_barracks', work: 'guard_barracks' },        // Hendricks
  110: { home: 'castle_kitchen', work: 'castle_kitchen' },        // Cook Martha
  111: { home: 'border_checkpoint', work: 'border_checkpoint' },  // Thorne
  112: { home: 'village_square', work: 'village_square' },        // Elder Moondog
  122: { home: 'village_square', work: 'village_square' },        // Town Crier Barnaby
};

class NPCLifeManager {
  private gameHour: number = 8; // Start at 8am
  private lastHourUpdate: number = Date.now();
  private readonly HOUR_DURATION_MS = 60000; // 1 minute real time = 1 game hour

  // Initialize NPC states when server starts
  initializeNpcStates(): void {
    const db = getDatabase();
    console.log('[NPCLife] Initializing NPC states...');

    // Get all spawned NPCs
    const npcs = db.prepare(`
      SELECT id, room_id, npc_template_id FROM room_npcs
      WHERE respawn_at IS NULL
    `).all() as { id: number; room_id: string; npc_template_id: number }[];

    for (const npc of npcs) {
      this.initializeNpcState(npc.id, npc.npc_template_id, npc.room_id);
    }

    console.log(`[NPCLife] Initialized ${npcs.length} NPCs`);
  }

  // Initialize state for a single NPC
  private initializeNpcState(instanceId: number, templateId: number, roomId: string): void {
    const db = getDatabase();

    // Check if state already exists
    const existing = db.prepare(`SELECT * FROM npc_state WHERE npc_instance_id = ?`).get(instanceId);
    if (existing) return;

    // Get schedule type for this NPC
    const scheduleType = NPC_SCHEDULE_TYPES[templateId] || 'stationary';
    const schedule = DEFAULT_SCHEDULES[scheduleType] || DEFAULT_SCHEDULES.stationary;

    // Get home/work locations
    const locations = NPC_LOCATIONS[templateId] || { home: roomId, work: roomId };

    // Determine current activity based on time
    const currentEntry = this.getCurrentScheduleEntry(schedule);

    try {
      db.prepare(`
        INSERT INTO npc_state (
          npc_instance_id, npc_template_id, current_room,
          current_task, task_progress, task_target,
          energy, mood, home_room, work_room, schedule_json,
          last_player_nearby, last_task_tick, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, 0)
      `).run(
        instanceId,
        templateId,
        currentEntry?.location === 'work' ? locations.work :
          currentEntry?.location === 'home' ? locations.home : roomId,
        currentEntry?.taskType || currentEntry?.task || null,
        0,
        currentEntry?.taskTarget || null,
        100,
        'neutral',
        locations.home,
        locations.work,
        JSON.stringify(schedule)
      );
    } catch (error) {
      // State might already exist from concurrent init
      console.log(`[NPCLife] Could not init state for NPC ${instanceId}:`, error);
    }
  }

  // Get the current schedule entry based on game hour
  private getCurrentScheduleEntry(schedule: ScheduleEntry[]): ScheduleEntry | null {
    // Find the entry that covers current hour
    for (let i = schedule.length - 1; i >= 0; i--) {
      if (schedule[i].hour <= this.gameHour) {
        return schedule[i];
      }
    }
    // Wrap around to last entry if before first
    return schedule[schedule.length - 1];
  }

  // Called when a player enters a room - activate nearby NPCs
  onPlayerEntersRoom(playerId: number, roomId: string): void {
    const db = getDatabase();
    const now = new Date();

    // Get player name for NPC comments
    const player = playerQueries.findById(db).get(playerId) as { name: string } | undefined;
    const playerName = player?.name || 'stranger';

    // Get room info
    const room = worldManager.getRoom(roomId);
    const roomName = room?.name || 'this place';

    // Get all NPCs in this room and adjacent rooms
    const nearbyRooms = this.getNearbyRooms(roomId);
    const roomList = [roomId, ...nearbyRooms];

    for (const currentRoom of roomList) {
      // Get NPCs in this room
      const npcsInRoom = db.prepare(`
        SELECT ns.*, rn.npc_template_id
        FROM npc_state ns
        JOIN room_npcs rn ON ns.npc_instance_id = rn.id
        WHERE ns.current_room = ?
      `).all(currentRoom) as any[];

      for (const npcState of npcsInRoom) {
        // Calculate elapsed time since last player was nearby
        if (npcState.last_player_nearby) {
          const lastNearby = new Date(npcState.last_player_nearby);
          const elapsedMs = now.getTime() - lastNearby.getTime();
          const elapsedGameHours = elapsedMs / this.HOUR_DURATION_MS;

          // Catch up on task progress
          if (npcState.current_task && elapsedGameHours > 0) {
            this.advanceTaskProgress(npcState.npc_instance_id, elapsedGameHours);
          }
        }

        // Mark as active and update last_player_nearby
        db.prepare(`
          UPDATE npc_state
          SET is_active = 1, last_player_nearby = ?
          WHERE npc_instance_id = ?
        `).run(now.toISOString(), npcState.npc_instance_id);

        // NPCs in the CURRENT room (not adjacent) may react to the player's arrival
        if (currentRoom === roomId) {
          const npcTemplate = getNpcById(npcState.npc_template_id);
          if (npcTemplate) {
            const personality = getNpcPersonalityPrompt(npcState.npc_template_id);

            // Generate NPC reactions asynchronously - either emote, comment, or both
            this.generateNpcRoomReaction(
              npcState,
              npcTemplate,
              personality,
              playerId,
              playerName,
              roomName
            );
          }
        }
      }
    }
  }

  // Generate NPC reaction when player enters - emote, comment, or both
  private async generateNpcRoomReaction(
    npcState: any,
    npcTemplate: any,
    personality: string,
    playerId: number,
    playerName: string,
    roomName: string
  ): Promise<void> {
    try {
      // Get room features so NPCs only reference things that actually exist
      const room = worldManager.getRoom(npcState.current_room);
      const roomFeatures = room?.features || [];

      // Decide what kind of reaction (or combination)
      const roll = Math.random();

      if (roll < 0.4) {
        // 40%: Just emote (action without dialogue)
        const emote = await generateNpcEmote(
          npcTemplate.name,
          personality,
          npcState.current_task,
          roomName,
          roomFeatures
        );
        if (emote) {
          connectionManager.sendToPlayer(playerId, {
            type: 'output',
            text: `\n${emote}`,
            messageType: 'emote',
          });
        }
      } else if (roll < 0.7) {
        // 30%: Comment (dialogue)
        const comment = await generateNpcRoomEntryComment(
          npcState.npc_template_id,
          npcTemplate.name,
          personality,
          playerId,
          playerName,
          roomName
        );
        if (comment) {
          connectionManager.sendToPlayer(playerId, {
            type: 'output',
            text: `\n${npcTemplate.name}: ${comment}`,
            messageType: 'chat',
          });
        }
      } else if (roll < 0.85) {
        // 15%: Both emote then comment
        const emote = await generateNpcEmote(
          npcTemplate.name,
          personality,
          npcState.current_task,
          roomName,
          roomFeatures
        );
        const comment = await generateNpcRoomEntryComment(
          npcState.npc_template_id,
          npcTemplate.name,
          personality,
          playerId,
          playerName,
          roomName
        );

        if (emote) {
          connectionManager.sendToPlayer(playerId, {
            type: 'output',
            text: `\n${emote}`,
            messageType: 'emote',
          });
        }
        if (comment) {
          // Small delay before dialogue follows action
          setTimeout(() => {
            connectionManager.sendToPlayer(playerId, {
              type: 'output',
              text: `${npcTemplate.name}: ${comment}`,
              messageType: 'chat',
            });
          }, 500);
        }
      }
      // 15%: No reaction at all (NPC is absorbed in their work)
    } catch (err) {
      console.error(`[NPC Reaction] Error for ${npcTemplate.name}:`, err);
    }
  }

  // Get rooms adjacent to this one (for activation radius)
  private getNearbyRooms(roomId: string): string[] {
    const room = worldManager.getRoom(roomId);
    if (!room) return [];
    return room.exits.map(e => e.targetRoom);
  }

  // Advance an NPC's task progress based on elapsed time
  private advanceTaskProgress(npcInstanceId: number, elapsedHours: number): void {
    const db = getDatabase();

    // Get active task
    const task = db.prepare(`
      SELECT * FROM npc_tasks
      WHERE npc_instance_id = ? AND status = 'active'
      ORDER BY id DESC LIMIT 1
    `).get(npcInstanceId) as NpcTask | undefined;

    if (!task) return;

    // Calculate progress (base: 10% per game hour of work)
    const progressPerHour = 100 / (task.estimatedTicks / 10);
    const progressGain = Math.min(100 - task.progress, progressPerHour * elapsedHours);

    const newProgress = Math.min(100, task.progress + progressGain);

    // Update task progress
    db.prepare(`
      UPDATE npc_tasks SET progress = ? WHERE id = ?
    `).run(newProgress, task.id);

    // Also update npc_state
    db.prepare(`
      UPDATE npc_state SET task_progress = ?, last_task_tick = CURRENT_TIMESTAMP
      WHERE npc_instance_id = ?
    `).run(newProgress, npcInstanceId);

    // If task is complete, handle completion
    if (newProgress >= 100) {
      this.completeTask(task.id, npcInstanceId);
    }
  }

  // Complete an NPC task
  private completeTask(taskId: number, npcInstanceId: number): void {
    const db = getDatabase();

    db.prepare(`
      UPDATE npc_tasks
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(taskId);

    // Update NPC state
    db.prepare(`
      UPDATE npc_state
      SET current_task = NULL, task_progress = 0, task_target = NULL
      WHERE npc_instance_id = ?
    `).run(npcInstanceId);

    // Potentially create a new task or transition to next schedule activity
    // This will be handled by the schedule tick
  }

  // Player helps an NPC with their task
  helpWithTask(playerId: number, npcInstanceId: number): { success: boolean; message: string; socialGain: number } {
    const db = getDatabase();

    // Get NPC state
    const state = db.prepare(`
      SELECT ns.*, rn.npc_template_id
      FROM npc_state ns
      JOIN room_npcs rn ON ns.npc_instance_id = rn.id
      WHERE ns.npc_instance_id = ?
    `).get(npcInstanceId) as any;

    if (!state) {
      return { success: false, message: "That NPC isn't here.", socialGain: 0 };
    }

    if (!state.current_task) {
      return { success: false, message: "They don't seem to be working on anything right now.", socialGain: 0 };
    }

    // Get the active task
    const task = db.prepare(`
      SELECT * FROM npc_tasks
      WHERE npc_instance_id = ? AND status = 'active'
      ORDER BY id DESC LIMIT 1
    `).get(npcInstanceId) as NpcTask | undefined;

    if (!task || !task.helpAccepted) {
      return { success: false, message: "They don't need help with that.", socialGain: 0 };
    }

    // Help! Progress the task by 15-25%
    const helpAmount = 15 + Math.random() * 10;
    const newProgress = Math.min(100, task.progress + helpAmount);

    // Record the helper
    const helpers = JSON.parse(task.helperPlayerIds as unknown as string || '[]');
    if (!helpers.includes(playerId)) {
      helpers.push(playerId);
    }

    db.prepare(`
      UPDATE npc_tasks
      SET progress = ?, helper_player_ids = ?
      WHERE id = ?
    `).run(newProgress, JSON.stringify(helpers), task.id);

    // Update npc_state too
    db.prepare(`
      UPDATE npc_state SET task_progress = ? WHERE npc_instance_id = ?
    `).run(newProgress, npcInstanceId);

    // Award social capital
    const socialGain = Math.floor(5 + Math.random() * 5); // 5-10 points
    this.adjustSocialCapital(playerId, state.npc_template_id, socialGain, 'helped');

    // Check if task completed
    if (newProgress >= 100) {
      this.completeTask(task.id, npcInstanceId);
    }

    return {
      success: true,
      message: `You help with the ${state.current_task}. ${newProgress >= 100 ? 'The task is complete!' : `Progress: ${Math.floor(newProgress)}%`}`,
      socialGain
    };
  }

  // Adjust social capital between player and NPC
  private adjustSocialCapital(playerId: number, npcTemplateId: number, amount: number, reason: string): void {
    const db = getDatabase();

    // Upsert social capital
    db.prepare(`
      INSERT INTO social_capital (player_id, npc_id, capital, last_interaction)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (player_id, npc_id) DO UPDATE SET
        capital = MIN(100, MAX(-100, capital + ?)),
        times_helped = times_helped + CASE WHEN ? > 0 THEN 1 ELSE 0 END,
        times_wronged = times_wronged + CASE WHEN ? < 0 THEN 1 ELSE 0 END,
        last_interaction = CURRENT_TIMESTAMP
    `).run(playerId, npcTemplateId, amount, amount, amount, amount);

    // Update trust level based on new capital
    const result = db.prepare(`
      SELECT capital FROM social_capital WHERE player_id = ? AND npc_id = ?
    `).get(playerId, npcTemplateId) as { capital: number } | undefined;

    if (result) {
      const trustLevel = this.capitalToTrustLevel(result.capital);
      db.prepare(`
        UPDATE social_capital SET trust_level = ? WHERE player_id = ? AND npc_id = ?
      `).run(trustLevel, playerId, npcTemplateId);
    }
  }

  // Convert capital value to trust level
  private capitalToTrustLevel(capital: number): string {
    if (capital < -50) return 'hostile';
    if (capital < -10) return 'unfriendly';
    if (capital < 10) return 'stranger';
    if (capital < 30) return 'acquaintance';
    if (capital < 60) return 'friend';
    if (capital < 90) return 'trusted';
    return 'family';
  }

  // Get room description addition for NPC activities
  getNpcActivityDescription(roomId: string): string {
    const db = getDatabase();

    const npcsWorking = db.prepare(`
      SELECT ns.*, rn.npc_template_id
      FROM npc_state ns
      JOIN room_npcs rn ON ns.npc_instance_id = rn.id
      WHERE ns.current_room = ? AND ns.current_task IS NOT NULL
    `).all(roomId) as any[];

    if (npcsWorking.length === 0) return '';

    const descriptions: string[] = [];

    for (const npc of npcsWorking) {
      const template = getNpcById(npc.npc_template_id);
      if (!template) continue;

      const taskDesc = this.getTaskDescription(npc.current_task, npc.task_progress, template.name);
      if (taskDesc) {
        descriptions.push(taskDesc);
      }
    }

    return descriptions.length > 0 ? '\n\n' + descriptions.join('\n') : '';
  }

  // Generate human-readable task description
  private getTaskDescription(task: string, progress: number, npcName: string): string {
    const progressDesc = progress < 25 ? 'just starting' :
      progress < 50 ? 'making progress on' :
        progress < 75 ? 'well into' :
          progress < 100 ? 'nearly finished with' : 'completed';

    const taskDescs: Record<string, string> = {
      farming: `${npcName} is bent over the crops, ${progressDesc} the day's farming.`,
      cooking: `${npcName} stirs a pot, ${progressDesc} preparing a meal.`,
      patrolling: `${npcName} walks a patrol route, eyes scanning for trouble.`,
      selling: `${npcName} arranges wares, ready to serve customers.`,
      cleaning: `${npcName} sweeps and tidies, ${progressDesc} cleaning up.`,
      smithing: `${npcName} hammers at the forge, ${progressDesc} the current piece.`,
      fishing: `${npcName} sits with a fishing line in the water, patient as always.`,
      serving: `${npcName} moves between tables, serving food and drink.`,
      tailoring: `${npcName} works at the sewing table, ${progressDesc} a garment.`,
      baking: `${npcName} works at the oven, ${progressDesc} the day's bread.`,
    };

    const desc = taskDescs[task];
    if (desc && progress < 100) {
      return `[${npcName} is ${Math.floor(progress)}% done. Type HELP ${npcName.split(' ')[0].toUpperCase()} to assist.]`;
    }

    return desc || '';
  }

  // Called every game tick - advance NPC schedules and tasks
  tick(): void {
    // Update game hour
    const now = Date.now();
    if (now - this.lastHourUpdate >= this.HOUR_DURATION_MS) {
      this.gameHour = (this.gameHour + 1) % 24;
      this.lastHourUpdate = now;
      this.onHourChange();
    }

    // Process active NPCs (those with players nearby)
    this.processActiveNpcs();
  }

  // Called when the game hour changes
  private onHourChange(): void {
    const db = getDatabase();
    const timeOfDay = getTimeOfDay();

    console.log(`[NPCLife] Hour changed to ${this.gameHour}:00 (${timeOfDay})`);

    // Move NPCs according to schedules
    const allNpcs = db.prepare(`
      SELECT * FROM npc_state
    `).all() as any[];

    for (const npc of allNpcs) {
      const schedule = JSON.parse(npc.schedule_json || '[]');
      const currentEntry = this.getCurrentScheduleEntry(schedule);

      if (currentEntry) {
        // Determine target room
        let targetRoom = currentEntry.location;
        if (targetRoom === 'work') targetRoom = npc.work_room;
        if (targetRoom === 'home') targetRoom = npc.home_room;
        if (targetRoom === 'random') targetRoom = this.getRandomAdjacentRoom(npc.current_room);

        // Move NPC if needed
        if (targetRoom && targetRoom !== npc.current_room) {
          this.moveNpc(npc.npc_instance_id, targetRoom);
        }

        // Start new task if needed
        if (currentEntry.taskType && currentEntry.taskType !== npc.current_task) {
          this.startTask(npc.npc_instance_id, currentEntry.taskType, currentEntry.taskTarget || null);
        }
      }
    }

    // Occasionally have NPCs gossip or shout
    if (Math.random() < 0.3) { // 30% chance each hour
      this.triggerRandomNpcChatter();
    }
  }

  // Move an NPC to a new room
  private moveNpc(npcInstanceId: number, targetRoom: string): void {
    const db = getDatabase();

    // Get current state
    const state = db.prepare(`
      SELECT ns.*, rn.npc_template_id, rn.room_id as db_room
      FROM npc_state ns
      JOIN room_npcs rn ON ns.npc_instance_id = rn.id
      WHERE ns.npc_instance_id = ?
    `).get(npcInstanceId) as any;

    if (!state) return;

    const template = getNpcById(state.npc_template_id);
    if (!template) return;

    const oldRoom = state.current_room;

    // Update both tables
    db.prepare(`UPDATE npc_state SET current_room = ? WHERE npc_instance_id = ?`).run(targetRoom, npcInstanceId);
    db.prepare(`UPDATE room_npcs SET room_id = ? WHERE id = ?`).run(targetRoom, npcInstanceId);

    // Notify players in old room
    const playersInOld = worldManager.getPlayersInRoom(oldRoom);
    for (const pid of playersInOld) {
      connectionManager.sendToPlayer(pid, {
        type: 'output',
        text: `${template.name} leaves.`,
        messageType: 'movement'
      });
    }

    // Notify players in new room
    const playersInNew = worldManager.getPlayersInRoom(targetRoom);
    for (const pid of playersInNew) {
      connectionManager.sendToPlayer(pid, {
        type: 'output',
        text: `${template.name} arrives.`,
        messageType: 'movement'
      });
    }
  }

  // Start a new task for an NPC
  private startTask(npcInstanceId: number, taskType: string, taskTarget: string | null): void {
    const db = getDatabase();

    // Get NPC info
    const state = db.prepare(`SELECT * FROM npc_state WHERE npc_instance_id = ?`).get(npcInstanceId) as any;
    if (!state) return;

    // Create task record
    const estimatedTicks = this.getTaskDuration(taskType);
    const description = this.getTaskStartDescription(taskType, taskTarget);

    db.prepare(`
      INSERT INTO npc_tasks (npc_instance_id, task_type, description, location, estimated_ticks, status, started_at)
      VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
    `).run(npcInstanceId, taskType, description, state.current_room, estimatedTicks);

    // Update NPC state
    db.prepare(`
      UPDATE npc_state
      SET current_task = ?, task_progress = 0, task_target = ?
      WHERE npc_instance_id = ?
    `).run(taskType, taskTarget, npcInstanceId);
  }

  private getTaskDuration(taskType: string): number {
    const durations: Record<string, number> = {
      farming: 100,
      cooking: 60,
      patrolling: 50,
      cleaning: 40,
      smithing: 80,
      serving: 30,
      fishing: 120, // Long task
    };
    return durations[taskType] || 50;
  }

  private getTaskStartDescription(taskType: string, target: string | null): string {
    const descs: Record<string, string> = {
      farming: `Working on ${target || 'the fields'}`,
      cooking: `Preparing ${target || 'a meal'}`,
      patrolling: 'Making patrol rounds',
      cleaning: `Cleaning ${target || 'the area'}`,
      smithing: `Forging ${target || 'metalwork'}`,
      serving: 'Serving customers',
      fishing: 'Fishing in the river',
    };
    return descs[taskType] || `Working on ${taskType}`;
  }

  private getRandomAdjacentRoom(currentRoom: string): string {
    const room = worldManager.getRoom(currentRoom);
    if (!room || room.exits.length === 0) return currentRoom;
    const exit = room.exits[Math.floor(Math.random() * room.exits.length)];
    return exit.targetRoom;
  }

  // Process active NPCs (called every tick)
  private processActiveNpcs(): void {
    const db = getDatabase();

    // Get active NPCs (player was nearby recently)
    const activeNpcs = db.prepare(`
      SELECT ns.*, rn.npc_template_id
      FROM npc_state ns
      JOIN room_npcs rn ON ns.npc_instance_id = rn.id
      WHERE ns.is_active = 1
        AND ns.last_player_nearby > datetime('now', '-5 minutes')
    `).all() as any[];

    for (const npc of activeNpcs) {
      // Small chance to progress task each tick
      if (npc.current_task && Math.random() < 0.1) {
        const progress = Math.min(100, npc.task_progress + 1);

        db.prepare(`UPDATE npc_state SET task_progress = ? WHERE npc_instance_id = ?`).run(progress, npc.npc_instance_id);
        db.prepare(`UPDATE npc_tasks SET progress = ? WHERE npc_instance_id = ? AND status = 'active'`).run(progress, npc.npc_instance_id);

        if (progress >= 100) {
          // Get task ID
          const task = db.prepare(`
            SELECT id FROM npc_tasks WHERE npc_instance_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1
          `).get(npc.npc_instance_id) as { id: number } | undefined;

          if (task) {
            this.completeTask(task.id, npc.npc_instance_id);
          }
        }
      }

      // ~8% chance per tick (every 10 sec) to spontaneously interact with a player
      // This means an NPC will speak roughly every 2 minutes on average
      if (Math.random() < 0.08) {
        this.triggerSpontaneousInteraction(npc);
      }
    }

    // Deactivate NPCs that haven't had a player nearby for 5+ minutes
    db.prepare(`
      UPDATE npc_state
      SET is_active = 0
      WHERE is_active = 1
        AND last_player_nearby < datetime('now', '-5 minutes')
    `).run();
  }

  // NPC spontaneously speaks to or emotes at a player in their room
  private async triggerSpontaneousInteraction(npcState: any): Promise<void> {
    const template = getNpcById(npcState.npc_template_id);
    if (!template || template.type === 'enemy') return;

    // Get players in this NPC's room
    const playersInRoom = worldManager.getPlayersInRoom(npcState.current_room);
    if (playersInRoom.length === 0) return;

    // Pick a random player
    const targetPlayerId = playersInRoom[Math.floor(Math.random() * playersInRoom.length)];
    const db = getDatabase();
    const player = playerQueries.findById(db).get(targetPlayerId) as { name: string; level: number; gold: number } | undefined;
    if (!player) return;

    const personality = getNpcPersonalityPrompt(npcState.npc_template_id);

    // Generate a spontaneous comment based on NPC type
    try {
      const comment = await this.generateSpontaneousComment(
        template,
        personality,
        npcState,
        player.name,
        player.level,
        player.gold,
        targetPlayerId
      );

      if (comment) {
        connectionManager.sendToPlayer(targetPlayerId, {
          type: 'output',
          text: `\n${template.name} says to you, "${comment}"`,
          messageType: 'chat',
        });
      }
    } catch (error) {
      console.error('[NPCLife] Spontaneous interaction error:', error);
    }
  }

  // Generate a context-aware spontaneous comment from an NPC
  private async generateSpontaneousComment(
    template: any,
    personality: string,
    npcState: any,
    playerName: string,
    playerLevel: number,
    playerGold: number,
    playerId: number
  ): Promise<string | null> {
    const { getConversationHistory, addToConversationHistory } = await import('../services/geminiService');
    const { itemTemplates } = require('../data/items');

    // Check if we have recent conversation history with this player
    const conversationHistory = getConversationHistory(playerId, template.id);
    const hasRecentConvo = conversationHistory.length > 0;

    // Build context based on NPC type and conversation state
    let context = '';
    let conversationContext = '';

    if (hasRecentConvo) {
      // We've been talking - continue the conversation naturally
      const lastExchanges = conversationHistory.slice(-4);
      conversationContext = '\nRECENT CONVERSATION:\n' + lastExchanges.map(m =>
        `${m.role === 'player' ? playerName : template.name}: ${m.content}`
      ).join('\n');
      context = `Continue your conversation naturally. Reference what was discussed. Be helpful and guide them.`;
    } else {
      // New interaction - initiate based on NPC type
      if (template.type === 'shopkeeper' && template.shopInventory) {
        const items = template.shopInventory.slice(0, 3).map((si: any) => {
          const it = itemTemplates.find((t: any) => t.id === si.itemTemplateId);
          const price = Math.floor((it?.value || 10) * si.buyPriceMultiplier);
          return it ? `${it.name} (${price}g)` : null;
        }).filter(Boolean);

        if (items.length > 0) {
          context = `You're a shopkeeper. You sell: ${items.join(', ')}. ${playerName} is browsing. `;
          context += playerGold < 20 ? 'They look broke. Suggest how they could earn gold.' : 'Make a sales pitch!';
        }
      } else if (template.type === 'questgiver') {
        context = `You might have work for ${playerName}. Hint at an opportunity or task.`;
      } else {
        // Ambient NPCs - make small talk or observations
        const topics = [
          `Comment on the weather or time of day`,
          `Share a rumor or observation about the village`,
          `Ask ${playerName} where they're headed`,
          `Mention something about your current task: ${npcState.current_task || 'relaxing'}`,
          `Make a philosophical observation about life in Gamehenge`,
        ];
        context = topics[Math.floor(Math.random() * topics.length)];
      }
    }

    const prompt = `You are ${template.name}. Personality: ${personality}
${conversationContext}

Generate ONE short spontaneous comment (under 20 words) to ${playerName} who is nearby.
Context: ${context}

KNOWN PEOPLE in Gamehenge: Wilson, Icculus, Tela, Colonel Forbin, Fee, Mr. Palmer, Farmer Rutherford, Blacksmith Gordo, Elena, Baker Possum, Innkeeper Antelope, Tailor Lydia, Healer Esther, Elder Moondog, Barnaby, Marge, Gertrude, Fisherman Harpua, Captain Sloth.
NEVER invent people. Only mention characters from this list or generic roles like "the guards" or "travelers".

${hasRecentConvo ? 'Continue the conversation - reference what was already discussed!' : 'Keep it natural - like something you\'d say to someone in passing.'}`;

    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const result = await model.generateContent(prompt);
      const response = result.response.text().trim().replace(/^["']|["']$/g, '');

      // Skip if too long or seems like a non-response
      if (response.length > 150 || response.length < 5) return null;

      // Track this in conversation history so the NPC remembers they said it
      addToConversationHistory(playerId, template.id, 'npc', response);

      return response;
    } catch (error) {
      return null;
    }
  }

  // Trigger random NPC chatter (gossip or shout)
  private async triggerRandomNpcChatter(): Promise<void> {
    const db = getDatabase();

    // Get a random active NPC that can talk
    const npc = db.prepare(`
      SELECT ns.*, rn.npc_template_id
      FROM npc_state ns
      JOIN room_npcs rn ON ns.npc_instance_id = rn.id
      WHERE ns.is_active = 1
      ORDER BY RANDOM()
      LIMIT 1
    `).get() as any;

    if (!npc) return;

    const template = getNpcById(npc.npc_template_id);
    if (!template || template.type === 'enemy') return;

    const personality = getNpcPersonalityPrompt(npc.npc_template_id);

    // Decide: gossip or shout?
    const useGossip = Math.random() < 0.7; // 70% gossip, 30% shout

    try {
      if (useGossip) {
        const topics = ['the weather', 'Wilson', 'the harvest', 'rumors from the forest', 'prices at market', 'strange travelers'];
        const topic = topics[Math.floor(Math.random() * topics.length)];
        const message = await generateNpcGossip(template.name, personality, topic);

        // Send to gossip channel
        connectionManager.broadcast({
          type: 'output',
          text: `[Gossip] ${template.name}: ${message}`,
          messageType: 'chat'
        });
      } else {
        const situations = ['calling out to a friend', 'warning about the weather', 'greeting passersby', 'complaining about work'];
        const situation = situations[Math.floor(Math.random() * situations.length)];
        const message = await generateNpcShout(template.name, personality, situation);

        // Send to nearby rooms
        const playersInRoom = worldManager.getPlayersInRoom(npc.current_room);
        for (const pid of playersInRoom) {
          connectionManager.sendToPlayer(pid, {
            type: 'output',
            text: `${template.name} shouts, "${message}"`,
            messageType: 'chat'
          });
        }
      }
    } catch (error) {
      // Silently fail if Gemini is unavailable
    }
  }

  // Get current game time
  getGameTime(): { hour: number; timeOfDay: string } {
    return {
      hour: this.gameHour,
      timeOfDay: getTimeOfDay()
    };
  }
}

export const npcLifeManager = new NPCLifeManager();
