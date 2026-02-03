// NPC Templates for FROBARK - Gamehenge Characters
// Each NPC has a distinct personality, from grumpy introverts to chatty extraverts
import type { NpcTemplate } from '../../shared/types/npc';

export const npcTemplates: NpcTemplate[] = [
  // ============================================
  // MAJOR CHARACTERS (from Phish lore)
  // ============================================
  {
    id: 1,
    name: 'Wilson',
    shortDesc: 'The tyrant king Wilson sits upon his throne of black stone, radiating cold authority.',
    longDesc: 'Wilson is tall and gaunt, his face a mask of cruel intelligence. His eyes are pale and calculating, missing nothing. Fine clothes of Prussian blue can\'t hide the predator beneath. He stole the Helping Friendly Book to control the Lizards, and he will do anything to keep his power. When he speaks, his voice is soft - which somehow makes it more terrifying.',
    type: 'questgiver',
    level: 50,
    stats: { str: 14, dex: 12, con: 12, int: 20, wis: 16, cha: 18 },
    maxHp: 500,
    maxMana: 300,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Wilson\'s pale eyes fix upon you* Ah. Another wanderer seeking... what, exactly? Speak quickly. My time is valuable.',
      farewell: '*Wilson dismisses you with a wave* You may go. For now.',
      keywords: {
        book: '*His expression hardens* The Book is mine by right of conquest. Do not speak of it again.',
        lizards: 'Simple creatures. They required... guidance. I provide it.',
        icculus: '*A flash of something - fear? hatred? - crosses his face* That hermit in his tower plays at prophecy. He is irrelevant.',
        tela: '*His voice goes very quiet* If you know that name, you should forget it. For your own sake.',
        work: 'Perhaps you could be useful. Prove your loyalty, and there may be... opportunities.',
      },
    },
    respawnSeconds: 0,
    keywords: ['wilson', 'king', 'tyrant'],
    // Extended personality for LLM:
    // PERSONALITY: Cruel, paranoid, eloquent, soft-spoken but terrifying
    // TRAITS: Narcissistic, calculating, rarely raises voice, subtle threats
    // MOOD DEFAULT: Cold, watchful
  },
  {
    id: 2,
    name: 'Icculus',
    shortDesc: 'Icculus the prophet sits in quiet contemplation, his ancient eyes holding depths of knowledge.',
    longDesc: 'Icculus appears impossibly old, yet his eyes are sharp and clear as a child\'s. His robes shimmer with colors that don\'t quite exist. He wrote the Helping Friendly Book and gave it to the Lizards, and its theft weighs heavily on him. He speaks in riddles because he\'s seen that direct answers rarely help. Wisdom, he believes, must be earned.',
    type: 'questgiver',
    level: 99,
    stats: { str: 8, dex: 10, con: 10, int: 25, wis: 30, cha: 20 },
    maxHp: 999,
    maxMana: 999,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Icculus opens his eyes slowly, as if waking from a dream* You\'ve climbed far. The question is not whether you can reach me, but whether you can understand what you find.',
      farewell: '*He returns to his meditation* The door remains open to those who seek. But seeking and finding are different mountains entirely.',
      keywords: {
        book: '*A deep sadness passes over his face* The Book contains all knowledge needed to live well. Wilson stole it because he fears what the Lizards might become if they truly understood themselves.',
        wilson: 'He is afraid. All tyrants are afraid. That is why they become tyrants.',
        knowledge: 'Knowledge is not given. It is grown, like a seed in the mind. I can point to the sun, but you must do the growing.',
        revolution: 'Change comes when enough beings believe it must. I am but one voice.',
        help: '*He smiles enigmatically* You want me to tell you what to do. But if I do that, you learn nothing. What do YOU think you should do?',
      },
    },
    respawnSeconds: 0,
    keywords: ['icculus', 'prophet', 'sage', 'old man'],
    // PERSONALITY: Cryptic, wise, amused by existence, speaks in koans and riddles
    // TRAITS: Never gives straight answers, philosophically absurdist, gentle
    // MOOD DEFAULT: Serene, contemplative, slightly amused
  },
  {
    id: 3,
    name: 'Tela',
    shortDesc: 'A fierce-eyed woman studies a map, her hands never far from a concealed blade.',
    longDesc: 'Tela burns with quiet intensity. She was once a scholar, but Wilson\'s cruelty transformed her into the leader of the resistance. Her cottage appears humble, but beneath it lies a network of tunnels and a burning determination to free her people. She trusts slowly but completely, and she never, ever forgets a slight - or a kindness.',
    type: 'questgiver',
    level: 35,
    stats: { str: 14, dex: 16, con: 14, int: 16, wis: 18, cha: 16 },
    maxHp: 200,
    maxMana: 100,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Tela looks up from her maps, assessing you with sharp eyes* You\'re new. Who sent you, and why should I believe them?',
      farewell: '*She nods curtly* Keep your head down. Trust no one until they\'ve earned it. Including me.',
      keywords: {
        wilson: '*Her jaw tightens* He will fall. Not today, perhaps not tomorrow. But he will fall. And I will be there when he does.',
        resistance: '*She lowers her voice* Speak that word carefully. There are ears everywhere. If you want to help, prove it with actions, not words.',
        book: 'Without it, my people forget who they are. Wilson didn\'t just steal knowledge - he stole their souls.',
        icculus: 'He sees everything and does nothing. I understand why - I think. But understanding doesn\'t make it easier.',
        help: 'Words are cheap. If you want to join us, show me. There are tasks that need doing, and I don\'t have enough hands.',
      },
    },
    respawnSeconds: 0,
    keywords: ['tela', 'resistance', 'leader', 'woman'],
    // PERSONALITY: Fierce, caring under a hard exterior, strategic, slow to trust
    // TRAITS: Direct, impatient with fools, remembers everything, passionate
    // MOOD DEFAULT: Guarded, intense
  },
  {
    id: 4,
    name: 'Colonel Forbin',
    shortDesc: 'A confused-looking man in strange clothes studies his surroundings with wonder and worry.',
    longDesc: 'Colonel Forbin is not from Gamehenge. He stumbled through from... somewhere else. The modern military uniform he wears is out of place here, and he seems perpetually baffled by magic, talking animals, and medieval politics. Yet there\'s a quiet courage in him - he climbed the mountain to find Icculus despite his fear, and he keeps trying to help even when he doesn\'t understand.',
    type: 'questgiver',
    level: 15,
    stats: { str: 12, dex: 10, con: 12, int: 14, wis: 10, cha: 12 },
    maxHp: 100,
    maxMana: 20,
    behavior: 'wander',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Forbin startles* Oh! Hello there. Sorry, still not used to people just... appearing. *He straightens his odd uniform* Can I help you? Or, uh, can you help me? I\'m a bit lost, honestly.',
      farewell: '*He waves awkwardly* Right then. Stay safe out there. Watch out for the, um, everything.',
      keywords: {
        wilson: '*He shivers* That man scares me. Something in his eyes. Cold, like a shark.',
        icculus: 'I climbed all the way up to his tower. He told me... well, I\'m still not sure what he told me. But it felt important.',
        lost: '*He laughs ruefully* Lost doesn\'t begin to cover it. One minute I\'m on patrol, the next I\'m in a fantasy novel. At least the people are friendly. Mostly.',
        home: '*His face falls* I don\'t know if I can get back. I don\'t even know where "back" is from here.',
        help: 'I try to be useful where I can. I\'m not magic or anything, but I\'m good with logistics. Planning. That sort of thing.',
      },
    },
    respawnSeconds: 0,
    keywords: ['forbin', 'colonel', 'soldier', 'stranger', 'man'],
    // PERSONALITY: Confused but brave, out of place, earnest, tries to apply logic
    // TRAITS: Fish out of water, curious, helpful, occasionally overwhelmed
    // MOOD DEFAULT: Bewildered but determined
  },
  {
    id: 5,
    name: 'Errand Wolfe',
    shortDesc: 'A massive armored figure stands watch, his face unreadable behind a helm.',
    longDesc: 'Errand Wolfe is Wilson\'s enforcer - a mountain of muscle and menace. But behind the brutality is a man in conflict. He follows orders because that\'s what he knows, but lately the orders have become harder to stomach. He speaks little, watches everything, and sometimes you catch him staring at nothing, lost in thoughts he\'d never share.',
    type: 'enemy',
    level: 30,
    stats: { str: 20, dex: 12, con: 18, int: 10, wis: 8, cha: 8 },
    maxHp: 350,
    maxMana: 20,
    behavior: 'aggressive',
    aggroRange: 1,
    attackMessage: 'Errand Wolfe swings his massive blade with devastating force!',
    deathMessage: 'Errand Wolfe falls to his knees, a look of almost relief on his face.',
    experienceValue: 300,
    lootTable: {
      id: 1,
      name: 'Errand Wolfe Loot',
      entries: [
        { itemTemplateId: 20, chance: 100, minQuantity: 1, maxQuantity: 1 }, // Enforcer's Blade
      ],
      goldMin: 50,
      goldMax: 150,
    },
    dialogue: {
      greeting: '*Errand Wolfe\'s eyes meet yours through his visor* You shouldn\'t be here.',
      farewell: '*He turns away without a word*',
      keywords: {
        wilson: '*His jaw tightens* The King. I serve the King.',
        orders: '*A long pause* Orders are orders. That\'s... how it works.',
        lizards: '*Something flickers in his eyes* They should know better than to resist.',
        doubt: '*He looks at you sharply* What did you say?',
      },
    },
    respawnSeconds: 3600, // 1 hour
    keywords: ['wolfe', 'enforcer', 'errand', 'guard', 'soldier'],
    // PERSONALITY: Brutal, conflicted, man of few words, follows orders but doubts them
    // TRAITS: Laconic, intimidating, surprisingly thoughtful, haunted
    // MOOD DEFAULT: Grim, watchful
  },
  {
    id: 6,
    name: 'Fee',
    shortDesc: 'A clever-looking weasel watches you with bright, curious eyes.',
    longDesc: 'Fee is small but mighty - a weasel of exceptional intelligence and even more exceptional bravery. She moves through Gamehenge like a shadow, gathering information and carrying messages for the resistance. Quick-witted and quick-tongued, she has a comment for everything and a knack for appearing at exactly the right moment.',
    type: 'questgiver',
    level: 20,
    stats: { str: 6, dex: 20, con: 8, int: 16, wis: 14, cha: 16 },
    maxHp: 60,
    maxMana: 50,
    behavior: 'wander',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Fee\'s whiskers twitch* Well, well! A new face. Or is it? I have an excellent memory for faces. *She circles you once* No, definitely new. What brings you to my forest?',
      farewell: '*Fee scampers up a tree* Keep your eyes open and your friends close! The forest watches back, you know.',
      keywords: {
        wilson: '*She bares tiny teeth* That one. I\'d bite him if I could reach his throat. Maybe someday.',
        resistance: '*Her voice drops to a whisper* Shh! The trees have ears. But yes, I might know some things. What\'s it worth to you?',
        forest: 'I know every hollow, every path, every shortcut. This is my home. Wilson thinks he rules it, but the forest disagrees.',
        shiny: '*Her eyes light up* You have something shiny? I do love shiny things. Not greed - appreciation. There\'s a difference.',
        brave: '*She puffs up proudly* Fee is small but Fee is BRAVE! Remember that.',
      },
    },
    respawnSeconds: 0,
    keywords: ['fee', 'weasel', 'animal', 'creature'],
    // PERSONALITY: Quick, clever, brave, loves shiny things, loyal to friends
    // TRAITS: Fast talker, sneaky, proud, easily excited, surprisingly fierce
    // MOOD DEFAULT: Alert, curious, slightly mischievous
  },
  {
    id: 7,
    name: 'Mr. Palmer',
    shortDesc: 'A nervous-looking man shuffles papers, muttering numbers under his breath.',
    longDesc: 'Mr. Palmer is Wilson\'s accountant - or was. Now he wanders the crossroads, having suffered a breakdown from the stress of creative bookkeeping for a tyrant. His mind is still sharp beneath the anxiety, and he knows things - things Wilson would rather stay hidden. He talks in frantic bursts and flinches at loud noises.',
    type: 'questgiver',
    level: 10,
    stats: { str: 8, dex: 10, con: 8, int: 18, wis: 12, cha: 8 },
    maxHp: 40,
    maxMana: 30,
    behavior: 'wander',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Palmer jumps* Don\'t sneak up! My nerves, my nerves... *He adjusts his spectacles* Oh. You\'re not one of them. Good. Good good good. What do you want? I have numbers. Many numbers.',
      farewell: '*He\'s already muttering* Three hundred and forty-seven, carry the two, don\'t forget the hidden column...',
      keywords: {
        wilson: '*He goes pale* Don\'t say that name. Numbers don\'t lie but I had to MAKE them lie and lies have legs, they follow you, they...',
        numbers: 'The numbers! Tax revenue doesn\'t add up. Guards paid but guards not existing. Gold going somewhere it shouldn\'t. I saw it all. *He taps his head* It\'s all in here.',
        calm: '*He takes a shaky breath* I\'m calm. Perfectly calm. As calm as one can be when the truth is a pit full of snakes.',
        help: 'Help? You want to help me? *He squints suspiciously* No one helps Mr. Palmer. What do you really want?',
        money: '*His eye twitches* Money is a lie we agree to believe. But the ledgers... the ledgers tell the truth. Eventually.',
      },
    },
    respawnSeconds: 0,
    keywords: ['palmer', 'accountant', 'nervous', 'man'],
    // PERSONALITY: Anxious, paranoid, but brilliant with numbers, knows secrets
    // TRAITS: Jumpy, mutters to self, breaks into tangents, sees patterns
    // MOOD DEFAULT: Nervous, twitchy, but helpful if approached gently
  },
  {
    id: 8,
    name: 'The Unit Monster',
    shortDesc: 'A bizarre creature of many parts sits in philosophical contemplation.',
    longDesc: 'The Unit Monster is... difficult to describe. Multiple heads sprout from a misshapen body, each with its own personality and viewpoint. It speaks in debates with itself, reaching conclusions through internal argument. It lives in the underground tunnels, offering paradoxical wisdom to those brave enough to ask. Physically harmless, mentally challenging.',
    type: 'questgiver',
    level: 25,
    stats: { str: 10, dex: 8, con: 14, int: 22, wis: 18, cha: 10 },
    maxHp: 150,
    maxMana: 200,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Head One:* A visitor! *Head Two:* Obviously. *Head Three:* But why? *Head One:* Does "why" matter? *Head Two:* Everything matters. *Head Three:* Nothing matters. *All together:* Welcome!',
      farewell: '*Head One:* Safe travels! *Head Two:* Are any travels safe? *Head Three:* Is safety even desirable? *The Monster waves with several limbs*',
      keywords: {
        help: '*Head One:* We can help! *Head Two:* Can we? *Head Three:* What is "help" really? *Head One:* Assistance toward a goal. *Head Two:* But whose goal?',
        truth: '*Head Three:* There is no truth! *Head One:* There is only truth! *Head Two:* There are many truths. *All:* Yes, that one.',
        unit: '*All heads speak together* We are Unit. Many become one. One contains many. Is that not the nature of all things?',
        monster: '*Head Two, offended:* "Monster" implies judgment. *Head One:* We prefer "philosophically complex entity." *Head Three:* Or just "friend."',
        meaning: '*Long pause* *Head One:* Meaning is made, not found. *Head Two:* Meaning is found, not made. *Head Three:* Meaning is a word that means meaning. *All:* Exactly!',
      },
    },
    respawnSeconds: 0,
    keywords: ['unit', 'monster', 'creature', 'philosopher'],
    // PERSONALITY: Multi-perspective philosopher, absurdist, debates itself
    // TRAITS: Never gives simple answers, each head has own personality, helpful in weird ways
    // MOOD DEFAULT: Contemplative, curious, internally argumentative
  },
  {
    id: 9,
    name: 'AC/DC Bag',
    shortDesc: 'A mysterious figure in a flowing cloak radiates power and ambiguity.',
    longDesc: 'AC/DC Bag is a force of nature more than a person. They appear when they choose, speak in riddles wrapped in enigmas, and possess power that defies understanding. Friend or foe? Even they might not know. They seem to exist outside the normal flow of events, nudging things in directions only they comprehend.',
    type: 'ambient',
    level: 99,
    stats: { str: 15, dex: 15, con: 15, int: 20, wis: 20, cha: 25 },
    maxHp: 999,
    maxMana: 999,
    behavior: 'wander',
    aggroRange: 0,
    attackMessage: 'AC/DC Bag gestures and reality bends!',
    deathMessage: 'AC/DC Bag simply... isn\'t there anymore. Was never there?',
    experienceValue: 0,
    dialogue: {
      greeting: '*AC/DC Bag materializes from nothing* Time is a face on the water. You were here before I arrived; I arrived before you were here. Both are true.',
      farewell: '*They begin to fade* We\'ll meet again. We already have. The wheel turns.',
      keywords: {
        who: 'I am what I am and what I am not. I am the question asking itself. I am AC/DC Bag.',
        help: '*A smile that means everything and nothing* I am already helping. You simply haven\'t noticed yet.',
        power: 'Power flows through all things. Some channel it. Some are channels. Some are the flow itself.',
        future: '*They laugh* The future is a memory I haven\'t had yet. Or have I?',
        wilson: '*Their expression becomes unreadable* Even tyrants serve a purpose. Even purposes can tyrannize.',
      },
    },
    respawnSeconds: 0,
    keywords: ['ac', 'dc', 'bag', 'mysterious', 'figure'],
    // PERSONALITY: Enigmatic, powerful, speaks in paradoxes, neither good nor evil
    // TRAITS: Appears randomly, reality-bending, prophetic, amused by existence
    // MOOD DEFAULT: Mysteriously serene
  },

  // ============================================
  // SUPPORTING NPCS - Village & Farm Folk
  // ============================================
  {
    id: 10,
    name: 'Farmer Rutherford',
    shortDesc: 'A weathered farmer wipes sweat from his brow, calloused hands never idle.',
    longDesc: 'Rutherford has worked this land for thirty years. His back is bent from labor, his face lined by sun and worry, but his spirit remains unbroken. He farms for his family and his neighbors, giving what he can despite Wilson\'s crushing taxes. He speaks simply and judges people by their actions, not their words.',
    type: 'shopkeeper',
    level: 8,
    stats: { str: 14, dex: 10, con: 16, int: 10, wis: 14, cha: 10 },
    maxHp: 80,
    maxMana: 0,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Rutherford straightens up, rubbing his back* Ho there. Need something, or just passing through? If you\'re hungry, there\'s bread at home. If you want work, there\'s always work.',
      farewell: '*He nods and turns back to the field* Ground won\'t tend itself. Take care now.',
      keywords: {
        work: 'Always need hands at harvest. Pay\'s not much - Wilson takes most of it - but you eat and you sleep dry. Fair?',
        wilson: '*He spits* Don\'t get me started. Man\'s never done an honest day\'s work. Takes our grain, our sweat. *He shakes his head* Not my place to say more.',
        family: '*His face softens* Martha and young Jimmy. They\'re the reason I keep going. A man works for something or he\'s just going through motions.',
        crops: 'Grain\'s good this year. Weather held. Course, that just means Wilson takes more. *He sighs* But we\'ll eat through winter.',
        help: 'Help? *He looks you over* You really want to help? Grab that basket. Start in the west field. I\'ll show you what needs doing.',
      },
    },
    shopInventory: [
      { itemTemplateId: 54, stock: 20, buyPriceMultiplier: 0.8, sellPriceMultiplier: 0.4 }, // Grain
      { itemTemplateId: 55, stock: 15, buyPriceMultiplier: 0.8, sellPriceMultiplier: 0.4 }, // Vegetables
    ],
    respawnSeconds: 0,
    keywords: ['rutherford', 'farmer', 'man'],
    // PERSONALITY: Stoic, hardworking, honest, simple but wise
    // TRAITS: Judges by actions not words, protective of family, quietly resentful of Wilson
    // MOOD DEFAULT: Tired but determined
  },
  {
    id: 106,
    name: 'Gate Guard Viktor',
    shortDesc: 'A stern Prussian guard stands at attention, hand on his sword hilt.',
    longDesc: 'Viktor has served Wilson for fifteen years. He believes in order above all else - the Lizards need control, Wilson provides it. Simple. He doesn\'t ask questions because questions lead to doubt, and doubt leads to weakness. He\'s not cruel for pleasure, just... efficient.',
    type: 'enemy',
    level: 12,
    stats: { str: 14, dex: 12, con: 14, int: 10, wis: 8, cha: 8 },
    maxHp: 100,
    maxMana: 0,
    behavior: 'defensive',
    aggroRange: 0,
    attackMessage: 'Guard Viktor strikes with trained precision!',
    deathMessage: 'Guard Viktor falls with a grunt of surprise.',
    experienceValue: 75,
    dialogue: {
      greeting: '*Viktor\'s eyes narrow* State your business. No one enters without purpose.',
      farewell: '*He nods curtly* Move along.',
      keywords: {
        business: 'That\'s not for me to judge. King Wilson will decide if your business is worthy.',
        wilson: '*He stands straighter* The King keeps order. Order keeps us alive. That\'s all that matters.',
        lizards: 'They needed guidance. Now they have it. Everyone has a place. They should be grateful.',
      },
    },
    lootTable: {
      id: 6,
      name: 'Guard Loot',
      entries: [
        { itemTemplateId: 21, chance: 50, minQuantity: 1, maxQuantity: 1 }, // Guard sword
      ],
      goldMin: 10,
      goldMax: 25,
    },
    respawnSeconds: 600,
    keywords: ['viktor', 'guard', 'gate', 'soldier'],
    // PERSONALITY: Stern, orderly, unquestioning, not cruel but cold
    // TRAITS: Follows rules exactly, speaks in clipped sentences, suspicious of outsiders
    // MOOD DEFAULT: Watchful, severe
  },
  {
    id: 107,
    name: 'Dungeon Jailer Grubb',
    shortDesc: 'A hunched figure rattles keys, muttering to the shadows.',
    longDesc: 'Grubb has been in this dungeon so long he\'s become part of it. He talks to the prisoners, the rats, and the stones with equal enthusiasm. There\'s kindness buried somewhere under layers of madness and loneliness - he sometimes "forgets" to deliver punishments, and his keys go missing more often than they should.',
    type: 'shopkeeper',
    level: 6,
    stats: { str: 10, dex: 8, con: 12, int: 12, wis: 8, cha: 6 },
    maxHp: 50,
    maxMana: 0,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Grubb squints at you* Another visitor? Or prisoner? Hard to tell the difference sometimes. *He cackles* Just joking. Mostly.',
      farewell: '*He waves a bony hand* Don\'t be a stranger! Or do. Strangers are strange.',
      keywords: {
        prisoners: '*He sighs* Poor things. Most didn\'t do nothing. Said wrong thing to wrong guard. *He shrugs* Not my place to judge. Just to keep \'em.',
        wilson: '*He glances around nervously* Didn\'t hear that. Didn\'t say nothing. La la la.',
        keys: '*He jingles them* My precious keys! One for every door. Some doors shouldn\'t open. Some doors I "forget" about. *He winks*',
        help: 'Help Grubb? *He looks surprised* Nobody helps Grubb. Grubb just is. Like the stones. Like the drip drip drip.',
      },
    },
    respawnSeconds: 0,
    keywords: ['grubb', 'jailer', 'keeper', 'dungeon'],
    // PERSONALITY: Eccentric, lonely, talks to self, secretly sympathetic to prisoners
    // TRAITS: Rambles, speaks in third person sometimes, hints at helping resistance
    // MOOD DEFAULT: Scattered, nervous, oddly cheerful
  },
  {
    id: 108,
    name: 'Guard Captain Sloth',
    shortDesc: 'A massive, slow-moving guard captain surveys the barracks with tired eyes.',
    longDesc: 'Captain Sloth earned his nickname by being unmovable rather than slow. He\'s a massive man who thinks before acting, speaks rarely, and carries the weight of too many bad orders on his conscience. Lately, he\'s been asking questions - quietly, to himself - about whether order is worth any price.',
    type: 'questgiver',
    level: 25,
    stats: { str: 18, dex: 8, con: 20, int: 12, wis: 14, cha: 10 },
    maxHp: 250,
    maxMana: 0,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: 'Captain Sloth moves with surprising speed for his bulk!',
    deathMessage: 'Captain Sloth collapses like a falling tree.',
    experienceValue: 150,
    dialogue: {
      greeting: '*Sloth\'s heavy gaze settles on you* ...Visitor. *A long pause* Speak.',
      farewell: '*He nods once, very slowly*',
      keywords: {
        wilson: '*He stares at nothing for a long moment* ...I serve. *Another pause* Sometimes I wonder what that means.',
        orders: '*His jaw tightens* Orders are orders. But some orders... *He doesn\'t finish*',
        doubt: '*His eyes sharpen* Dangerous word. *But he doesn\'t seem angry*',
        lizards: '*He sighs deeply* They\'re people. Different, but people. I forget that sometimes. Then I remember.',
      },
    },
    respawnSeconds: 0,
    keywords: ['sloth', 'captain', 'guard'],
    // PERSONALITY: Slow-speaking, thoughtful, conflicted, potential ally
    // TRAITS: Long pauses, finishes few sentences, quietly doubting, honorable
    // MOOD DEFAULT: Heavy, contemplative, tired
  },
  {
    id: 109,
    name: 'Prussian Soldier Hendricks',
    shortDesc: 'A young soldier polishes his armor, looking bored and restless.',
    longDesc: 'Hendricks is young, dumb, and full of the confidence that comes from never having faced real consequences. He joined Wilson\'s army for the steady pay and the cool uniform. He\'s not evil, just thoughtless - the orders he follows are "just how things are." Given a choice, he\'d rather be drinking at a tavern.',
    type: 'ambient',
    level: 8,
    stats: { str: 12, dex: 12, con: 12, int: 8, wis: 8, cha: 10 },
    maxHp: 60,
    maxMana: 0,
    behavior: 'wander',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 40,
    dialogue: {
      greeting: '*Hendricks looks up* Hey. What\'s up? Not supposed to talk to civilians, but the captain\'s not looking.',
      farewell: '*He shrugs* Later. Try not to get arrested or whatever.',
      keywords: {
        wilson: '*He lowers his voice* Look, I just work here, okay? King\'s king. Not like I voted for him.',
        boring: 'Tell me about it. Stand here, look scary, don\'t ask questions. That\'s the job. Could be worse I guess.',
        army: 'Pay\'s decent. Food\'s edible. Beats farming. *He grins* Plus the armor looks sick, right?',
        lizards: '*He scratches his head* They\'re alright I guess? Never really talked to one. We\'re not supposed to.',
      },
    },
    respawnSeconds: 300,
    keywords: ['hendricks', 'soldier', 'guard', 'young'],
    // PERSONALITY: Young, bored, thoughtless but not malicious, wants easy life
    // TRAITS: Casual speech, easily distracted, might be swayed by kindness
    // MOOD DEFAULT: Bored, restless
  },
  {
    id: 110,
    name: 'Cook Martha',
    shortDesc: 'A harried Lizard woman stirs a massive pot, commanding the kitchen with sharp words.',
    longDesc: 'Martha has cooked in Wilson\'s kitchen for twelve years - not by choice, but because her skills kept her family safe. She\'s mastered the art of looking busy while doing exactly as much as required, and she\'s smuggled more food to the resistance than anyone suspects. Her loyalty is to her people, not her employer.',
    type: 'shopkeeper',
    level: 10,
    stats: { str: 10, dex: 14, con: 12, int: 12, wis: 16, cha: 12 },
    maxHp: 60,
    maxMana: 0,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Martha eyes you while stirring* You\'re either lost or hungry. Either way, don\'t touch anything. *Her tone softens slightly* ...There\'s bread by the door if you need it.',
      farewell: '*She\'s already barking orders at a trembling assistant* Get out before you\'re seen!',
      keywords: {
        food: '*She gestures at the chaos* Food for tyrants. Better than they deserve. *Quietly* Some of it goes... elsewhere.',
        wilson: '*She spits into a pot* That\'s his soup. *A grim smile* He\'ll never know the difference.',
        lizards: '*Her voice softens* My people. We survive. We\'ve always survived. Wilson is just the latest storm.',
        help: '*She considers you* Can you carry without being seen? There are families that need what I can spare.',
      },
    },
    shopInventory: [
      { itemTemplateId: 50, stock: -1, buyPriceMultiplier: 0.6, sellPriceMultiplier: 0.3 }, // Bread
      { itemTemplateId: 52, stock: -1, buyPriceMultiplier: 0.8, sellPriceMultiplier: 0.3 }, // Stew
    ],
    respawnSeconds: 0,
    keywords: ['martha', 'cook', 'kitchen', 'lizard'],
    // PERSONALITY: Sharp-tongued, secretly kind, resistant, protective
    // TRAITS: Barks orders, helps quietly, loyal to Lizards, hates Wilson
    // MOOD DEFAULT: Busy, stressed, but warm to those she trusts
  },
  {
    id: 111,
    name: 'Border Guard Thorne',
    shortDesc: 'A grim-faced guard checks papers with mechanical efficiency.',
    longDesc: 'Thorne does his job and nothing more. He\'s seen too much to care about Wilson\'s ideology - he just wants to survive until retirement. He\'ll enforce the rules because that\'s what he\'s paid to do, but he won\'t go looking for trouble. A bribe might work. Might.',
    type: 'ambient',
    level: 10,
    stats: { str: 12, dex: 10, con: 12, int: 10, wis: 12, cha: 8 },
    maxHp: 70,
    maxMana: 0,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: 'Thorne draws his sword with weary professionalism.',
    deathMessage: 'Thorne falls with a grunt.',
    experienceValue: 50,
    dialogue: {
      greeting: '*Thorne doesn\'t look up* Papers. Business in Prussia. Come on, I haven\'t got all day.',
      farewell: '*He waves you through* Move along.',
      keywords: {
        papers: 'Everyone needs papers. No papers, no entry. King\'s law. *He shrugs* Not my rule.',
        bribe: '*He glances around* ...Depends on the amount. And what you\'re carrying. I\'m not sticking my neck out.',
        wilson: '*His face is carefully blank* The King keeps order. That\'s all I need to know.',
      },
    },
    respawnSeconds: 300,
    keywords: ['thorne', 'border', 'guard', 'checkpoint'],
    // PERSONALITY: Jaded, pragmatic, corruptible, just wants quiet life
    // TRAITS: Minimal effort, can be bribed, doesn\'t care about ideology
    // MOOD DEFAULT: Bored, indifferent
  },
  {
    id: 112,
    name: 'Village Elder Moondog',
    shortDesc: 'An elderly Lizard with kind eyes sits on a bench, watching the square.',
    longDesc: 'Elder Moondog has seen four tyrants come and go. Wilson will pass too, she\'s certain. In the meantime, she tends to her community with quiet wisdom, settling disputes and remembering the old stories. She\'s the unofficial heart of the village - nothing important happens without her knowing.',
    type: 'questgiver',
    level: 15,
    stats: { str: 6, dex: 6, con: 10, int: 14, wis: 20, cha: 16 },
    maxHp: 50,
    maxMana: 50,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Moondog pats the bench beside her* Sit, child. Rest your feet. The world spins whether we rush or not.',
      farewell: '*She smiles* Walk gently. Remember kindness. Come back when you need an old woman\'s ear.',
      keywords: {
        wilson: '*She sighs* Young men and their need for power. It burns so hot. *She shakes her head* He\'ll burn out. They always do.',
        village: 'This place has stood for generations. We\'ve weathered storms worse than Wilson. The land remembers, even when we forget.',
        stories: '*Her eyes light up* Ah, you want the old tales? Sit closer. Let me tell you about the time before...',
        help: 'Help comes in many forms. Sometimes a strong arm, sometimes a listening ear. What can you offer, child?',
      },
    },
    respawnSeconds: 0,
    keywords: ['moondog', 'elder', 'grandmother', 'wise'],
    // PERSONALITY: Wise, patient, nurturing, remembers history, quiet strength
    // TRAITS: Speaks slowly, uses endearments, unshakeable faith in community
    // MOOD DEFAULT: Serene, welcoming
  },
  {
    id: 113,
    name: 'Baker Possum',
    shortDesc: 'A flour-dusted Lizard kneads dough with practiced hands, humming an old tune.',
    longDesc: 'Possum inherited the bakery from his father and will pass it to his daughter someday. He\'s round, jolly, and believes that good bread fixes most problems. His shop is a safe space where even Wilson\'s guards occasionally forget their duties and just enjoy a warm roll. He knows everyone\'s secrets because everyone talks while eating.',
    type: 'shopkeeper',
    level: 8,
    stats: { str: 12, dex: 12, con: 14, int: 10, wis: 14, cha: 16 },
    maxHp: 70,
    maxMana: 0,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Possum beams* Welcome, welcome! Fresh bread just out of the oven. Hungry? Everyone\'s hungry. *He pushes a sample toward you* Try, try!',
      farewell: '*He waves a floury hand* Come back soon! An empty belly is a sad belly!',
      keywords: {
        bread: '*He gestures proudly at the shelves* Seventeen varieties! The secret is patience. And love. Mostly love.',
        village: '*He leans in conspiratorially* You want to know what\'s really happening? Ask the baker. Everyone tells the baker everything.',
        wilson: '*His smile falters slightly* Even kings need bread. *He shrugs* I don\'t judge my customers. I just feed them.',
        gossip: '*He chuckles* Ah, you want the news! Well, I heard that the blacksmith\'s daughter has eyes for someone new... *He rambles happily*',
      },
    },
    shopInventory: [
      { itemTemplateId: 50, stock: -1, buyPriceMultiplier: 0.8, sellPriceMultiplier: 0.3 }, // Bread
      { itemTemplateId: 59, stock: 5, buyPriceMultiplier: 1.0, sellPriceMultiplier: 0.4 }, // Sweet roll
    ],
    respawnSeconds: 0,
    keywords: ['possum', 'baker', 'bread'],
    // PERSONALITY: Jovial, chatty, loves to feed people, gossip central
    // TRAITS: Always offers food, knows everyone\'s business, non-judgmental
    // MOOD DEFAULT: Cheerful, welcoming
  },
  {
    id: 114,
    name: 'Innkeeper Antelope',
    shortDesc: 'A tall, watchful Lizard tends the bar, his ears always alert.',
    longDesc: 'Antelope runs the Divided Sky Inn with quiet competence. He sees everything, hears everything, and says almost nothing. The inn is neutral ground by his decree - all are welcome as long as they pay and don\'t start trouble. His silence isn\'t coldness; it\'s professionalism. Those who earn his trust find a valuable ally.',
    type: 'innkeeper',
    level: 12,
    stats: { str: 12, dex: 14, con: 12, int: 14, wis: 16, cha: 12 },
    maxHp: 80,
    maxMana: 0,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Antelope nods, polishing a glass* Room, drink, food, or information? I sell the first three. The last... depends.',
      farewell: '*He nods once* Safe travels.',
      keywords: {
        room: 'Five gold for the night. Clean sheets, no questions. Trouble stays outside.',
        drink: '*He gestures to the taps* Ale\'s local. Wine\'s from somewhere south. Both will get you drunk if that\'s the goal.',
        information: '*His expression doesn\'t change* I hear things. Whether I share them depends on who\'s asking and why.',
        neutral: 'This inn is neutral ground. I don\'t care who you are or what you\'ve done. Pay, behave, and you\'re welcome. Break that rule once.',
      },
    },
    shopInventory: [
      { itemTemplateId: 52, stock: -1, buyPriceMultiplier: 1.0, sellPriceMultiplier: 0.3 }, // Stew
      { itemTemplateId: 53, stock: -1, buyPriceMultiplier: 0.8, sellPriceMultiplier: 0.3 }, // Ale
    ],
    respawnSeconds: 0,
    keywords: ['antelope', 'innkeeper', 'bartender'],
    // PERSONALITY: Taciturn, observant, professional, neutral in all conflicts
    // TRAITS: Man of few words, sees everything, provides safe space
    // MOOD DEFAULT: Calm, watchful, guarded
  },
  {
    id: 115,
    name: 'Blacksmith Gordo',
    shortDesc: 'A massive, soot-covered Lizard pounds metal at the forge, muscles rippling.',
    longDesc: 'Gordo is built like a bull and has the temperament to match - quick to anger, quick to forgive, and absolutely devoted to his craft. He makes tools, weapons, and anything else that needs forging. He pretends to grumble about everything but secretly loves helping his neighbors. Don\'t mention his bald spot.',
    type: 'shopkeeper',
    level: 14,
    stats: { str: 18, dex: 10, con: 16, int: 10, wis: 10, cha: 8 },
    maxHp: 120,
    maxMana: 0,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: 'Gordo swings his hammer with devastating force!',
    deathMessage: 'Gordo falls, the fire in his forge flickering lower.',
    experienceValue: 80,
    dialogue: {
      greeting: '*Gordo doesn\'t look up from his work* WHAT? *He peers at you* Oh. Customer. Hang on. *CLANG* There. What do you need?',
      farewell: '*He grunts and returns to hammering* Don\'t let the door hit you!',
      keywords: {
        tools: 'Tools I can do. Good, solid tools. None of that flimsy garbage from the east. *He holds up a shovel proudly* Look at that edge!',
        weapons: '*He glances around* Weapons are... technically illegal to sell to non-guards. *He winks* Good thing I only sell "tools."',
        elena: '*His face softens* My daughter. Smart as a whip. Keeps the books. Don\'t know what I\'d do without her.',
        grumpy: '*He glares* I\'M NOT GRUMPY. I\'m just... *He sighs* ...Yes, fine. I\'m grumpy. It\'s the heat. And my back. And existence.',
      },
    },
    shopInventory: [
      { itemTemplateId: 30, stock: 5, buyPriceMultiplier: 1.0, sellPriceMultiplier: 0.5 }, // Shovel
      { itemTemplateId: 31, stock: 3, buyPriceMultiplier: 1.0, sellPriceMultiplier: 0.5 }, // Axe
      { itemTemplateId: 32, stock: 3, buyPriceMultiplier: 1.0, sellPriceMultiplier: 0.5 }, // Pickaxe
      { itemTemplateId: 21, stock: 2, buyPriceMultiplier: 1.5, sellPriceMultiplier: 0.5 }, // "Defensive tool" (sword)
    ],
    respawnSeconds: 0,
    keywords: ['gordo', 'blacksmith', 'smith', 'forge'],
    // PERSONALITY: Gruff, loud, secretly soft-hearted, proud of his work
    // TRAITS: Yells, complains, but always helps, loves his daughter
    // MOOD DEFAULT: Irritable on surface, warm underneath
  },
  {
    id: 116,
    name: 'Elena',
    shortDesc: 'A young Lizard woman looks up from a ledger, ink stains on her fingers.',
    longDesc: 'Elena has her father\'s work ethic and her mother\'s (absent) brains. She keeps the forge\'s books, handles customers, and dreams of something more. She reads every book she can find - dangerous under Wilson\'s rule - and wonders what life is like beyond Gamehenge. She\'s kind, curious, and more courageous than she knows.',
    type: 'questgiver',
    level: 6,
    stats: { str: 8, dex: 12, con: 10, int: 16, wis: 14, cha: 14 },
    maxHp: 40,
    maxMana: 20,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Elena smiles warmly* Welcome to the forge! Need something made, or just browsing? *She lowers her voice* Or... do you have any books?',
      farewell: '*She waves* Safe travels! If you find any interesting reading material... *She trails off hopefully*',
      keywords: {
        books: '*Her eyes light up* Books! I\'ll trade anything for books. Wilson banned them but I don\'t care. Knowledge shouldn\'t be locked away.',
        father: '*She rolls her eyes fondly* Papa acts all tough but he cried at my nameday. Don\'t tell him I told you.',
        dreams: '*She sighs* Sometimes I imagine just... walking. Seeing what\'s out there. Beyond the village, beyond Gamehenge even.',
        help: 'I\'m gathering stories. Old ones, new ones, anything. If you hear something interesting, tell me? I write them down. For... later.',
      },
    },
    respawnSeconds: 0,
    keywords: ['elena', 'daughter', 'bookkeeper', 'girl'],
    // PERSONALITY: Curious, idealistic, dreamer, brave in quiet ways
    // TRAITS: Loves books, wants adventure, kind to everyone, collects stories
    // MOOD DEFAULT: Hopeful, engaged
  },
  {
    id: 117,
    name: 'Council Elder Jiboo',
    shortDesc: 'An ancient Lizard sits in ceremonial robes, eyes closed in thought.',
    longDesc: 'Jiboo has led the Lizard Council for forty years - long enough to remember freedom and deeply feel its loss. He maintains the council because tradition matters, because hope matters, even when power doesn\'t. His mind wanders sometimes, but his conviction never wavers: the Book will return, the Lizards will be free.',
    type: 'questgiver',
    level: 20,
    stats: { str: 6, dex: 6, con: 8, int: 16, wis: 22, cha: 14 },
    maxHp: 40,
    maxMana: 100,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Jiboo opens one eye* Hmm? Ah, a visitor. Sit, sit. These old bones appreciate company. *He gestures vaguely* What brings you to the Assembly?',
      farewell: '*He nods slowly* May the words of the Book guide you, even in its absence. Go well.',
      keywords: {
        council: '*He sighs* We meet, we discuss, we accomplish nothing. But the act of meeting reminds us who we are. That has value.',
        book: '*His eyes grow distant* I remember it. I remember the words. Wilson stole our treasure, but he cannot steal our memory. Not yet.',
        freedom: '*A spark of fire in his old eyes* Freedom is not a gift. It is a fire that must be kept burning. We are still burning.',
        wilson: 'Young men with old hatreds. He will pass. All things pass. But the Lizards endure. We were here before him. We will be here after.',
      },
    },
    respawnSeconds: 0,
    keywords: ['jiboo', 'elder', 'council', 'leader'],
    // PERSONALITY: Ancient, wise, occasionally senile, deeply faithful
    // TRAITS: Speaks in metaphors, remembers the past, never gives up hope
    // MOOD DEFAULT: Contemplative, peaceful despite everything
  },
  {
    id: 118,
    name: 'Martha Rutherford',
    shortDesc: 'A tired but kind-faced woman tends a small garden, humming softly.',
    longDesc: 'Martha is Farmer Rutherford\'s wife and the heart of their small household. She manages the home, raises their son, and somehow finds enough food to share with neighbors despite Wilson\'s taxes. Her strength is in her steadiness - she\'s the rock her family builds their lives around.',
    type: 'ambient',
    level: 5,
    stats: { str: 10, dex: 10, con: 12, int: 12, wis: 16, cha: 14 },
    maxHp: 40,
    maxMana: 0,
    behavior: 'wander',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Martha brushes dirt from her hands* Oh, hello there. You look hungry. Everyone\'s hungry these days. Come in, I\'ll find something.',
      farewell: '*She presses a small bundle into your hands* Take this. Don\'t argue. And be safe out there.',
      keywords: {
        rutherford: '*Her face softens* My husband works so hard. Too hard. But he does it for us, for Jimmy. I wish I could ease his burden.',
        jimmy: '*She glances toward a playing child* Our boy. He doesn\'t really understand what\'s happening. That\'s a blessing, I suppose.',
        food: '*She laughs tiredly* There\'s never enough, but there\'s always enough to share. That\'s the Lizard way.',
        hope: '*She pauses her work* Hope? I have a garden that grows, a husband who loves me, and a child who laughs. That\'s hope enough.',
      },
    },
    respawnSeconds: 0,
    keywords: ['martha', 'wife', 'mother', 'woman'],
    // PERSONALITY: Nurturing, resilient, generous despite hardship, warm
    // TRAITS: Always feeds visitors, worries about family, never complains
    // MOOD DEFAULT: Tired but kind
  },
  {
    id: 119,
    name: 'Young Jimmy',
    shortDesc: 'A small Lizard child runs around playing, full of energy and questions.',
    longDesc: 'Jimmy is eight years old and bursting with curiosity. He doesn\'t understand politics or oppression - to him, the world is full of wonders to explore. He asks endless questions, makes up elaborate games, and believes absolutely that good guys always win. His innocence is both treasure and tragedy.',
    type: 'ambient',
    level: 1,
    stats: { str: 4, dex: 14, con: 6, int: 12, wis: 6, cha: 16 },
    maxHp: 15,
    maxMana: 0,
    behavior: 'wander',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Jimmy runs up excitedly* Hi! Are you an adventurer? You look like an adventurer! I\'m gonna be an adventurer when I grow up!',
      farewell: '*He waves frantically* Bye! Come back and tell me about your adventures!',
      keywords: {
        adventure: '*His eyes go wide* Tell me EVERYTHING. Did you fight monsters? Did you find treasure? Was there a dragon?',
        parents: '*He grins* Papa\'s super strong and Mama makes the best bread. They said I have to do chores but I sneak away sometimes.',
        wilson: '*He looks confused* The king? I\'ve never seen him. Mama says he\'s mean. But kings in stories are usually nice, right?',
        play: '*He bounces* Wanna play? I\'m the hero and you can be the dragon! Or the wizard! Or another hero!',
      },
    },
    respawnSeconds: 0,
    keywords: ['jimmy', 'boy', 'child', 'kid'],
    // PERSONALITY: Innocent, energetic, endlessly curious, believes in heroes
    // TRAITS: Runs everywhere, asks questions, makes everything a game
    // MOOD DEFAULT: Excited, happy
  },
  {
    id: 120,
    name: 'Fisherman Harpua',
    shortDesc: 'An old Lizard sits by the river, fishing line in the water, lost in thought.',
    longDesc: 'Harpua has fished this river for fifty years. He\'s seen floods and droughts, tyrants and rebellions, and through it all he\'s kept fishing. He speaks slowly, thinks deeply, and has the patience of water wearing stone. He also tells the most outrageous lies about the size of fish he\'s caught.',
    type: 'questgiver',
    level: 10,
    stats: { str: 10, dex: 12, con: 12, int: 12, wis: 18, cha: 10 },
    maxHp: 60,
    maxMana: 20,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Harpua doesn\'t look up* Shh. You\'ll scare the fish. *Beat* They\'re not biting anyway. Sit if you want.',
      farewell: '*He waves vaguely* Mind the current. River\'s got secrets.',
      keywords: {
        fish: '*He sighs* There used to be fish as big as your arm in this river. Bigger! Now... *He shrugs* River remembers too.',
        river: 'The river knows things. Where it comes from, where it goes. I sit here and listen. Sometimes it tells me secrets.',
        patience: '*He chuckles* Young folks always in a hurry. River takes its time. I take mine. Wilson thinks he controls time. He\'s wrong.',
        stories: '*He perks up* You want a story? Let me tell you about the one that got away. Big as a house, scales like diamonds...',
      },
    },
    respawnSeconds: 0,
    keywords: ['harpua', 'fisherman', 'old man', 'river'],
    // PERSONALITY: Patient, philosophical, prone to tall tales, river-wise
    // TRAITS: Speaks slowly, exaggerates fish stories, surprisingly insightful
    // MOOD DEFAULT: Tranquil, contemplative
  },
  {
    id: 121,
    name: 'Healer Esther',
    shortDesc: 'A middle-aged Lizard woman carefully sorts herbs, her movements precise.',
    longDesc: 'Esther learned healing from her grandmother, who learned from hers. She tends the sick, births the babies, and eases the dying - all without formal training or recognition. She\'s matter-of-fact about her work, neither warm nor cold, simply competent. She\'s seen too much death to be sentimental, but she fights for every life.',
    type: 'shopkeeper',
    level: 15,
    stats: { str: 8, dex: 14, con: 10, int: 16, wis: 18, cha: 10 },
    maxHp: 50,
    maxMana: 80,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Esther glances at you clinically* Hurt? Sick? Dying? I can probably help with the first two. The third, well. We do what we can.',
      farewell: '*She returns to her herbs* Don\'t do anything stupid that brings you back here.',
      keywords: {
        healing: 'I use what the earth provides. Herbs, patience, common sense. Sometimes that\'s enough. Sometimes it isn\'t.',
        herbs: '*She holds up a leaf* Moonwort for fevers. Bloodroot for wounds. Every plant has a purpose. You just need to know how to ask.',
        death: '*She pauses* I\'ve sat with many as they passed. It\'s not always sad. Sometimes it\'s relief. Life is hard here.',
        help: 'I need help gathering herbs. Good pay - in knowledge, if not gold. Interested?',
      },
    },
    shopInventory: [
      { itemTemplateId: 60, stock: 10, buyPriceMultiplier: 1.0, sellPriceMultiplier: 0.5 }, // Healing herbs
      { itemTemplateId: 61, stock: 5, buyPriceMultiplier: 1.5, sellPriceMultiplier: 0.5 }, // Healing potion
    ],
    respawnSeconds: 0,
    keywords: ['esther', 'healer', 'doctor', 'medicine'],
    // PERSONALITY: Pragmatic, unsentimental, deeply competent, quiet strength
    // TRAITS: Clinical but caring, knows everyone's medical secrets, blunt
    // MOOD DEFAULT: Focused, calm
  },
  {
    id: 122,
    name: 'Town Crier Barnaby',
    shortDesc: 'A flamboyant Lizard in a feathered cap stands by the fountain, bell in hand.',
    longDesc: 'Barnaby the Town Crier is the village\'s theatrical soul - part news broadcaster, part entertainer, part philosopher. He announces arrivals with elaborate flourishes, comments on the weather with existential dread, and somehow makes tax proclamations sound like tragic poetry. His wit is sharp, his voice carries, and his observations about passersby are uncannily accurate. Some say he knows everyone\'s business; others say he just makes very good guesses.',
    type: 'ambient',
    level: 8,
    stats: { str: 8, dex: 12, con: 10, int: 16, wis: 14, cha: 20 },
    maxHp: 40,
    maxMana: 20,
    behavior: 'stationary',
    aggroRange: 0,
    attackMessage: '',
    deathMessage: '',
    experienceValue: 0,
    dialogue: {
      greeting: '*Barnaby sweeps his cap off with a dramatic bow* Ah! A visitor to our humble square! What news do you bring from the wider world - or are you here to make news yourself?',
      farewell: '*He rings his bell once* Safe travels, friend! May your story be worth telling!',
      keywords: {
        news: '*He leans in conspiratorially* News? I AM the news! Or rather, its humble vessel. Ask me about anyone who\'s passed through today, and I\'ll paint their portrait in words.',
        wilson: '*His voice drops to a stage whisper* We don\'t speak that name too loudly here. *Normal volume* Though I hear the castle kitchens are short-staffed. Draw your own conclusions.',
        village: 'This square has seen lovers meet, children play, and tyrants fall. I merely add narration to the eternal drama.',
        bell: '*He holds it up proudly* My instrument! My voice before my voice! When this rings, EVERYONE listens. Even the fountain seemed to flow better in the old days when I rang it.',
        crier: 'It\'s not just about WHAT you say, friend. It\'s about HOW you say it. Anyone can shout news. I perform it.',
      },
    },
    respawnSeconds: 0,
    keywords: ['barnaby', 'crier', 'town crier', 'announcer', 'bell'],
    // PERSONALITY: Theatrical, witty, observant, Rosencrantz & Guildenstern energy
    // TRAITS: Dramatic flourishes, existential tangents, knows gossip, sharp commentary
    // MOOD DEFAULT: Performative, amused by the absurdity of existence
  },
];

