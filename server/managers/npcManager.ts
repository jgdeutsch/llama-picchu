// NPC Manager for Llama Picchu MUD
import { getDatabase, roomNpcQueries, npcMemoryQueries } from '../database';
import { connectionManager } from './connectionManager';
import { worldManager } from './worldManager';
import { combatManager } from './combatManager';
import { npcTemplates } from '../data/npcs';
import type { NpcTemplate, NpcInstance } from '../../shared/types/npc';

// Rude words/phrases that NPCs will detect
const RUDE_WORDS = [
  'stupid', 'idiot', 'dumb', 'hate', 'ugly', 'shut up', 'die', 'kill you',
  'fool', 'moron', 'useless', 'worthless', 'sucks', 'terrible', 'worst',
  'loser', 'pathetic', 'lame', 'boring', 'annoying', 'jerk', 'ass', 'damn'
];

// Polite words/phrases that NPCs appreciate
const POLITE_WORDS = [
  'please', 'thank', 'thanks', 'grateful', 'appreciate', 'kind', 'help',
  'wonderful', 'great', 'amazing', 'excellent', 'beautiful', 'wise',
  'respect', 'honor', 'bless', 'friend', 'sorry', 'apologize'
];

export interface NpcMemory {
  npc_template_id: number;
  player_id: number;
  disposition: number; // 0-100, 50 is neutral
  interaction_count: number;
  positive_interactions: number;
  negative_interactions: number;
  last_interaction: string | null;
  last_rudeness: string | null;
  memories: string; // JSON array of memory strings
}

export interface MemoryEntry {
  timestamp: string;
  event: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

class NpcManager {
  // Get NPC template by ID
  getNpcTemplate(templateId: number): NpcTemplate | undefined {
    return npcTemplates.find((t) => t.id === templateId);
  }

  // Get NPC template by keyword
  getNpcTemplateByKeyword(keyword: string): NpcTemplate | undefined {
    const lowerKeyword = keyword.toLowerCase();
    return npcTemplates.find((t) =>
      t.name.toLowerCase().includes(lowerKeyword) ||
      t.keywords.some((k) => k.toLowerCase().includes(lowerKeyword))
    );
  }

  // Spawn NPC in room
  spawnNpc(roomId: string, templateId: number): number | null {
    const template = this.getNpcTemplate(templateId);
    if (!template) return null;

    const db = getDatabase();
    const result = roomNpcQueries.spawn(db).run(roomId, templateId, template.maxHp, template.maxMana);

    console.log(`Spawned ${template.name} in room ${roomId}`);
    return result.lastInsertRowid as number;
  }

  // Initialize world NPCs from room templates
  initializeWorldNpcs(): void {
    const db = getDatabase();

    // Clear existing NPCs
    db.exec('DELETE FROM room_npcs');

    const roomIds = worldManager.getAllRoomIds();

    for (const roomId of roomIds) {
      const room = worldManager.getRoom(roomId);
      if (!room) continue;

      for (const npcSpawn of room.defaultNpcs) {
        this.spawnNpc(roomId, npcSpawn.npcTemplateId);
      }
    }

    const count = (db.prepare('SELECT COUNT(*) as count FROM room_npcs').get() as { count: number }).count;
    console.log(`Initialized ${count} NPCs in the world`);
  }

