// Quest Manager for Llama Picchu MUD
import { getDatabase, questQueries } from '../database';
import { connectionManager } from './connectionManager';
import { playerManager } from './playerManager';
import { questDefinitions } from '../data/quests';
import type { QuestDefinition, QuestObjective } from '../../shared/types';

class QuestManager {
  // Get quest definition by ID
  getQuestDefinition(questId: number): QuestDefinition | undefined {
    return questDefinitions.find((q) => q.id === questId);
  }

  // Get player's active quests
  getPlayerQuests(playerId: number): {
    quest: QuestDefinition;
    status: string;
    progress: Record<string, number>;
  }[] {
    const db = getDatabase();
    const playerQuests = questQueries.getActive(db).all(playerId) as {
      quest_id: number;
      status: string;
      progress_json: string;
    }[];

    return playerQuests.map((pq) => {
      const quest = this.getQuestDefinition(pq.quest_id);
      return {
        quest: quest!,
        status: pq.status,
        progress: JSON.parse(pq.progress_json || '{}'),
      };
    }).filter((q) => q.quest);
  }

  // Accept a quest
  acceptQuest(playerId: number, questId: number): { success: boolean; message: string } {
    const quest = this.getQuestDefinition(questId);
    if (!quest) {
      return { success: false, message: 'Quest not found.' };
    }

    const db = getDatabase();

    // Check if already have quest
    const existing = db.prepare(
      'SELECT * FROM player_quests WHERE player_id = ? AND quest_id = ?'
    ).get(playerId, questId) as { status: string } | undefined;

    if (existing) {
      if (existing.status === 'active') {
        return { success: false, message: 'You already have this quest.' };
      }
      if (existing.status === 'completed' && !quest.repeatable) {
        return { success: false, message: 'You have already completed this quest.' };
      }
    }

    // Check level requirement
    const player = playerManager.getPlayer(playerId) as { level: number; class_id: number };
    if (player.level < quest.levelRequired) {
      return { success: false, message: `You must be level ${quest.levelRequired} to accept this quest.` };
    }

    // Check class requirement
    if (quest.classRequired && quest.classRequired !== player.class_id) {
      return { success: false, message: 'This quest is not available to your class.' };
    }

    // Check prerequisites
    for (const prereqId of quest.prerequisites) {
      const prereq = db.prepare(
        'SELECT * FROM player_quests WHERE player_id = ? AND quest_id = ? AND status = "completed"'
      ).get(playerId, prereqId);

      if (!prereq) {
        const prereqQuest = this.getQuestDefinition(prereqId);
        return {
          success: false,
          message: `You must complete "${prereqQuest?.name || 'a previous quest'}" first.`,
        };
      }
    }

    // Initialize progress
    const progress: Record<string, number> = {};
    for (const objective of quest.objectives) {
      progress[objective.id] = 0;
    }

    // Add quest
    if (existing) {
      db.prepare(
        'UPDATE player_quests SET status = "active", progress_json = ?, started_at = CURRENT_TIMESTAMP, completed_at = NULL WHERE player_id = ? AND quest_id = ?'
      ).run(JSON.stringify(progress), playerId, questId);
    } else {
      questQueries.addQuest(db).run(playerId, questId);
      questQueries.updateProgress(db).run(JSON.stringify(progress), playerId, questId);
    }

    connectionManager.sendToPlayer(playerId, {
      type: 'quest_update',
      questId,
      status: 'active',
      progress,
    });

    return { success: true, message: `Quest accepted: ${quest.name}` };
  }

  // Update quest progress
  updateProgress(
    playerId: number,
    objectiveType: 'kill' | 'collect' | 'deliver' | 'explore' | 'talk',
    target: string | number,
    amount: number = 1
  ): void {
    const db = getDatabase();
    const activeQuests = this.getPlayerQuests(playerId);

    for (const { quest, progress } of activeQuests) {
      let updated = false;

      for (const objective of quest.objectives) {
        if (objective.type !== objectiveType) continue;

        // Check if target matches
        const targetMatches = typeof target === 'string'
          ? String(objective.target).toLowerCase() === target.toLowerCase()
          : objective.target === target;

        if (!targetMatches) continue;

        // Check if already complete
        const current = progress[objective.id] || 0;
        if (current >= objective.quantity) continue;

        // Update progress
        progress[objective.id] = Math.min(current + amount, objective.quantity);
        updated = true;
      }

      if (updated) {
        // Save progress
        questQueries.updateProgress(db).run(JSON.stringify(progress), playerId, quest.id);

        // Notify player
        connectionManager.sendToPlayer(playerId, {
          type: 'quest_update',
          questId: quest.id,
          status: 'active',
          progress,
        });

        // Check if quest is complete
        this.checkQuestCompletion(playerId, quest.id);
      }
    }
  }

