// NPC-related types for Llama Picchu MUD

import type { PlayerStats } from './player';
import type { LootTable } from './item';

export type NpcType =
  | 'enemy'
  | 'shopkeeper'
  | 'questgiver'
  | 'guildmaster'
  | 'trainer'
  | 'banker'
  | 'innkeeper'
  | 'ambient'; // Non-interactive flavor NPCs

export type NpcBehavior =
  | 'stationary'    // Never moves
  | 'wander'        // Moves randomly within area
  | 'patrol'        // Follows set path
  | 'aggressive'    // Attacks players on sight
  | 'defensive'     // Only attacks if attacked first
  | 'cowardly';     // Flees when low HP

export interface NpcDialogue {
  greeting: string;
  farewell: string;
  busy?: string;      // When shopkeeper has no items
  questOffer?: string;
  questComplete?: string;
  keywords: Record<string, string>; // keyword -> response
}

export interface ShopInventory {
  itemTemplateId: number;
  stock: number;        // -1 for infinite
  buyPriceMultiplier: number;  // Multiply item value
  sellPriceMultiplier: number; // Multiply item value (usually 0.5)
}

export interface NpcTemplate {
  id: number;
  name: string;
  shortDesc: string;
  longDesc: string;
  type: NpcType;
  level: number;
  stats: PlayerStats;
  maxHp: number;
  maxMana: number;
  behavior: NpcBehavior;
  aggroRange: number;     // Rooms away to detect players (usually 0-1)

  // Combat
  attackMessage: string;  // e.g., "The puma slashes at you with razor claws!"
  deathMessage: string;   // e.g., "The puma spirit dissipates into mist."
  experienceValue: number;
  lootTable?: LootTable;

  // Non-combat roles
  dialogue?: NpcDialogue;
  shopInventory?: ShopInventory[];
  trainableSkills?: number[]; // Skill IDs this NPC can teach
  questIds?: number[];        // Quests this NPC offers

  // Respawn
  respawnSeconds: number;

  keywords: string[];     // For targeting ("puma", "spirit", "cat")
}

export interface NpcInstance {
  id: number;
  templateId: number;
  roomId: string;
  currentHp: number;
  currentMana: number;
  combatTarget: number | null;  // Player ID
  respawnAt: Date | null;
  lastAction: Date;
  patrolIndex?: number;         // For patrol behavior
}

// Combat state for active fights
export interface CombatParticipant {
  type: 'player' | 'npc';
  id: number;
  initiative: number;
}

export interface CombatInstance {
  id: string;
  roomId: string;
  participants: CombatParticipant[];
  round: number;
  startedAt: Date;
  lastRoundAt: Date;
}
