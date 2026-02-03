/**
 * LLAMA AT MACHU PICCHU - Game Engine
 * A Text Adventure in the Style of Rosencrantz and Guildenstern Are Dead
 */

export interface Room {
  name: string;
  description: string;
  exits: Record<string, string>; // direction -> room_id
  items: Record<string, string | Record<string, string>>; // item -> description or container
  visited: boolean;
}

export interface Player {
  name: string;
  location: string;
  inventory: Record<string, string>;
  hasSpit: boolean;
  gameFlags: Record<string, boolean>;
}

export interface QuestionGameState {
  active: boolean;
  playerScore: number;
  alpacaScore: number;
  round: number;
  usedQuestions: string[];
  currentQuestion: string;
}

export interface CoinGameState {
  consecutiveUps: number;
  totalFlips: number;
}

export interface GameState {
  player: Player;
  rooms: Record<string, Room>;
  turnCount: number;
  questionGame: QuestionGameState;
  coinGame: CoinGameState;
  gameOver: boolean;
  victoryShown: boolean;
}

const ALPACA_QUESTIONS = [
  "Why do you think you're here?",
  "Have you considered what happens next?",
  "Is that really the best you can do?",
  "Do llamas dream of electric guinea pigs?",
  "What would you say if I said nothing?",
  "Doesn't the altitude make you dizzy?",
  "Have you ever noticed how stones just... sit there?",
  "Why is the sky blue at this elevation?",
  "Do you think the Sapa Inca ever wonders about us?",
  "Is existence not the strangest thing?",
  "What's the point of having four legs if we're always standing still?",
  "Have you eaten any particularly good grass lately?",
  "Why do humans build stairs when they could just climb?",
  "Isn't it odd that we're having this conversation?",
  "Do you think there's a llama afterlife?",
  "What if the terraces go on forever?",
  "Can a question be its own answer?",
  "Why do you suppose they call it 'Machu' Picchu?",
];

const PHILOSOPHICAL_THOUGHTS = [
  "You think about the nature of being a llama. Four legs. Good wool. What else is there?",
  "You ponder existence. Then you ponder grass. The grass wins.",
  "If a llama thinks in the mountains and no one hears it, does it make a sound? No, because thinking is silent.",
  "You consider the stones around you. They were placed here with purpose. Your purpose is... standing here, apparently.",
  "The altitude makes you philosophical. Or maybe you're always philosophical. Hard to tell.",
  "You think about whether the other llamas think about things. They seem focused on grass. Maybe that's wisdom.",
  "For a moment, you feel connected to all llamas, past and future. Then the feeling passes and you're just you again.",
  "You wonder if the sun really needs to be hitched. It seems to rise regardless.",
];

const FALLBACK_RESPONSES = [
  "You contemplate doing that, but ultimately decide against it. You're a llama, after all.",
  "The universe considers your request and returns: 'Error 404: Action Not Found in the Cosmic Registry.'",
  "You try, but nothing happens. Perhaps the stones have other plans for you.",
  "That's not really a thing llamas do. Trust me, I've checked.",
  "The condor overhead caws mockingly. Even it knows that's not a valid command.",
  "You stand there, four legs planted firmly, unsure of what exactly you were trying to accomplish.",
  "The wind whispers something about 'try looking around' or 'maybe pick something up.'",
  "Your llama brain processes this request and returns a gentle 'huh?'",
  "The Incas didn't build this city so you could do... whatever that was.",
  "Perhaps try something more llama-appropriate? Like walking. Or looking. Or existing contemplatively.",
];

