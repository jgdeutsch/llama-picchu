// WebSocket message types for Llama Picchu MUD

import type { Player, PlayerResources, PlayerVitals } from './player';
import type { RoomState } from './room';
import type { CombatRoundResult, CombatState } from './combat';

// Client -> Server messages
export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'command'; command: string }
  | { type: 'ping' };

// Server -> Client messages
export type ServerMessage =
  | { type: 'auth_success'; playerId: number; playerName: string }
  | { type: 'auth_failure'; reason: string }
  | { type: 'output'; text: string; messageType: OutputType }
  | { type: 'room_update'; room: RoomState }
  | { type: 'player_update'; resources: Partial<PlayerResources>; vitals?: Partial<PlayerVitals> }
  | { type: 'combat_update'; combat: CombatState }
  | { type: 'combat_round'; result: CombatRoundResult }
  | { type: 'player_entered'; playerName: string }
  | { type: 'player_left'; playerName: string; direction?: string }
  | { type: 'chat'; channel: ChatChannel; from: string; message: string }
  | { type: 'whisper'; from: string; message: string }
  | { type: 'emote'; from: string; action: string }
  | { type: 'system'; message: string }
  | { type: 'level_up'; level: number; statPoints: number }
  | { type: 'quest_update'; questId: number; status: string; progress: Record<string, number> }
  | { type: 'inventory_update'; items: InventoryItem[] }
  | { type: 'equipment_update'; slot: string; item: EquipmentItem | null }
  | { type: 'skill_update'; skillId: number; proficiency: number }
  | { type: 'npc_action'; npcName: string; action: string }
  | { type: 'npc_say'; npcName: string; message: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };

export type OutputType =
  | 'normal'
  | 'system'
  | 'combat'
  | 'chat'
  | 'whisper'
  | 'emote'
  | 'error'
  | 'room_title'
  | 'room_desc'
  | 'room_exits'
  | 'room_items'
  | 'room_npcs'
  | 'room_players';

export type ChatChannel =
  | 'say'     // Room-only
  | 'shout'   // Area-wide
  | 'gossip'  // Server-wide
  | 'group';  // Party only

export interface InventoryItem {
  id: number;
  templateId: number;
  name: string;
  quantity: number;
  equipped: boolean;
}

export interface EquipmentItem {
  id: number;
  templateId: number;
  name: string;
  slot: string;
}

// Connection state
export interface ConnectionState {
  connected: boolean;
  authenticated: boolean;
  playerId: number | null;
  playerName: string | null;
  lastPing: number;
}

// Batch output for efficiency
export interface BatchedOutput {
  messages: ServerMessage[];
  timestamp: number;
}
