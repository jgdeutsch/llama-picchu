// Command Router for Llama Picchu MUD
import { connectionManager } from '../managers/connectionManager';
import { playerManager } from '../managers/playerManager';
import { worldManager } from '../managers/worldManager';
import { combatManager } from '../managers/combatManager';
import { npcManager } from '../managers/npcManager';
import { questManager } from '../managers/questManager';
import { getDatabase, playerQueries } from '../database';
import { processMovementCommand } from './movement';
import { processInteractionCommand } from './interaction';
import { processCombatCommand } from './combat';
import { processCommunicationCommand } from './communication';
import { processCharacterCommand } from './character';
import { processSkillCommand } from './skills';
import { processShopCommand } from './shop';
import type { Direction } from '../../shared/types/room';

// Direction aliases
const DIRECTION_ALIASES: Record<string, Direction> = {
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
  u: 'up',
  d: 'down',
  north: 'north',
  south: 'south',
  east: 'east',
  west: 'west',
  up: 'up',
  down: 'down',
};

// Command aliases
const COMMAND_ALIASES: Record<string, string> = {
  l: 'look',
  i: 'inventory',
  inv: 'inventory',
  eq: 'equipment',
  sc: 'score',
  k: 'kill',
  "'": 'say',
  '.': 'gossip',
  t: 'tell',
  '?': 'help',
  h: 'help',
  x: 'examine',
  get: 'take',
  grab: 'take',
  pick: 'take',
};

export interface CommandContext {
  playerId: number;
  playerName: string;
  roomId: string;
  command: string;
  args: string[];
  rawInput: string;
}

export function processCommand(playerId: number, rawInput: string): void {
  const db = getDatabase();
  const player = playerQueries.findById(db).get(playerId) as {
    id: number;
    name: string;
    current_room: string;
  } | undefined;

  if (!player) {
    connectionManager.sendToPlayer(playerId, {
      type: 'error',
      message: 'Player not found.',
    });
    return;
  }

  // Parse input
  const trimmed = rawInput.trim();
  if (!trimmed) return;

  const parts = trimmed.split(/\s+/);
  let command = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Apply command aliases
  if (COMMAND_ALIASES[command]) {
    command = COMMAND_ALIASES[command];
  }

  const context: CommandContext = {
    playerId,
    playerName: player.name,
    roomId: player.current_room,
    command,
    args,
    rawInput: trimmed,
  };

  // Check for direction commands first
  if (DIRECTION_ALIASES[command]) {
    processMovementCommand(context, DIRECTION_ALIASES[command]);
    return;
  }

  // Route to appropriate command handler
  switch (command) {
    // Movement
    case 'go':
    case 'walk':
    case 'move':
    case 'run':
      if (args.length > 0 && DIRECTION_ALIASES[args[0].toLowerCase()]) {
        processMovementCommand(context, DIRECTION_ALIASES[args[0].toLowerCase()]);
      } else {
        sendOutput(playerId, 'Go where? (north, south, east, west, up, down)');
      }
      break;
    case 'flee':
      processFlee(context);
      break;

    // Interaction
    case 'look':
    case 'examine':
      processLook(context);
      break;
    case 'take':
      processTake(context);
      break;
    case 'drop':
      processDrop(context);
      break;
    case 'inventory':
      processInventory(context);
      break;
    case 'equipment':
      processEquipment(context);
      break;
    case 'wear':
    case 'wield':
      processWear(context);
      break;
    case 'remove':
      processRemove(context);
      break;

    // Character
    case 'score':
      processScore(context);
      break;
    case 'skills':
    case 'spells':
      processSkillList(context);
      break;
    case 'quests':
      processQuestLog(context);
      break;

    // Combat
    case 'kill':
    case 'attack':
      processKill(context);
      break;
    case 'cast':
      processSkillCommand(context);
      break;

    // Communication
    case 'say':
      processSay(context);
      break;
    case 'shout':
      processShout(context);
      break;
    case 'gossip':
      processGossip(context);
      break;
    case 'tell':
      processTell(context);
      break;
    case 'who':
      processWho(context);
      break;

    // Economy
    case 'buy':
      processBuy(context);
      break;
    case 'sell':
      processSell(context);
      break;
    case 'list':
      processShopList(context);
      break;

    // Survival
    case 'eat':
      processEat(context);
      break;
    case 'drink':
      processDrink(context);
      break;
    case 'rest':
    case 'sleep':
      processRest(context);
      break;
    case 'wake':
    case 'stand':
      processWake(context);
      break;

    // Training
    case 'practice':
      processPractice(context);
      break;

    // Quests
    case 'accept':
      processAcceptQuest(context);
      break;

    // Misc
    case 'help':
      processHelp(context);
      break;
    case 'save':
      processSave(context);
      break;
    case 'consider':
    case 'con':
      processConsider(context);
      break;
    case 'talk':
      processTalk(context);
      break;

    default:
      processUnknownCommand(ctx);
  }
}

