// Player-related types for Llama Picchu MUD

export interface PlayerStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface PlayerResources {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
}

export interface PlayerVitals {
  hunger: number;  // 0-100, drains over time
  thirst: number;  // 0-100, drains over time
}

export interface PlayerEquipment {
  head: number | null;
  neck: number | null;
  body: number | null;
  back: number | null;
  legs: number | null;
  feet: number | null;
  hands: number | null;
  mainHand: number | null;
  offHand: number | null;
  ring1: number | null;
  ring2: number | null;
}

export type EquipmentSlot = keyof PlayerEquipment;

export interface Player {
  id: number;
  accountId: number;
  name: string;
  classId: number;
  level: number;
  experience: number;
  stats: PlayerStats;
  resources: PlayerResources;
  vitals: PlayerVitals;
  equipment: PlayerEquipment;
  gold: number;
  currentRoom: string;
  isResting: boolean;
  isFighting: boolean;
  createdAt: Date;
  lastLogin: Date;
}

export interface PlayerInventoryItem {
  id: number;
  playerId: number;
  itemTemplateId: number;
  quantity: number;
}

export interface PlayerSkill {
  playerId: number;
  skillId: number;
  proficiency: number; // 0-100
}

export interface PlayerQuest {
  playerId: number;
  questId: number;
  status: 'active' | 'completed' | 'failed';
  progress: Record<string, number>;
  startedAt: Date;
  completedAt: Date | null;
}

export interface Account {
  id: number;
  username: string;
  passwordHash: string;
  email: string;
  createdAt: Date;
  lastLogin: Date;
  isAdmin: boolean;
}

export type PlayerClass =
  | 'sun_priest'
  | 'shadow_stalker'
  | 'condor_warrior'
  | 'earth_shaman'
  | 'wind_runner'
  | 'spirit_caller';

export interface ClassDefinition {
  id: number;
  name: string;
  slug: PlayerClass;
  description: string;
  primaryStat: keyof PlayerStats;
  secondaryStat: keyof PlayerStats;
  role: string;
  guildRoom: string;
  startingSkills: string[];
  baseHp: number;
  baseMana: number;
  baseStamina: number;
  hpPerLevel: number;
  manaPerLevel: number;
  staminaPerLevel: number;
}
