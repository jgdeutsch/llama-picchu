// Llama Classes for Llama Picchu MUD
import type { ClassDefinition, PlayerClass } from '../../shared/types/player';

export const classDefinitions: ClassDefinition[] = [
  {
    id: 1,
    name: 'Sun Priest',
    slug: 'sun_priest',
    description: 'Devoted servants of Inti, the Sun God. Sun Priests channel divine light to heal allies and smite enemies with radiant power.',
    primaryStat: 'wis',
    secondaryStat: 'int',
    role: 'Healer/Buffer',
    guildRoom: 'temple_sun',
    startingSkills: ['minor_heal', 'bless', 'light'],
    baseHp: 80,
    baseMana: 120,
    baseStamina: 60,
    hpPerLevel: 6,
    manaPerLevel: 12,
    staminaPerLevel: 4,
  },
  {
    id: 2,
    name: 'Shadow Stalker',
    slug: 'shadow_stalker',
    description: 'Masters of stealth and subtlety. Shadow Stalkers strike from the darkness, dealing devastating blows to unsuspecting foes.',
    primaryStat: 'dex',
    secondaryStat: 'int',
    role: 'Rogue/Stealth',
    guildRoom: 'shadow_guild',
    startingSkills: ['sneak', 'backstab', 'pick_lock'],
    baseHp: 90,
    baseMana: 60,
    baseStamina: 100,
    hpPerLevel: 7,
    manaPerLevel: 5,
    staminaPerLevel: 10,
  },
  {
    id: 3,
    name: 'Condor Warrior',
    slug: 'condor_warrior',
    description: 'Fierce warriors blessed by the spirit of the condor. They lead charges into battle, protecting allies with their powerful presence.',
    primaryStat: 'str',
    secondaryStat: 'con',
    role: 'Tank/Fighter',
    guildRoom: 'warrior_barracks',
    startingSkills: ['bash', 'taunt', 'block'],
    baseHp: 120,
    baseMana: 40,
    baseStamina: 100,
    hpPerLevel: 12,
    manaPerLevel: 3,
    staminaPerLevel: 8,
  },
  {
    id: 4,
    name: 'Earth Shaman',
    slug: 'earth_shaman',
    description: 'Keepers of the Pachamama, the Earth Mother. Earth Shamans commune with nature, calling upon roots and stone for defense and healing.',
    primaryStat: 'wis',
    secondaryStat: 'con',
    role: 'Druid/Nature',
    guildRoom: 'earth_shrine',
    startingSkills: ['earth_shield', 'entangle', 'nature_healing'],
    baseHp: 100,
    baseMana: 100,
    baseStamina: 80,
    hpPerLevel: 9,
    manaPerLevel: 10,
    staminaPerLevel: 6,
  },
  {
    id: 5,
    name: 'Wind Runner',
    slug: 'wind_runner',
    description: 'Swift messengers of the mountain winds. Wind Runners strike with blinding speed, overwhelming enemies before they can react.',
    primaryStat: 'dex',
    secondaryStat: 'str',
    role: 'Speed/DPS',
    guildRoom: 'messenger_post',
    startingSkills: ['quick_strike', 'dodge', 'sprint'],
    baseHp: 85,
    baseMana: 50,
    baseStamina: 120,
    hpPerLevel: 7,
    manaPerLevel: 4,
    staminaPerLevel: 12,
  },
  {
    id: 6,
    name: 'Spirit Caller',
    slug: 'spirit_caller',
    description: 'Mystics who commune with ancestral spirits. Spirit Callers summon the power of the dead to aid the living with arcane might.',
    primaryStat: 'int',
    secondaryStat: 'wis',
    role: 'Mage/Summoner',
    guildRoom: 'ancestor_hall',
    startingSkills: ['spirit_bolt', 'summon_ancestor', 'mana_shield'],
    baseHp: 70,
    baseMana: 140,
    baseStamina: 50,
    hpPerLevel: 5,
    manaPerLevel: 14,
    staminaPerLevel: 3,
  },
];

// Helper to get class by ID
export function getClassById(id: number): ClassDefinition | undefined {
  return classDefinitions.find((c) => c.id === id);
}

// Helper to get class by slug
export function getClassBySlug(slug: PlayerClass): ClassDefinition | undefined {
  return classDefinitions.find((c) => c.slug === slug);
}

// Get all classes for display
export function getClassList(): { id: number; name: string; role: string; description: string }[] {
  return classDefinitions.map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    description: c.description,
  }));
}