// Helper to suggest similar commands
function processUnknownCommand(ctx: CommandContext): void {
  const { command, args, playerId } = ctx;

  // Common typos and what the player probably meant
  const suggestions: Record<string, { cmd: string; tip: string }> = {
    // Movement typos
    'nort': { cmd: 'north', tip: 'Try "north" or just "n" to go north' },
    'sout': { cmd: 'south', tip: 'Try "south" or just "s" to go south' },
    'eas': { cmd: 'east', tip: 'Try "east" or just "e" to go east' },
    'wes': { cmd: 'west', tip: 'Try "west" or just "w" to go west' },
    'go': { cmd: 'north', tip: 'Just type the direction: n, s, e, w, u, d' },
    'walk': { cmd: 'north', tip: 'Just type the direction: n, s, e, w, u, d' },
    'move': { cmd: 'north', tip: 'Just type the direction: n, s, e, w, u, d' },

    // Common attempts
    'pickup': { cmd: 'take', tip: 'Use "take <item>" or "get <item>" to pick things up' },
    'grab': { cmd: 'take', tip: 'Use "take <item>" to pick things up' },
    'stats': { cmd: 'score', tip: 'Use "score" or "sc" to see your character stats' },
    'status': { cmd: 'score', tip: 'Use "score" or "sc" to see your character stats' },
    'stat': { cmd: 'score', tip: 'Use "score" or "sc" to see your character stats' },
    'info': { cmd: 'score', tip: 'Use "score" for stats, "inventory" for items, "equipment" for gear' },
    'me': { cmd: 'score', tip: 'Use "score" or "sc" to see your character info' },
    'char': { cmd: 'score', tip: 'Use "score" or "sc" to see your character info' },
    'character': { cmd: 'score', tip: 'Use "score" or "sc" to see your character info' },
    'bag': { cmd: 'inventory', tip: 'Use "inventory" or just "i" to see your items' },
    'items': { cmd: 'inventory', tip: 'Use "inventory" or just "i" to see your items' },
    'pack': { cmd: 'inventory', tip: 'Use "inventory" or just "i" to see your items' },
    'gear': { cmd: 'equipment', tip: 'Use "equipment" or "eq" to see what you have equipped' },
    'equip': { cmd: 'wear', tip: 'Use "wear <item>" or "wield <item>" to equip something' },
    'unequip': { cmd: 'remove', tip: 'Use "remove <slot>" to unequip an item' },
    'fight': { cmd: 'kill', tip: 'Use "kill <target>" or "k <target>" to attack' },
    'attack': { cmd: 'kill', tip: 'Use "kill <target>" or "k <target>" to attack' },
    'hit': { cmd: 'kill', tip: 'Use "kill <target>" or "k <target>" to attack' },
    'run': { cmd: 'flee', tip: 'Use "flee" to escape from combat' },
    'escape': { cmd: 'flee', tip: 'Use "flee" to escape from combat' },
    'chat': { cmd: 'say', tip: 'Use "say <message>" to speak in the room, or "gossip" for global chat' },
    'speak': { cmd: 'say', tip: 'Use "say <message>" or just \' to speak' },
    'yell': { cmd: 'shout', tip: 'Use "shout <message>" to yell across the area' },
    'whisper': { cmd: 'tell', tip: 'Use "tell <player> <message>" for private messages' },
    'pm': { cmd: 'tell', tip: 'Use "tell <player> <message>" for private messages' },
    'msg': { cmd: 'tell', tip: 'Use "tell <player> <message>" for private messages' },
    'message': { cmd: 'tell', tip: 'Use "tell <player> <message>" for private messages' },
    'players': { cmd: 'who', tip: 'Use "who" to see online players' },
    'online': { cmd: 'who', tip: 'Use "who" to see online players' },
    'purchase': { cmd: 'buy', tip: 'Use "buy <item>" to purchase from a shopkeeper' },
    'shop': { cmd: 'list', tip: 'Use "list" to see shop inventory (when near a shopkeeper)' },
    'store': { cmd: 'list', tip: 'Use "list" to see shop inventory (when near a shopkeeper)' },
    'train': { cmd: 'practice', tip: 'Use "practice" at a guild to train skills' },
    'learn': { cmd: 'practice', tip: 'Use "practice" at a guild to train skills' },
    'teach': { cmd: 'practice', tip: 'Use "practice" at a guild to train skills' },
    'quest': { cmd: 'quests', tip: 'Use "quests" to see your quest log, or "talk <npc>" to ask about quests' },
    'mission': { cmd: 'quests', tip: 'Use "quests" to see your quest log' },
    'missions': { cmd: 'quests', tip: 'Use "quests" to see your quest log' },
    'spell': { cmd: 'cast', tip: 'Use "cast <spell> [target]" to use magic' },
    'magic': { cmd: 'cast', tip: 'Use "cast <spell> [target]" to use magic' },
    'use': { cmd: 'cast', tip: 'For spells use "cast <spell>", for items use "eat" or "drink"' },
    'sleep': { cmd: 'rest', tip: 'Use "rest" to recover faster, "wake" to stop resting' },
    'sit': { cmd: 'rest', tip: 'Use "rest" to sit and recover faster' },
    'getup': { cmd: 'wake', tip: 'Use "wake" or "stand" to stop resting' },
    'hello': { cmd: 'talk', tip: 'Use "talk <npc>" to start a conversation with someone' },
    'hi': { cmd: 'talk', tip: 'Use "talk <npc>" to start a conversation with someone' },
    'hey': { cmd: 'talk', tip: 'Use "talk <npc>" to start a conversation with someone' },
    'greet': { cmd: 'talk', tip: 'Use "talk <npc>" to start a conversation with someone' },
    'inspect': { cmd: 'look', tip: 'Use "look" or "l" to see the room, "look <thing>" to examine something' },
    'see': { cmd: 'look', tip: 'Use "look" or "l" to see the room' },
    'view': { cmd: 'look', tip: 'Use "look" or "l" to see the room' },
    'check': { cmd: 'look', tip: 'Use "look <thing>" to examine something' },
    'eval': { cmd: 'consider', tip: 'Use "consider <enemy>" or "con" to evaluate how tough they are' },
    'analyse': { cmd: 'consider', tip: 'Use "consider <enemy>" to see how tough they are' },
    'analyze': { cmd: 'consider', tip: 'Use "consider <enemy>" to see how tough they are' },
    'exit': { cmd: 'look', tip: 'Use "look" to see exits, then type a direction (n/s/e/w/u/d) to leave' },
    'exits': { cmd: 'look', tip: 'Use "look" to see exits - they\'re listed at the bottom' },
    'leave': { cmd: 'look', tip: 'Type a direction (n/s/e/w/u/d) to leave. Use "look" to see exits' },
    'commands': { cmd: 'help', tip: 'Use "help" or "?" to see all available commands' },
    '?': { cmd: 'help', tip: 'Use "help" to see all available commands' },
  };

  // Check for a direct suggestion
  const suggestion = suggestions[command.toLowerCase()];
  if (suggestion) {
    sendOutput(playerId, `\n${suggestion.tip}\n`, 'system');
    return;
  }

  // Check if it might be trying to talk to someone
  const npcsInRoom = npcManager.getNpcsInRoom(ctx.roomId);
  const matchingNpc = npcsInRoom.find(npc =>
    npc.name.toLowerCase().includes(command.toLowerCase()) ||
    command.toLowerCase().includes(npc.name.toLowerCase().split(' ')[0])
  );

  if (matchingNpc) {
    sendOutput(playerId, `\nDid you want to talk to ${matchingNpc.name}? Try: talk ${matchingNpc.name.split(' ')[0].toLowerCase()}\n`, 'system');
    return;
  }

  // Generic helpful response
  const helpTexts = [
    `\nHmm, I don't understand "${command}". Here are some things you can try:`,
    `  • Type "help" to see all commands`,
    `  • Type "look" to see where you are`,
    `  • Type n/s/e/w to move around`,
    `  • Type "talk <npc>" to chat with characters`,
    `  • Type "inventory" to see your items\n`,
  ];

  // Add context-specific suggestions
  if (npcsInRoom.length > 0) {
    const npcName = npcsInRoom[0].name.split(' ')[0].toLowerCase();
    helpTexts.push(`There's someone here you could talk to: "talk ${npcName}"\n`);
  }

  sendOutput(playerId, helpTexts.join('\n'), 'system');
}