  // Process NPC AI for all active NPCs
  processAi(): void {
    const db = getDatabase();

    // Get all NPCs that are alive and have no combat target
    const idleNpcs = db.prepare(`
      SELECT rn.*, rt.behavior, rt.aggro_range
      FROM room_npcs rn
      JOIN (
        SELECT id, 'aggressive' as behavior, 1 as aggro_range FROM room_npcs WHERE npc_template_id IN (
          SELECT id FROM (VALUES (1), (2), (3), (4), (5)) -- aggressive NPC IDs
        )
      ) rt ON rn.id = rt.id
      WHERE rn.respawn_at IS NULL AND rn.combat_target IS NULL
    `).all() as Array<{
      id: number;
      room_id: string;
      npc_template_id: number;
      hp_current: number;
    }>;

    for (const npc of idleNpcs) {
      const template = this.getNpcTemplate(npc.npc_template_id);
      if (!template) continue;

      // Check for aggressive behavior
      if (template.behavior === 'aggressive') {
        this.processAggressiveAi(npc, template);
      } else if (template.behavior === 'wander') {
        this.processWanderAi(npc, template);
      }
    }

    // Process NPCs in combat
    const combatNpcs = db.prepare(`
      SELECT * FROM room_npcs
      WHERE respawn_at IS NULL AND combat_target IS NOT NULL
    `).all() as Array<{
      id: number;
      room_id: string;
      npc_template_id: number;
      combat_target: number;
    }>;

    for (const npc of combatNpcs) {
      // Check if target is still in room
      const playersInRoom = worldManager.getPlayersInRoom(npc.room_id);
      if (!playersInRoom.includes(npc.combat_target)) {
        // Player left room, clear target
        roomNpcQueries.setCombatTarget(db).run(null, npc.id);
      }
    }
  }

  // Process aggressive NPC AI
  private processAggressiveAi(
    npc: { id: number; room_id: string; npc_template_id: number },
    template: NpcTemplate
  ): void {
    // Check for players in room to attack
    const playersInRoom = worldManager.getPlayersInRoom(npc.room_id);

    for (const playerId of playersInRoom) {
      // Check if player is already in combat
      if (combatManager.isInCombat(playerId)) continue;

      // NPC initiates combat!
      const db = getDatabase();
      const player = db.prepare('SELECT name FROM players WHERE id = ?').get(playerId) as { name: string };

      // Notify player of attack
      connectionManager.sendToPlayer(playerId, {
        type: 'output',
        text: `\n${template.name} attacks you!`,
        messageType: 'combat',
      });

      // Start combat (player as defender)
      combatManager.startCombat(playerId, npc.id);

      // Only attack one player
      break;
    }
  }

  // Process wandering NPC AI
  private processWanderAi(
    npc: { id: number; room_id: string },
    template: NpcTemplate
  ): void {
    // 10% chance to wander each tick
    if (Math.random() > 0.1) return;

    const room = worldManager.getRoom(npc.room_id);
    if (!room || room.exits.length === 0) return;

    // Pick random exit
    const randomExit = room.exits[Math.floor(Math.random() * room.exits.length)];

    // Move NPC
    const db = getDatabase();
    db.prepare('UPDATE room_npcs SET room_id = ? WHERE id = ?').run(randomExit.targetRoom, npc.id);

    // Notify players in old room
    const oldRoomPlayers = worldManager.getPlayersInRoom(npc.room_id);
    for (const playerId of oldRoomPlayers) {
      connectionManager.sendToPlayer(playerId, {
        type: 'npc_action',
        npcName: template.name,
        action: `leaves ${randomExit.direction}`,
      });
    }

    // Notify players in new room
    const newRoomPlayers = worldManager.getPlayersInRoom(randomExit.targetRoom);
    for (const playerId of newRoomPlayers) {
      connectionManager.sendToPlayer(playerId, {
        type: 'npc_action',
        npcName: template.name,
        action: 'arrives',
      });
    }
  }

  // Get NPC dialogue response (old simple method - kept for compatibility)
  getDialogueResponse(npcTemplateId: number, keyword?: string): string | null {
    const template = this.getNpcTemplate(npcTemplateId);
    if (!template || !template.dialogue) return null;

    if (!keyword) {
      return template.dialogue.greeting;
    }

    const lowerKeyword = keyword.toLowerCase();
    for (const [key, response] of Object.entries(template.dialogue.keywords)) {
      if (key.toLowerCase().includes(lowerKeyword)) {
        return response;
      }
    }

    return template.dialogue.greeting;
  }

  // === NPC MEMORY SYSTEM ===

  // Get or create memory record for an NPC about a player
  getMemory(npcTemplateId: number, playerId: number): NpcMemory {
    const db = getDatabase();

    // Try to get existing memory
    let memory = npcMemoryQueries.get(db).get(npcTemplateId, playerId) as NpcMemory | undefined;

    if (!memory) {
      // Create new memory record
      db.prepare(`
        INSERT INTO npc_memory (npc_template_id, player_id, disposition)
        VALUES (?, ?, 50)
      `).run(npcTemplateId, playerId);
      memory = npcMemoryQueries.get(db).get(npcTemplateId, playerId) as NpcMemory;
    }

    return memory;
  }

