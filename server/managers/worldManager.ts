// World Manager for Llama Picchu MUD
import { getDatabase, playerQueries, roomItemQueries, roomNpcQueries } from '../database';
import { connectionManager } from './connectionManager';
import { roomTemplates } from '../data/rooms';
import { itemTemplates } from '../data/items';
import { npcTemplates } from '../data/npcs';
import type { RoomTemplate, RoomState, Direction, RoomItemInstance, RoomNpcInstance } from '../../shared/types/room';
import type { ServerMessage } from '../../shared/types/websocket';

import { updatePlayerLastSeen } from './playerTracker';

// Types for NPC state queries
interface NpcStateRow {
  npc_instance_id: number;
  current_task: string | null;
  current_purpose: string | null;
  task_progress: number;
  mood: string;
  energy: number;
}

class WorldManager {
  private rooms: Map<string, RoomTemplate> = new Map();
  private roomStates: Map<string, RoomState> = new Map();

  initialize(): void {
    // Load room templates
    for (const room of roomTemplates) {
      this.rooms.set(room.id, room);
    }

    console.log(`WorldManager initialized with ${this.rooms.size} rooms`);
  }

  // Get room template by ID
  getRoom(roomId: string): RoomTemplate | undefined {
    return this.rooms.get(roomId);
  }

  // Get full room state including players, items, NPCs
  getRoomState(roomId: string): RoomState | null {
    const template = this.rooms.get(roomId);
    if (!template) return null;

    const db = getDatabase();

    // Get players in room
    const players = playerQueries.getPlayersInRoom(db).all(roomId) as { id: number }[];
    const playerIds = players.map((p) => p.id);

    // Get items in room
    const items = roomItemQueries.getByRoom(db).all(roomId) as RoomItemInstance[];

    // Get NPCs in room (alive ones)
    const npcs = roomNpcQueries.getByRoom(db).all(roomId) as RoomNpcInstance[];

    return {
      id: roomId,
      template,
      players: playerIds,
      items,
      npcs,
    };
  }

  // Get players currently in a room
  getPlayersInRoom(roomId: string): number[] {
    const db = getDatabase();
    const players = playerQueries.getPlayersInRoom(db).all(roomId) as { id: number }[];
    return players.map((p) => p.id);
  }

  // Move player to a new room
  movePlayer(playerId: number, direction: Direction): { success: boolean; message: string; newRoomId?: string } {
    const db = getDatabase();
    const player = playerQueries.findById(db).get(playerId) as {
      id: number;
      name: string;
      current_room: string;
      is_fighting: number;
    };

    if (!player) {
      return { success: false, message: 'Player not found.' };
    }

    if (player.is_fighting) {
      return { success: false, message: 'You cannot move while in combat! Use "flee" to escape.' };
    }

    const currentRoom = this.getRoom(player.current_room);
    if (!currentRoom) {
      return { success: false, message: 'You are in an invalid location.' };
    }

    // Find the exit in the requested direction
    const exit = currentRoom.exits.find((e) => e.direction === direction);
    if (!exit) {
      return { success: false, message: `You cannot go ${direction} from here.` };
    }

    // Check if exit is locked
    if (exit.locked) {
      return { success: false, message: 'That way is locked.' };
    }

    // Check if exit is hidden
    if (exit.hiddenUntil) {
      // For now, hidden exits are always hidden - can add flag checking later
      return { success: false, message: `You cannot go ${direction} from here.` };
    }

    const targetRoom = this.getRoom(exit.targetRoom);
    if (!targetRoom) {
      return { success: false, message: 'That exit leads nowhere.' };
    }

    // Get players in old room to notify them
    const playersInOldRoom = this.getPlayersInRoom(player.current_room);

    // Update player location
    playerQueries.updateRoom(db).run(exit.targetRoom, playerId);

    // Track this movement for "where" command
    updatePlayerLastSeen(player.name, player.current_room, direction);

    // Notify players in old room that player left
    const leaveMessage: ServerMessage = {
      type: 'player_left',
      playerName: player.name,
      direction,
    };
    connectionManager.sendToRoomExcept(player.current_room, leaveMessage, playersInOldRoom, playerId);

    // Get players in new room to notify them
    const playersInNewRoom = this.getPlayersInRoom(exit.targetRoom);

    // Notify players in new room that player arrived
    const enterMessage: ServerMessage = {
      type: 'player_entered',
      playerName: player.name,
    };
    connectionManager.sendToRoomExcept(exit.targetRoom, enterMessage, playersInNewRoom, playerId);

    return {
      success: true,
      message: '',
      newRoomId: exit.targetRoom,
    };
  }