function sendOutput(playerId: number, text: string, type: 'normal' | 'system' | 'error' = 'normal'): void {
  connectionManager.sendToPlayer(playerId, {
    type: 'output',
    text,
    messageType: type,
  });
}

// === COMMAND IMPLEMENTATIONS ===

function processLook(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    // Look at room
    const roomDesc = worldManager.getRoomDescription(ctx.roomId, ctx.playerId);
    sendOutput(ctx.playerId, roomDesc);
  } else {
    // Look at something specific
    processInteractionCommand(ctx, 'look');
  }
}

function processTake(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Take what?');
    return;
  }
  processInteractionCommand(ctx, 'take');
}

function processDrop(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Drop what?');
    return;
  }
  processInteractionCommand(ctx, 'drop');
}

function processInventory(ctx: CommandContext): void {
  const inventory = playerManager.getInventory(ctx.playerId);

  if (inventory.length === 0) {
    sendOutput(ctx.playerId, '\nYou are not carrying anything.\n');
    return;
  }

  const lines = ['\n[ Inventory ]'];
  for (const item of inventory) {
    if (item.quantity > 1) {
      lines.push(`  ${item.name} (x${item.quantity})`);
    } else {
      lines.push(`  ${item.name}`);
    }
  }
  lines.push('');
  sendOutput(ctx.playerId, lines.join('\n'));
}

