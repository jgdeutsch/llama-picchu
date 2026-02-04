// NPC Wants/Needs for FROBARK MUD
// What NPCs desire from players - creates exchange opportunities

export interface NpcWant {
  npcTemplateId: number;
  wantType: 'item' | 'service' | 'information' | 'craft';
  itemId?: number;           // Item template ID if want_type is 'item'
  description: string;       // Human-readable description
  dialogueHint: string;      // What NPC says when asked about it
  quantityNeeded: number;
  importance: number;        // 1-10
  rewardType: 'gold' | 'item' | 'service' | 'reputation';
  rewardAmount: number;      // Gold or reputation boost
  rewardItemId?: number;     // Item given in return
  rewardDescription: string;
  isRepeatable: boolean;
  cooldownHours: number;
}

export const npcWants: NpcWant[] = [
  // === Farmer Rutherford (10) - Needs farm supplies ===
  {
    npcTemplateId: 10,
    wantType: 'item',
    itemId: 52, // Rich Soil
    description: 'Rutherford needs good soil for his crops',
    dialogueHint: "The soil here's been worked to death. If you find some rich dark earth from the forest, I'd pay well for it.",
    quantityNeeded: 5,
    importance: 7,
    rewardType: 'gold',
    rewardAmount: 15,
    rewardDescription: "I'll pay 15 gold for good soil.",
    isRepeatable: true,
    cooldownHours: 24,
  },
  {
    npcTemplateId: 10,
    wantType: 'item',
    itemId: 54, // Earthworm
    description: 'Rutherford wants earthworms for his garden',
    dialogueHint: "Earthworms! They're gold for the soil. Dig some up and I'll make it worth your while.",
    quantityNeeded: 3,
    importance: 5,
    rewardType: 'gold',
    rewardAmount: 10,
    rewardDescription: "Worms mean better crops. Here's 10 gold.",
    isRepeatable: true,
    cooldownHours: 12,
  },

  // === Healer Esther (121) - Needs herbs and materials ===
  {
    npcTemplateId: 121,
    wantType: 'item',
    itemId: 67, // Glowing Root
    description: 'Esther needs rare glowing roots for medicine',
    dialogueHint: "There's a root that glows faintly - grows in dark places. I need it for strong healing draughts. Bring me one and I'll teach you something useful.",
    quantityNeeded: 1,
    importance: 9,
    rewardType: 'item',
    rewardAmount: 0,
    rewardItemId: 61, // Healing Potion
    rewardDescription: "This root is precious. Take this healing potion - and my thanks.",
    isRepeatable: true,
    cooldownHours: 48,
  },
  {
    npcTemplateId: 121,
    wantType: 'item',
    itemId: 60, // Healing herbs (basic)
    description: 'Esther always needs common healing herbs',
    dialogueHint: "I'm always running low on basic herbs. Bring me some and I'll pay fair price - or trade you something useful.",
    quantityNeeded: 3,
    importance: 6,
    rewardType: 'gold',
    rewardAmount: 20,
    rewardDescription: "Good herbs. Here's your payment.",
    isRepeatable: true,
    cooldownHours: 8,
  },

  // === Blacksmith Gordo (115) - Needs metal and fuel ===
  {
    npcTemplateId: 115,
    wantType: 'item',
    itemId: 73, // Iron Ore
    description: 'Gordo needs iron ore for smithing',
    dialogueHint: "Can't make tools without iron. The mines are dangerous but if you bring me ore, I'll forge something for you.",
    quantityNeeded: 3,
    importance: 8,
    rewardType: 'item',
    rewardAmount: 0,
    rewardItemId: 80, // Basic tool - shovel
    rewardDescription: "Good ore! Here - take this shovel. Made it myself.",
    isRepeatable: true,
    cooldownHours: 72,
  },
  {
    npcTemplateId: 115,
    wantType: 'item',
    itemId: 74, // Coal
    description: 'Gordo needs coal for the forge',
    dialogueHint: "The forge eats coal like a hungry beast. Bring me coal and I'll pay you - or knock some gold off your next purchase.",
    quantityNeeded: 5,
    importance: 6,
    rewardType: 'gold',
    rewardAmount: 15,
    rewardDescription: "That'll keep the forge burning. Here's 15 gold.",
    isRepeatable: true,
    cooldownHours: 24,
  },

  // === Baker Possum (113) - Needs ingredients ===
  {
    npcTemplateId: 113,
    wantType: 'item',
    itemId: 65, // Firewood
    description: 'Possum needs firewood for the oven',
    dialogueHint: "The oven's always hungry for wood. Bring me some dry firewood and I'll give you fresh bread - best deal in the village.",
    quantityNeeded: 3,
    importance: 7,
    rewardType: 'item',
    rewardAmount: 0,
    rewardItemId: 41, // Bread
    rewardDescription: "Perfect! Have a fresh loaf, on the house.",
    isRepeatable: true,
    cooldownHours: 8,
  },

  // === Tailor Lydia (126) - Needs fabric materials ===
  {
    npcTemplateId: 126,
    wantType: 'item',
    itemId: 46, // Condor Feather
    description: 'Lydia wants condor feathers for fine garments',
    dialogueHint: "Condor feathers make beautiful trim. Bring me some and I might make you something... special.",
    quantityNeeded: 2,
    importance: 7,
    rewardType: 'item',
    rewardAmount: 0,
    rewardItemId: 20, // Woven Wool Tunic
    rewardDescription: "Beautiful feathers. Here - a tunic I made. It'll keep you warm.",
    isRepeatable: true,
    cooldownHours: 48,
  },
  {
    npcTemplateId: 126,
    wantType: 'item',
    itemId: 69, // Flexible Branch (for buttons/toggles)
    description: 'Lydia needs flexible branches for fastenings',
    dialogueHint: "I need supple branches for buttons and toggles. The right wood bends without breaking.",
    quantityNeeded: 3,
    importance: 4,
    rewardType: 'gold',
    rewardAmount: 12,
    rewardDescription: "These will do nicely. Here's your payment.",
    isRepeatable: true,
    cooldownHours: 24,
  },

  // === Fisherman Harpua (120) - Needs bait ===
  {
    npcTemplateId: 120,
    wantType: 'item',
    itemId: 54, // Earthworm
    description: 'Harpua always needs fishing bait',
    dialogueHint: "Fish like worms. I like fish. You see where this is going? Bring me worms, I'll share some of my catch.",
    quantityNeeded: 5,
    importance: 6,
    rewardType: 'item',
    rewardAmount: 0,
    rewardItemId: 63, // River Trout
    rewardDescription: "Good bait! Here - take this trout. Caught it this morning.",
    isRepeatable: true,
    cooldownHours: 12,
  },

  // === Fee (6) - Loves shiny things ===
  {
    npcTemplateId: 6,
    wantType: 'item',
    itemId: 75, // Crystal
    description: 'Fee is obsessed with shiny crystals',
    dialogueHint: "SHINY! You have shiny? Fee loves shiny things! Bring Fee something sparkly and Fee will... Fee will give you something VERY special!",
    quantityNeeded: 1,
    importance: 10,
    rewardType: 'item',
    rewardAmount: 0,
    rewardItemId: 62, // Mana Crystal
    rewardDescription: "OOOOH! So pretty! Fee happy! Here, take this - Fee found it but you deserve it more!",
    isRepeatable: true,
    cooldownHours: 72,
  },
  {
    npcTemplateId: 6,
    wantType: 'item',
    itemId: 45, // Raw Gold Nugget
    description: 'Fee wants gold nuggets',
    dialogueHint: "Gold! Gold is the SHINIEST! Fee would do ANYTHING for gold nugget!",
    quantityNeeded: 1,
    importance: 9,
    rewardType: 'reputation',
    rewardAmount: 30,
    rewardDescription: "Fee LOVES you! You are Fee's BEST friend now!",
    isRepeatable: true,
    cooldownHours: 48,
  },

  // === Elena (116) - Wants books and stories ===
  {
    npcTemplateId: 116,
    wantType: 'item',
    itemId: 68, // Ancient Artifact (she's curious)
    description: 'Elena collects ancient artifacts and curiosities',
    dialogueHint: "If you find anything old - artifacts, relics, things from before Wilson's time - bring them to me. I collect stories, and every object has one.",
    quantityNeeded: 1,
    importance: 8,
    rewardType: 'gold',
    rewardAmount: 50,
    rewardDescription: "This is wonderful! The markings... I must study this. Here - you've earned this.",
    isRepeatable: true,
    cooldownHours: 168, // Weekly
  },

  // === Innkeeper Antelope (114) - Needs supplies ===
  {
    npcTemplateId: 114,
    wantType: 'item',
    itemId: 65, // Firewood
    description: 'Antelope needs firewood for the inn',
    dialogueHint: "Running an inn takes mountains of firewood. Bring me some and I'll put gold in your pocket - or ale in your belly.",
    quantityNeeded: 5,
    importance: 6,
    rewardType: 'gold',
    rewardAmount: 20,
    rewardDescription: "That'll keep the common room warm. Here's your coin.",
    isRepeatable: true,
    cooldownHours: 24,
  },
  {
    npcTemplateId: 114,
    wantType: 'item',
    itemId: 63, // River Trout
    description: 'Antelope wants fresh fish for the kitchen',
    dialogueHint: "Fresh fish makes the best stew. Bring me some from the river and dinner's on me.",
    quantityNeeded: 2,
    importance: 5,
    rewardType: 'item',
    rewardAmount: 0,
    rewardItemId: 40, // Stew
    rewardDescription: "Perfect! Here - have a bowl of my famous stew.",
    isRepeatable: true,
    cooldownHours: 12,
  },

  // === Vegetable Vendor Marge (123) - Wants farm products ===
  {
    npcTemplateId: 123,
    wantType: 'item',
    itemId: 52, // Rich Soil
    description: 'Marge wants soil for her window garden',
    dialogueHint: "Can't have a farm anymore, but I grow herbs in pots. Good soil makes all the difference.",
    quantityNeeded: 2,
    importance: 5,
    rewardType: 'item',
    rewardAmount: 0,
    rewardItemId: 42, // Vegetables
    rewardDescription: "Thank you dear. Take some vegetables - freshest I have.",
    isRepeatable: true,
    cooldownHours: 48,
  },

  // === Old Gossip Gertrude (124) - Trades for information ===
  {
    npcTemplateId: 124,
    wantType: 'information',
    description: 'Gertrude trades secrets for secrets',
    dialogueHint: "Information is the real currency, dear. Tell me something interesting and I might tell you something useful.",
    quantityNeeded: 1,
    importance: 7,
    rewardType: 'reputation',
    rewardAmount: 15,
    rewardDescription: "Now THAT'S interesting. You've got a good eye for secrets. I'll remember that.",
    isRepeatable: true,
    cooldownHours: 24,
  },

  // === Shopkeeper Stumpy (127) - Buys anything unusual ===
  {
    npcTemplateId: 127,
    wantType: 'item',
    itemId: 69, // Broken Pottery
    description: 'Stumpy collects curiosities',
    dialogueHint: "I'll buy almost anything interesting. Old pottery, strange stones, bits and bobs. One man's junk is another man's inventory!",
    quantityNeeded: 5,
    importance: 4,
    rewardType: 'gold',
    rewardAmount: 8,
    rewardDescription: "I can sell these to collectors. Here's your cut.",
    isRepeatable: true,
    cooldownHours: 24,
  },

  // === Mr. Palmer (7) - Paranoid needs ===
  {
    npcTemplateId: 7,
    wantType: 'item',
    itemId: 68, // Ancient Artifact
    description: 'Palmer seeks proof of conspiracies',
    dialogueHint: "Artifacts! Evidence! They're hiding the truth in the old things! Bring me proof and I'll... I'll make it worth your while!",
    quantityNeeded: 1,
    importance: 8,
    rewardType: 'gold',
    rewardAmount: 75,
    rewardDescription: "YES! I knew it! This proves... this proves EVERYTHING! Here, take this gold, I must study this!",
    isRepeatable: true,
    cooldownHours: 168,
  },

  // === Cook Martha (110) - Castle cook needs ingredients ===
  {
    npcTemplateId: 110,
    wantType: 'item',
    itemId: 47, // Huayruro Seed (spice)
    description: 'Martha needs exotic spices',
    dialogueHint: "Wilson wants fancy food but won't pay for fancy ingredients. Find me something special and I'll sneak you something from the kitchen.",
    quantityNeeded: 3,
    importance: 6,
    rewardType: 'item',
    rewardAmount: 0,
    rewardItemId: 40, // Stew
    rewardDescription: "These will do nicely. Here - don't tell anyone where you got this.",
    isRepeatable: true,
    cooldownHours: 48,
  },
];

// Get wants for a specific NPC
export function getNpcWants(npcTemplateId: number): NpcWant[] {
  return npcWants.filter(w => w.npcTemplateId === npcTemplateId);
}

// Get all active wants (for seeding)
export function getAllNpcWants(): NpcWant[] {
  return npcWants;
}
