// Item-related types for Llama Picchu MUD

import type { EquipmentSlot, PlayerStats } from './player';

export type ItemType =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'accessory'
  | 'consumable'
  | 'food'
  | 'drink'
  | 'material'
  | 'quest'
  | 'container'
  | 'key'
  | 'currency'
  | 'tool';

export type WeaponType =
  | 'hoof'      // Unarmed-style
  | 'horn'      // Piercing
  | 'staff'     // Magical
  | 'charm'     // Spellcasting focus
  | 'sling'     // Ranged
  | 'headbutt'; // Blunt

export type ArmorType =
  | 'cloth'
  | 'leather'
  | 'wool'      // Special llama armor
  | 'metal'
  | 'sacred';   // Magical protection

export interface ItemStats {
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  hp?: number;
  mana?: number;
  stamina?: number;
}

export interface WeaponStats {
  minDamage: number;
  maxDamage: number;
  speed: number;      // Attacks per round (1-3)
  critChance: number; // Percentage 0-100
  critMultiplier: number; // Usually 1.5 or 2.0
}

export interface ArmorStats {
  defense: number;
  magicDefense: number;
}

export interface ConsumableEffect {
  type: 'heal_hp' | 'heal_mana' | 'heal_stamina' | 'restore_hunger' | 'restore_thirst' | 'buff' | 'cure';
  amount: number;
  duration?: number; // For buffs, in seconds
  buffStat?: keyof PlayerStats;
}

// Tool types for the crafting/resource system
export type ToolType =
  | 'shovel'    // For digging
  | 'axe'       // For chopping wood
  | 'pickaxe'   // For mining
  | 'hoe'       // For farming
  | 'hammer'    // For building
  | 'fishing';  // For fishing

export interface ItemTemplate {
  id: number;
  name: string;
  shortDesc: string;
  longDesc: string;
  type: ItemType;
  slot?: EquipmentSlot;
  weaponType?: WeaponType;
  armorType?: ArmorType;
  toolType?: ToolType;    // For tool items
  weaponStats?: WeaponStats;
  armorStats?: ArmorStats;
  statBonuses?: ItemStats;
  consumableEffects?: ConsumableEffect[];
  value: number;          // Base gold value
  weight: number;         // Affects inventory capacity
  levelRequired: number;
  classRequired?: number; // Class ID or null for any
  stackable: boolean;
  maxStack: number;
  questItem: boolean;     // Cannot be dropped/sold
  keywords: string[];     // For command parsing ("sword", "blade", etc.)
}

export interface LootTableEntry {
  itemTemplateId: number;
  chance: number;      // Percentage 0-100
  minQuantity: number;
  maxQuantity: number;
}

export interface LootTable {
  id: number;
  name: string;
  entries: LootTableEntry[];
  goldMin: number;
  goldMax: number;
}
