// Appearance Manager for FROBARK
// Handles player cleanliness, bloodiness, and appearance-based NPC reactions
// Inspired by Kingdom Come: Deliverance 2's clothing/cleanliness system

import { getDatabase } from '../database';
import { itemTemplates } from '../data/items';
import { playerManager } from './playerManager';

// Room dirt levels affect how quickly players get dirty
const ROOM_DIRT_DECAY: Record<string, number> = {
  'clean': 0,      // Castle halls, kept rooms
  'dusty': 1,      // Most indoor areas
  'dirty': 3,      // Stables, workshops
  'filthy': 5,     // Sewers, dungeons
  'muddy': 4,      // Outdoors in rain, swamps
};

// Cleanliness descriptors
function getCleanlinessDescriptor(cleanliness: number): string {
  if (cleanliness >= 90) return 'pristine';
  if (cleanliness >= 70) return 'clean';
  if (cleanliness >= 50) return 'slightly dusty';
  if (cleanliness >= 30) return 'dirty';
  if (cleanliness >= 15) return 'very dirty';
  return 'absolutely filthy';
}

// Bloodiness descriptors
function getBloodinessDescriptor(bloodiness: number): string {
  if (bloodiness >= 70) return 'drenched in blood';
  if (bloodiness >= 50) return 'heavily bloodstained';
  if (bloodiness >= 30) return 'bloodstained';
  if (bloodiness >= 10) return 'has some blood spatters';
  return '';
}

export interface PlayerAppearance {
  cleanliness: number;
  bloodiness: number;
  cleanlinessDesc: string;
  bloodinessDesc: string;
  lastWashed: Date | null;
  lastCombat: Date | null;
}

export interface WaterSource {
  id: number;
  roomId: string;
  sourceType: string;
  ownerNpcId: number | null;
  quality: string;
  cleanlinessBonus: number;
  description: string;
}

class AppearanceManager {
  // Get or create player appearance record
  getPlayerAppearance(playerId: number): PlayerAppearance {
    const db = getDatabase();

    // Try to get existing record
    let record = db.prepare(`
      SELECT cleanliness, bloodiness, last_washed, last_combat
      FROM player_appearance WHERE player_id = ?
    `).get(playerId) as {
      cleanliness: number;
      bloodiness: number;
      last_washed: string | null;
      last_combat: string | null;
    } | undefined;

    // Create if doesn't exist
    if (!record) {
      db.prepare(`
        INSERT INTO player_appearance (player_id, cleanliness, bloodiness)
        VALUES (?, 70, 0)
      `).run(playerId);
      record = { cleanliness: 70, bloodiness: 0, last_washed: null, last_combat: null };
    }

    return {
      cleanliness: record.cleanliness,
      bloodiness: record.bloodiness,
      cleanlinessDesc: getCleanlinessDescriptor(record.cleanliness),
      bloodinessDesc: getBloodinessDescriptor(record.bloodiness),
      lastWashed: record.last_washed ? new Date(record.last_washed) : null,
      lastCombat: record.last_combat ? new Date(record.last_combat) : null,
    };
  }

  // Update player cleanliness (called periodically by game loop)
  updateCleanliness(playerId: number, roomDirtLevel: string = 'dusty'): void {
    const db = getDatabase();
    const decay = ROOM_DIRT_DECAY[roomDirtLevel] || 0;

    if (decay > 0) {
      db.prepare(`
        UPDATE player_appearance
        SET cleanliness = MAX(0, cleanliness - ?)
        WHERE player_id = ?
      `).run(decay * 0.1, playerId);
    }
  }