  // Generate room description for a player
  getRoomDescription(roomId: string, playerId: number): string {
    const db = getDatabase();
    const roomState = this.getRoomState(roomId);
    if (!roomState) {
      return 'You are in a void of nothingness.';
    }

    const { template, players, items, npcs } = roomState;
    const lines: string[] = [];

    // Room title
    lines.push(`\n[${template.name}]`);
    lines.push('');

    // Room description
    lines.push(template.description);
    lines.push('');

    // Items on ground
    if (items.length > 0) {
      const itemDescriptions = items.map((item) => {
        const itemTemplate = itemTemplates.find((t) => t.id === item.itemTemplateId);
        if (!itemTemplate) return null;
        if (item.quantity > 1) {
          return `  ${itemTemplate.shortDesc} (x${item.quantity})`;
        }
        return `  ${itemTemplate.shortDesc}`;
      }).filter(Boolean);

      if (itemDescriptions.length > 0) {
        lines.push('You see:');
        lines.push(...itemDescriptions as string[]);
        lines.push('');
      }
    }

    // NPCs in room - with contextual activity descriptions
    if (npcs.length > 0) {
      const npcDescriptions = npcs.map((npc) => {
        const npcTemplate = npcTemplates.find((t) => t.id === npc.npcTemplateId);
        if (!npcTemplate) return null;

        // Get NPC's current state for contextual description
        const npcState = db.prepare(`
          SELECT current_task, current_purpose, task_progress, mood, energy
          FROM npc_state WHERE npc_instance_id = ?
        `).get(npc.id) as NpcStateRow | undefined;

        // Generate contextual description based on where they are and what they're doing
        return `  ${this.getContextualNpcDescription(npcTemplate, roomId, npcState)}`;
      }).filter(Boolean);

      if (npcDescriptions.length > 0) {
        lines.push(...npcDescriptions as string[]);
        lines.push('');
      }
    }

    // Other players in room
    const otherPlayers = players.filter((id) => id !== playerId);
    if (otherPlayers.length > 0) {
      const playerData = otherPlayers.map((id) => {
        const p = playerQueries.findById(db).get(id) as { name: string; level: number } | undefined;
        return p ? `  ${p.name} the llama is here.` : null;
      }).filter(Boolean);

      if (playerData.length > 0) {
        lines.push(...playerData as string[]);
        lines.push('');
      }
    }

    // Exits
    const exitDirections = template.exits
      .filter((e) => !e.hiddenUntil)
      .map((e) => e.direction);

    if (exitDirections.length > 0) {
      lines.push(`[Exits: ${exitDirections.join(', ')}]`);
    } else {
      lines.push('[Exits: none]');
    }

    return lines.join('\n');
  }

  // Add item to room
  addItemToRoom(roomId: string, itemTemplateId: number, quantity: number = 1): void {
    const db = getDatabase();
    roomItemQueries.addItem(db).run(roomId, itemTemplateId, quantity);
  }

  // Remove item from room
  removeItemFromRoom(roomItemId: number): void {
    const db = getDatabase();
    roomItemQueries.removeItem(db).run(roomItemId);
  }

  // Get item in room by keyword
  findItemInRoom(roomId: string, keyword: string): RoomItemInstance | null {
    const db = getDatabase();
    const items = roomItemQueries.getByRoom(db).all(roomId) as RoomItemInstance[];

    for (const item of items) {
      const template = itemTemplates.find((t) => t.id === item.itemTemplateId);
      if (template) {
        const lowerKeyword = keyword.toLowerCase();
        if (
          template.name.toLowerCase().includes(lowerKeyword) ||
          template.keywords.some((k) => k.toLowerCase().includes(lowerKeyword))
        ) {
          return item;
        }
      }
    }

    return null;
  }