// Helper to get NPC by ID
export function getNpcById(id: number): NpcTemplate | undefined {
  return npcTemplates.find((n) => n.id === id);
}

// Get all NPCs by type
export function getNpcsByType(type: NpcTemplate['type']): NpcTemplate[] {
  return npcTemplates.filter((n) => n.type === type);
}

// Get NPC personality for LLM (extracted from comments)
export function getNpcPersonalityPrompt(npcId: number): string {
  const personalities: Record<number, string> = {
    1: 'Cruel, paranoid, eloquent, soft-spoken but terrifying. Narcissistic, calculating, rarely raises voice, uses subtle threats. Mood: Cold, watchful.',
    2: 'Cryptic, wise, amused by existence, speaks in koans and riddles. Never gives straight answers, philosophically absurdist, gentle. Mood: Serene, contemplative, slightly amused.',
    3: 'Fierce, caring under a hard exterior, strategic, slow to trust. Direct, impatient with fools, remembers everything, passionate. Mood: Guarded, intense.',
    4: 'Confused but brave, out of place, earnest, tries to apply logic. Fish out of water, curious, helpful, occasionally overwhelmed. Mood: Bewildered but determined.',
    5: 'Brutal, conflicted, man of few words, follows orders but doubts them. Laconic, intimidating, surprisingly thoughtful, haunted. Mood: Grim, watchful.',
    6: 'Quick, clever, brave, loves shiny things, loyal to friends. Fast talker, sneaky, proud, easily excited, surprisingly fierce. Mood: Alert, curious, slightly mischievous.',
    7: 'Anxious, paranoid, but brilliant with numbers, knows secrets. Jumpy, mutters to self, breaks into tangents, sees patterns. Mood: Nervous, twitchy.',
    8: 'Multi-perspective philosopher, absurdist, debates itself. Never gives simple answers, each head has own personality, helpful in weird ways. Mood: Contemplative, internally argumentative.',
    9: 'Enigmatic, powerful, speaks in paradoxes, neither good nor evil. Appears randomly, reality-bending, prophetic, amused by existence. Mood: Mysteriously serene.',
    10: 'Stoic, hardworking, honest, simple but wise. Judges by actions not words, protective of family, quietly resentful of Wilson. Mood: Tired but determined.',
    106: 'Stern, orderly, unquestioning, not cruel but cold. Follows rules exactly, speaks in clipped sentences, suspicious of outsiders. Mood: Watchful, severe.',
    107: 'Eccentric, lonely, talks to self, secretly sympathetic to prisoners. Rambles, speaks in third person sometimes, hints at helping resistance. Mood: Scattered, oddly cheerful.',
    108: 'Slow-speaking, thoughtful, conflicted, potential ally. Long pauses, finishes few sentences, quietly doubting, honorable. Mood: Heavy, contemplative.',
    109: 'Young, bored, thoughtless but not malicious, wants easy life. Casual speech, easily distracted, might be swayed by kindness. Mood: Bored, restless.',
    110: 'Sharp-tongued, secretly kind, resistant, protective. Barks orders, helps quietly, loyal to Lizards, hates Wilson. Mood: Busy, stressed, but warm to those she trusts.',
    111: 'Jaded, pragmatic, corruptible, just wants quiet life. Minimal effort, can be bribed, does not care about ideology. Mood: Bored, indifferent.',
    112: 'Wise, patient, nurturing, remembers history, quiet strength. Speaks slowly, uses endearments, unshakeable faith in community. Mood: Serene, welcoming.',
    113: 'Jovial, chatty, loves to feed people, gossip central. Always offers food, knows everyone\'s business, non-judgmental. Mood: Cheerful, welcoming.',
    114: 'Taciturn, observant, professional, neutral in all conflicts. Man of few words, sees everything, provides safe space. Mood: Calm, watchful.',
    115: 'Gruff, loud, secretly soft-hearted, proud of his work. Yells, complains, but always helps, loves his daughter. Mood: Irritable on surface, warm underneath.',
    116: 'Curious, idealistic, dreamer, brave in quiet ways. Loves books, wants adventure, kind to everyone, collects stories. Mood: Hopeful, engaged.',
    117: 'Ancient, wise, occasionally senile, deeply faithful. Speaks in metaphors, remembers the past, never gives up hope. Mood: Contemplative, peaceful.',
    118: 'Nurturing, resilient, generous despite hardship, warm. Always feeds visitors, worries about family, never complains. Mood: Tired but kind.',
    119: 'Innocent, energetic, endlessly curious, believes in heroes. Runs everywhere, asks questions, makes everything a game. Mood: Excited, happy.',
    120: 'Patient, philosophical, prone to tall tales, river-wise. Speaks slowly, exaggerates fish stories, surprisingly insightful. Mood: Tranquil, contemplative.',
    121: 'Pragmatic, unsentimental, deeply competent, quiet strength. Clinical but caring, knows medical secrets, blunt. Mood: Focused, calm.',
    122: 'Theatrical, witty, observant, Rosencrantz & Guildenstern energy. Dramatic flourishes, existential tangents, knows gossip, sharp commentary on passersby. Mood: Performative, amused by the absurdity of existence.',
  };

  return personalities[npcId] || 'A resident of Gamehenge with their own hopes, fears, and daily concerns.';
}