export function createInitialState(): GameState {
  const rooms: Record<string, Room> = {
    plaza: {
      name: "The Main Plaza",
      description: "You stand in the central plaza of Machu Picchu. The Sacred Rock looms to the north, its shape echoing the mountain behind it. Stone buildings line the east and west. Llamas (your cousins, perhaps?) graze nearby, looking at you as if they know something you don't. Which is unsettling, given that they're also llamas.",
      exits: { n: "sacred_rock", e: "temple_sun", s: "terraces", w: "three_windows" },
      items: { coca_leaf: "A single coca leaf, green and slightly bitter-looking. The Incas use these for everything - rituals, medicine, getting through long llama-herding days." },
      visited: false,
    },
    sacred_rock: {
      name: "The Sacred Rock",
      description: "An enormous flat stone, shaped like the mountain Yanantin behind it. Priests sometimes come here to do... priestly things. The stone is said to be a portal, though a portal to WHERE is a question that makes your llama brain hurt. There's an unusual marking on its surface.",
      exits: { s: "plaza", w: "intihuatana" },
      items: { small_stone: "A small stone that has chipped off the Sacred Rock. It feels... significant? Or maybe it's just a rock. Hard to tell with rocks." },
      visited: false,
    },
    temple_sun: {
      name: "Temple of the Sun",
      description: "The curved walls of the Temple of the Sun wrap around you. Windows are positioned with astronomical precision - on the solstice, light falls exactly upon the ceremonial stone. It's all very impressive, though as a llama, you find yourself wondering if all this effort couldn't have gone into growing more grass.",
      exits: { w: "plaza", d: "royal_tomb", n: "spring" },
      items: {},
      visited: false,
    },
    intihuatana: {
      name: "The Intihuatana Stone",
      description: "The 'Hitching Post of the Sun' rises before you, a carved stone pillar used to 'tie' the sun during winter solstice. The priests say it prevents the sun from escaping. You, being a llama, have opinions about this claim but keep them to yourself. There's an alpaca here, looking philosophically at the horizon.",
      exits: { e: "sacred_rock", s: "plaza" },
      items: { knotted_cord: "A small quipu - a knotted cord used for record-keeping. This one seems to record... something. The knots are complex. You can't read it. You're a llama." },
      visited: false,
    },
    terraces: {
      name: "The Agricultural Terraces",
      description: "Rows upon rows of terraces descend the mountainside, carved into steps that grow maize, potatoes, and coca. The engineering is remarkable. Also remarkable: the grass here is DELICIOUS. You resist the urge to graze. Actually, no you don't. You take a small bite. It's really good grass.",
      exits: { n: "plaza", e: "guardhouse", s: "path" },
      items: { maize: "A cob of maize, golden and perfect. It represents life, sustenance, and also makes a decent snack." },
      visited: false,
    },
    guardhouse: {
      name: "The Guardhouse",
      description: "From this restored building, you can see the entire complex below, plus the winding path that leads down to the Urubamba River. A guard llama (yes, that's a real job) stands nearby, looking official. Or as official as a llama can look, which is surprisingly official.",
      exits: { w: "terraces" },
      items: { wool_blanket: "A colorful wool blanket, probably made from your relatives. You try not to think about this too hard." },
      visited: false,
    },
    royal_tomb: {
      name: "The Royal Tomb",
      description: "A natural cave beneath the Temple of the Sun, shaped and enhanced by Incan stoneworkers. The walls are smooth, the air is cool. Something important was buried here once. Or will be buried here. Time is confusing when you're a llama experiencing what might be a philosophical crisis.",
      exits: { u: "temple_sun" },
      items: { offering_box: { golden_earring: "A golden earring, fit for Incan nobility. Very shiny.", dried_flowers: "Flowers, dried and preserved. They smell like memory." } },
      visited: false,
    },
    condor_temple: {
      name: "Temple of the Condor",
      description: "The rock here has been carved to resemble a condor in flight, its wings forming natural walls. You've seen condors circling overhead. They're impressive birds. You're an impressive llama. Perhaps there's common ground there, in the impressiveness. A strange door is set into the back wall.",
      exits: { w: "spring" },
      items: { feather: "A condor feather, large and dark. It has a certain gravitas." },
      visited: false,
    },
    secret_room: {
      name: "The Hidden Chamber",
      description: "You're not supposed to be here. This is clear from the way everything feels... secret. Ancient quipus hang from the walls - knotted strings that record everything the Incas know. In the center, a small altar holds a golden llama figurine. It looks a bit like you, actually.",
      exits: { w: "condor_temple" },
      items: {},
      visited: false,
    },
    path: {
      name: "Mountain Path",
      description: "A narrow path winds along the mountainside. To one side: a stunning view of cloud forest and river valley. To the other: a very long fall. You're a sure-footed llama, so this doesn't bother you. Much. Actually, don't look down.",
      exits: { n: "terraces" },
      items: {},
      visited: false,
    },
    spring: {
      name: "The Sacred Spring",
      description: "Water bubbles up from the mountain itself, channeled through carved stone fountains. The Incas have built sixteen of these fountains in a row, each flowing into the next. The sound is peaceful. You drink some water. It tastes like... water, but somehow more meaningful.",
      exits: { s: "temple_sun", e: "condor_temple" },
      items: { clay_vessel: "A clay vessel for carrying water. Useful, practical, unassuming." },
      visited: false,
    },
    three_windows: {
      name: "Temple of Three Windows",
      description: "Three trapezoidal windows look out over the main plaza. Legend says the Incan ancestors emerged from three caves, represented by these windows. You're a llama, so your ancestors were also llamas, emerging from wherever llamas emerge from. A field, probably.",
      exits: { e: "plaza", n: "intihuatana" },
      items: {},
      visited: false,
    },
  };

  return {
    player: {
      name: "Quyllur",
      location: "plaza",
      inventory: {},
      hasSpit: true,
      gameFlags: {},
    },
    rooms,
    turnCount: 0,
    questionGame: {
      active: false,
      playerScore: 0,
      alpacaScore: 0,
      round: 0,
      usedQuestions: [],
      currentQuestion: "",
    },
    coinGame: {
      consecutiveUps: 0,
      totalFlips: 0,
    },
    gameOver: false,
    victoryShown: false,
  };
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRoomDescription(state: GameState, verbose: boolean = false): string {
  const room = state.rooms[state.player.location];
  const lines: string[] = [];

  if (verbose || !room.visited) {
    lines.push(`\n${room.name}`);
    lines.push("-".repeat(room.name.length));
    lines.push(room.description);
  } else {
    lines.push(`\n${room.name}`);
  }

  const visibleItems = Object.keys(room.items);
  if (visibleItems.length > 0) {
    lines.push(`\nYou see: ${visibleItems.join(", ")}`);
  }

  const exitNames: Record<string, string> = {
    n: "north", s: "south", e: "east", w: "west",
    u: "up", d: "down", ne: "northeast", nw: "northwest",
    se: "southeast", sw: "southwest"
  };
  const exits = Object.keys(room.exits).map(d => exitNames[d] || d);
  if (exits.length > 0) {
    lines.push(`Exits: ${exits.join(", ")}`);
  }

  return lines.join("\n");
}

function isQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.endsWith("?")) return true;

  const questionStarters = [
    "who", "what", "where", "when", "why", "how",
    "is", "are", "do", "does", "did", "can", "could",
    "would", "should", "will", "have", "has", "had",
    "isn't", "aren't", "don't", "doesn't", "didn't",
    "can't", "couldn't", "wouldn't", "shouldn't"
  ];
  const firstWord = trimmed.toLowerCase().split(/\s+/)[0] || "";
  return questionStarters.includes(firstWord);
}

