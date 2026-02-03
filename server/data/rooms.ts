// Room Templates for FROBARK - Gamehenge World
import type { RoomTemplate } from '../../shared/types/room';

export const roomTemplates: RoomTemplate[] = [
  // ============================================
  // PRUSSIA (Wilson's Domain)
  // ============================================
  {
    id: 'prussia_gate',
    name: 'Gates of Prussia',
    description: 'Massive iron gates tower before you, adorned with Wilson\'s crest - a fist crushing a book. Prussian guards in dark armor stand watch, their eyes cold and suspicious. Beyond, you can see the spires of Wilson\'s castle rising against a perpetually grey sky. The smell of coal smoke and fear hangs in the air.',
    area: 'prussia',
    exits: [
      { direction: 'north', targetRoom: 'wilson_castle_hall' },
      { direction: 'south', targetRoom: 'border_checkpoint' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 106, respawnMinutes: 0 }], // Gate Guard
  },
  {
    id: 'wilson_castle_hall',
    name: 'Wilson\'s Great Hall',
    description: 'The Great Hall of Wilson\'s castle is a monument to ego and cruelty. Tapestries depicting Wilson\'s "victories" over the Lizards line the walls. A massive throne of black stone dominates the far end, and the Helping Friendly Book - stolen from the Lizards - sits in a glass case, taunting all who see it. The ceiling is lost in shadow.',
    area: 'prussia',
    exits: [
      { direction: 'south', targetRoom: 'prussia_gate' },
      { direction: 'up', targetRoom: 'wilson_tower' },
      { direction: 'down', targetRoom: 'castle_dungeon' },
      { direction: 'east', targetRoom: 'guard_barracks' },
      { direction: 'west', targetRoom: 'castle_kitchen' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 1, respawnMinutes: 0 }], // Wilson (when holding court)
  },
  {
    id: 'wilson_tower',
    name: 'Wilson\'s Tower',
    description: 'From this high tower, all of Gamehenge spreads below like a map. You can see the Lizard village, the dark forest, and far in the distance, the peak where Icculus\'s tower stands. Wilson comes here to survey his domain and plot. A telescope points toward Icculus\'s tower. The wind howls mournfully.',
    area: 'prussia',
    exits: [
      { direction: 'down', targetRoom: 'wilson_castle_hall' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [],
  },
  {
    id: 'castle_dungeon',
    name: 'Castle Dungeon',
    description: 'The dungeon reeks of despair and damp stone. Iron cages line the walls, some occupied by political prisoners who dared speak against Wilson. Chains rattle in the darkness, and somewhere water drips endlessly. The jailer\'s desk sits near the stairs, covered in old papers and a half-eaten meal.',
    area: 'prussia',
    exits: [
      { direction: 'up', targetRoom: 'wilson_castle_hall' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 107, respawnMinutes: 0 }], // Dungeon Jailer
  },
  {
    id: 'guard_barracks',
    name: 'Guard Barracks',
    description: 'Rows of simple bunks fill this stark room where Wilson\'s soldiers sleep. Weapon racks hold spears, swords, and clubs. A few off-duty guards play dice in the corner while others polish their armor. The atmosphere is one of bored menace - men with nothing to do but wait for orders to hurt someone.',
    area: 'prussia',
    exits: [
      { direction: 'west', targetRoom: 'wilson_castle_hall' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [
      { npcTemplateId: 108, respawnMinutes: 0 }, // Guard Captain Sloth
      { npcTemplateId: 109, respawnMinutes: 0 }, // Prussian Soldier
    ],
  },
  {
    id: 'castle_kitchen',
    name: 'Castle Kitchen',
    description: 'Heat and steam fill this busy kitchen where servants prepare Wilson\'s meals. Pots bubble over open fires, and the smell of roasting meat mingles with fresh bread. The cook - a harried Lizard forced into service - shouts orders at trembling assistants. There\'s a small door that leads to the servant quarters.',
    area: 'prussia',
    exits: [
      { direction: 'east', targetRoom: 'wilson_castle_hall' },
    ],
    flags: { safe: true },
    defaultItems: [
      { itemTemplateId: 50, quantity: 3, respawnMinutes: 30 }, // Bread
      { itemTemplateId: 51, quantity: 2, respawnMinutes: 45 }, // Roasted meat
    ],
    defaultNpcs: [{ npcTemplateId: 110, respawnMinutes: 0 }], // Cook Martha
  },

  // ============================================
  // BORDER / CROSSROADS
  // ============================================
  {
    id: 'border_checkpoint',
    name: 'Border Checkpoint',
    description: 'A wooden guardhouse marks the border between Prussia and the free lands. Prussian soldiers check papers and search travelers, looking for contraband - especially books. A worn path leads south toward the Crossroads, while the ominous gates of Prussia loom to the north.',
    area: 'border',
    exits: [
      { direction: 'north', targetRoom: 'prussia_gate' },
      { direction: 'south', targetRoom: 'crossroads' },
      { direction: 'east', targetRoom: 'forest_edge' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 111, respawnMinutes: 0 }], // Border Guard
  },
  {
    id: 'crossroads',
    name: 'The Crossroads',
    description: 'You stand at the heart of Gamehenge, where all paths meet. A weathered signpost points in four directions: North to Prussia, South to the Village, East to the Forest, West to the River. Travelers of all kinds pass through here - merchants, pilgrims, refugees, and those who\'d rather not be seen. This is neutral ground, by ancient custom.',
    area: 'crossroads',
    exits: [
      { direction: 'north', targetRoom: 'border_checkpoint' },
      { direction: 'south', targetRoom: 'village_square' },
      { direction: 'east', targetRoom: 'forest_edge' },
      { direction: 'west', targetRoom: 'river_crossing' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 7, respawnMinutes: 0 }], // Mr. Palmer (the accountant, sometimes here)
  },

  // ============================================
  // GAMEHENGE VILLAGE
  // ============================================
  {
    id: 'village_square',
    name: 'Village Square',
    description: 'The central square of the Lizard village is a place of quiet resistance. A dry fountain - once a symbol of prosperity - stands silent in the center. Lizards gather here to share news, trade goods, and remember better times. Wilson\'s proclamations are posted on a board, but someone has drawn a rude picture on the latest one.',
    area: 'village',
    exits: [
      { direction: 'north', targetRoom: 'crossroads' },
      { direction: 'east', targetRoom: 'market_district' },
      { direction: 'south', targetRoom: 'assembly_hall' },
      { direction: 'west', targetRoom: 'lizard_homes_west' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [
      { npcTemplateId: 112, respawnMinutes: 0 }, // Village Elder
    ],
  },
  {
    id: 'market_district',
    name: 'Market District',
    description: 'Despite Wilson\'s taxes, commerce survives here. Stalls sell everything from vegetables to handmade crafts. The Lizards have learned to hide their best goods from the tax collectors. A blacksmith\'s hammer rings steadily from a forge, and the smell of fresh bread drifts from a small bakery.',
    area: 'village',
    exits: [
      { direction: 'west', targetRoom: 'village_square' },
      { direction: 'north', targetRoom: 'the_inn' },
      { direction: 'east', targetRoom: 'blacksmith_forge' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [
      { npcTemplateId: 113, respawnMinutes: 0 }, // Baker Possum
      { npcTemplateId: 7, respawnMinutes: 0 }, // Mr. Palmer
    ],
  },
  {
    id: 'the_inn',
    name: 'The Divided Sky Inn',
    description: 'This cozy inn is the social heart of the village. A fire crackles in a stone hearth, and the smell of stew fills the air. Travelers and locals share tables, swapping stories and complaints about Wilson. The innkeeper keeps a careful ear - you never know who might be a spy. Music sometimes fills the room when someone brave enough picks up a lute.',
    area: 'village',
    exits: [
      { direction: 'south', targetRoom: 'market_district' },
    ],
    flags: { safe: true, restRoom: true, restCost: 5 },
    defaultItems: [
      { itemTemplateId: 52, quantity: 5, respawnMinutes: 20 }, // Stew
      { itemTemplateId: 53, quantity: 10, respawnMinutes: 15 }, // Ale
    ],
    defaultNpcs: [{ npcTemplateId: 114, respawnMinutes: 0 }], // Innkeeper Antelope
  },
  {
    id: 'blacksmith_forge',
    name: 'Gordo\'s Forge',
    description: 'The heat from the forge is intense. Gordo the blacksmith hammers away at hot metal, sparks flying with each strike. Tools of all kinds hang from the walls - shovels, axes, hoes, and yes, a few weapons hidden in the back. His daughter Elena manages the front, keeping the books.',
    area: 'village',
    exits: [
      { direction: 'west', targetRoom: 'market_district' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [
      { npcTemplateId: 115, respawnMinutes: 0 }, // Blacksmith Gordo
      { npcTemplateId: 116, respawnMinutes: 0 }, // Elena
    ],
  },
  {
    id: 'assembly_hall',
    name: 'Assembly Hall',
    description: 'The Lizard Council meets here, though their power has been reduced to mere ceremony under Wilson\'s rule. Wooden benches face a raised platform. Maps of Gamehenge cover the walls, marked with symbols only the Lizards understand. The hall echoes with the memory of fiery speeches and brave resolutions.',
    area: 'village',
    exits: [
      { direction: 'north', targetRoom: 'village_square' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 117, respawnMinutes: 0 }], // Council Elder Jiboo
  },
  {
    id: 'lizard_homes_west',
    name: 'Lizard Homes - West Side',
    description: 'Simple but sturdy homes line this quiet street. Flower boxes brighten windows despite the hard times. Children play in the dirt road while elders sit on porches, watching the world pass. This is where the working families live - farmers, craftsmen, and laborers.',
    area: 'village',
    exits: [
      { direction: 'east', targetRoom: 'village_square' },
      { direction: 'south', targetRoom: 'farmlands' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [
      { npcTemplateId: 118, respawnMinutes: 0 }, // Martha (Rutherford's wife)
      { npcTemplateId: 119, respawnMinutes: 0 }, // Young Jimmy
    ],
  },

  // ============================================
  // FARMLANDS
  // ============================================
  {
    id: 'farmlands',
    name: 'Lizard Farmlands',
    description: 'Golden fields of grain stretch toward the horizon, worked by Lizard farmers who toil under Wilson\'s heavy taxes. Scarecrows stand sentinel over the crops. The soil is rich and dark, yielding good harvests - most of which go straight to Prussia. A farmer wipes sweat from his brow.',
    area: 'farmlands',
    exits: [
      { direction: 'north', targetRoom: 'lizard_homes_west' },
      { direction: 'east', targetRoom: 'river_crossing' },
      { direction: 'south', targetRoom: 'the_underground' },
    ],
    flags: {},
    defaultItems: [
      { itemTemplateId: 54, quantity: 5, respawnMinutes: 60 }, // Grain
      { itemTemplateId: 55, quantity: 3, respawnMinutes: 45 }, // Vegetables
    ],
    defaultNpcs: [
      { npcTemplateId: 10, respawnMinutes: 0 }, // Farmer Rutherford
    ],
  },
  {
    id: 'the_underground',
    name: 'The Underground',
    description: 'A hidden entrance beneath an old barn leads to this network of tunnels. The resistance uses these passages to move unseen. Torches flicker on rough-hewn walls, and the air is cool and damp. Somewhere in the darkness, you hear voices planning something important.',
    area: 'underground',
    exits: [
      { direction: 'up', targetRoom: 'farmlands' },
      { direction: 'east', targetRoom: 'hidden_glade', hiddenUntil: 'knows_resistance' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 8, respawnMinutes: 0 }], // The Unit Monster
  },

  // ============================================
  // THE RIVER
  // ============================================
  {
    id: 'river_crossing',
    name: 'River Crossing',
    description: 'A wooden bridge spans the wide river that divides Gamehenge. The water flows dark and deep, carrying secrets from the mountains. An old fisherman sits on the bank, his line in the water, seemingly oblivious to the world\'s troubles. Sometimes the bridge is guarded; today it is not.',
    area: 'river',
    exits: [
      { direction: 'east', targetRoom: 'crossroads' },
      { direction: 'west', targetRoom: 'farmlands' },
      { direction: 'south', targetRoom: 'tela_cottage' },
      { direction: 'north', targetRoom: 'forest_stream' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 120, respawnMinutes: 0 }], // Fisherman Harpua
  },
  {
    id: 'tela_cottage',
    name: 'Tela\'s Cottage',
    description: 'A modest cottage hidden among willow trees, Tela\'s home is the secret heart of the resistance. Herbs dry from the rafters, and maps are spread across a table. The cottage looks innocent enough from outside, but those who know, know. A sense of fierce determination permeates the air.',
    area: 'river',
    exits: [
      { direction: 'north', targetRoom: 'river_crossing' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 3, respawnMinutes: 0 }], // Tela
  },

  // ============================================
  // THE FOREST
  // ============================================
  {
    id: 'forest_edge',
    name: 'Forest Edge',
    description: 'The great forest of Gamehenge begins here, ancient trees rising like pillars into a canopy that blocks most light. The air is thick with the smell of moss and growing things. Paths branch in multiple directions, but it\'s easy to lose your way once you venture deeper.',
    area: 'forest',
    exits: [
      { direction: 'west', targetRoom: 'crossroads' },
      { direction: 'east', targetRoom: 'deep_forest' },
      { direction: 'south', targetRoom: 'border_checkpoint' },
    ],
    flags: {},
    defaultItems: [
      { itemTemplateId: 56, quantity: 5, respawnMinutes: 30 }, // Forest mushrooms
    ],
    defaultNpcs: [],
  },
  {
    id: 'deep_forest',
    name: 'Deep Forest',
    description: 'Sunlight barely penetrates here. The trees seem to watch with ancient eyes. Strange sounds echo through the underbrush - creatures that have never been catalogued. It\'s beautiful and terrifying in equal measure. Those who wander carelessly may never find their way out.',
    area: 'forest',
    exits: [
      { direction: 'west', targetRoom: 'forest_edge' },
      { direction: 'north', targetRoom: 'great_tree' },
      { direction: 'south', targetRoom: 'hidden_glade' },
      { direction: 'east', targetRoom: 'fee_burrow' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [],
  },
  {
    id: 'great_tree',
    name: 'The Great Tree',
    description: 'A tree of impossible size dominates this clearing, its trunk wider than a house, its branches disappearing into the clouds. This is the oldest living thing in Gamehenge. Carvings in a forgotten language spiral up the bark. Legend says Icculus once meditated here for a year.',
    area: 'forest',
    exits: [
      { direction: 'south', targetRoom: 'deep_forest' },
      { direction: 'up', targetRoom: 'tower_approach' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [],
  },
  {
    id: 'hidden_glade',
    name: 'Hidden Glade',
    description: 'A secret clearing known only to the resistance. Sunlight filters through the leaves, illuminating a natural amphitheater. Logs serve as benches. This is where the rebels meet to plan Wilson\'s downfall. Carved into a stone: "The knowledge was encyclopedic, a encyclopedic of all Encyclopedi-know."',
    area: 'forest',
    exits: [
      { direction: 'north', targetRoom: 'deep_forest' },
      { direction: 'west', targetRoom: 'the_underground' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [],
  },
  {
    id: 'forest_stream',
    name: 'Forest Stream',
    description: 'A clear stream winds through the forest here, its water cold and pure from mountain springs. Fish dart beneath the surface. Smooth stones line the banks, perfect for sitting and thinking. The rush of water drowns out other sounds, making this a peaceful retreat.',
    area: 'forest',
    exits: [
      { direction: 'south', targetRoom: 'river_crossing' },
      { direction: 'east', targetRoom: 'deep_forest' },
    ],
    flags: { safe: true, restRoom: true, restCost: 0 },
    defaultItems: [
      { itemTemplateId: 57, quantity: 3, respawnMinutes: 30 }, // Fresh water
      { itemTemplateId: 58, quantity: 2, respawnMinutes: 60 }, // River fish
    ],
    defaultNpcs: [],
  },
  {
    id: 'fee_burrow',
    name: 'Fee\'s Burrow',
    description: 'A cozy burrow beneath the roots of an ancient oak, this is the home of Fee the weasel. The entrance is small - you have to duck to enter. Inside, it\'s surprisingly comfortable: dried leaves for bedding, nuts stored in corners, and the walls decorated with shiny things Fee has collected.',
    area: 'forest',
    exits: [
      { direction: 'west', targetRoom: 'deep_forest' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 6, respawnMinutes: 0 }], // Fee
  },

  // ============================================
  // ICCULUS'S DOMAIN
  // ============================================
  {
    id: 'tower_approach',
    name: 'Mountain Path to Icculus',
    description: 'A treacherous path winds up the mountainside toward Icculus\'s tower. The air grows thin and cold. Cloud wisps drift past, and the view of Gamehenge below is breathtaking. Few make this journey - fewer still reach the top. The path tests both body and spirit.',
    area: 'icculus',
    exits: [
      { direction: 'down', targetRoom: 'great_tree' },
      { direction: 'up', targetRoom: 'tower_base' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 4, respawnMinutes: 0 }], // Colonel Forbin (wandering)
  },
  {
    id: 'tower_base',
    name: 'Tower Base',
    description: 'You stand before the base of Icculus\'s tower, a structure that seems to defy architecture - it twists and spirals in ways that hurt to look at directly. A door of strange metal bears no handle or lock, only an inscription: "Only those who know they know nothing truly know." The Famous Mockingbird circles overhead.',
    area: 'icculus',
    exits: [
      { direction: 'down', targetRoom: 'tower_approach' },
      { direction: 'up', targetRoom: 'tower_stairs', hiddenUntil: 'tower_door_open' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [],
  },
  {
    id: 'tower_stairs',
    name: 'Tower Stairs',
    description: 'Spiral stairs climb through the tower\'s impossible interior. Each floor seems larger than it should be. Windows show different views - not just of Gamehenge, but of places that might not exist. Time moves strangely here. You\'ve been climbing for what feels like hours, or possibly minutes.',
    area: 'icculus',
    exits: [
      { direction: 'down', targetRoom: 'tower_base' },
      { direction: 'up', targetRoom: 'icculus_chamber' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [],
  },
  {
    id: 'icculus_chamber',
    name: 'Icculus\'s Chamber',
    description: 'The prophet\'s chamber is filled with books, scrolls, and instruments of unknown purpose. Star charts cover the ceiling. In the center, Icculus himself - if he is here - sits in meditation or study. The room hums with power. You feel insignificant and infinite simultaneously.',
    area: 'icculus',
    exits: [
      { direction: 'down', targetRoom: 'tower_stairs' },
      { direction: 'north', targetRoom: 'book_chamber' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 2, respawnMinutes: 0 }], // Icculus
  },
  {
    id: 'book_chamber',
    name: 'The Chamber of the Helping Friendly Book',
    description: 'This sacred chamber once held the Helping Friendly Book before Wilson stole it. The pedestal remains, empty and forlorn. Ancient wards flicker weakly on the walls. A sense of loss permeates everything. Icculus sometimes comes here to remember what was taken.',
    area: 'icculus',
    exits: [
      { direction: 'south', targetRoom: 'icculus_chamber' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [],
  },

  // ============================================
  // SPECIAL LOCATIONS
  // ============================================
  {
    id: 'icy_mountain_pass',
    name: 'Icy Mountain Pass',
    description: 'Bitter wind cuts through this high mountain pass. Snow and ice make every step treacherous. The path leads between Prussia and the wild northern lands. Few travel here by choice. The cold seeps into bones and slows thoughts.',
    area: 'wilderness',
    exits: [
      { direction: 'south', targetRoom: 'prussia_gate' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [],
  },
];

// Helper to get room by ID
export function getRoomById(id: string): RoomTemplate | undefined {
  return roomTemplates.find((r) => r.id === id);
}

// Get all rooms in an area
export function getRoomsByArea(area: string): RoomTemplate[] {
  return roomTemplates.filter((r) => r.area === area);
}

// Get safe rooms (for respawn points)
export function getSafeRooms(): RoomTemplate[] {
  return roomTemplates.filter((r) => r.flags.safe);
}