  // Find NPC in room by keyword - supports smart matching
  findNpcInRoom(roomId: string, keyword: string): RoomNpcInstance | null {
    const db = getDatabase();
    const npcs = roomNpcQueries.getByRoom(db).all(roomId) as RoomNpcInstance[];
    const lowerKeyword = keyword.toLowerCase();

    // Generic keywords that should match based on NPC properties
    const genericKeywords: Record<string, (template: typeof npcTemplates[0]) => boolean> = {
      'lizard': (t) => t.longDesc?.toLowerCase().includes('lizard') || t.shortDesc?.toLowerCase().includes('lizard') || false,
      'human': (t) => !t.longDesc?.toLowerCase().includes('lizard') && !t.longDesc?.toLowerCase().includes('weasel'),
      'man': (t) => t.longDesc?.toLowerCase().includes(' man') || t.longDesc?.toLowerCase().includes(' he ') || t.name.toLowerCase().includes('man'),
      'woman': (t) => t.longDesc?.toLowerCase().includes(' woman') || t.longDesc?.toLowerCase().includes(' she ') || t.name.toLowerCase().includes('woman'),
      'guard': (t) => t.type === 'enemy' && (t.keywords.includes('guard') || t.name.toLowerCase().includes('guard')),
      'shopkeeper': (t) => t.type === 'shopkeeper' || t.type === 'innkeeper',
      'merchant': (t) => t.type === 'shopkeeper',
      'bartender': (t) => t.type === 'innkeeper',
      'innkeeper': (t) => t.type === 'innkeeper',
      'vendor': (t) => t.type === 'shopkeeper',
      'npc': (_t) => true, // Match any NPC
      'person': (_t) => true,
      'someone': (_t) => true,
      'anyone': (_t) => true,
    };

    // First try exact/partial keyword matching (original logic)
    for (const npc of npcs) {
      const template = npcTemplates.find((t) => t.id === npc.npcTemplateId);
      if (template) {
        if (
          template.name.toLowerCase().includes(lowerKeyword) ||
          template.keywords.some((k) => k.toLowerCase().includes(lowerKeyword))
        ) {
          return npc;
        }
      }
    }

    // Try generic keyword matching
    const genericMatcher = genericKeywords[lowerKeyword];
    if (genericMatcher) {
      for (const npc of npcs) {
        const template = npcTemplates.find((t) => t.id === npc.npcTemplateId);
        if (template && genericMatcher(template)) {
          return npc;
        }
      }
    }

    // Try matching NPC type (e.g., "questgiver", "enemy")
    for (const npc of npcs) {
      const template = npcTemplates.find((t) => t.id === npc.npcTemplateId);
      if (template && template.type.toLowerCase() === lowerKeyword) {
        return npc;
      }
    }

    return null;
  }

  // Get all NPCs in room with their templates (for suggestions)
  getNpcsInRoomWithTemplates(roomId: string): Array<{ npc: RoomNpcInstance; template: typeof npcTemplates[0] }> {
    const db = getDatabase();
    const npcs = roomNpcQueries.getByRoom(db).all(roomId) as RoomNpcInstance[];
    const result: Array<{ npc: RoomNpcInstance; template: typeof npcTemplates[0] }> = [];

    for (const npc of npcs) {
      const template = npcTemplates.find((t) => t.id === npc.npcTemplateId);
      if (template) {
        result.push({ npc, template });
      }
    }

    return result;
  }

  // Check if room is safe (no combat)
  isRoomSafe(roomId: string): boolean {
    const room = this.getRoom(roomId);
    return room?.flags?.safe ?? false;
  }

  // Check if room allows resting
  isRestRoom(roomId: string): boolean {
    const room = this.getRoom(roomId);
    return room?.flags?.restRoom ?? false;
  }

  // Get rest cost for room
  getRestCost(roomId: string): number {
    const room = this.getRoom(roomId);
    return room?.flags?.restCost ?? 0;
  }

