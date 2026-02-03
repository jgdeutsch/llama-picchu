// Quest Definitions for Llama Picchu MUD
import type { QuestDefinition } from '../../shared/types';

export const questDefinitions: QuestDefinition[] = [
  {
    id: 1,
    name: 'Cleanse the Spirits',
    description: 'The restless ancestor spirits in the Royal Tomb must be calmed. Defeat them to grant them peace.',
    levelRequired: 4,
    prerequisites: [],
    objectives: [
      {
        id: 'kill_spirits',
        type: 'kill',
        target: 2, // Restless Ancestor NPC ID
        quantity: 5,
        description: 'Defeat restless ancestor spirits (0/5)',
      },
    ],
    rewards: {
      experience: 200,
      gold: 50,
      items: [{ itemTemplateId: 63, quantity: 2 }], // Healing potions
    },
    repeatable: true,
    timeLimit: undefined,
  },
  {
    id: 2,
    name: 'Gather Sacred Herbs',
    description: 'Elder Qhapaq needs ingredients for a purification ritual. Gather coca leaves and huayruro seeds.',
    levelRequired: 1,
    prerequisites: [],
    objectives: [
      {
        id: 'collect_coca',
        type: 'collect',
        target: 60, // Coca leaf item ID
        quantity: 10,
        description: 'Collect coca leaves (0/10)',
      },
      {
        id: 'collect_seeds',
        type: 'collect',
        target: 82, // Huayruro seed item ID
        quantity: 5,
        description: 'Collect huayruro seeds (0/5)',
      },
    ],
    rewards: {
      experience: 75,
      gold: 25,
    },
    repeatable: true,
    timeLimit: undefined,
  },
  {
    id: 3,
    name: 'The Corrupted Puma',
    description: 'A puma spirit has been corrupted by dark forces. Track it down on the Mountain Path and defeat it.',
    levelRequired: 3,
    prerequisites: [],
    objectives: [
      {
        id: 'explore_path',
        type: 'explore',
        target: 'path', // Room ID
        quantity: 1,
        description: 'Find the Mountain Path (0/1)',
      },
      {
        id: 'kill_puma',
        type: 'kill',
        target: 1, // Corrupted Puma NPC ID
        quantity: 1,
        description: 'Defeat the corrupted puma spirit (0/1)',
      },
    ],
    rewards: {
      experience: 150,
      gold: 40,
      items: [{ itemTemplateId: 83, quantity: 1 }], // Puma fang
    },
    repeatable: true,
    timeLimit: undefined,
  },
  {
    id: 4,
    name: 'Temple Restoration',
    description: 'The Temple of the Sun needs repairs. Gather materials from defeated enemies and dangerous locations.',
    levelRequired: 8,
    prerequisites: [1, 3], // Must complete Cleanse the Spirits and The Corrupted Puma first
    objectives: [
      {
        id: 'collect_gold',
        type: 'collect',
        target: 80, // Gold nugget item ID
        quantity: 5,
        description: 'Collect gold nuggets (0/5)',
      },
      {
        id: 'collect_feathers',
        type: 'collect',
        target: 81, // Condor feather item ID
        quantity: 3,
        description: 'Collect condor feathers (0/3)',
      },
      {
        id: 'kill_guardians',
        type: 'kill',
        target: 4, // Stone Guardian NPC ID
        quantity: 2,
        description: 'Defeat stone guardians (0/2)',
      },
    ],
    rewards: {
      experience: 400,
      gold: 150,
      items: [
        { itemTemplateId: 40, quantity: 1 }, // Golden earring
      ],
    },
    repeatable: false,
    timeLimit: undefined,
  },
  {
    id: 5,
    name: 'The Golden Llama',
    description: 'Legends speak of a Golden Llama hidden in the depths of Machu Picchu. Find this legendary artifact!',
    levelRequired: 15,
    prerequisites: [4], // Must complete Temple Restoration
    objectives: [
      {
        id: 'defeat_boss',
        type: 'kill',
        target: 5, // Corrupted High Priest
        quantity: 1,
        description: 'Defeat the corrupted high priest (0/1)',
      },
      {
        id: 'find_secret',
        type: 'explore',
        target: 'secret_room', // Room ID
        quantity: 1,
        description: 'Discover the hidden chamber (0/1)',
      },
      {
        id: 'collect_llama',
        type: 'collect',
        target: 100, // Golden Llama item ID
        quantity: 1,
        description: 'Obtain the Golden Llama figurine (0/1)',
      },
    ],
    rewards: {
      experience: 1000,
      gold: 500,
      items: [
        { itemTemplateId: 4, quantity: 1 }, // Sun Staff (legendary)
      ],
    },
    repeatable: false,
    timeLimit: undefined,
  },
  {
    id: 6,
    name: 'Shadow Condor Hunt',
    description: 'Shadow condors threaten travelers on the mountain paths. Eliminate this threat.',
    levelRequired: 6,
    prerequisites: [],
    objectives: [
      {
        id: 'kill_condors',
        type: 'kill',
        target: 3, // Shadow Condor NPC ID
        quantity: 3,
        description: 'Defeat shadow condors (0/3)',
      },
    ],
    rewards: {
      experience: 250,
      gold: 75,
      items: [{ itemTemplateId: 81, quantity: 5 }], // Condor feathers
    },
    repeatable: true,
    timeLimit: undefined,
  },
  {
    id: 7,
    name: 'Warrior\'s Trial',
    description: 'Prove your worth as a Condor Warrior by defeating powerful enemies.',
    levelRequired: 10,
    classRequired: 3, // Condor Warrior only
    prerequisites: [],
    objectives: [
      {
        id: 'kill_guardians',
        type: 'kill',
        target: 4, // Stone Guardian
        quantity: 3,
        description: 'Defeat stone guardians (0/3)',
      },
      {
        id: 'explore_valley',
        type: 'explore',
        target: 'hidden_valley',
        quantity: 1,
        description: 'Reach the Hidden Valley (0/1)',
      },
    ],
    rewards: {
      experience: 500,
      gold: 200,
      items: [{ itemTemplateId: 23, quantity: 1 }], // Bronze breastplate
    },
    repeatable: false,
    timeLimit: undefined,
  },
  {
    id: 8,
    name: 'Spirit Walker',
    description: 'Commune with the ancestor spirits and learn their secrets.',
    levelRequired: 10,
    classRequired: 6, // Spirit Caller only
    prerequisites: [],
    objectives: [
      {
        id: 'explore_hall',
        type: 'explore',
        target: 'ancestor_hall',
        quantity: 1,
        description: 'Visit the Hall of Ancestors (0/1)',
      },
      {
        id: 'explore_ruins',
        type: 'explore',
        target: 'haunted_ruins',
        quantity: 1,
        description: 'Explore the Haunted Ruins (0/1)',
      },
      {
        id: 'kill_spirits',
        type: 'kill',
        target: 2, // Restless Ancestor
        quantity: 10,
        description: 'Release ancestor spirits (0/10)',
      },
    ],
    rewards: {
      experience: 600,
      gold: 150,
      items: [{ itemTemplateId: 41, quantity: 1 }], // Quipu talisman
    },
    repeatable: false,
    timeLimit: undefined,
  },
  {
    id: 9,
    name: 'Market Run',
    description: 'Help the merchants by delivering goods around Machu Picchu.',
    levelRequired: 2,
    prerequisites: [],
    objectives: [
      {
        id: 'explore_market',
        type: 'explore',
        target: 'marketplace',
        quantity: 1,
        description: 'Visit the Marketplace (0/1)',
      },
      {
        id: 'explore_inn',
        type: 'explore',
        target: 'inn',
        quantity: 1,
        description: 'Visit the Inn (0/1)',
      },
      {
        id: 'explore_smith',
        type: 'explore',
        target: 'weapon_shop',
        quantity: 1,
        description: 'Visit the Weapon Shop (0/1)',
      },
    ],
    rewards: {
      experience: 50,
      gold: 30,
    },
    repeatable: false,
    timeLimit: undefined,
  },
  {
    id: 10,
    name: 'Alchemist\'s Request',
    description: 'The alchemist needs rare ingredients for her experiments.',
    levelRequired: 5,
    prerequisites: [],
    objectives: [
      {
        id: 'collect_fangs',
        type: 'collect',
        target: 83, // Puma fang
        quantity: 3,
        description: 'Collect puma fangs (0/3)',
      },
      {
        id: 'collect_seeds',
        type: 'collect',
        target: 82, // Huayruro seeds
        quantity: 10,
        description: 'Collect huayruro seeds (0/10)',
      },
    ],
    rewards: {
      experience: 175,
      gold: 60,
      items: [
        { itemTemplateId: 63, quantity: 3 }, // Healing potions
        { itemTemplateId: 64, quantity: 3 }, // Mana crystals
      ],
    },
    repeatable: true,
    timeLimit: undefined,
  },
];

// Helper to get quest by ID
export function getQuestById(id: number): QuestDefinition | undefined {
  return questDefinitions.find((q) => q.id === id);
}

// Get quests available at a certain level
export function getQuestsForLevel(level: number): QuestDefinition[] {
  return questDefinitions.filter((q) => q.levelRequired <= level);
}
