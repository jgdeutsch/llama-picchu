// Room Templates for Llama Picchu MUD
import type { RoomTemplate } from '../../shared/types/room';

export const roomTemplates: RoomTemplate[] = [
  // === MAIN AREAS (from original game) ===
  {
    id: 'plaza',
    name: 'Main Plaza',
    description: 'You stand in the grand central plaza of Machu Picchu. Ancient stone walls surround you, their massive blocks fitted together with impossible precision. The morning mist clings to the distant peaks, and the air is thin but invigorating. Other llamas mill about, going about their daily routines. A fountain bubbles peacefully in the center.',
    area: 'machu_picchu',
    exits: [
      { direction: 'north', targetRoom: 'intihuatana' },
      { direction: 'east', targetRoom: 'temple_sun' },
      { direction: 'south', targetRoom: 'terraces' },
      { direction: 'west', targetRoom: 'guardhouse' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 10, respawnMinutes: 0 }], // Elder Shaman
  },
  {
    id: 'intihuatana',
    name: 'Intihuatana Stone',
    description: 'Before you rises the famous Intihuatana, the "Hitching Post of the Sun." This carved stone pillar was used by Incan astronomers to track the sun\'s movements. The stone seems to pulse with ancient energy, and you feel a deep connection to something greater. A wise-looking alpaca meditates nearby.',
    area: 'machu_picchu',
    exits: [
      { direction: 'south', targetRoom: 'plaza' },
      { direction: 'east', targetRoom: 'sacred_rock' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [],
  },
  {
    id: 'sacred_rock',
    name: 'Sacred Rock',
    description: 'A massive flat rock dominates this terrace, its shape eerily resembling the mountain peaks behind it. This is the Sacred Rock, a place of deep spiritual significance. Strange symbols are carved into its surface, and touching it makes your wool stand on end. The air shimmers slightly here.',
    area: 'machu_picchu',
    exits: [
      { direction: 'west', targetRoom: 'intihuatana' },
      { direction: 'south', targetRoom: 'temple_sun' },
    ],
    flags: {},
    defaultItems: [{ itemTemplateId: 82, quantity: 3, respawnMinutes: 30 }], // Huayruro seeds
    defaultNpcs: [],
  },
  {
    id: 'temple_sun',
    name: 'Temple of the Sun',
    description: 'You enter the magnificent Temple of the Sun, the most sacred building in Machu Picchu. Curved walls of precisely fitted stone create a perfect semicircle. Through carefully positioned windows, beams of light illuminate different parts of the chamber depending on the season. A golden altar stands at the center, and the priests of Inti conduct their rituals here.',
    area: 'machu_picchu',
    exits: [
      { direction: 'west', targetRoom: 'plaza' },
      { direction: 'north', targetRoom: 'sacred_rock' },
      { direction: 'down', targetRoom: 'royal_tomb' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 11, respawnMinutes: 0 }], // Temple Priest
  },
  {
    id: 'royal_tomb',
    name: 'Royal Tomb',
    description: 'A natural cave beneath the Temple of the Sun has been converted into a royal tomb. The walls are lined with carved niches that once held sacred objects and mummified remains. The air is cool and still, and you sense the presence of ancient spirits. Offerings of flowers and coca leaves have been placed at a stone altar.',
    area: 'machu_picchu',
    exits: [
      { direction: 'up', targetRoom: 'temple_sun' },
    ],
    flags: {},
    defaultItems: [{ itemTemplateId: 60, quantity: 5, respawnMinutes: 60 }], // Coca leaves
    defaultNpcs: [{ npcTemplateId: 2, respawnMinutes: 5 }], // Restless Ancestor
  },
  {
    id: 'terraces',
    name: 'Agricultural Terraces',
    description: 'Spectacular stone terraces cascade down the mountainside, a marvel of ancient engineering. Each level is perfectly level, designed for growing crops in the thin mountain air. You can see potato plants, quinoa, and maize growing in neat rows. The view of the valley below is breathtaking.',
    area: 'machu_picchu',
    exits: [
      { direction: 'north', targetRoom: 'plaza' },
      { direction: 'east', targetRoom: 'condor_temple' },
      { direction: 'south', targetRoom: 'path' },
    ],
    flags: {},
    defaultItems: [{ itemTemplateId: 65, quantity: 2, respawnMinutes: 30 }], // Quinoa bowls
    defaultNpcs: [],
  },
  {
    id: 'guardhouse',
    name: 'Guardhouse',
    description: 'A sturdy stone guardhouse overlooks the main entrance to Machu Picchu. From here, guards once watched for approaching visitors or threats. The view is panoramic - you can see the winding Urubamba River far below and the Sacred Valley stretching to the horizon. A weapon rack holds training equipment.',
    area: 'machu_picchu',
    exits: [
      { direction: 'east', targetRoom: 'plaza' },
    ],
    flags: {},
    defaultItems: [{ itemTemplateId: 1, quantity: 1, respawnMinutes: 60 }], // Wooden staff
    defaultNpcs: [],
  },
  {
    id: 'condor_temple',
    name: 'Temple of the Condor',
    description: 'This temple features a remarkable natural rock formation that resembles a condor with outstretched wings. The Incans carved additional details to enhance the likeness. The condor was sacred to them, a messenger between the earthly and heavenly realms. There is a passage leading into darkness to the east.',
    area: 'machu_picchu',
    exits: [
      { direction: 'west', targetRoom: 'terraces' },
      { direction: 'east', targetRoom: 'secret_room', hiddenUntil: 'secret_door_open' },
    ],
    flags: {},
    defaultItems: [{ itemTemplateId: 81, quantity: 1, respawnMinutes: 120 }], // Condor feather
    defaultNpcs: [{ npcTemplateId: 3, respawnMinutes: 5 }], // Shadow Condor
  },
  {
    id: 'secret_room',
    name: 'Hidden Chamber',
    description: 'You have discovered a secret chamber! The walls are covered with intricate murals depicting llamas in heroic poses. In the center of the room, on a pedestal of pure gold, sits the legendary Golden Llama - an artifact of immense power and beauty. This must be what you\'ve been searching for!',
    area: 'machu_picchu',
    exits: [
      { direction: 'west', targetRoom: 'condor_temple' },
    ],
    flags: { safe: true },
    defaultItems: [{ itemTemplateId: 100, quantity: 1, respawnMinutes: 0 }], // Golden Llama (doesn't respawn)
    defaultNpcs: [],
  },
  {
    id: 'path',
    name: 'Mountain Path',
    description: 'A narrow path winds along the mountainside, offering stunning but terrifying views of the sheer drop below. One wrong step could send you tumbling into the abyss. The path continues to a sacred spring to the south and returns to the terraces to the north.',
    area: 'machu_picchu',
    exits: [
      { direction: 'north', targetRoom: 'terraces' },
      { direction: 'south', targetRoom: 'spring' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 1, respawnMinutes: 5 }], // Corrupted Puma
  },
  {
    id: 'spring',
    name: 'Sacred Spring',
    description: 'A natural spring bubbles up from the earth, its waters crystal clear and impossibly cold. Stone channels direct the water into a series of fountains, a masterpiece of Incan hydraulic engineering. This is a place of purification and renewal. The peaceful atmosphere calms your spirit.',
    area: 'machu_picchu',
    exits: [
      { direction: 'north', targetRoom: 'path' },
      { direction: 'east', targetRoom: 'three_windows' },
    ],
    flags: { safe: true, restRoom: true, restCost: 0 },
    defaultItems: [{ itemTemplateId: 66, quantity: 3, respawnMinutes: 20 }], // Spring water
    defaultNpcs: [],
  },
  {
    id: 'three_windows',
    name: 'Temple of the Three Windows',
    description: 'Three large trapezoidal windows dominate one wall of this temple, perfectly framing the mountains beyond. According to legend, these windows represent the three worlds of Incan cosmology: the upper world of the gods, the earthly world, and the underworld of the dead. The morning light streams through in golden rays.',
    area: 'machu_picchu',
    exits: [
      { direction: 'west', targetRoom: 'spring' },
      { direction: 'north', targetRoom: 'ancestor_hall' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [],
  },

  // === NEW GUILD & QUEST AREAS ===
  {
    id: 'ancestor_hall',
    name: 'Hall of Ancestors',
    description: 'This solemn hall is dedicated to communing with the spirits of the dead. Alcoves line the walls, each containing a mummified ancestor wrapped in fine textiles. Spirit Callers meditate here, strengthening their connection to the other side. The air is thick with incense and mystery.',
    area: 'machu_picchu',
    exits: [
      { direction: 'south', targetRoom: 'three_windows' },
      { direction: 'east', targetRoom: 'haunted_ruins' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 16, respawnMinutes: 0 }], // Spirit Caller Guildmaster
  },
  {
    id: 'shadow_guild',
    name: 'Shadow Guild',
    description: 'Hidden behind a false wall, this cramped chamber serves as headquarters for those who walk in shadow. Maps of guard routes cover the walls, and various tools of the trade hang from hooks. The only light comes from a single candle that never seems to burn down.',
    area: 'machu_picchu',
    exits: [
      { direction: 'north', targetRoom: 'guardhouse' },
    ],
    flags: { safe: true },
    defaultItems: [{ itemTemplateId: 2, quantity: 1, respawnMinutes: 0 }], // Obsidian dagger (no respawn - shop only)
    defaultNpcs: [{ npcTemplateId: 12, respawnMinutes: 0 }], // Shadow Stalker Guildmaster
  },
  {
    id: 'warrior_barracks',
    name: 'Warrior Barracks',
    description: 'Stone bunks line the walls of this military quarters. Weapons racks hold an assortment of bronze weapons, and practice dummies show signs of heavy use. Condor Warriors train here, honing their skills in the art of combat. The sound of clashing metal echoes from a training yard to the east.',
    area: 'machu_picchu',
    exits: [
      { direction: 'west', targetRoom: 'guardhouse' },
      { direction: 'east', targetRoom: 'training_yard' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 13, respawnMinutes: 0 }], // Condor Warrior Guildmaster
  },
  {
    id: 'training_yard',
    name: 'Training Yard',
    description: 'An open courtyard where warriors practice combat techniques. Straw dummies and wooden posts serve as targets. The stone floor shows countless scuff marks from generations of training. A few young warriors spar with wooden weapons under watchful supervision.',
    area: 'machu_picchu',
    exits: [
      { direction: 'west', targetRoom: 'warrior_barracks' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [],
  },
  {
    id: 'earth_shrine',
    name: 'Earth Shrine',
    description: 'This natural grotto has been sanctified as a shrine to Pachamama, the Earth Mother. Living plants grow from cracks in the rock, and offerings of seeds and flowers cover a simple stone altar. Earth Shamans come here to meditate and draw power from the land itself.',
    area: 'machu_picchu',
    exits: [
      { direction: 'north', targetRoom: 'terraces' },
    ],
    flags: { safe: true },
    defaultItems: [{ itemTemplateId: 82, quantity: 5, respawnMinutes: 60 }], // Huayruro seeds
    defaultNpcs: [{ npcTemplateId: 14, respawnMinutes: 0 }], // Earth Shaman Guildmaster
  },
  {
    id: 'messenger_post',
    name: 'Messenger Post',
    description: 'This small outpost serves as headquarters for the Wind Runners, the swift messengers of the empire. Maps of the road system cover the walls, and various supplies for long journeys are stored here. A trained condor perches on a stone post, ready to carry urgent messages.',
    area: 'machu_picchu',
    exits: [
      { direction: 'south', targetRoom: 'path' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 15, respawnMinutes: 0 }], // Wind Runner Guildmaster
  },
  {
    id: 'marketplace',
    name: 'Marketplace',
    description: 'A bustling marketplace where llamas and alpacas trade goods from across the empire. Colorful textiles hang from wooden stalls, and the aroma of cooking food fills the air. Merchants call out their wares while customers haggle over prices. This is the commercial heart of the community.',
    area: 'machu_picchu',
    exits: [
      { direction: 'north', targetRoom: 'plaza' },
      { direction: 'east', targetRoom: 'weapon_shop' },
      { direction: 'west', targetRoom: 'alchemy_shop' },
      { direction: 'south', targetRoom: 'inn' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 20, respawnMinutes: 0 }], // Weaver Llama shopkeeper
  },
  {
    id: 'weapon_shop',
    name: 'Bronze & Stone Armory',
    description: 'The ring of hammer on metal fills this workshop. A grizzled llama smith works at a forge, crafting weapons and armor from bronze and stone. Finished pieces hang on the walls, their edges gleaming in the firelight. The heat from the forge makes the air shimmer.',
    area: 'machu_picchu',
    exits: [
      { direction: 'west', targetRoom: 'marketplace' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 21, respawnMinutes: 0 }], // Weapon Smith
  },
  {
    id: 'alchemy_shop',
    name: 'Alchemist\'s Den',
    description: 'Strange smells and bubbling sounds fill this cluttered workshop. Shelves are packed with jars of herbs, minerals, and less identifiable substances. An elderly llama alchemist tends to a complex arrangement of tubes and vessels, distilling potions of various colors.',
    area: 'machu_picchu',
    exits: [
      { direction: 'east', targetRoom: 'marketplace' },
    ],
    flags: { safe: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 22, respawnMinutes: 0 }], // Alchemist
  },
  {
    id: 'inn',
    name: 'The Tired Traveler Inn',
    description: 'A cozy inn offering rest and refreshment to weary travelers. Soft wool blankets cover comfortable beds, and a fire crackles in a stone hearth. The innkeeper serves warm food and cold chicha to guests. This is a perfect place to recover from your adventures.',
    area: 'machu_picchu',
    exits: [
      { direction: 'north', targetRoom: 'marketplace' },
    ],
    flags: { safe: true, restRoom: true, restCost: 10 },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 23, respawnMinutes: 0 }], // Innkeeper
  },

  // === DANGEROUS QUEST AREAS ===
  {
    id: 'corrupted_grove',
    name: 'Corrupted Grove',
    description: 'Once a beautiful garden, this grove has been twisted by dark magic. The plants here grow in unnatural shapes, their leaves black and dripping with corruption. Foul spirits lurk among the twisted trees, and the air itself seems to fight against you.',
    area: 'wilderness',
    exits: [
      { direction: 'south', targetRoom: 'earth_shrine' },
      { direction: 'north', targetRoom: 'boss_chamber' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [
      { npcTemplateId: 2, respawnMinutes: 3 }, // Restless Ancestor
      { npcTemplateId: 2, respawnMinutes: 3 }, // Restless Ancestor
    ],
  },
  {
    id: 'haunted_ruins',
    name: 'Haunted Ruins',
    description: 'The ruins of an ancient structure, older even than Machu Picchu itself. Strange lights flicker among the collapsed stones, and whispered voices speak in forgotten languages. Whatever civilization built this place left behind more than just architecture.',
    area: 'wilderness',
    exits: [
      { direction: 'west', targetRoom: 'ancestor_hall' },
      { direction: 'north', targetRoom: 'mountain_pass' },
    ],
    flags: {},
    defaultItems: [{ itemTemplateId: 101, quantity: 1, respawnMinutes: 0 }], // Ancient scroll (quest item)
    defaultNpcs: [
      { npcTemplateId: 2, respawnMinutes: 5 }, // Restless Ancestor
      { npcTemplateId: 4, respawnMinutes: 10 }, // Stone Guardian
    ],
  },
  {
    id: 'mountain_pass',
    name: 'Mountain Pass',
    description: 'A treacherous mountain pass winds between jagged peaks. The wind howls through narrow gaps in the rock, and ice makes every step dangerous. This is the only route to the hidden valley, but few have the courage to traverse it.',
    area: 'wilderness',
    exits: [
      { direction: 'south', targetRoom: 'haunted_ruins' },
      { direction: 'north', targetRoom: 'hidden_valley' },
    ],
    flags: {},
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 3, respawnMinutes: 5 }], // Shadow Condor
  },
  {
    id: 'hidden_valley',
    name: 'Hidden Valley',
    description: 'Beyond the mountain pass lies a secret valley untouched by time. Lush vegetation grows despite the altitude, fed by hot springs that steam in the cold air. This place feels ancient and powerful, as if the gods themselves once walked here.',
    area: 'wilderness',
    exits: [
      { direction: 'south', targetRoom: 'mountain_pass' },
      { direction: 'east', targetRoom: 'boss_chamber' },
    ],
    flags: {},
    defaultItems: [{ itemTemplateId: 80, quantity: 3, respawnMinutes: 60 }], // Gold nuggets
    defaultNpcs: [{ npcTemplateId: 4, respawnMinutes: 10 }], // Stone Guardian
  },
  {
    id: 'boss_chamber',
    name: 'Corrupted Temple',
    description: 'A massive chamber carved from living rock, corrupted by dark forces. Twisted vines cover crumbling pillars, and the altar at the center pulses with malevolent energy. A powerful being has made this place its lair, and its presence fills you with dread.',
    area: 'wilderness',
    exits: [
      { direction: 'west', targetRoom: 'hidden_valley' },
      { direction: 'south', targetRoom: 'corrupted_grove' },
    ],
    flags: { noRecall: true },
    defaultItems: [],
    defaultNpcs: [{ npcTemplateId: 5, respawnMinutes: 30 }], // Corrupted Priest boss
  },
];

// Helper to get room by ID
export function getRoomById(id: string): RoomTemplate | undefined {
  return roomTemplates.find((r) => r.id === id);
}