  // Analyze message sentiment
  analyzeMessageSentiment(message: string): { isRude: boolean; isPolite: boolean; rudeWords: string[]; politeWords: string[] } {
    const lowerMessage = message.toLowerCase();
    const rudeWords = RUDE_WORDS.filter(word => lowerMessage.includes(word));
    const politeWords = POLITE_WORDS.filter(word => lowerMessage.includes(word));

    return {
      isRude: rudeWords.length > 0,
      isPolite: politeWords.length > 0,
      rudeWords,
      politeWords,
    };
  }

  // Update NPC disposition based on interaction
  updateDisposition(npcTemplateId: number, playerId: number, change: number, isRude: boolean = false): number {
    const db = getDatabase();
    const memory = this.getMemory(npcTemplateId, playerId);
    const newDisposition = Math.max(0, Math.min(100, memory.disposition + change));

    // Update disposition
    db.prepare(`
      UPDATE npc_memory
      SET disposition = ?,
          interaction_count = interaction_count + 1,
          positive_interactions = positive_interactions + ?,
          negative_interactions = negative_interactions + ?,
          last_interaction = CURRENT_TIMESTAMP,
          last_rudeness = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE last_rudeness END
      WHERE npc_template_id = ? AND player_id = ?
    `).run(
      newDisposition,
      change > 0 ? 1 : 0,
      change < 0 ? 1 : 0,
      isRude ? 1 : 0,
      npcTemplateId,
      playerId
    );

    return newDisposition;
  }

  // Add a memory about a player
  addMemoryEntry(npcTemplateId: number, playerId: number, event: string, sentiment: 'positive' | 'negative' | 'neutral'): void {
    const db = getDatabase();
    const memory = this.getMemory(npcTemplateId, playerId);

    let memories: MemoryEntry[] = [];
    try {
      memories = JSON.parse(memory.memories || '[]');
    } catch {
      memories = [];
    }

    // Add new memory (keep last 10)
    memories.push({
      timestamp: new Date().toISOString(),
      event,
      sentiment,
    });
    if (memories.length > 10) {
      memories = memories.slice(-10);
    }

    db.prepare(`UPDATE npc_memory SET memories = ? WHERE npc_template_id = ? AND player_id = ?`)
      .run(JSON.stringify(memories), npcTemplateId, playerId);
  }

  // Get disposition description
  getDispositionDescription(disposition: number): string {
    if (disposition >= 90) return 'adores you';
    if (disposition >= 75) return 'really likes you';
    if (disposition >= 60) return 'likes you';
    if (disposition >= 45) return 'is neutral toward you';
    if (disposition >= 30) return 'dislikes you';
    if (disposition >= 15) return 'really dislikes you';
    return 'despises you';
  }

  // Process a conversation with an NPC - the main conversation handler
  processConversation(
    playerId: number,
    playerName: string,
    npcInstanceId: number,
    message: string
  ): { response: string; dispositionChange: number } {
    const db = getDatabase();

    // Get NPC instance
    const npcInstance = db.prepare('SELECT * FROM room_npcs WHERE id = ?').get(npcInstanceId) as {
      id: number;
      npc_template_id: number;
      room_id: string;
    } | undefined;

    if (!npcInstance) {
      return { response: 'That creature is not here.', dispositionChange: 0 };
    }

    const template = this.getNpcTemplate(npcInstance.npc_template_id);
    if (!template) {
      return { response: 'That creature ignores you.', dispositionChange: 0 };
    }

    // Enemy NPCs don't chat
    if (template.type === 'enemy') {
      return {
        response: `${template.name} snarls at you menacingly. It doesn't seem interested in conversation.`,
        dispositionChange: 0,
      };
    }

    // Get memory for this NPC about this player
    const memory = this.getMemory(template.id, playerId);

    // Analyze message sentiment
    const sentiment = this.analyzeMessageSentiment(message);

    // Calculate disposition change
    let dispositionChange = 0;
    if (sentiment.isRude) {
      dispositionChange = -10 * sentiment.rudeWords.length;
    }
    if (sentiment.isPolite) {
      dispositionChange += 5 * sentiment.politeWords.length;
    }

    // Update disposition
    const newDisposition = this.updateDisposition(
      template.id,
      playerId,
      dispositionChange,
      sentiment.isRude
    );

    // Add memory if significant
    if (sentiment.isRude) {
      this.addMemoryEntry(
        template.id,
        playerId,
        `${playerName} was rude (said: "${message.substring(0, 50)}")`,
        'negative'
      );
    } else if (sentiment.isPolite) {
      this.addMemoryEntry(
        template.id,
        playerId,
        `${playerName} was kind (said: "${message.substring(0, 50)}")`,
        'positive'
      );
    }

    // Generate response based on disposition and message
    const response = this.generateConversationResponse(
      template,
      playerName,
      message,
      newDisposition,
      memory,
      sentiment
    );

    return { response, dispositionChange };
  }

