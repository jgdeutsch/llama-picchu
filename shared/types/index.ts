// Shared types index for Llama Picchu MUD

export * from './player';
export * from './room';
export * from './item';
export * from './npc';
export * from './combat';
export * from './websocket';

// Skills and spells types
export interface SkillDefinition {
  id: number;
  name: string;
  slug: string;
  description: string;
  type: 'passive' | 'active' | 'spell';
  classRequired?: number;
  levelRequired: number;
  manaCost: number;
  staminaCost: number;
  cooldownSeconds: number;
  targetType: 'self' | 'single' | 'room' | 'group';
  effect: SkillEffect;
}

export interface SkillEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'utility';
  basePower: number;
  scalingStat?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
  duration?: number;
  affectedStat?: string;
}

// Quest types
export interface QuestDefinition {
  id: number;
  name: string;
  description: string;
  levelRequired: number;
  classRequired?: number;
  prerequisites: number[]; // Quest IDs that must be completed first
  objectives: QuestObjective[];
  rewards: QuestReward;
  repeatable: boolean;
  timeLimit?: number; // In minutes, optional
}

export interface QuestObjective {
  id: string;
  type: 'kill' | 'collect' | 'deliver' | 'explore' | 'talk';
  target: string | number; // NPC ID, item ID, or room ID
  quantity: number;
  description: string;
}

export interface QuestReward {
  experience: number;
  gold: number;
  items?: { itemTemplateId: number; quantity: number }[];
  reputation?: { faction: string; amount: number };
}

// Game tick timing constants
export const TICK_RATE_MS = 1000;           // Main game loop tick
export const COMBAT_TICK_MS = 3000;         // Combat round duration
export const REGEN_TICK_MS = 10000;         // HP/Mana/Stamina regen
export const HUNGER_TICK_MS = 300000;       // 5 minutes - hunger/thirst drain
export const NPC_AI_TICK_MS = 5000;         // NPC behavior tick
export const SAVE_TICK_MS = 60000;          // Auto-save interval