function getAlpacaQuestion(state: GameState): string {
  const available = ALPACA_QUESTIONS.filter(q => !state.questionGame.usedQuestions.includes(q));
  if (available.length === 0) {
    state.questionGame.usedQuestions = [];
    return getRandomElement(ALPACA_QUESTIONS);
  }
  const question = getRandomElement(available);
  state.questionGame.usedQuestions.push(question);
  return question;
}

export interface ProcessResult {
  output: string;
  state: GameState;
  needsLLM?: boolean;
  userInput?: string;
}

export function processCommand(state: GameState, rawInput: string): ProcessResult {
  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  const words = rawInput.toLowerCase().trim().split(/\s+/);
  if (words.length === 0 || !words[0]) {
    return { output: "", state: newState };
  }

  // Handle question game mode
  if (newState.questionGame.active) {
    if (["quit", "stop", "exit", "end"].includes(rawInput.toLowerCase())) {
      newState.questionGame.active = false;
      return { output: "\nYou end the question game. The Alpaca looks slightly disappointed.", state: newState };
    }

    newState.questionGame.round++;

    if (!isQuestion(rawInput)) {
      newState.questionGame.alpacaScore++;
      const fouls = [
        "Statement! One-love.",
        "That wasn't a question! Two-love.",
        "Rhetoric is acceptable, but THAT was a statement!",
        "A statement! We're not playing the statement game!",
        "Foul! Declarative sentence detected!",
      ];
      const foul = getRandomElement(fouls);

      if (newState.questionGame.alpacaScore >= 3) {
        newState.questionGame.active = false;
        return {
          output: `${foul}\n\nThe Alpaca has won. It looks smug, which is impressive for an alpaca.`,
          state: newState
        };
      }

      const nextQ = getAlpacaQuestion(newState);
      newState.questionGame.currentQuestion = nextQ;
      return {
        output: `${foul}\n\nScore: You ${newState.questionGame.playerScore} - Alpaca ${newState.questionGame.alpacaScore}\n\nAlpaca: ${nextQ}`,
        state: newState
      };
    }

    // Good question - alpaca sometimes fails
    if (Math.random() < 0.2 && newState.questionGame.round > 2) {
      newState.questionGame.playerScore++;
      if (newState.questionGame.playerScore >= 3) {
        newState.questionGame.active = false;
        newState.player.gameFlags.won_question_game = true;
        return {
          output: `Alpaca: "I... that is to say..." Statement! The Alpaca falters!\n\nYou've won this round! The Alpaca nods respectfully.\n\n(The Alpaca nods sagely. 'The secret door in the Condor Temple,' it says, 'responds to those who carry both what flies and what stays.')`,
          state: newState
        };
      }
      const nextQ = getAlpacaQuestion(newState);
      newState.questionGame.currentQuestion = nextQ;
      return {
        output: `Alpaca: "Well, I think..." Wait, that's a statement!\n\nScore: You ${newState.questionGame.playerScore} - Alpaca ${newState.questionGame.alpacaScore}\n\nAlpaca: ${nextQ}`,
        state: newState
      };
    }

    const nextQ = getAlpacaQuestion(newState);
    newState.questionGame.currentQuestion = nextQ;
    return {
      output: `Good question!\n\nAlpaca: ${nextQ}`,
      state: newState
    };
  }

  // Regular command processing
  newState.turnCount++;
  if (newState.turnCount % 5 === 0) {
    newState.player.hasSpit = true;
  }

  let cmd = words[0];
  const args = words.slice(1);

  // Direction shortcuts
  const directions: Record<string, string> = {
    n: "north", s: "south", e: "east", w: "west",
    u: "up", d: "down", ne: "northeast", nw: "northwest",
    se: "southeast", sw: "southwest"
  };
  const reverseDir: Record<string, string> = {
    north: "n", south: "s", east: "e", west: "w",
    up: "u", down: "d", northeast: "ne", northwest: "nw",
    southeast: "se", southwest: "sw"
  };

  if (cmd in directions || cmd in reverseDir) {
    const dir = reverseDir[cmd] || cmd;
    const room = newState.rooms[newState.player.location];
    if (dir in room.exits) {
      const wasVisited = newState.rooms[room.exits[dir]].visited;
      newState.player.location = room.exits[dir];
      newState.rooms[newState.player.location].visited = true;

      let output = getRoomDescription(newState, !wasVisited);

      // Check for golden llama spawn
      if (newState.player.location === "secret_room" && !("golden_llama" in newState.rooms.secret_room.items)) {
        newState.rooms.secret_room.items.golden_llama = "A golden llama figurine. It's you, but in gold. This is either an honor or deeply unsettling.";
        output += "\n\n[The golden llama figurine glints in the dim light. It seems important.]";
      }

      return { output, state: newState };
    }
    return { output: "You cannot go that way. The stones are silent on the matter.", state: newState };
  }

  // Aliases
  const aliases: Record<string, string> = {
    walk: "go", move: "go", run: "go",
    get: "take", grab: "take", pick: "take",
    inv: "inventory", i: "inventory",
    l: "look", examine: "look", x: "look",
    q: "quit", exit: "quit",
    "?": "help", h: "help",
  };
  cmd = aliases[cmd] || cmd;

  // GO command
  if (cmd === "go") {
    if (args.length === 0) {
      return { output: "Go where? The existential question of our time.", state: newState };
    }
    const dir = reverseDir[args[0]] || args[0];
    const room = newState.rooms[newState.player.location];
    if (dir in room.exits) {
      const wasVisited = newState.rooms[room.exits[dir]].visited;
      newState.player.location = room.exits[dir];
      newState.rooms[newState.player.location].visited = true;

      let output = getRoomDescription(newState, !wasVisited);

      if (newState.player.location === "secret_room" && !("golden_llama" in newState.rooms.secret_room.items)) {
        newState.rooms.secret_room.items.golden_llama = "A golden llama figurine. It's you, but in gold. This is either an honor or deeply unsettling.";
        output += "\n\n[The golden llama figurine glints in the dim light. It seems important.]";
      }

      return { output, state: newState };
    }
    return { output: "You cannot go that way.", state: newState };
  }

  // LOOK command
  if (cmd === "look") {
    if (args.length === 0) {
      newState.rooms[newState.player.location].visited = false; // Force full description
      return { output: getRoomDescription(newState, true), state: newState };
    }
    const thing = args.join("_");

    // Check inventory
    if (thing in newState.player.inventory) {
      return { output: `The ${thing}: ${newState.player.inventory[thing]}`, state: newState };
    }

    // Check room
    const room = newState.rooms[newState.player.location];
    if (thing in room.items) {
      const item = room.items[thing];
      if (typeof item === "object") {
        const contents = Object.keys(item).join(", ") || "nothing";
        return { output: `Inside the ${thing} you see: ${contents}`, state: newState };
      }
      return { output: `The ${thing}: ${item}`, state: newState };
    }

    // Check inside containers
    for (const [container, contents] of Object.entries(room.items)) {
      if (typeof contents === "object" && thing in contents) {
        return { output: `The ${thing}: ${contents[thing]}`, state: newState };
      }
    }

    return { output: `You see no ${thing} here. You stare at the empty space where it isn't, philosophically.`, state: newState };
  }

  // TAKE command
  if (cmd === "take") {
    if (args.length === 0) {
      return { output: "Take what? The scenic view? The temperature? Be specific.", state: newState };
    }

    if (Object.keys(newState.player.inventory).length >= 6) {
      return { output: "Your llama pack is full. Perhaps consider what is truly essential?", state: newState };
    }

    const item = args.join("_");
    const room = newState.rooms[newState.player.location];

    if (item in room.items) {
      const itemData = room.items[item];
      if (typeof itemData === "object") {
        return { output: `The ${item} is a container. You cannot take the whole thing. Even for a llama, that's ambitious.`, state: newState };
      }
      newState.player.inventory[item] = itemData;
      delete room.items[item];

      let output = `You carefully pick up the ${item} with your surprisingly dexterous llama lips.`;

      // Check for victory
      if (item === "golden_llama" && !newState.victoryShown) {
        newState.victoryShown = true;
        output += `\n
╔══════════════════════════════════════════════════════════════╗
║                     VICTORY!                                 ║
╚══════════════════════════════════════════════════════════════╝

You have found the Golden Llama - your own reflection in sacred gold.

What does it mean? Perhaps that you were the treasure all along.
Perhaps that the Incas really liked llamas. Perhaps both.

The condors circle overhead. The sun continues its journey across
the sky, hitched or not. The stones remain, as they always have
and always will.

And you, Quyllur the llama, stand a little taller. Four legs,
excellent wool, and now: a golden legacy.

                    THE END

           (You can keep exploring if you'd like!)`;
      }

      return { output, state: newState };
    }

    // Check inside containers
    for (const [container, contents] of Object.entries(room.items)) {
      if (typeof contents === "object" && item in contents) {
        newState.player.inventory[item] = contents[item];
        delete (room.items[container] as Record<string, string>)[item];
        return { output: `You carefully pick up the ${item} from the ${container} with your surprisingly dexterous llama lips.`, state: newState };
      }
    }

    return { output: `There is no ${item} here. Unless it's invisible, which, admittedly, would be a twist.`, state: newState };
  }

  // DROP command
  if (cmd === "drop") {
    if (args.length === 0) {
      return { output: "Drop what? Your expectations? Already done.", state: newState };
    }
    const item = args.join("_");
    if (item in newState.player.inventory) {
      newState.rooms[newState.player.location].items[item] = newState.player.inventory[item];
      delete newState.player.inventory[item];
      return { output: `You drop the ${item}. It lands with the finality of a dropped thing.`, state: newState };
    }
    return { output: `You don't have a ${item}. You're a llama, not a magician.`, state: newState };
  }

  // INVENTORY command
  if (cmd === "inventory") {
    const items = Object.keys(newState.player.inventory);
    if (items.length === 0) {
      return { output: "You are carrying nothing. Such is the llama condition.", state: newState };
    }
    return { output: `You are carrying: ${items.join(", ")}`, state: newState };
  }

  // SPIT command
  if (cmd === "spit") {
    if (!newState.player.hasSpit) {
      return { output: "You've already spit recently. Even llamas need time to reload.", state: newState };
    }
    newState.player.hasSpit = false;
    if (args.length > 0) {
      return { output: `You spit with devastating accuracy at the ${args.join(" ")}. It makes a satisfying 'ptooey' sound.`, state: newState };
    }
    return { output: "You spit into the wind. It's surprisingly cathartic.", state: newState };
  }

  // OPEN command
  if (cmd === "open") {
    if (args.length === 0) {
      return { output: "Open what? Your mind? Already dangerously ajar.", state: newState };
    }
    const thing = args.join("_");

    // Secret door
    if (["door", "strange_door", "secret_door"].includes(thing) && newState.player.location === "condor_temple") {
      if ("feather" in newState.player.inventory && "small_stone" in newState.player.inventory) {
        newState.rooms.condor_temple.exits.e = "secret_room";
        return {
          output: "You hold up the feather and the stone. The door recognizes these offerings and slowly grinds open, revealing a passage to the east. You have no idea how you knew to do that. Llama intuition, perhaps.",
          state: newState
        };
      }
      return { output: "The door doesn't budge. It seems to want... something. Two somethings, perhaps. One that flies, one that sits?", state: newState };
    }

    // Containers
    const room = newState.rooms[newState.player.location];
    if (thing in room.items) {
      const item = room.items[thing];
      if (typeof item === "object") {
        const contents = Object.keys(item).join(", ") || "nothing";
        return { output: `You open the ${thing}. Inside you find: ${contents}`, state: newState };
      }
      return { output: `The ${thing} isn't something you can open. It's more of a... thing. That exists.`, state: newState };
    }

    return { output: `You don't see a ${thing} that can be opened.`, state: newState };
  }

  // QUESTIONS command
  if (cmd === "questions" || cmd === "question") {
    if (newState.player.location !== "intihuatana") {
      return { output: "The Question Game requires an opponent. The alpaca at the Intihuatana stone is known for its philosophical debates.", state: newState };
    }

    newState.questionGame.active = true;
    newState.questionGame.playerScore = 0;
    newState.questionGame.alpacaScore = 0;
    newState.questionGame.round = 0;
    const firstQ = getAlpacaQuestion(newState);
    newState.questionGame.currentQuestion = firstQ;

    return {
      output: `
THE QUESTION GAME
=================
Rules:
1. You must respond with a question
2. Statements are not allowed
3. Rhetoric counts as a question
4. Repetition is forbidden
5. The one who fails to ask a question loses

The Alpaca will serve as your opponent. Begin!

Alpaca: ${firstQ}`,
      state: newState
    };
  }

  // FLIP command
  if (cmd === "flip") {
    if (!("coca_leaf" in newState.player.inventory)) {
      return { output: "You need a coca leaf to flip. They're traditional.", state: newState };
    }

    newState.coinGame.totalFlips++;
    const prob = newState.coinGame.totalFlips < 50 ? 0.92 : 0.5;
    const isUp = Math.random() < prob;

    if (isUp) {
      newState.coinGame.consecutiveUps++;
      const count = newState.coinGame.consecutiveUps;
      if (count > 20) {
        return { output: `Face-up. Again. (${count} times now.) This is beginning to feel less like chance and more like destiny. Or a glitch in the cosmic mechanism.`, state: newState };
      } else if (count > 10) {
        return { output: `Face-up. (${count} consecutive.) The laws of probability weep quietly.`, state: newState };
      } else if (count > 5) {
        return { output: `Face-up. (${count} in a row.) Statistically improbable. Philosophically troubling.`, state: newState };
      }
      return { output: `Face-up. (${count} consecutive.)`, state: newState };
    } else {
      const prev = newState.coinGame.consecutiveUps;
      newState.coinGame.consecutiveUps = 0;
      return { output: `Face-down! After ${prev} consecutive face-ups. The universe remembers how to be random.`, state: newState };
    }
  }

  // THINK command
  if (cmd === "think") {
    return { output: getRandomElement(PHILOSOPHICAL_THOUGHTS), state: newState };
  }

  // HELP command
  if (cmd === "help") {
    return {
      output: `
COMMANDS:
=========
Movement:  north/n, south/s, east/e, west/w, up/u, down/d

Actions:   look [thing]  - Look around or at something specific
           take <item>   - Pick up an item
           drop <item>   - Drop an item from your inventory
           inventory/i   - Check what you're carrying
           spit [target] - You're a llama. You can spit.
           open <thing>  - Open a container or door

Special:   questions     - Start the Question Game
           flip          - Flip a coca leaf (when you have one)
           think         - Ponder your existence
           save          - Save your game (auto-saves too!)
           new           - Start a new game
           help          - Show this message

Remember: You are a llama. Act accordingly.`,
      state: newState
    };
  }

  // Command not recognized - needs LLM
  return {
    output: "",
    state: newState,
    needsLLM: true,
    userInput: rawInput
  };
}

export function getFallbackResponse(): string {
  return getRandomElement(FALLBACK_RESPONSES);
}

export const INTRO_TEXT = `
╔══════════════════════════════════════════════════════════════╗
║              LLAMA AT MACHU PICCHU                           ║
║     A Text Adventure in Uncertain Times                      ║
╚══════════════════════════════════════════════════════════════╝

You are a llama.

This is, perhaps, the only thing you know for certain. You have
four legs, excellent wool, and a vague sense that something
significant is about to happen. Or has happened. Or is happening
right now, in a way that you're somehow missing.

The year is... well, it's the Incan era. Before that whole
Spanish business. The sun is worshipped, the stones are precisely
cut, and you're standing in what will one day be a major tourist
attraction, but is currently just home.

You remember being somewhere else a moment ago. Or do you? Memory
is a curious thing when you're a llama.

Type 'help' for a list of commands, or just start walking around.
Something is bound to happen eventually. These things usually do.
`;