function processEquipment(ctx: CommandContext): void {
  processCharacterCommand(ctx, 'equipment');
}

function processWear(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Wear what?');
    return;
  }
  processCharacterCommand(ctx, 'wear');
}

function processRemove(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Remove what?');
    return;
  }
  processCharacterCommand(ctx, 'remove');
}

function processScore(ctx: CommandContext): void {
  const scoreDisplay = playerManager.getScoreDisplay(ctx.playerId);
  sendOutput(ctx.playerId, scoreDisplay);
}

function processSkillList(ctx: CommandContext): void {
  processCharacterCommand(ctx, 'skills');
}

function processQuestLog(ctx: CommandContext): void {
  const questLog = questManager.getQuestLogDisplay(ctx.playerId);
  sendOutput(ctx.playerId, questLog);
}

function processKill(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Kill what?');
    return;
  }
  processCombatCommand(ctx, 'kill');
}

function processFlee(ctx: CommandContext): void {
  const result = combatManager.flee(ctx.playerId);
  sendOutput(ctx.playerId, result.message);
}

function processSay(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Say what?');
    return;
  }
  processCommunicationCommand(ctx, 'say');
}

function processShout(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Shout what?');
    return;
  }
  processCommunicationCommand(ctx, 'shout');
}

function processGossip(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Gossip what?');
    return;
  }
  processCommunicationCommand(ctx, 'gossip');
}

function processTell(ctx: CommandContext): void {
  if (ctx.args.length < 2) {
    sendOutput(ctx.playerId, 'Tell who what?');
    return;
  }
  processCommunicationCommand(ctx, 'tell');
}