  // Generate NPC response based on context
  private generateConversationResponse(
    template: NpcTemplate,
    playerName: string,
    message: string,
    disposition: number,
    memory: NpcMemory,
    sentiment: { isRude: boolean; isPolite: boolean; rudeWords: string[]; politeWords: string[] }
  ): string {
    const lowerMessage = message.toLowerCase();

    // If NPC is very upset, they might refuse to help
    if (disposition < 20) {
      const refusals = [
        `${template.name} turns away from you coldly. "I have nothing to say to you."`,
        `${template.name} scowls. "After how you've treated me? Leave me alone."`,
        `${template.name} glares at you. "Come back when you've learned some manners."`,
        `${template.name} ignores you completely.`,
      ];
      return refusals[Math.floor(Math.random() * refusals.length)];
    }

    // Reaction to rude message
    if (sentiment.isRude) {
      const rudeReactions = [
        `${template.name} looks hurt. "That was unkind. I'll remember that."`,
        `${template.name} frowns deeply. "There's no need for such language."`,
        `${template.name}'s expression hardens. "I expected better from you, ${playerName}."`,
        `${template.name} sighs sadly. "Why would you say such things?"`,
      ];
      return rudeReactions[Math.floor(Math.random() * rudeReactions.length)];
    }

    // Reaction to polite message
    if (sentiment.isPolite && disposition >= 50) {
      // Check for keywords in the message
      if (template.dialogue?.keywords) {
        for (const [keyword, response] of Object.entries(template.dialogue.keywords)) {
          if (lowerMessage.includes(keyword.toLowerCase())) {
            // Add warm prefix for high disposition
            if (disposition >= 70) {
              return `${template.name} smiles warmly at you. "${response}"`;
            }
            return `${template.name} says, "${response}"`;
          }
        }
      }

      const politeResponses = [
        `${template.name} smiles at your kind words. "You're too kind, ${playerName}."`,
        `${template.name} nods appreciatively. "It's nice to meet someone with manners."`,
        `${template.name} seems pleased. "I appreciate your respect."`,
      ];
      return politeResponses[Math.floor(Math.random() * politeResponses.length)];
    }

    // Check for keyword matches in dialogue
    if (template.dialogue?.keywords) {
      for (const [keyword, response] of Object.entries(template.dialogue.keywords)) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          // Modify response based on disposition
          if (disposition >= 70) {
            return `${template.name} says eagerly, "${response}"`;
          } else if (disposition >= 40) {
            return `${template.name} says, "${response}"`;
          } else {
            return `${template.name} says reluctantly, "${response}"`;
          }
        }
      }
    }