  // Generate a contextual NPC description based on where they are and what they're doing
  private getContextualNpcDescription(
    npcTemplate: typeof npcTemplates[0],
    roomId: string,
    npcState: NpcStateRow | undefined
  ): string {
    const room = this.getRoom(roomId);
    const roomName = room?.name || 'this place';
    const npcName = npcTemplate.name;
    const gender = npcTemplate.gender || 'male';
    const pronoun = gender === 'female' ? 'her' : gender === 'neutral' ? 'their' : 'his';

    // If NPC has no state, use static shortDesc
    if (!npcState) {
      return npcTemplate.shortDesc;
    }

    // If NPC has a stored purpose from their recent movement, use it
    if (npcState.current_purpose) {
      return `${npcName} is here, ${npcState.current_purpose}.`;
    }

    // Get room context
    const isAtInn = roomId === 'the_inn';
    const isAtBakery = roomId === 'bakery';
    const isAtMarket = roomId === 'market_district';
    const isAtVillageSquare = roomId === 'village_square';
    const isAtFarmlands = roomId === 'farmlands';
    const isAtForge = roomId === 'blacksmith_forge';
    const isAtTailor = roomId === 'tailor_shop';

    // Check if this is their work location based on template keywords
    const isBlacksmith = npcTemplate.keywords.includes('blacksmith') || npcTemplate.keywords.includes('smith');
    const isBaker = npcTemplate.keywords.includes('baker');
    const isFarmer = npcTemplate.keywords.includes('farmer');
    const isTailor = npcTemplate.keywords.includes('tailor');
    const isInnkeeper = npcTemplate.type === 'innkeeper';

    // If they're at their work location doing work, use the standard shortDesc
    if (npcState.current_task) {
      if (isBlacksmith && isAtForge && npcState.current_task === 'smithing') {
        return npcTemplate.shortDesc;
      }
      if (isBaker && isAtBakery && (npcState.current_task === 'baking' || npcState.current_task === 'selling')) {
        return npcTemplate.shortDesc;
      }
      if (isFarmer && isAtFarmlands && npcState.current_task === 'farming') {
        return npcTemplate.shortDesc;
      }
      if (isTailor && isAtTailor && npcState.current_task === 'tailoring') {
        return npcTemplate.shortDesc;
      }
      if (isInnkeeper && isAtInn) {
        return npcTemplate.shortDesc;
      }
    }

    // Generate contextual descriptions for NPCs in places they don't "belong"
    // Based on the room they're in and what activity brought them there

    // At the inn (socializing, eating, drinking)
    if (isAtInn) {
      const innActivities = [
        `${npcName} sits at a table, nursing a mug of ale.`,
        `${npcName} chats quietly with another patron at the bar.`,
        `${npcName} leans against the wall, watching the room with tired eyes.`,
        `${npcName} enjoys a bowl of stew, taking a well-earned break.`,
        `${npcName} sits alone, staring into a half-empty cup.`,
        `${npcName} laughs at something another villager said.`,
        `${npcName} rests ${pronoun} feet by the fire, looking content.`,
      ];
      // Pick consistently based on NPC id so description doesn't change randomly
      return innActivities[npcTemplate.id % innActivities.length];
    }

    // At the market (shopping, browsing)
    if (isAtMarket) {
      const marketActivities = [
        `${npcName} browses the stalls, examining goods.`,
        `${npcName} haggles with a vendor over prices.`,
        `${npcName} carries a basket of purchased goods.`,
        `${npcName} stands near a stall, looking thoughtful.`,
        `${npcName} walks between the stalls, shopping for supplies.`,
      ];
      return marketActivities[npcTemplate.id % marketActivities.length];
    }

    // At the village square (gathering, watching, socializing)
    if (isAtVillageSquare) {
      const squareActivities = [
        `${npcName} sits on the fountain edge, resting.`,
        `${npcName} watches the comings and goings in the square.`,
        `${npcName} talks with neighbors near the notice board.`,
        `${npcName} crosses the square, going about ${pronoun} business.`,
        `${npcName} pauses to listen to the town crier.`,
      ];
      return squareActivities[npcTemplate.id % squareActivities.length];
    }

    // At the bakery (buying bread)
    if (isAtBakery && !isBaker) {
      const bakeryActivities = [
        `${npcName} waits for fresh bread, sniffing the air appreciatively.`,
        `${npcName} counts coins for a purchase.`,
        `${npcName} chats with the baker while waiting.`,
      ];
      return bakeryActivities[npcTemplate.id % bakeryActivities.length];
    }

    // At the farmlands (helping, visiting)
    if (isAtFarmlands && !isFarmer) {
      const farmActivities = [
        `${npcName} watches the farmers work from the field's edge.`,
        `${npcName} stops to chat with someone working the fields.`,
        `${npcName} walks along the path between the fields.`,
      ];
      return farmActivities[npcTemplate.id % farmActivities.length];
    }

    // Default: if we can't determine context, check their current task
    if (npcState.current_task) {
      const taskDescriptions: Record<string, string> = {
        'socialize': `${npcName} is here, relaxing and socializing.`,
        'socializing': `${npcName} is here, relaxing and socializing.`,
        'eat': `${npcName} is here, having a meal.`,
        'eating': `${npcName} is here, having a meal.`,
        'rest': `${npcName} sits nearby, resting.`,
        'resting': `${npcName} sits nearby, resting.`,
        'sleep': `${npcName} is sleeping soundly.`,
        'sleeping': `${npcName} is sleeping soundly.`,
        'wake': `${npcName} is just waking up.`,
        'wander': `${npcName} passes through, going about ${pronoun} day.`,
        'idle': `${npcName} is here.`,
      };
      if (taskDescriptions[npcState.current_task]) {
        return taskDescriptions[npcState.current_task];
      }
    }

    // Ultimate fallback: use shortDesc
    return npcTemplate.shortDesc;
  }

  // Get all room IDs
  getAllRoomIds(): string[] {
    return Array.from(this.rooms.keys());
  }

  // Get room count
  getRoomCount(): number {
    return this.rooms.size;
  }
}

export const worldManager = new WorldManager();
export default worldManager;
