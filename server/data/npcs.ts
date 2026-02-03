// NPC Templates for Llama Picchu MUD
import type { NpcTemplate } from '../../shared/types/npc';

export const npcTemplates: NpcTemplate[] = [
  // === ENEMIES ===
  {
    id: 1,
    name: 'Corrupted Puma Spirit',
    shortDesc: 'A twisted puma spirit prowls here, its eyes glowing with malice.',
    longDesc: 'Once a noble guardian spirit, this puma has been corrupted by dark forces. Its form flickers between solid and ethereal, and its claws crackle with shadowy energy.',
    type: 'enemy',
    level: 3,
    stats: { str: 12, dex: 14, con: 10, int: 6, wis: 8, cha: 6 },
    maxHp: 45,
    maxMana: 0,
    behavior: 'aggressive',
    aggroRange: 0,
    attackMessage: 'The puma spirit slashes at you with spectral claws!',
    deathMessage: 'The corrupted puma dissolves into wisps of dark mist.',
    experienceValue: 50,
    lootTable: {
      id: 1,
      name: 'Puma Loot',
      entries: [
        { itemTemplateId: 83, chance: 40, minQuantity: 1, maxQuantity: 2 }, // Puma fang
        { itemTemplateId: 60, chance: 30, minQuantity: 1, maxQuantity: 3 }, // Coca leaf
      ],
      goldMin: 5,
      goldMax: 15,
    },
    respawnSeconds: 300,
    keywords: ['puma', 'spirit', 'corrupted', 'cat'],
  },
  {
    id: 2,
    name: 'Restless Ancestor Spirit',
    shortDesc: 'A translucent spirit drifts aimlessly, trapped between worlds.',
    longDesc: 'The spirit of an ancient Incan ancestor, unable to find peace. Its form is barely visible, a shimmer of regret and unfinished business. It attacks anything that disturbs its endless wandering.',
    type: 'enemy',
    level: 5,
    stats: { str: 8, dex: 12, con: 8, int: 14, wis: 12, cha: 10 },
    maxHp: 60,
    maxMana: 40,
    behavior: 'aggressive',
    aggroRange: 0,
    attackMessage: 'The ancestor spirit wails and reaches through you with icy fingers!',
    deathMessage: 'The ancestor spirit finally finds peace, fading away with a grateful sigh.',
    experienceValue: 75,
    lootTable: {
      id: 2,
      name: 'Spirit Loot',
      entries: [
        { itemTemplateId: 64, chance: 25, minQuantity: 1, maxQuantity: 1 }, // Mana crystal
        { itemTemplateId: 82, chance: 50, minQuantity: 2, maxQuantity: 5 }, // Huayruro seeds
      ],
      goldMin: 10,
      goldMax: 25,
    },
    respawnSeconds: 300,
    keywords: ['spirit', 'ancestor', 'ghost', 'restless'],
  },
  {
    id: 3,
    name: 'Shadow Condor',
    shortDesc: 'A massive condor made of living shadow circles overhead.',
    longDesc: 'A condor corrupted by darkness, its wingspan blocks out the light. Its feathers drip with shadow, and its cry echoes with malevolent intent. It swoops down to attack with razor-sharp talons.',
    type: 'enemy',
    level: 7,
    stats: { str: 14, dex: 16, con: 12, int: 8, wis: 10, cha: 8 },
    maxHp: 90,
    maxMana: 20,
    behavior: 'aggressive',
    aggroRange: 1,
    attackMessage: 'The shadow condor dives at you with razor talons!',
    deathMessage: 'The shadow condor shrieks and explodes into a cloud of dark feathers.',
    experienceValue: 120,
    lootTable: {
      id: 3,
      name: 'Condor Loot',
      entries: [
        { itemTemplateId: 81, chance: 60, minQuantity: 1, maxQuantity: 3 }, // Condor feather
        { itemTemplateId: 63, chance: 20, minQuantity: 1, maxQuantity: 1 }, // Healing potion
      ],
      goldMin: 15,
      goldMax: 40,
    },
    respawnSeconds: 300,
    keywords: ['condor', 'shadow', 'bird', 'dark'],
  },
  {
    id: 4,
    name: 'Stone Guardian',
    shortDesc: 'An animated stone statue stands guard, its eyes glowing.',
    longDesc: 'A massive stone warrior, carved by ancient hands and animated by forgotten magic. It moves with surprising speed despite its bulk, and its stone fists can crush bone. It protects this place against all intruders.',
    type: 'enemy',
    level: 10,
    stats: { str: 18, dex: 8, con: 20, int: 4, wis: 6, cha: 2 },
    maxHp: 150,
    maxMana: 0,
    behavior: 'defensive',
    aggroRange: 0,
    attackMessage: 'The stone guardian swings its massive fist at you!',
    deathMessage: 'The stone guardian crumbles into rubble, its magic finally exhausted.',
    experienceValue: 200,
    lootTable: {
      id: 4,
      name: 'Guardian Loot',
      entries: [
        { itemTemplateId: 80, chance: 40, minQuantity: 1, maxQuantity: 3 }, // Gold nugget
        { itemTemplateId: 63, chance: 40, minQuantity: 1, maxQuantity: 2 }, // Healing potion
      ],
      goldMin: 30,
      goldMax: 60,
    },
    respawnSeconds: 600,
    keywords: ['guardian', 'stone', 'statue', 'golem'],
  },
  {
    id: 5,
    name: 'Corrupted High Priest',
    shortDesc: 'A towering figure in tattered robes radiates dark power.',
    longDesc: 'Once a high priest of Inti, this being has been utterly corrupted by the darkness. Its eyes burn with unholy fire, and shadows coil around its form like living things. It commands terrible power and will not yield its domain easily.',
    type: 'enemy',
    level: 15,
    stats: { str: 14, dex: 12, con: 16, int: 20, wis: 18, cha: 16 },
    maxHp: 300,
    maxMana: 200,
    behavior: 'aggressive',
    aggroRange: 0,
    attackMessage: 'The corrupted priest unleashes a bolt of shadow energy!',
    deathMessage: 'The corrupted priest screams as light finally pierces the darkness, purifying its tormented soul.',
    experienceValue: 500,
    lootTable: {
      id: 5,
      name: 'Boss Loot',
      entries: [
        { itemTemplateId: 4, chance: 30, minQuantity: 1, maxQuantity: 1 }, // Sun Staff
        { itemTemplateId: 102, chance: 100, minQuantity: 1, maxQuantity: 1 }, // Temple Key
        { itemTemplateId: 80, chance: 80, minQuantity: 3, maxQuantity: 5 }, // Gold nuggets
      ],
      goldMin: 100,
      goldMax: 250,
    },
    respawnSeconds: 1800, // 30 minutes
    keywords: ['priest', 'corrupted', 'boss', 'high priest'],
  },

  // === QUEST GIVERS & FRIENDLY NPCs ===
  {
    id: 10,
    name: 'Elder Shaman Qhapaq',
    shortDesc: 'An ancient llama shaman meditates peacefully.',
    longDesc: 'Elder Qhapaq is the oldest and wisest llama in Machu Picchu. His wool is grey with age, but his eyes still sparkle with ancient knowledge. He has guided countless young llamas on their journeys and offers quests to those who seek adventure.',
    type: 'questgiver',
    level: 50,
    stats: { str: 8, dex: 8, con: 10, int: 20, wis: 25, cha: 18 },
    maxHp: 500,
    maxMana: 500,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: 'Greetings, young one. I am Elder Qhapaq. I sense great potential in you. Perhaps you seek adventure?',
      farewell: 'May the light of Inti guide your path.',
      keywords: {
        adventure: 'Ah, you seek adventure? There are many threats to our sacred city. Speak to me of "quests" if you wish to help.',
        quests: 'I have tasks for those brave enough to face danger. Ask about the "spirits" that trouble us, or the "corruption" spreading in the wilderness.',
        spirits: 'Restless ancestor spirits wander the royal tomb. They need to be calmed. Will you help?',
        corruption: 'Dark forces have corrupted the sacred grove and twisted its guardians. The source must be found and destroyed.',
        help: 'I can teach you about our ways. Ask about "classes", "skills", or "training".',
      },
    },
    questIds: [1, 2], // Cleanse the Spirits, The Corrupted Grove
    respawnSeconds: 0,
    keywords: ['elder', 'shaman', 'qhapaq', 'old'],
  },
  {
    id: 11,
    name: 'Temple Priest Willaq',
    shortDesc: 'A priest in golden robes tends the sacred altar.',
    longDesc: 'Priest Willaq serves Inti, the Sun God, with devotion. His robes shimmer with gold thread, and he carries himself with quiet dignity. He offers training to Sun Priests and wisdom to all who seek it.',
    type: 'guildmaster',
    level: 30,
    stats: { str: 10, dex: 10, con: 12, int: 16, wis: 20, cha: 16 },
    maxHp: 200,
    maxMana: 300,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: 'Welcome to the Temple of the Sun. How may I serve the light?',
      farewell: 'Go with the blessing of Inti.',
      keywords: {
        training: 'I can teach those devoted to Inti the ways of healing and light. Say "practice" to train your skills.',
        inti: 'Inti, the Sun God, is the giver of all life. Through his light, we find strength and warmth.',
        priest: 'Sun Priests channel the power of Inti to heal the wounded and smite the darkness.',
      },
    },
    trainableSkills: [1, 2, 3], // Minor heal, bless, light
    respawnSeconds: 0,
    keywords: ['priest', 'willaq', 'temple', 'sun'],
  },
  {
    id: 12,
    name: 'Shadowmaster Runa',
    shortDesc: 'A hooded figure lurks in the shadows.',
    longDesc: 'You can barely make out the form of Shadowmaster Runa, who seems to blend with the darkness itself. She speaks in whispers and moves without sound. She trains those who walk the path of shadow.',
    type: 'guildmaster',
    level: 30,
    stats: { str: 12, dex: 20, con: 10, int: 16, wis: 14, cha: 12 },
    maxHp: 150,
    maxMana: 100,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*whispers* So, you seek the path of shadows...',
      farewell: 'Walk softly, and leave no trace.',
      keywords: {
        training: 'I teach those with the talent for stealth and precision. Say "practice" to hone your dark arts.',
        shadow: 'The shadow is not evil - it is merely the absence of light. We learn to use it.',
        assassin: 'We are not mere killers. We are surgeons, removing threats with precision.',
      },
    },
    trainableSkills: [10, 11, 12], // Sneak, backstab, pick_lock
    respawnSeconds: 0,
    keywords: ['shadowmaster', 'runa', 'shadow', 'rogue'],
  },
  {
    id: 13,
    name: 'Warmaster Tupaq',
    shortDesc: 'A scarred warrior demonstrates combat techniques.',
    longDesc: 'Warmaster Tupaq is a legend among the Condor Warriors. His body bears countless scars from battles won, and his muscles ripple beneath his wool. He teaches the arts of war with stern discipline.',
    type: 'guildmaster',
    level: 30,
    stats: { str: 20, dex: 14, con: 18, int: 10, wis: 12, cha: 14 },
    maxHp: 300,
    maxMana: 50,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: 'You want to be a warrior? Show me what you\'re made of!',
      farewell: 'Fight with honor, or not at all.',
      keywords: {
        training: 'I train warriors, not cowards. Say "practice" if you have the courage.',
        warrior: 'A true warrior protects the weak and faces danger without fear.',
        battle: 'Battle is the ultimate test. Only in combat do you truly know yourself.',
      },
    },
    trainableSkills: [20, 21, 22], // Bash, taunt, block
    respawnSeconds: 0,
    keywords: ['warmaster', 'tupaq', 'warrior', 'condor'],
  },
  {
    id: 14,
    name: 'Earth Mother Killa',
    shortDesc: 'A serene llama communes with the earth itself.',
    longDesc: 'Earth Mother Killa sits in deep meditation, her hooves buried in the soil. Plants seem to grow towards her, and small creatures rest peacefully at her side. She teaches the ways of nature and the Earth Mother.',
    type: 'guildmaster',
    level: 30,
    stats: { str: 10, dex: 10, con: 16, int: 14, wis: 20, cha: 16 },
    maxHp: 200,
    maxMana: 250,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: 'Welcome, child of Pachamama. The earth speaks well of you.',
      farewell: 'May the Earth Mother hold you in her embrace.',
      keywords: {
        training: 'I teach those who listen to the voice of the land. Say "practice" to learn.',
        nature: 'All life is connected through the Earth Mother. We are her children.',
        pachamama: 'Pachamama is the Earth Mother, source of all growing things. Respect her, and she will protect you.',
      },
    },
    trainableSkills: [30, 31, 32], // Earth shield, entangle, nature healing
    respawnSeconds: 0,
    keywords: ['earth', 'mother', 'killa', 'shaman', 'druid'],
  },
  {
    id: 15,
    name: 'Swiftfoot Wayra',
    shortDesc: 'A lithe llama stretches, ready to run at any moment.',
    longDesc: 'Wayra never stays still for long. Even standing in place, she shifts from hoof to hoof, always ready to sprint. She is the fastest messenger in the empire and trains others in the arts of speed.',
    type: 'guildmaster',
    level: 30,
    stats: { str: 14, dex: 20, con: 12, int: 12, wis: 10, cha: 14 },
    maxHp: 150,
    maxMana: 80,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: 'You\'re too slow! But maybe I can fix that...',
      farewell: 'Remember: the wind stops for nothing!',
      keywords: {
        training: 'Speed is life. Say "practice" and try to keep up!',
        speed: 'The fastest llama survives. The slowest becomes someone\'s dinner.',
        messenger: 'We carry the words of emperors across mountains. Our speed holds the empire together.',
      },
    },
    trainableSkills: [40, 41, 42], // Quick strike, dodge, sprint
    respawnSeconds: 0,
    keywords: ['swiftfoot', 'wayra', 'wind', 'runner', 'messenger'],
  },
  {
    id: 16,
    name: 'Spirit Guide Ayar',
    shortDesc: 'A ghostly llama flickers between this world and the next.',
    longDesc: 'Ayar exists partially in the spirit realm, giving him a translucent appearance. He can see and speak with the dead, and teaches others to tap into this power. His voice seems to echo from far away.',
    type: 'guildmaster',
    level: 30,
    stats: { str: 8, dex: 12, con: 10, int: 20, wis: 18, cha: 14 },
    maxHp: 120,
    maxMana: 350,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: 'The spirits welcome you... they have been expecting you.',
      farewell: 'The ancestors walk beside you, whether you see them or not.',
      keywords: {
        training: 'I can teach you to hear the whispers of the dead. Say "practice" to begin.',
        spirits: 'The spirits of our ancestors surround us always. We need only learn to listen.',
        death: 'Death is not an ending, merely a transition. The spirit endures.',
      },
    },
    trainableSkills: [50, 51, 52], // Spirit bolt, summon ancestor, mana shield
    respawnSeconds: 0,
    keywords: ['spirit', 'guide', 'ayar', 'caller', 'ghost'],
  },

  // === SHOPKEEPERS ===
  {
    id: 20,
    name: 'Weaver Llama Chasqa',
    shortDesc: 'A llama surrounded by colorful textiles hums as she works.',
    longDesc: 'Chasqa is a master weaver, her nimble hooves creating intricate patterns in fine textiles. She sells clothing and accessories made from the finest alpaca wool.',
    type: 'shopkeeper',
    level: 10,
    stats: { str: 8, dex: 14, con: 10, int: 12, wis: 12, cha: 16 },
    maxHp: 80,
    maxMana: 0,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: 'Welcome to my stall! The finest textiles in all the Andes!',
      farewell: 'Come back soon! I\'m always weaving new things.',
      keywords: {
        buy: 'Say "list" to see my wares, or "buy <item>" to purchase.',
        sell: 'I\'ll buy quality goods at fair prices. Say "sell <item>".',
        wool: 'My wool comes from the finest alpacas. Feel how soft!',
      },
    },
    shopInventory: [
      { itemTemplateId: 20, stock: -1, buyPriceMultiplier: 1.2, sellPriceMultiplier: 0.5 }, // Woven tunic
      { itemTemplateId: 21, stock: -1, buyPriceMultiplier: 1.2, sellPriceMultiplier: 0.5 }, // Leather sandals
      { itemTemplateId: 42, stock: 2, buyPriceMultiplier: 1.5, sellPriceMultiplier: 0.5 }, // Vicuña cloak
      { itemTemplateId: 22, stock: 1, buyPriceMultiplier: 1.5, sellPriceMultiplier: 0.5 }, // Condor headdress
    ],
    respawnSeconds: 0,
    keywords: ['weaver', 'chasqa', 'textile', 'merchant'],
  },
  {
    id: 21,
    name: 'Smith Kuntur',
    shortDesc: 'A muscular llama hammers metal at a forge.',
    longDesc: 'Kuntur is a master metalworker, his face permanently creased from squinting at hot metal. He forges weapons and armor for those who can afford his quality work.',
    type: 'shopkeeper',
    level: 15,
    stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 120,
    maxMana: 0,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*CLANG* Oh! A customer! What can I forge for you?',
      farewell: 'May my weapons serve you well!',
      keywords: {
        buy: 'I\'ve got weapons and armor. Say "list" to see, "buy <item>" to purchase.',
        sell: 'I\'ll take old weapons off your hands. Say "sell <item>".',
        forge: 'I work bronze mostly. Steel is rare in these mountains.',
      },
    },
    shopInventory: [
      { itemTemplateId: 1, stock: -1, buyPriceMultiplier: 1.0, sellPriceMultiplier: 0.5 }, // Wooden staff
      { itemTemplateId: 2, stock: 3, buyPriceMultiplier: 1.2, sellPriceMultiplier: 0.5 }, // Obsidian dagger
      { itemTemplateId: 3, stock: 2, buyPriceMultiplier: 1.2, sellPriceMultiplier: 0.5 }, // Bronze mace
      { itemTemplateId: 23, stock: 1, buyPriceMultiplier: 1.3, sellPriceMultiplier: 0.5 }, // Bronze breastplate
    ],
    respawnSeconds: 0,
    keywords: ['smith', 'kuntur', 'forge', 'weapon', 'armor'],
  },
  {
    id: 22,
    name: 'Alchemist Ñuqa',
    shortDesc: 'An eccentric llama mixes bubbling potions.',
    longDesc: 'Ñuqa\'s workshop is a controlled chaos of ingredients and experiments. She mutters formulas under her breath and occasionally cackles when a mixture turns the right color.',
    type: 'shopkeeper',
    level: 20,
    stats: { str: 8, dex: 12, con: 10, int: 18, wis: 14, cha: 8 },
    maxHp: 70,
    maxMana: 150,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: 'Yes, yes, what do you want? I\'m in the middle of something!',
      farewell: 'Don\'t blow yourself up with those!',
      keywords: {
        buy: 'Potions, crystals, all manner of magical supplies. "list" to see, "buy" to purchase.',
        sell: 'I\'ll buy ingredients. Rare ones pay well. Say "sell <item>".',
        potion: 'My potions are guaranteed! Mostly. Usually. Just don\'t mix them.',
      },
    },
    shopInventory: [
      { itemTemplateId: 63, stock: -1, buyPriceMultiplier: 1.2, sellPriceMultiplier: 0.5 }, // Healing potion
      { itemTemplateId: 64, stock: -1, buyPriceMultiplier: 1.2, sellPriceMultiplier: 0.5 }, // Mana crystal
      { itemTemplateId: 60, stock: -1, buyPriceMultiplier: 1.0, sellPriceMultiplier: 0.4 }, // Coca leaf
    ],
    respawnSeconds: 0,
    keywords: ['alchemist', 'nuqa', 'potion', 'magic'],
  },
  {
    id: 23,
    name: 'Innkeeper Sami',
    shortDesc: 'A plump, friendly llama tends the inn\'s fire.',
    longDesc: 'Sami runs the Tired Traveler Inn with warmth and efficiency. She makes everyone feel welcome and ensures her guests are well-fed and rested.',
    type: 'innkeeper',
    level: 5,
    stats: { str: 10, dex: 10, con: 12, int: 10, wis: 12, cha: 18 },
    maxHp: 60,
    maxMana: 0,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: 'Welcome to the Tired Traveler! You look like you could use a rest.',
      farewell: 'Safe travels! Come back whenever you need rest.',
      keywords: {
        rest: 'Say "rest" to recover your strength. It costs 10 gold per hour, but you\'ll heal faster!',
        food: 'I\'ve got chicha and cuy! "list" to see the menu, "buy" to order.',
        room: 'Just say "rest" and I\'ll set you up with a bed.',
      },
    },
    shopInventory: [
      { itemTemplateId: 61, stock: -1, buyPriceMultiplier: 1.0, sellPriceMultiplier: 0.3 }, // Chicha
      { itemTemplateId: 62, stock: -1, buyPriceMultiplier: 1.0, sellPriceMultiplier: 0.3 }, // Roasted cuy
      { itemTemplateId: 65, stock: -1, buyPriceMultiplier: 0.8, sellPriceMultiplier: 0.3 }, // Quinoa bowl
      { itemTemplateId: 66, stock: -1, buyPriceMultiplier: 0.5, sellPriceMultiplier: 0.2 }, // Spring water
    ],
    respawnSeconds: 0,
    keywords: ['innkeeper', 'sami', 'inn', 'rest'],
  },
];

// Helper to get NPC by ID
export function getNpcById(id: number): NpcTemplate | undefined {
  return npcTemplates.find((n) => n.id === id);
}