  // Check if quest is complete
  checkQuestCompletion(playerId: number, questId: number): boolean {
    const db = getDatabase();
    const quest = this.getQuestDefinition(questId);
    if (!quest) return false;

    const playerQuest = db.prepare(
      'SELECT * FROM player_quests WHERE player_id = ? AND quest_id = ?'
    ).get(playerId, questId) as { progress_json: string } | undefined;

    if (!playerQuest) return false;

    const progress = JSON.parse(playerQuest.progress_json || '{}');

    // Check all objectives
    for (const objective of quest.objectives) {
      const current = progress[objective.id] || 0;
      if (current < objective.quantity) {
        return false;
      }
    }

    return true;
  }

  // Complete a quest and grant rewards
  completeQuest(playerId: number, questId: number): { success: boolean; message: string } {
    if (!this.checkQuestCompletion(playerId, questId)) {
      return { success: false, message: 'Quest objectives are not complete.' };
    }

    const quest = this.getQuestDefinition(questId);
    if (!quest) {
      return { success: false, message: 'Quest not found.' };
    }

    const db = getDatabase();

    // Mark quest complete
    questQueries.completeQuest(db).run(playerId, questId);

    // Grant rewards
    const rewards: string[] = [];

    // Experience
    if (quest.rewards.experience > 0) {
      playerManager.awardExperience(playerId, quest.rewards.experience);
      rewards.push(`${quest.rewards.experience} experience`);
    }

    // Gold
    if (quest.rewards.gold > 0) {
      playerManager.modifyGold(playerId, quest.rewards.gold);
      rewards.push(`${quest.rewards.gold} gold`);
    }

    // Items
    if (quest.rewards.items) {
      for (const item of quest.rewards.items) {
        playerManager.addItemToInventory(playerId, item.itemTemplateId, item.quantity);
      }
      rewards.push('items');
    }

    connectionManager.sendToPlayer(playerId, {
      type: 'quest_update',
      questId,
      status: 'completed',
      progress: {},
    });

    const rewardMsg = rewards.length > 0 ? `\nRewards: ${rewards.join(', ')}` : '';
    return {
      success: true,
      message: `Quest completed: ${quest.name}!${rewardMsg}`,
    };
  }

  // Abandon a quest
  abandonQuest(playerId: number, questId: number): { success: boolean; message: string } {
    const db = getDatabase();

    const existing = db.prepare(
      'SELECT * FROM player_quests WHERE player_id = ? AND quest_id = ? AND status = "active"'
    ).get(playerId, questId);

    if (!existing) {
      return { success: false, message: 'You do not have that quest.' };
    }

    db.prepare(
      'UPDATE player_quests SET status = "failed" WHERE player_id = ? AND quest_id = ?'
    ).run(playerId, questId);

    const quest = this.getQuestDefinition(questId);
    return { success: true, message: `Quest abandoned: ${quest?.name || 'Unknown'}` };
  }

  // Get quest log display
  getQuestLogDisplay(playerId: number): string {
    const activeQuests = this.getPlayerQuests(playerId);

    if (activeQuests.length === 0) {
      return '\nYou have no active quests.\n';
    }

    const lines: string[] = [
      '',
      '═══════════════════════════════════════',
      '              QUEST LOG                 ',
      '═══════════════════════════════════════',
    ];

    for (const { quest, progress } of activeQuests) {
      lines.push('');
      lines.push(`[${quest.name}]`);
      lines.push(`Level ${quest.levelRequired} - ${quest.description}`);
      lines.push('');
      lines.push('Objectives:');

      for (const objective of quest.objectives) {
        const current = progress[objective.id] || 0;
        const complete = current >= objective.quantity;
        const marker = complete ? '[X]' : '[ ]';
        lines.push(`  ${marker} ${objective.description} (${current}/${objective.quantity})`);
      }

      lines.push('');
      lines.push(`Rewards: ${quest.rewards.experience} XP, ${quest.rewards.gold} gold`);
      lines.push('───────────────────────────────────────');
    }

    return lines.join('\n') + '\n';
  }

  // Get available quests from NPC
  getAvailableQuests(npcTemplateId: number, playerId: number): QuestDefinition[] {
    const { npcTemplates } = require('../data/npcs');
    const npc = npcTemplates.find((t: { id: number }) => t.id === npcTemplateId);

    if (!npc || !npc.questIds) return [];

    const db = getDatabase();
    const player = playerManager.getPlayer(playerId) as { level: number; class_id: number };

    return npc.questIds
      .map((id: number) => this.getQuestDefinition(id))
      .filter((quest: QuestDefinition | undefined): quest is QuestDefinition => {
        if (!quest) return false;
        if (player.level < quest.levelRequired) return false;
        if (quest.classRequired && quest.classRequired !== player.class_id) return false;

        // Check if already have or completed
        const existing = db.prepare(
          'SELECT * FROM player_quests WHERE player_id = ? AND quest_id = ?'
        ).get(playerId, quest.id) as { status: string } | undefined;

        if (existing) {
          if (existing.status === 'active') return false;
          if (existing.status === 'completed' && !quest.repeatable) return false;
        }

        return true;
      });
  }
}

export const questManager = new QuestManager();
export default questManager;
