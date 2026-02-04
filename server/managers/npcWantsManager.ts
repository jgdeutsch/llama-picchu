// NPC Wants Manager for FROBARK MUD
// Manages what NPCs want from players and handles fulfillment

import { getDatabase } from '../database';
import { getNpcWants, getAllNpcWants, type NpcWant } from '../data/npcWants';
import { itemTemplates } from '../data/items';
import { npcTemplates } from '../data/npcs';

interface WantWithStatus extends NpcWant {
  id: number;
  canFulfill: boolean;
  nextAvailable?: Date;
}

class NpcWantsManager {
  // Initialize/seed the wants into the database
  seedWants(): void {
    const db = getDatabase();
    const wants = getAllNpcWants();

    for (const want of wants) {
      // Check if this want already exists
      const existing = db.prepare(`
        SELECT id FROM npc_wants
        WHERE npc_template_id = ? AND want_type = ? AND item_id IS ?
      `).get(want.npcTemplateId, want.wantType, want.itemId || null);

      if (!existing) {
        db.prepare(`
          INSERT INTO npc_wants (
            npc_template_id, want_type, item_id, description, dialogue_hint,
            quantity_needed, importance, reward_type, reward_amount,
            reward_item_id, reward_description, is_repeatable, cooldown_hours
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          want.npcTemplateId,
          want.wantType,
          want.itemId || null,
          want.description,
          want.dialogueHint,
          want.quantityNeeded,
          want.importance,
          want.rewardType,
          want.rewardAmount,
          want.rewardItemId || null,
          want.rewardDescription,
          want.isRepeatable ? 1 : 0,
          want.cooldownHours
        );
      }
    }

    console.log(`[NpcWantsManager] Seeded ${wants.length} NPC wants`);
  }

  // Get all active wants for an NPC
  getWantsForNpc(npcTemplateId: number, playerId?: number): WantWithStatus[] {
    const db = getDatabase();

    const wants = db.prepare(`
      SELECT * FROM npc_wants
      WHERE npc_template_id = ? AND is_active = 1
      ORDER BY importance DESC
    `).all(npcTemplateId) as any[];

    return wants.map(want => {
      let canFulfill = true;
      let nextAvailable: Date | undefined;

      if (playerId && !want.is_repeatable) {
        // Check if already fulfilled
        const fulfillment = db.prepare(`
          SELECT fulfilled_at FROM npc_want_fulfillments
          WHERE want_id = ? AND player_id = ?
        `).get(want.id, playerId) as { fulfilled_at: string } | undefined;

        if (fulfillment) {
          canFulfill = false;
        }
      } else if (playerId && want.is_repeatable) {
        // Check cooldown
        const lastFulfillment = db.prepare(`
          SELECT fulfilled_at FROM npc_want_fulfillments
          WHERE want_id = ? AND player_id = ?
          ORDER BY fulfilled_at DESC
          LIMIT 1
        `).get(want.id, playerId) as { fulfilled_at: string } | undefined;

        if (lastFulfillment) {
          const cooldownEnd = new Date(lastFulfillment.fulfilled_at);
          cooldownEnd.setHours(cooldownEnd.getHours() + want.cooldown_hours);

          if (cooldownEnd > new Date()) {
            canFulfill = false;
            nextAvailable = cooldownEnd;
          }
        }
      }

      return {
        id: want.id,
        npcTemplateId: want.npc_template_id,
        wantType: want.want_type,
        itemId: want.item_id,
        description: want.description,
        dialogueHint: want.dialogue_hint,
        quantityNeeded: want.quantity_needed,
        importance: want.importance,
        rewardType: want.reward_type,
        rewardAmount: want.reward_amount,
        rewardItemId: want.reward_item_id,
        rewardDescription: want.reward_description,
        isRepeatable: want.is_repeatable === 1,
        cooldownHours: want.cooldown_hours,
        canFulfill,
        nextAvailable,
      };
    });
  }

  // Check if player can fulfill a want with an item they're giving
  checkFulfillment(
    npcTemplateId: number,
    playerId: number,
    itemTemplateId: number,
    quantity: number
  ): { want: WantWithStatus; fulfilled: boolean } | null {
    const wants = this.getWantsForNpc(npcTemplateId, playerId);

    // Find a matching want
    const matchingWant = wants.find(w =>
      w.wantType === 'item' &&
      w.itemId === itemTemplateId &&
      w.canFulfill
    );

    if (!matchingWant) return null;

    // Check quantity
    const fulfilled = quantity >= matchingWant.quantityNeeded;

    return { want: matchingWant, fulfilled };
  }

  // Fulfill a want and grant reward
  fulfillWant(
    wantId: number,
    playerId: number,
    quantityGiven: number
  ): { success: boolean; message: string; reward?: { type: string; amount?: number; itemId?: number } } {
    const db = getDatabase();

    const want = db.prepare(`SELECT * FROM npc_wants WHERE id = ?`).get(wantId) as any;
    if (!want) {
      return { success: false, message: "That want doesn't exist." };
    }

    // Record the fulfillment
    db.prepare(`
      INSERT INTO npc_want_fulfillments (want_id, player_id, quantity_given)
      VALUES (?, ?, ?)
    `).run(wantId, playerId, quantityGiven);

    // Grant reward based on type
    if (want.reward_type === 'gold') {
      db.prepare(`UPDATE players SET gold = gold + ? WHERE id = ?`).run(want.reward_amount, playerId);
    } else if (want.reward_type === 'reputation') {
      // Boost social capital with this NPC
      db.prepare(`
        INSERT INTO social_capital (player_id, npc_id, capital, trust_level, times_helped)
        VALUES (?, ?, ?, 'acquaintance', 1)
        ON CONFLICT(player_id, npc_id) DO UPDATE SET
          capital = capital + ?,
          times_helped = times_helped + 1
      `).run(playerId, want.npc_template_id, want.reward_amount, want.reward_amount);
    } else if (want.reward_type === 'item' && want.reward_item_id) {
      // Give item - add to player inventory
      const existingItem = db.prepare(`
        SELECT id, quantity FROM player_inventory
        WHERE player_id = ? AND item_template_id = ?
      `).get(playerId, want.reward_item_id) as { id: number; quantity: number } | undefined;

      if (existingItem) {
        db.prepare(`UPDATE player_inventory SET quantity = quantity + 1 WHERE id = ?`).run(existingItem.id);
      } else {
        db.prepare(`
          INSERT INTO player_inventory (player_id, item_template_id, quantity)
          VALUES (?, ?, 1)
        `).run(playerId, want.reward_item_id);
      }
    }

    // Also give some social capital for any fulfillment
    if (want.reward_type !== 'reputation') {
      db.prepare(`
        INSERT INTO social_capital (player_id, npc_id, capital, trust_level, times_helped)
        VALUES (?, ?, 5, 'acquaintance', 1)
        ON CONFLICT(player_id, npc_id) DO UPDATE SET
          capital = capital + 5,
          times_helped = times_helped + 1
      `).run(playerId, want.npc_template_id);
    }

    return {
      success: true,
      message: want.reward_description,
      reward: {
        type: want.reward_type,
        amount: want.reward_amount,
        itemId: want.reward_item_id,
      },
    };
  }

  // Get a summary of what an NPC wants (for dialogue context)
  getWantsSummaryForDialogue(npcTemplateId: number, playerId: number): string {
    const wants = this.getWantsForNpc(npcTemplateId, playerId);
    const fulfillable = wants.filter(w => w.canFulfill);

    if (fulfillable.length === 0) {
      return '';
    }

    const lines: string[] = [];
    for (const want of fulfillable.slice(0, 3)) { // Top 3 by importance
      if (want.wantType === 'item' && want.itemId) {
        const item = itemTemplates.find(i => i.id === want.itemId);
        if (item) {
          lines.push(`- Wants ${want.quantityNeeded}x ${item.name}: "${want.dialogueHint}"`);
        }
      } else {
        lines.push(`- ${want.description}: "${want.dialogueHint}"`);
      }
    }

    return lines.length > 0 ? `\nTHINGS THIS NPC WANTS:\n${lines.join('\n')}` : '';
  }

  // Format wants for display to player
  formatWantsForPlayer(npcTemplateId: number, playerId: number): string {
    const wants = this.getWantsForNpc(npcTemplateId, playerId);
    const npc = npcTemplates.find(t => t.id === npcTemplateId);

    if (wants.length === 0) {
      return '';
    }

    const lines: string[] = [];

    for (const want of wants) {
      if (want.wantType === 'item' && want.itemId) {
        const item = itemTemplates.find(i => i.id === want.itemId);
        if (item) {
          const status = want.canFulfill ? '' : ' (on cooldown)';
          const rewardText = want.rewardType === 'gold'
            ? `${want.rewardAmount} gold`
            : want.rewardType === 'item' && want.rewardItemId
              ? itemTemplates.find(i => i.id === want.rewardItemId)?.name || 'an item'
              : `+${want.rewardAmount} reputation`;

          lines.push(`  - ${want.quantityNeeded}x ${item.name} → ${rewardText}${status}`);
        }
      }
    }

    if (lines.length === 0) return '';

    return `\n[${npc?.name || 'This person'} is looking for:]\n${lines.join('\n')}\n`;
  }
}

export const npcWantsManager = new NpcWantsManager();