function processWho(ctx: CommandContext): void {
  processCommunicationCommand(ctx, 'who');
}

function processBuy(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Buy what?');
    return;
  }
  processShopCommand(ctx, 'buy');
}

function processSell(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Sell what?');
    return;
  }
  processShopCommand(ctx, 'sell');
}

function processShopList(ctx: CommandContext): void {
  processShopCommand(ctx, 'list');
}

function processEat(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Eat what?');
    return;
  }
  processInteractionCommand(ctx, 'eat');
}

function processDrink(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Drink what?');
    return;
  }
  processInteractionCommand(ctx, 'drink');
}

function processRest(ctx: CommandContext): void {
  processCharacterCommand(ctx, 'rest');
}

function processWake(ctx: CommandContext): void {
  processCharacterCommand(ctx, 'wake');
}

function processPractice(ctx: CommandContext): void {
  processSkillCommand(ctx);
}

function processAcceptQuest(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Accept which quest? (Use the quest ID)');
    return;
  }

  const questId = parseInt(ctx.args[0]);
  if (isNaN(questId)) {
    sendOutput(ctx.playerId, 'Invalid quest ID.');
    return;
  }

  const result = questManager.acceptQuest(ctx.playerId, questId);
  sendOutput(ctx.playerId, result.message);
}

function processConsider(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Consider what?');
    return;
  }
  processCombatCommand(ctx, 'consider');
}

function processTalk(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Talk to whom?');
    return;
  }
  processInteractionCommand(ctx, 'talk');
}

function processSave(ctx: CommandContext): void {
  // In this MUD, saving is automatic, but we acknowledge the command
  sendOutput(ctx.playerId, 'Your progress has been saved.', 'system');
}

function processHelp(ctx: CommandContext): void {
  const helpText = `
╔════════════════════════════════════════════════════════╗
║             LLAMA PICCHU MUD - COMMANDS                ║
╠════════════════════════════════════════════════════════╣
║ MOVEMENT                                               ║
║   north/n, south/s, east/e, west/w, up/u, down/d       ║
║   flee - Escape from combat                            ║
╠════════════════════════════════════════════════════════╣
║ INTERACTION                                            ║
║   look/l [target] - Examine room or object             ║
║   take/get <item> - Pick up an item                    ║
║   drop <item> - Drop an item                           ║
║   talk <npc> - Talk to an NPC                          ║
║   eat/drink <item> - Consume food or drink             ║
╠════════════════════════════════════════════════════════╣
║ CHARACTER                                              ║
║   inventory/i - View carried items                     ║
║   equipment/eq - View equipped items                   ║
║   score/sc - View character stats                      ║
║   wear/wield <item> - Equip an item                    ║
║   remove <slot> - Unequip an item                      ║
║   skills - View learned skills                         ║
║   quests - View quest log                              ║
╠════════════════════════════════════════════════════════╣
║ COMBAT                                                 ║
║   kill/k <target> - Attack an enemy                    ║
║   consider/con <target> - Evaluate enemy strength      ║
║   cast <spell> [target] - Use a spell                  ║
║   flee - Attempt to escape combat                      ║
╠════════════════════════════════════════════════════════╣
║ COMMUNICATION                                          ║
║   say/' <message> - Speak to the room                  ║
║   shout <message> - Shout across the area              ║
║   gossip/. <message> - Chat with all players           ║
║   tell/t <player> <message> - Private message          ║
║   who - List online players                            ║
╠════════════════════════════════════════════════════════╣
║ ECONOMY                                                ║
║   list - View shop inventory                           ║
║   buy <item> - Purchase an item                        ║
║   sell <item> - Sell an item                           ║
╠════════════════════════════════════════════════════════╣
║ TRAINING                                               ║
║   practice - Train skills at a guild                   ║
╠════════════════════════════════════════════════════════╣
║ SURVIVAL                                               ║
║   rest/sleep - Rest to recover faster                  ║
║   wake/stand - Stop resting                            ║
╚════════════════════════════════════════════════════════╝
`;
  sendOutput(ctx.playerId, helpText);
}
