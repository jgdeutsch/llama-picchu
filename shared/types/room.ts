// Room-related types for Llama Picchu MUD

export type Direction = 'north' | 'south' | 'east' | 'west' | 'up' | 'down';
export type DirectionShort = 'n' | 's' | 'e' | 'w' | 'u' | 'd';

export const DIRECTION_MAP: Record<DirectionShort, Direction> = {
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
  u: 'up',
  d: 'down',
};

export const DIRECTION_OPPOSITES: Record<Direction, Direction> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
  up: 'down',
  down: 'up',
};

export interface RoomExit {
  direction: Direction;
  targetRoom: string;
  locked?: boolean;
  keyItemId?: number;
  hiddenUntil?: string; // Flag name that must be set
}

export interface RoomFlags {
  safe: boolean;        // No combat allowed
  restRoom: boolean;    // Can rest here for enhanced regen
  restCost: number;     // Gold per hour to rest
  noMagic: boolean;     // Spells cannot be cast
  dark: boolean;        // Requires light source
  underwater: boolean;  // Requires special equipment
  noRecall: boolean;    // Cannot recall from here
}

export interface RoomFeature {
  keywords: string[];  // Words that can be used to look at this feature
  description: string; // What the player sees when looking at it
}

export interface RoomTemplate {
  id: string;
  name: string;
  description: string;
  area: string;
  exits: RoomExit[];
  flags: Partial<RoomFlags>;
  defaultItems: { itemTemplateId: number; quantity: number; respawnMinutes: number }[];
  defaultNpcs: { npcTemplateId: number; respawnMinutes: number }[];
  features?: RoomFeature[]; // Optional lookable features mentioned in the description
}

export interface RoomState {
  id: string;
  template: RoomTemplate;
  players: number[];          // Player IDs currently in room
  items: RoomItemInstance[];  // Items on ground
  npcs: RoomNpcInstance[];    // NPCs in room
}

export interface RoomItemInstance {
  id: number;
  roomId: string;
  itemTemplateId: number;
  quantity: number;
  respawnAt: Date | null;
}

export interface RoomNpcInstance {
  id: number;
  roomId: string;
  npcTemplateId: number;
  currentHp: number;
  respawnAt: Date | null;
  combatTarget: number | null; // Player ID if in combat
}