  // Add blood to player (from combat)
  addBlood(playerId: number, amount: number): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE player_appearance
      SET bloodiness = MIN(100, bloodiness + ?),
          last_combat = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `).run(amount, playerId);

    // Create record if doesn't exist
    const changes = db.prepare(`SELECT changes()`).get() as { 'changes()': number };
    if (changes['changes()'] === 0) {
      db.prepare(`
        INSERT INTO player_appearance (player_id, cleanliness, bloodiness, last_combat)
        VALUES (?, 70, ?, CURRENT_TIMESTAMP)
      `).run(playerId, Math.min(100, amount));
    }
  }

  // Get water sources in a room
  getWaterSourcesInRoom(roomId: string): WaterSource[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT id, room_id as roomId, source_type as sourceType,
             owner_npc_id as ownerNpcId, quality, cleanliness_bonus as cleanlinessBonus,
             description
      FROM water_sources WHERE room_id = ?
    `).all(roomId) as WaterSource[];
  }

  // Wash at a water source
  wash(playerId: number, sourceId: number): { success: boolean; message: string; newCleanliness?: number } {
    const db = getDatabase();

    // Get the water source
    const source = db.prepare(`
      SELECT id, room_id, source_type, owner_npc_id, quality, cleanliness_bonus, description
      FROM water_sources WHERE id = ?
    `).get(sourceId) as {
      id: number;
      room_id: string;
      source_type: string;
      owner_npc_id: number | null;
      quality: string;
      cleanliness_bonus: number;
      description: string;
    } | undefined;

    if (!source) {
      return { success: false, message: "That water source doesn't exist." };
    }

    // Get current appearance
    const appearance = this.getPlayerAppearance(playerId);

    // Update cleanliness
    const newCleanliness = Math.min(100, appearance.cleanliness + source.cleanliness_bonus);
    const newBloodiness = Math.max(0, appearance.bloodiness - source.cleanliness_bonus);

    db.prepare(`
      UPDATE player_appearance
      SET cleanliness = ?, bloodiness = ?, last_washed = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `).run(newCleanliness, newBloodiness, playerId);

    // Quality-based message
    let qualityMsg = '';
    if (source.quality === 'murky') {
      qualityMsg = ' The water is a bit murky, but it does the job.';
    } else if (source.quality === 'dirty') {
      qualityMsg = " The water isn't the cleanest, but it's better than nothing.";
    }

    return {
      success: true,
      message: `You wash yourself in the ${source.source_type.replace('_', ' ')}.${qualityMsg}`,
      newCleanliness,
    };
  }

  // Build appearance description for "look self" command
  buildAppearanceDescription(playerId: number): string {
    const appearance = this.getPlayerAppearance(playerId);
    const lines: string[] = [];

    // Cleanliness line
    if (appearance.cleanliness < 90) {
      if (appearance.cleanliness >= 70) {
        lines.push('You look reasonably clean.');
      } else if (appearance.cleanliness >= 50) {
        lines.push('You are somewhat dusty and could use a wash.');
      } else if (appearance.cleanliness >= 30) {
        lines.push('You are quite dirty. People might notice.');
      } else if (appearance.cleanliness >= 15) {
        lines.push('You are very dirty. The grime is quite obvious.');
      } else {
        lines.push('You are absolutely filthy, covered in dirt and grime.');
      }
    } else {
      lines.push('You are clean and presentable.');
    }

    // Bloodiness line
    if (appearance.bloodiness > 0) {
      if (appearance.bloodiness >= 70) {
        lines.push('You are DRENCHED in blood. It\'s alarming.');
      } else if (appearance.bloodiness >= 50) {
        lines.push('You have heavy bloodstains on your clothes.');
      } else if (appearance.bloodiness >= 30) {
        lines.push('You have noticeable bloodstains.');
      } else if (appearance.bloodiness >= 10) {
        lines.push('You have some blood spatters on you.');
      }
    }

    // Stats line
    lines.push(`\nCleanliness: ${appearance.cleanliness}/100 (${appearance.cleanlinessDesc})`);
    if (appearance.bloodiness > 0) {
      lines.push(`Bloodiness: ${appearance.bloodiness}/100 (${appearance.bloodinessDesc})`);
    }

    return lines.join('\n');
  }

  // Build appearance context for NPC prompts
  buildNpcAppearanceContext(playerId: number): string {
    const appearance = this.getPlayerAppearance(playerId);
    const lines: string[] = [];

    // Cleanliness
    if (appearance.cleanliness < 20) {
      lines.push("The player is absolutely filthy, covered in grime.");
    } else if (appearance.cleanliness < 40) {
      lines.push("The player is quite dirty and disheveled.");
    } else if (appearance.cleanliness < 60) {
      lines.push("The player looks somewhat dusty and travel-worn.");
    }

    // Blood
    if (appearance.bloodiness > 70) {
      lines.push("The player is DRENCHED in blood - alarming!");
    } else if (appearance.bloodiness > 40) {
      lines.push("The player has noticeable bloodstains on their clothes.");
    } else if (appearance.bloodiness > 10) {
      lines.push("The player has some blood spatters on them.");
    }

    return lines.join(' ');
  }

  // Get charisma modifier based on appearance
  getAppearanceCharismaModifier(playerId: number): number {
    const appearance = this.getPlayerAppearance(playerId);
    let modifier = 0;

    // Cleanliness affects charisma
    if (appearance.cleanliness < 20) modifier -= 10;
    else if (appearance.cleanliness < 40) modifier -= 5;
    else if (appearance.cleanliness < 60) modifier -= 2;

    // Blood is alarming
    if (appearance.bloodiness > 50) modifier -= 15;
    else if (appearance.bloodiness > 20) modifier -= 8;
    else if (appearance.bloodiness > 0) modifier -= 3;

    return modifier;
  }
}

export const appearanceManager = new AppearanceManager();
