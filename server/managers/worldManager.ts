// World Manager for Llama Picchu MUD
import { getDatabase, playerQueries, roomItemQueries, roomNpcQueries } from '../database';
import { connectionManager } from './connectionManager';
import { roomTemplates } from '../data/rooms';
import { itemTemplates } from '../data/items';
import { npcTemplates } from '../data/npcs';
import type { RoomTemplate, RoomState, Direction, RoomItemInstance, RoomNpcInstance } from '../../shared/types/room';
import type { ServerMessage } from '../../shared/types/websocket';

import { updatePlayerLastSeen } from './playerTracker';

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

    // NPCs in room
    if (npcs.length > 0) {
      const npcDescriptions = npcs.map((npc) => {
        const npcTemplate = npcTemplates.find((t) => t.id === npc.npcTemplateId);
        if (!npcTemplate) return null;
        return `  ${npcTemplate.shortDesc}`;
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