    // Check if asking for help
    if (lowerMessage.includes('help') || lowerMessage.includes('how') || lowerMessage.includes('what')) {
      if (disposition >= 50) {
        // Helpful responses based on NPC type
        if (template.type === 'shopkeeper') {
          return `${template.name} says, "I can help you! Say 'list' to see my wares, 'buy <item>' to purchase, or 'sell <item>' to sell something."`;
        }
        if (template.type === 'guildmaster') {
          return `${template.name} says, "I can train you in various skills. Say 'practice' to see what I can teach you."`;
        }
        if (template.type === 'questgiver') {
          return `${template.name} says, "I have tasks for brave adventurers. Ask me about 'quests' to learn more."`;
        }
        if (template.type === 'innkeeper') {
          return `${template.name} says, "You can 'rest' here to recover your strength, or 'list' to see what food and drink I have."`;
        }
        return `${template.name} considers your question thoughtfully and offers what wisdom they can.`;
      } else {
        return `${template.name} shrugs. "Perhaps if you were nicer to me, I'd be more inclined to help."`;
      }
    }

    // First meeting
    if (memory.interaction_count <= 1 && template.dialogue?.greeting) {
      return `${template.name} says, "${template.dialogue.greeting}"`;
    }

    // Default responses based on disposition
    if (disposition >= 70) {
      const friendly = [
        `${template.name} listens attentively to you. "Is there something specific you'd like to know?"`,
        `${template.name} smiles. "It's always good to see you, ${playerName}."`,
        `${template.name} nods warmly. "How can I help you today, friend?"`,
      ];
      return friendly[Math.floor(Math.random() * friendly.length)];
    } else if (disposition >= 40) {
      const neutral = [
        `${template.name} regards you neutrally. "What do you need?"`,
        `${template.name} nods. "Yes?"`,
        `${template.name} waits for you to continue.`,
      ];
      return neutral[Math.floor(Math.random() * neutral.length)];
    } else {
      const unfriendly = [
        `${template.name} eyes you warily. "What do you want?"`,
        `${template.name} crosses their arms. "Make it quick."`,
        `${template.name} doesn't seem pleased to see you. "Yes?"`,
      ];
      return unfriendly[Math.floor(Math.random() * unfriendly.length)];
    }
  }

  // Apply forgiveness over time (call this periodically)
  applyForgiveness(): void {
    const db = getDatabase();
    const result = db.prepare(`
      UPDATE npc_memory
      SET disposition = MIN(50, disposition + 1)
      WHERE disposition < 50
        AND last_rudeness IS NOT NULL
        AND last_rudeness < datetime('now', '-10 minutes')
    `).run();

    if (result.changes > 0) {
      console.log(`Applied forgiveness to ${result.changes} NPC memories`);
    }
  }

  // Get a summary of an NPC's opinion of a player (for debugging/display)
  getRelationshipSummary(npcTemplateId: number, playerId: number): string {
    const memory = this.getMemory(npcTemplateId, playerId);
    const template = this.getNpcTemplate(npcTemplateId);

    if (!template) return 'Unknown NPC';

    const dispositionDesc = this.getDispositionDescription(memory.disposition);
    let summary = `${template.name} ${dispositionDesc}`;

    if (memory.negative_interactions > 0) {
      summary += ` (${memory.negative_interactions} rude interactions remembered)`;
    }
    if (memory.positive_interactions > 3) {
      summary += ` (values your kindness)`;
    }

    return summary;
  }

  // Get shop inventory for NPC
  getShopInventory(npcTemplateId: number): {
    itemTemplateId: number;
    name: string;
    price: number;
    stock: number;
  }[] | null {
    const template = this.getNpcTemplate(npcTemplateId);
    if (!template || !template.shopInventory) return null;

    const { itemTemplates } = require('../data/items');

    return template.shopInventory.map((shopItem) => {
      const itemTemplate = itemTemplates.find((t: { id: number }) => t.id === shopItem.itemTemplateId);
      return {
        itemTemplateId: shopItem.itemTemplateId,
        name: itemTemplate?.name || 'Unknown',
        price: Math.floor((itemTemplate?.value || 0) * shopItem.buyPriceMultiplier),
        stock: shopItem.stock,
      };
    });
  }

  // Buy item from NPC shop
  buyItem(
    playerId: number,
    npcInstanceId: number,
    itemKeyword: string
  ): { success: boolean; message: string } {
    const db = getDatabase();

    // Get NPC
    const npc = db.prepare('SELECT * FROM room_npcs WHERE id = ?').get(npcInstanceId) as {
      npc_template_id: number;
    } | undefined;

    if (!npc) {
      return { success: false, message: 'That merchant is not here.' };
    }

    const template = this.getNpcTemplate(npc.npc_template_id);
    if (!template || template.type !== 'shopkeeper' || !template.shopInventory) {
      return { success: false, message: 'You cannot buy from that.' };
    }

    // Find item
    const { itemTemplates } = require('../data/items');
    let shopItem = null;
    let itemTemplate = null;

    for (const si of template.shopInventory) {
      const it = itemTemplates.find((t: { id: number }) => t.id === si.itemTemplateId);
      if (it && (it.name.toLowerCase().includes(itemKeyword.toLowerCase()) ||
          it.keywords.some((k: string) => k.toLowerCase().includes(itemKeyword.toLowerCase())))) {
        shopItem = si;
        itemTemplate = it;
        break;
      }
    }

    if (!shopItem || !itemTemplate) {
      return { success: false, message: 'That item is not for sale here.' };
    }

    // Check stock
    if (shopItem.stock === 0) {
      return { success: false, message: 'That item is out of stock.' };
    }

    // Calculate price
    const price = Math.floor(itemTemplate.value * shopItem.buyPriceMultiplier);

    // Check player gold
    const player = db.prepare('SELECT gold FROM players WHERE id = ?').get(playerId) as { gold: number };
    if (player.gold < price) {
      return { success: false, message: `You don't have enough gold. You need ${price} gold.` };
    }

    // Deduct gold and add item
    const { playerManager } = require('./playerManager');
    playerManager.modifyGold(playerId, -price);
    playerManager.addItemToInventory(playerId, itemTemplate.id, 1);

    return {
      success: true,
      message: `You buy ${itemTemplate.name} for ${price} gold.`,
    };
  }

  // Sell item to NPC shop
  sellItem(
    playerId: number,
    npcInstanceId: number,
    itemKeyword: string
  ): { success: boolean; message: string } {
    const db = getDatabase();

    // Get NPC
    const npc = db.prepare('SELECT * FROM room_npcs WHERE id = ?').get(npcInstanceId) as {
      npc_template_id: number;
    } | undefined;

    if (!npc) {
      return { success: false, message: 'That merchant is not here.' };
    }

    const template = this.getNpcTemplate(npc.npc_template_id);
    if (!template || template.type !== 'shopkeeper') {
      return { success: false, message: 'You cannot sell to that.' };
    }

    // Find item in player inventory
    const { playerManager } = require('./playerManager');
    const item = playerManager.findItemInInventory(playerId, itemKeyword);

    if (!item) {
      return { success: false, message: 'You don\'t have that item.' };
    }

    const { itemTemplates } = require('../data/items');
    const itemTemplate = itemTemplates.find((t: { id: number }) => t.id === item.templateId);

    if (!itemTemplate) {
      return { success: false, message: 'Invalid item.' };
    }

    if (itemTemplate.questItem) {
      return { success: false, message: 'You cannot sell quest items.' };
    }

    // Calculate sell price (usually 50% of value)
    const price = Math.floor(itemTemplate.value * 0.5);

    // Remove item and add gold
    playerManager.removeItemFromInventory(playerId, item.id, 1);
    playerManager.modifyGold(playerId, price);

    return {
      success: true,
      message: `You sell ${itemTemplate.name} for ${price} gold.`,
    };
  }

  // Get list of NPCs in room
  getNpcsInRoom(roomId: string): { id: number; name: string; shortDesc: string; type: string }[] {
    const db = getDatabase();
    const npcs = roomNpcQueries.getByRoom(db).all(roomId) as {
      id: number;
      npc_template_id: number;
    }[];

    return npcs.map((npc) => {
      const template = this.getNpcTemplate(npc.npc_template_id);
      return {
        id: npc.id,
        name: template?.name || 'Unknown',
        shortDesc: template?.shortDesc || 'An unknown creature',
        type: template?.type || 'ambient',
      };
    }).filter((n) => n.name !== 'Unknown');
  }
}

export const npcManager = new NpcManager();
export default npcManager;
