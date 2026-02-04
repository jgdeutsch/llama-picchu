// Command Router for FROBARK MUD
import { connectionManager } from '../managers/connectionManager';
import { playerManager } from '../managers/playerManager';
import { worldManager } from '../managers/worldManager';
import { getPlayerLastSeen } from '../managers/playerTracker';
import { combatManager } from '../managers/combatManager';
import { npcManager } from '../managers/npcManager';
import { questManager } from '../managers/questManager';
import { npcLifeManager } from '../managers/npcLifeManager';
import { economyManager } from '../managers/economyManager';
import { resourceManager } from '../managers/resourceManager';
import { buildingManager } from '../managers/buildingManager';
import { creativeManager } from '../managers/creativeManager';
import { npcSocialManager } from '../managers/npcSocialManager';
import { appearanceManager } from '../managers/appearanceManager';
import { getDatabase, playerQueries } from '../database';
import { processMovementCommand } from './movement';
import { processInteractionCommand } from './interaction';
import { processCombatCommand } from './combat';
import { processCommunicationCommand, processReply } from './communication';
import { processCharacterCommand } from './character';
import { processSkillCommand } from './skills';
import { processShopCommand } from './shop';
import { getNpcById } from '../data/npcs';
import { getSocial, processSocialCommand, getAllSocialNames } from './socials';
import { generateBrainHelp } from '../services/geminiService';
import { itemTemplates } from '../data/items';
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
  ask: 'talk',  // "ask lydia about clothes" = "talk lydia about clothes"
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
    case 'vitals':
    case 'status':
      processVitals(context);
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
    case 'where':
      processWhere(context);
      break;
    case 'people':
    case 'scan':
      processPeople(context);
      break;
    case 'reply':
    case 'r':
      processReplyCmd(context);
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
    case 'rent':
    case 'stay':
      processRent(context);
      break;
    case 'wash':
    case 'clean':
    case 'bathe':
      processWash(context);
      break;

    // Training
    case 'practice':
      processPractice(context);
      break;

    // Quests
    case 'accept':
      processAcceptQuest(context);
      break;

    // Jobs & Economy
    case 'jobs':
    case 'employment':
      processJobs(context);
      break;
    case 'work':
      processWork(context);
      break;
    case 'apply':
    case 'hire':
      processApply(context);
      break;
    case 'quit':
      processQuitJob(context);
      break;
    case 'give':
    case 'pay':
      processGive(context);
      break;

    // Resource Gathering
    case 'dig':
      processDig(context);
      break;
    case 'fish':
      processFish(context);
      break;
    case 'chop':
      processChop(context);
      break;
    case 'mine':
      processMine(context);
      break;

    // Building
    case 'plots':
    case 'land':
      processPlots(context);
      break;
    case 'survey':
      processSurvey(context);
      break;
    case 'build':
      processBuild(context);
      break;
    case 'demolish':
      processDemolish(context);
      break;
    case 'materials':
    case 'buildlist':
      processBuildMaterials(context);
      break;

    // Creative
    case 'write':
      processWrite(context);
      break;
    case 'page':
      processPage(context);
      break;
    case 'newpage':
      processNewPage(context);
      break;
    case 'paint':
      processPaint(context);
      break;
    case 'draw':
      processDraw(context);
      break;
    case 'erase':
      processErase(context);
      break;
    case 'compose':
      processCompose(context);
      break;
    case 'notes':
      processNotes(context);
      break;
    case 'preview':
      processPreview(context);
      break;
    case 'finish':
      processFinish(context);
      break;
    case 'abandon':
      processAbandon(context);
      break;
    case 'play':
      processPlay(context);
      break;
    case 'books':
      processBooks(context);
      break;
    case 'songs':
    case 'music':
      processSongs(context);
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

    // NPC Assistance (Living World)
    case 'assist':
    case 'aid':
      processAssist(context);
      break;

    // Time
    case 'time':
      processTime(context);
      break;

    // Implementor Commands (admin only)
    case 'imm':
    case 'implementor':
      processImplementorCommand(context);
      break;
    case 'journal':
      processReadJournal(context);
      break;
    case 'alljournal':
    case 'journals':
      processAllJournals(context);
      break;
    case 'npcrel':
    case 'relationships':
      processNpcRelationships(context);
      break;
    case 'goto':
      processGoto(context);
      break;

    // Brain - Gemini-powered help
    case 'brain':
      processBrain(context);
      break;

    default:
      processUnknownCommand(context);
  }
}

// Helper to suggest similar commands
function processUnknownCommand(ctx: CommandContext): void {
  const { command, args, playerId } = ctx;

  // Check if this is a social/emote command
  const social = getSocial(command);
  if (social) {
    processSocialCommand(ctx, command);
    return;
  }

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
    `  • Type "inventory" to see your items`,
  ];

  // Add context-specific suggestions
  if (npcsInRoom.length > 0) {
    const npcName = npcsInRoom[0].name.split(' ')[0].toLowerCase();
    helpTexts.push(`  • There's someone here: "talk ${npcName}"`);
  }

  // Add brain reminder
  helpTexts.push('');
  helpTexts.push('💭 Tip: Use "brain <question>" to ask how to do something.');
  helpTexts.push('   Example: brain how do I equip a weapon?');
  helpTexts.push('');

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

function processVitals(ctx: CommandContext): void {
  // Quick status check for survival mechanics
  const db = getDatabase();
  const player = db.prepare(`
    SELECT gold, hunger, thirst, hp, max_hp, mana, max_mana, stamina, max_stamina
    FROM players WHERE id = ?
  `).get(ctx.playerId) as {
    gold: number;
    hunger: number;
    thirst: number;
    hp: number;
    max_hp: number;
    mana: number;
    max_mana: number;
    stamina: number;
    max_stamina: number;
  } | undefined;

  if (!player) {
    sendOutput(ctx.playerId, 'Error retrieving your status.');
    return;
  }

  // Build status display with visual bars
  const makeBar = (current: number, max: number, width: number = 10): string => {
    const filled = Math.round((current / max) * width);
    const empty = width - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  };

  const hungerStatus = player.hunger > 70 ? 'Full' :
    player.hunger > 40 ? 'Peckish' :
    player.hunger > 20 ? 'Hungry' :
    player.hunger > 0 ? 'Starving' : 'DYING';

  const thirstStatus = player.thirst > 70 ? 'Quenched' :
    player.thirst > 40 ? 'Thirsty' :
    player.thirst > 20 ? 'Parched' :
    player.thirst > 0 ? 'Dehydrated' : 'DYING';

  const { hour } = npcLifeManager.getGameTime();
  const timeStr = `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;

  const lines = [
    '',
    '╔═══════════════════════════════════╗',
    '║          YOUR CONDITION           ║',
    '╠═══════════════════════════════════╣',
    `║  Health:  ${makeBar(player.hp, player.max_hp)} ${String(player.hp).padStart(3)}/${player.max_hp}  ║`,
    `║  Stamina: ${makeBar(player.stamina, player.max_stamina)} ${String(player.stamina).padStart(3)}/${player.max_stamina}  ║`,
    `║  Mana:    ${makeBar(player.mana, player.max_mana)} ${String(player.mana).padStart(3)}/${player.max_mana}  ║`,
    '╠═══════════════════════════════════╣',
    `║  Hunger:  ${makeBar(player.hunger, 100)} ${hungerStatus.padEnd(10)} ║`,
    `║  Thirst:  ${makeBar(player.thirst, 100)} ${thirstStatus.padEnd(10)} ║`,
    '╠═══════════════════════════════════╣',
    `║  Gold:    ${String(player.gold).padStart(6)} coins            ║`,
    `║  Time:    ${timeStr.padEnd(12)}            ║`,
    '╚═══════════════════════════════════╝',
    '',
  ];

  // Add warnings if vitals are low
  if (player.hunger <= 20) {
    lines.push('  ⚠ You need to eat! Try: eat <food>');
  }
  if (player.thirst <= 20) {
    lines.push('  ⚠ You need water! Try: drink <water>');
  }
  if (player.gold === 0) {
    lines.push('  💰 No gold! Look for work or help NPCs.');
  }
  if (lines.length > 15) {
    lines.push('');
  }

  sendOutput(ctx.playerId, lines.join('\n'));
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

function processReplyCmd(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Reply with what? Use: reply <message>');
    return;
  }
  processReply(ctx);
}

function processPeople(ctx: CommandContext): void {
  // List all players and NPCs in the current room
  const db = getDatabase();
  const room = worldManager.getRoom(ctx.roomId);

  const lines: string[] = ['', `[ People in ${room?.name || 'this area'} ]`];

  // Get players in room
  const playersInRoom = playerQueries.getPlayersInRoom(db).all(ctx.roomId) as {
    id: number;
    name: string;
    level: number;
    class_id: number;
  }[];

  if (playersInRoom.length > 0) {
    lines.push('');
    lines.push('Players:');
    for (const p of playersInRoom) {
      const classDef = playerManager.getClassDefinition(p.class_id);
      const youMarker = p.id === ctx.playerId ? ' (you)' : '';
      lines.push(`  ${p.name} - level ${p.level} ${classDef?.name || 'llama'}${youMarker}`);
    }
  }

  // Get NPCs in room
  const npcsInRoom = npcManager.getNpcsInRoom(ctx.roomId);

  if (npcsInRoom.length > 0) {
    lines.push('');
    lines.push('Others:');
    for (const npc of npcsInRoom) {
      lines.push(`  ${npc.name}`);
    }
  }

  if (playersInRoom.length === 0 && npcsInRoom.length === 0) {
    lines.push('  Nobody else is here.');
  }

  lines.push('');
  sendOutput(ctx.playerId, lines.join('\n'));
}

function processWhere(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Where did who go? Use: where <player name>');
    return;
  }

  const targetName = ctx.args.join(' ');
  const db = getDatabase();

  // First, try to find the player
  const player = db.prepare(`SELECT id, name, current_room FROM players WHERE name LIKE ?`).get(`%${targetName}%`) as {
    id: number;
    name: string;
    current_room: string;
  } | undefined;

  if (!player) {
    sendOutput(ctx.playerId, `You don't know anyone named "${targetName}".`);
    return;
  }

  // Check if they're online
  if (connectionManager.isPlayerConnected(player.id)) {
    // They're online - where are they now?
    const room = worldManager.getRoom(player.current_room);
    sendOutput(ctx.playerId, `\n${player.name} is currently somewhere in ${room?.area || 'Gamehenge'}.\n`);
    return;
  }

  // They're offline - check last seen tracking
  const lastSeen = getPlayerLastSeen(player.name);

  if (lastSeen) {
    const room = worldManager.getRoom(lastSeen.roomId);
    const roomName = room?.name || 'an unknown place';
    const timeSince = Math.floor((Date.now() - lastSeen.timestamp) / 60000); // minutes

    let timeStr: string;
    if (timeSince < 1) {
      timeStr = 'just moments ago';
    } else if (timeSince < 60) {
      timeStr = `${timeSince} minute${timeSince !== 1 ? 's' : ''} ago`;
    } else {
      const hours = Math.floor(timeSince / 60);
      timeStr = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }

    if (lastSeen.direction) {
      sendOutput(ctx.playerId, `\n${player.name} was last seen in ${roomName}, heading ${lastSeen.direction}, ${timeStr}.\n`);
    } else {
      sendOutput(ctx.playerId, `\n${player.name} was last seen in ${roomName}, ${timeStr}.\n`);
    }
  } else {
    sendOutput(ctx.playerId, `\n${player.name} hasn't been seen around lately.\n`);
  }
}

function processBuy(ctx: CommandContext): void {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Buy what?');
    return;
  }

  // Check for plot purchase: "buy plot <number>"
  if (ctx.args[0].toLowerCase() === 'plot' && ctx.args.length >= 2) {
    const plotNumber = parseInt(ctx.args[1]);
    if (isNaN(plotNumber)) {
      sendOutput(ctx.playerId, 'Invalid plot number. Use: buy plot <number>');
      return;
    }
    const result = buildingManager.purchasePlot(ctx.playerId, ctx.roomId, plotNumber);
    sendOutput(ctx.playerId, result.message);
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

function processRent(ctx: CommandContext): void {
  // Check if we're at an inn
  const room = worldManager.getRoom(ctx.roomId);
  if (!room?.flags?.restRoom) {
    sendOutput(ctx.playerId, '\nYou can only rent a room at an inn or lodging establishment.\nTry the Divided Sky Inn in the village.\n');
    return;
  }

  const db = getDatabase();
  const player = playerQueries.findById(db).get(ctx.playerId) as {
    gold: number;
    is_resting: number;
  } | undefined;

  if (!player) {
    sendOutput(ctx.playerId, 'Error: Could not find your character.');
    return;
  }

  // Inn room costs
  const nightlyRate = room.flags.restCost || 5;
  const weeklyRate = Math.floor(nightlyRate * 5); // Discount for a week

  // Check if player specified duration
  const duration = ctx.args[0]?.toLowerCase();

  if (!duration) {
    // Show rental options
    const lines = [
      '',
      `╔════════════════════════════════════════════════════╗`,
      `║         ${room.name.padEnd(36)}      ║`,
      `╠════════════════════════════════════════════════════╣`,
      `║  Nightly Rate:  ${String(nightlyRate + ' gold').padEnd(20)} "rent night"  ║`,
      `║  Weekly Rate:   ${String(weeklyRate + ' gold').padEnd(20)} "rent week"   ║`,
      `╠════════════════════════════════════════════════════╣`,
      `║  Your gold: ${String(player.gold).padEnd(38)}║`,
      `╠════════════════════════════════════════════════════╣`,
      `║  Renting includes:                                 ║`,
      `║    • A clean bed for the night                     ║`,
      `║    • Doubled recovery rate while resting           ║`,
      `║    • Safe storage for your belongings              ║`,
      `╚════════════════════════════════════════════════════╝`,
      '',
    ];
    sendOutput(ctx.playerId, lines.join('\n'));
    return;
  }

  // Process rental
  let cost = nightlyRate;
  let durationText = 'the night';

  if (duration === 'week' || duration === 'weekly') {
    cost = weeklyRate;
    durationText = 'the week';
  } else if (duration !== 'night' && duration !== 'nightly' && duration !== 'tonight') {
    sendOutput(ctx.playerId, 'Rent for how long? Use "rent night" or "rent week".');
    return;
  }

  if (player.gold < cost) {
    sendOutput(ctx.playerId, `\nYou don't have enough gold. You need ${cost} gold but only have ${player.gold}.\n`);
    return;
  }

  // Deduct gold
  playerManager.modifyGold(ctx.playerId, -cost);

  // Set player to resting state
  playerQueries.updateRestState(db).run(1, ctx.playerId);

  // Flavorful response
  const innkeeperResponses = [
    `Innkeeper Antelope nods and takes your ${cost} gold. "Room's up the stairs, second door on the left. Fresh sheets."`,
    `You pay ${cost} gold. Antelope slides a key across the bar. "Sleep well. Breakfast isn't included."`,
    `"${cost} gold," Antelope says flatly. You hand it over. "Don't make noise after midnight."`,
  ];

  const response = innkeeperResponses[Math.floor(Math.random() * innkeeperResponses.length)];

  sendOutput(ctx.playerId, `
${response}

You head upstairs to your rented room for ${durationText}. The bed is simple but clean.
Your recovery rate is doubled while you rest here.

[Paid ${cost} gold. Type "wake" or "stand" when you're ready to get up.]
`);

  // Notify others in the room
  const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
  for (const otherId of playersInRoom) {
    if (otherId !== ctx.playerId) {
      connectionManager.sendToPlayer(otherId, {
        type: 'output',
        text: `${ctx.playerName} pays for a room and heads upstairs.`,
        messageType: 'normal',
      });
    }
  }
}

function processWash(ctx: CommandContext): void {
  // Get water sources in this room
  const waterSources = appearanceManager.getWaterSourcesInRoom(ctx.roomId);

  if (waterSources.length === 0) {
    sendOutput(ctx.playerId, '\nThere is no water source here to wash in.\nTry looking for a river, well, or public trough.\n');
    return;
  }

  // Get current appearance
  const appearance = appearanceManager.getPlayerAppearance(ctx.playerId);

  // If player specified a source type
  if (ctx.args.length > 0) {
    const targetWord = ctx.args.join(' ').toLowerCase();

    // Find matching source
    const matchedSource = waterSources.find(s =>
      s.sourceType.toLowerCase().includes(targetWord) ||
      s.description.toLowerCase().includes(targetWord) ||
      targetWord.includes(s.sourceType.replace('_', ' '))
    );

    if (!matchedSource) {
      sendOutput(ctx.playerId, `You don't see "${ctx.args.join(' ')}" here to wash in.`);
      return;
    }

    // Check if private and owner is nearby
    if (matchedSource.ownerNpcId) {
      const npcsInRoom = worldManager.getNpcsInRoomWithTemplates(ctx.roomId);
      const ownerNpc = npcsInRoom.find(n => n.template.id === matchedSource.ownerNpcId);

      if (ownerNpc) {
        // Owner is present - check relationship
        const db = getDatabase();
        const relationship = db.prepare(`
          SELECT capital FROM social_capital
          WHERE player_id = ? AND npc_id = ?
        `).get(ctx.playerId, matchedSource.ownerNpcId) as { capital: number } | undefined;

        if (!relationship || relationship.capital < 10) {
          sendOutput(ctx.playerId, `\n${ownerNpc.template.name} gives you a sharp look.\n"That's my water. Ask before you use it, stranger."\n`);
          return;
        }
        // If they have good relationship, let them use it
        sendOutput(ctx.playerId, `${ownerNpc.template.name} nods permission.`);
      }
    }

    // Do the wash
    const result = appearanceManager.wash(ctx.playerId, matchedSource.id);
    if (result.success) {
      let cleanMsg = result.message;
      if (appearance.bloodiness > 0) {
        cleanMsg += ' The blood washes away.';
      }
      cleanMsg += `\n\n[Cleanliness: ${appearance.cleanliness} → ${result.newCleanliness}]`;
      sendOutput(ctx.playerId, `\n${cleanMsg}\n`);

      // Notify others
      const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
      for (const otherId of playersInRoom) {
        if (otherId !== ctx.playerId) {
          connectionManager.sendToPlayer(otherId, {
            type: 'output',
            text: `${ctx.playerName} washes in the ${matchedSource.sourceType.replace('_', ' ')}.`,
            messageType: 'normal',
          });
        }
      }
    } else {
      sendOutput(ctx.playerId, result.message);
    }
    return;
  }

  // No source specified - list available sources
  if (waterSources.length === 1) {
    // Auto-use the only source
    const source = waterSources[0];

    // Check if private and owner is nearby (same logic as above)
    if (source.ownerNpcId) {
      const npcsInRoom = worldManager.getNpcsInRoomWithTemplates(ctx.roomId);
      const ownerNpc = npcsInRoom.find(n => n.template.id === source.ownerNpcId);

      if (ownerNpc) {
        const db = getDatabase();
        const relationship = db.prepare(`
          SELECT capital FROM social_capital
          WHERE player_id = ? AND npc_id = ?
        `).get(ctx.playerId, source.ownerNpcId) as { capital: number } | undefined;

        if (!relationship || relationship.capital < 10) {
          sendOutput(ctx.playerId, `\n${ownerNpc.template.name} gives you a sharp look.\n"That's my water. Ask before you use it, stranger."\n`);
          return;
        }
        sendOutput(ctx.playerId, `${ownerNpc.template.name} nods permission.`);
      }
    }

    const result = appearanceManager.wash(ctx.playerId, source.id);
    if (result.success) {
      let cleanMsg = result.message;
      if (appearance.bloodiness > 0) {
        cleanMsg += ' The blood washes away.';
      }
      cleanMsg += `\n\n[Cleanliness: ${appearance.cleanliness} → ${result.newCleanliness}]`;
      sendOutput(ctx.playerId, `\n${cleanMsg}\n`);

      // Notify others
      const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
      for (const otherId of playersInRoom) {
        if (otherId !== ctx.playerId) {
          connectionManager.sendToPlayer(otherId, {
            type: 'output',
            text: `${ctx.playerName} washes in the ${source.sourceType.replace('_', ' ')}.`,
            messageType: 'normal',
          });
        }
      }
    } else {
      sendOutput(ctx.playerId, result.message);
    }
  } else {
    // Multiple sources - list them
    const lines = [
      '\nYou see the following water sources:',
      '',
    ];
    for (const source of waterSources) {
      const ownership = source.ownerNpcId ? ' (private)' : ' (public)';
      lines.push(`  • ${source.sourceType.replace('_', ' ')}${ownership}`);
      lines.push(`    ${source.description}`);
    }
    lines.push('');
    lines.push('Use "wash <source>" to wash at a specific source.');
    lines.push(`Your current cleanliness: ${appearance.cleanliness}/100 (${appearance.cleanlinessDesc})`);
    lines.push('');
    sendOutput(ctx.playerId, lines.join('\n'));
  }
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

// === JOBS & ECONOMY COMMANDS ===

function processJobs(ctx: CommandContext): void {
  // Show available jobs at current location and player's current job
  const availableJobs = economyManager.getAvailableJobs(ctx.playerId, ctx.roomId);
  const currentJob = economyManager.getCurrentJob(ctx.playerId);

  const lines: string[] = ['', '╔═══════════════════════════════════════════════════╗'];
  lines.push('║              EMPLOYMENT OPPORTUNITIES             ║');
  lines.push('╠═══════════════════════════════════════════════════╣');

  // Show current job if any
  if (currentJob) {
    const npc = currentJob.job.employerNpcId ? getNpcById(currentJob.job.employerNpcId) : null;
    lines.push(`║  YOUR JOB: ${currentJob.job.name.padEnd(36)} ║`);
    lines.push(`║  Employer: ${(npc?.name || 'Village').padEnd(36)} ║`);
    lines.push(`║  Tasks Done: ${String(currentJob.employment.tasks_completed).padEnd(10)} Earned: ${String(currentJob.employment.total_earned).padEnd(6)} ║`);
    lines.push(`║  Standing: ${currentJob.employment.standing.padEnd(36)} ║`);
    lines.push('╠═══════════════════════════════════════════════════╣');
  }

  // Show available jobs at this location
  if (availableJobs.length === 0) {
    lines.push('║  No jobs available at this location.              ║');
    lines.push('║  Try the village square or farmlands.             ║');
  } else {
    lines.push('║  JOBS AVAILABLE HERE:                             ║');
    lines.push('║───────────────────────────────────────────────────║');

    for (const { job, canWork, reason } of availableJobs) {
      const status = canWork ? '✓' : '✗';
      const npc = job.employerNpcId ? getNpcById(job.employerNpcId) : null;

      lines.push(`║  [${job.id}] ${job.name.padEnd(30)} ${String(job.payPerTask).padStart(3)}g ${status} ║`);

      if (!canWork && reason) {
        lines.push(`║      ${reason.substring(0, 44).padEnd(44)} ║`);
      }
    }
  }

  lines.push('╠═══════════════════════════════════════════════════╣');
  lines.push('║  apply <job#> - Apply for a job                   ║');
  lines.push('║  work        - Start working (if employed)        ║');
  lines.push('║  quit        - Quit your current job              ║');
  lines.push('╚═══════════════════════════════════════════════════╝');
  lines.push('');

  sendOutput(ctx.playerId, lines.join('\n'));
}

function processWork(ctx: CommandContext): void {
  // Start working on a task for your current job
  const result = economyManager.startWork(ctx.playerId);
  sendOutput(ctx.playerId, result.message);
}

function processApply(ctx: CommandContext): void {
  // Apply for a job by ID
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Apply for which job? Use: apply <job number>');
    return;
  }

  const jobId = parseInt(ctx.args[0]);
  if (isNaN(jobId)) {
    sendOutput(ctx.playerId, 'Invalid job number.');
    return;
  }

  const result = economyManager.applyForJob(ctx.playerId, jobId);
  sendOutput(ctx.playerId, result.message);
}

function processQuitJob(ctx: CommandContext): void {
  // Quit current job
  const result = economyManager.quitJob(ctx.playerId);
  sendOutput(ctx.playerId, result.message);
}

function processGive(ctx: CommandContext): void {
  // Give items to NPCs or gold to players
  // Formats: "give <item> <npc>" or "give <amount> <player>"
  if (ctx.args.length < 2) {
    sendOutput(ctx.playerId, 'Give what to whom? Use: give <item> <npc> or give <amount> <player>');
    return;
  }

  const db = getDatabase();
  const firstArg = ctx.args[0];
  const targetName = ctx.args.slice(1).join(' ').toLowerCase();

  // First, check if giving to an NPC (item)
  const npcsInRoom = npcManager.getNpcsInRoom(ctx.roomId);
  let matchedNpc: { id: number; name: string; npcTemplateId?: number } | null = null;

  for (const npc of npcsInRoom) {
    const nameParts = npc.name.toLowerCase().split(' ');
    if (nameParts.some(part => part.length >= 3 && targetName.includes(part)) ||
        npc.name.toLowerCase().includes(targetName)) {
      matchedNpc = npc;
      break;
    }
  }

  if (matchedNpc) {
    // Giving something to an NPC
    const itemName = firstArg.toLowerCase();

    // Find item in player's inventory
    const inventory = playerManager.getInventory(ctx.playerId);
    const item = inventory.find(i => {
      // Check by name
      if (i.name.toLowerCase().includes(itemName)) return true;
      // Check by item template keywords
      const template = itemTemplates.find(t => t.id === i.templateId);
      if (template?.keywords?.some(k => k.toLowerCase().includes(itemName))) return true;
      return false;
    });

    if (!item) {
      sendOutput(ctx.playerId, `You don't have "${firstArg}" to give.`);
      return;
    }

    // Check if this fulfills an NPC want
    const npcWantsManager = require('../managers/npcWantsManager').npcWantsManager;
    const npcTemplateId = matchedNpc.npcTemplateId || (matchedNpc as any).id;
    const fulfillmentCheck = npcWantsManager.checkFulfillment(
      npcTemplateId,
      ctx.playerId,
      item.templateId,
      item.quantity
    );

    if (fulfillmentCheck && fulfillmentCheck.fulfilled) {
      // Remove items from player inventory
      const removeQty = fulfillmentCheck.want.quantityNeeded;
      if (item.quantity > removeQty) {
        db.prepare(`
          UPDATE player_inventory SET quantity = quantity - ?
          WHERE player_id = ? AND item_template_id = ?
        `).run(removeQty, ctx.playerId, item.templateId);
      } else {
        db.prepare(`
          DELETE FROM player_inventory
          WHERE player_id = ? AND item_template_id = ?
        `).run(ctx.playerId, item.templateId);
      }

      // Fulfill the want and get reward
      const result = npcWantsManager.fulfillWant(fulfillmentCheck.want.id, ctx.playerId, removeQty);

      sendOutput(ctx.playerId, `\nYou give ${removeQty}x ${item.name} to ${matchedNpc.name}.\n`);
      sendOutput(ctx.playerId, `${matchedNpc.name}: "${result.message}"\n`);

      if (result.reward) {
        if (result.reward.type === 'gold') {
          sendOutput(ctx.playerId, `[+${result.reward.amount} gold]`);
        } else if (result.reward.type === 'item' && result.reward.itemId) {
          const rewardItem = require('../data/items').itemTemplates.find((i: any) => i.id === result.reward!.itemId);
          sendOutput(ctx.playerId, `[Received: ${rewardItem?.name || 'an item'}]`);
        } else if (result.reward.type === 'reputation') {
          sendOutput(ctx.playerId, `[+${result.reward.amount} reputation with ${matchedNpc.name}]`);
        }
      }
      sendOutput(ctx.playerId, `[+5 social capital with ${matchedNpc.name}]\n`);
    } else if (fulfillmentCheck && !fulfillmentCheck.fulfilled) {
      // They want this item but player doesn't have enough
      sendOutput(ctx.playerId, `\n${matchedNpc.name} wants ${fulfillmentCheck.want.quantityNeeded}x ${item.name}, but you only have ${item.quantity}.\n`);
    } else {
      // NPC doesn't want this item
      sendOutput(ctx.playerId, `\nYou offer ${item.name} to ${matchedNpc.name}.\n`);
      sendOutput(ctx.playerId, `${matchedNpc.name} looks at it but doesn't seem interested.\n`);
    }
    return;
  }

  // Not an NPC - check if giving gold to a player
  const amount = parseInt(firstArg);
  if (isNaN(amount) || amount <= 0) {
    sendOutput(ctx.playerId, `You don't see "${targetName}" here.`);
    return;
  }

  // Find target player
  const target = db.prepare(`SELECT id, name FROM players WHERE name LIKE ?`).get(`%${targetName}%`) as { id: number; name: string } | undefined;

  if (!target) {
    sendOutput(ctx.playerId, `Couldn't find anyone named "${targetName}".`);
    return;
  }

  if (target.id === ctx.playerId) {
    sendOutput(ctx.playerId, 'You can\'t give gold to yourself.');
    return;
  }

  // Check if target is in same room
  const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
  if (!playersInRoom.includes(target.id)) {
    sendOutput(ctx.playerId, `${target.name} isn't here.`);
    return;
  }

  const result = economyManager.transferGold(ctx.playerId, target.id, amount);
  sendOutput(ctx.playerId, result.message);
}

// === RESOURCE GATHERING COMMANDS ===

function processDig(ctx: CommandContext): void {
  // Dig in the current location to find resources
  // Requires a shovel
  const result = resourceManager.dig(ctx.playerId, ctx.roomId);
  sendOutput(ctx.playerId, result.message);
}

function processFish(ctx: CommandContext): void {
  // Fish in water locations
  // Requires fishing line
  const result = resourceManager.fish(ctx.playerId, ctx.roomId);
  sendOutput(ctx.playerId, result.message);
}

function processChop(ctx: CommandContext): void {
  // Chop wood in forest areas
  // Requires an axe
  const result = resourceManager.chop(ctx.playerId, ctx.roomId);
  sendOutput(ctx.playerId, result.message);
}

function processMine(ctx: CommandContext): void {
  // Mine stone and ore in underground areas
  // Requires a pickaxe
  const result = resourceManager.mine(ctx.playerId, ctx.roomId);
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

function processAssist(ctx: CommandContext): void {
  // The ASSIST command lets players help NPCs with their current tasks.
  // This is a core mechanic of the living world - NPCs remember who helped them,
  // and you earn social capital for lending a hand.

  if (ctx.args.length === 0) {
    // No target specified - show who's around that could use help
    const npcsInRoom = npcManager.getNpcsInRoom(ctx.roomId);

    if (npcsInRoom.length === 0) {
      sendOutput(ctx.playerId, '\nThere is nobody here who could use your help.\n');
      return;
    }

    // Get room activity descriptions (this shows NPCs working on tasks)
    const activityDesc = npcLifeManager.getNpcActivityDescription(ctx.roomId);

    if (!activityDesc) {
      sendOutput(ctx.playerId, '\nNo one here seems to need assistance right now.\n');
    } else {
      // List NPCs with names for assist command
      const helpableNames = npcsInRoom.map(npc => `  • ${npc.name.split(' ')[0].toLowerCase()}`).join('\n');
      sendOutput(ctx.playerId, `\nYou see people working:${activityDesc}\n\nType "assist <name>" to lend a hand, e.g.:\n${helpableNames}\n`);
    }
    return;
  }

  // Try to find the NPC by name
  const targetName = ctx.args.join(' ').toLowerCase();
  const npcsInRoom = npcManager.getNpcsInRoom(ctx.roomId);
  const targetNpc = npcsInRoom.find(npc =>
    npc.name.toLowerCase().includes(targetName) ||
    npc.name.toLowerCase().split(' ').some(part => part.startsWith(targetName))
  );

  if (!targetNpc) {
    sendOutput(ctx.playerId, `\nYou don't see "${ctx.args.join(' ')}" here.\n`);
    return;
  }

  // Need to get the NPC instance ID (from room_npcs table) rather than template ID
  const db = getDatabase();
  const npcInstance = db.prepare(`
    SELECT id FROM room_npcs
    WHERE npc_template_id = ? AND room_id = ?
    LIMIT 1
  `).get(targetNpc.id, ctx.roomId) as { id: number } | undefined;

  if (!npcInstance) {
    sendOutput(ctx.playerId, `\n${targetNpc.name} doesn't seem to be here right now.\n`);
    return;
  }

  // Try to help this NPC with their current task
  const result = npcLifeManager.helpWithTask(ctx.playerId, npcInstance.id);

  if (result.success) {
    // Build a rich description of the help
    const helpMessages = [
      '',
      result.message,
      '',
    ];

    if (result.socialGain && result.socialGain > 0) {
      helpMessages.push(`[+${result.socialGain} Social Capital with ${targetNpc.name}]`);
    }

    helpMessages.push('');
    sendOutput(ctx.playerId, helpMessages.join('\n'));

    // Broadcast to the room that the player is helping
    const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
    for (const pid of playersInRoom) {
      if (pid !== ctx.playerId) {
        connectionManager.sendToPlayer(pid, {
          type: 'output',
          text: `\n${ctx.playerName} lends a hand to ${targetNpc.name}.\n`,
          messageType: 'normal',
        });
      }
    }
  } else {
    sendOutput(ctx.playerId, `\n${result.message}\n`);
  }
}

function processTime(ctx: CommandContext): void {
  // Shows the current in-game time. The game world has a day/night cycle
  // where 1 real minute = 1 game hour. NPCs follow schedules based on this.

  const { hour: gameHour } = npcLifeManager.getGameTime();
  const timeOfDay = getTimeOfDayDescription(gameHour);
  const hourDisplay = gameHour % 12 || 12;
  const amPm = gameHour >= 12 ? 'PM' : 'AM';

  const timeLines = [
    '',
    `═══════════════════════════════════`,
    `  The time in Gamehenge is ${hourDisplay}:00 ${amPm}`,
    `  ${timeOfDay}`,
    `═══════════════════════════════════`,
    '',
  ];

  sendOutput(ctx.playerId, timeLines.join('\n'));
}

function getTimeOfDayDescription(hour: number): string {
  // Atmospheric descriptions of the time of day, as befits a fantasy world
  if (hour >= 5 && hour < 7) {
    return 'Dawn breaks over Gamehenge. The sky blushes pink.';
  } else if (hour >= 7 && hour < 9) {
    return 'Early morning. Dew glistens on the grass.';
  } else if (hour >= 9 && hour < 12) {
    return 'Mid-morning. The village stirs with activity.';
  } else if (hour >= 12 && hour < 14) {
    return 'High noon. The sun stands at its zenith.';
  } else if (hour >= 14 && hour < 17) {
    return 'Afternoon. Long shadows begin to stretch.';
  } else if (hour >= 17 && hour < 19) {
    return 'Evening approaches. The sky turns golden.';
  } else if (hour >= 19 && hour < 21) {
    return 'Dusk settles over the land. Torches are lit.';
  } else if (hour >= 21 && hour < 23) {
    return 'Night has fallen. Stars wheel overhead.';
  } else {
    return 'Deep night. Most souls are asleep.';
  }
}

// === BUILDING COMMANDS ===

function processPlots(ctx: CommandContext): void {
  // Show available plots for purchase in the current room
  const plots = buildingManager.getAvailablePlots(ctx.roomId);

  if (plots.length === 0) {
    sendOutput(ctx.playerId, '\nThere is no land available for purchase here.\nTry the village residential areas or farmlands.\n');
    return;
  }

  const lines: string[] = ['', '╔═══════════════════════════════════════════════════╗'];
  lines.push('║              AVAILABLE LAND PLOTS                 ║');
  lines.push('╠═══════════════════════════════════════════════════╣');

  for (const plot of plots) {
    const status = plot.owned ? `Owned by ${plot.ownerName}` : `${plot.price} gold`;
    const marker = plot.owned ? '✗' : '✓';
    lines.push(`║  Plot #${plot.plotNumber}  (${plot.width}x${plot.height})  ${status.padEnd(25)} ${marker} ║`);
  }

  lines.push('╠═══════════════════════════════════════════════════╣');
  lines.push('║  To purchase: buy plot <number>                   ║');
  lines.push('║  After owning: survey, build, demolish            ║');
  lines.push('╚═══════════════════════════════════════════════════╝');
  lines.push('');

  sendOutput(ctx.playerId, lines.join('\n'));
}

function processSurvey(ctx: CommandContext): void {
  // View your plot as ASCII art
  const result = buildingManager.surveyPlot(ctx.playerId, ctx.roomId);
  sendOutput(ctx.playerId, result.message);
}

function processBuild(ctx: CommandContext): void {
  // Build a structure on your plot
  // Usage: build <type> <x> <y>
  if (ctx.args.length < 3) {
    // Show build options
    const options = buildingManager.listBuildOptions();
    sendOutput(ctx.playerId, options);
    return;
  }

  const structureType = ctx.args[0].toLowerCase();
  const x = parseInt(ctx.args[1]);
  const y = parseInt(ctx.args[2]);

  if (isNaN(x) || isNaN(y)) {
    sendOutput(ctx.playerId, 'Invalid coordinates. Use: build <type> <x> <y>');
    return;
  }

  const result = buildingManager.build(ctx.playerId, ctx.roomId, structureType, x, y);
  sendOutput(ctx.playerId, result.message);
}

function processDemolish(ctx: CommandContext): void {
  // Remove a structure from your plot
  // Usage: demolish <x> <y>
  if (ctx.args.length < 2) {
    sendOutput(ctx.playerId, 'Demolish what? Use: demolish <x> <y>');
    return;
  }

  const x = parseInt(ctx.args[0]);
  const y = parseInt(ctx.args[1]);

  if (isNaN(x) || isNaN(y)) {
    sendOutput(ctx.playerId, 'Invalid coordinates. Use: demolish <x> <y>');
    return;
  }

  const result = buildingManager.demolish(ctx.playerId, ctx.roomId, x, y);
  sendOutput(ctx.playerId, result.message);
}

function processBuildMaterials(ctx: CommandContext): void {
  // List all buildable structures and their material costs
  const options = buildingManager.listBuildOptions();
  sendOutput(ctx.playerId, options);
}

// === CREATIVE COMMANDS ===

function processWrite(ctx: CommandContext): void {
  // Start writing a book or add text to current book
  const wipType = creativeManager.getWipType(ctx.playerId);

  if (wipType === 'book' && ctx.args.length > 0) {
    // Add text to existing book
    const text = ctx.args.join(' ');
    const result = creativeManager.writeToBook(ctx.playerId, text);
    sendOutput(ctx.playerId, result.message);
  } else if (ctx.args.length > 0) {
    // Start new book with title
    const title = ctx.args.join(' ');
    const result = creativeManager.startBook(ctx.playerId, title);
    sendOutput(ctx.playerId, result.message);
  } else {
    sendOutput(ctx.playerId, 'Write what? Use "write <title>" to start a book, or "write <text>" to add to your current book.');
  }
}

function processPage(ctx: CommandContext): void {
  // This would navigate to a specific page - for now just show current work
  const result = creativeManager.readWip(ctx.playerId);
  sendOutput(ctx.playerId, result.message);
}

function processNewPage(ctx: CommandContext): void {
  const result = creativeManager.addBookPage(ctx.playerId);
  sendOutput(ctx.playerId, result.message);
}

function processPaint(ctx: CommandContext): void {
  // Start a new artwork
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Paint what? Use "paint <title>" to start an artwork.');
    return;
  }

  // Parse optional dimensions: paint "Title" 20 10
  const title = ctx.args[0];
  let width = 20;
  let height = 10;

  if (ctx.args.length >= 3) {
    const parsedW = parseInt(ctx.args[1]);
    const parsedH = parseInt(ctx.args[2]);
    if (!isNaN(parsedW)) width = parsedW;
    if (!isNaN(parsedH)) height = parsedH;
  }

  const result = creativeManager.startArtwork(ctx.playerId, title, width, height);
  sendOutput(ctx.playerId, result.message);
}

function processDraw(ctx: CommandContext): void {
  // Draw on canvas: draw <x> <y> <char>
  if (ctx.args.length < 3) {
    sendOutput(ctx.playerId, 'Draw what? Use: draw <x> <y> <character>');
    return;
  }

  const x = parseInt(ctx.args[0]);
  const y = parseInt(ctx.args[1]);
  const char = ctx.args[2];

  if (isNaN(x) || isNaN(y)) {
    sendOutput(ctx.playerId, 'Invalid coordinates.');
    return;
  }

  const result = creativeManager.drawOnCanvas(ctx.playerId, x, y, char);
  sendOutput(ctx.playerId, result.message);
}

function processErase(ctx: CommandContext): void {
  // Erase from canvas: erase <x> <y>
  if (ctx.args.length < 2) {
    sendOutput(ctx.playerId, 'Erase where? Use: erase <x> <y>');
    return;
  }

  const x = parseInt(ctx.args[0]);
  const y = parseInt(ctx.args[1]);

  if (isNaN(x) || isNaN(y)) {
    sendOutput(ctx.playerId, 'Invalid coordinates.');
    return;
  }

  const result = creativeManager.drawOnCanvas(ctx.playerId, x, y, ' ');
  sendOutput(ctx.playerId, result.success ? `You erase at (${x}, ${y}).` : result.message);
}

function processCompose(ctx: CommandContext): void {
  // Start a musical composition or add notes
  const wipType = creativeManager.getWipType(ctx.playerId);

  if (wipType === 'composition' && ctx.args.length > 0) {
    // Add notes to existing composition
    const notes = ctx.args.join(' ');
    const result = creativeManager.addNotes(ctx.playerId, notes);
    sendOutput(ctx.playerId, result.message);
  } else if (ctx.args.length > 0) {
    // Start new composition with title
    // Optional: compose <title> <instrument>
    const title = ctx.args[0];
    const instrument = ctx.args[1] || 'voice';
    const result = creativeManager.startComposition(ctx.playerId, title, instrument);
    sendOutput(ctx.playerId, result.message);
  } else {
    sendOutput(ctx.playerId, 'Compose what? Use "compose <title> [instrument]" to start.\nInstruments: voice, lute, flute, drum, harp');
  }
}

function processNotes(ctx: CommandContext): void {
  // Add notes to a composition
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Add what notes? Use: notes <musical notation>');
    return;
  }

  const notes = ctx.args.join(' ');
  const result = creativeManager.addNotes(ctx.playerId, notes);
  sendOutput(ctx.playerId, result.message);
}

function processPreview(ctx: CommandContext): void {
  // Preview current work in progress
  const result = creativeManager.readWip(ctx.playerId);
  sendOutput(ctx.playerId, result.message);
}

function processFinish(ctx: CommandContext): void {
  // Finish and publish current work
  const result = creativeManager.finishCreative(ctx.playerId);
  sendOutput(ctx.playerId, result.message);
}

function processAbandon(ctx: CommandContext): void {
  // Abandon current work
  const result = creativeManager.abandonWip(ctx.playerId);
  sendOutput(ctx.playerId, result.message);
}

function processPlay(ctx: CommandContext): void {
  // Play a musical composition
  if (ctx.args.length === 0) {
    // List compositions
    const result = creativeManager.listPlayerCompositions(ctx.playerId);
    sendOutput(ctx.playerId, result.message);
    return;
  }

  const title = ctx.args.join(' ');
  const result = creativeManager.performMusic(ctx.playerId, ctx.roomId, title);
  sendOutput(ctx.playerId, result.message);

  // Broadcast to room if successful
  if (result.success && result.broadcastText) {
    const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
    for (const pid of playersInRoom) {
      if (pid !== ctx.playerId) {
        connectionManager.sendToPlayer(pid, {
          type: 'output',
          text: `\n${result.broadcastText}\n`,
          messageType: 'normal',
        });
      }
    }
  }
}

function processBooks(ctx: CommandContext): void {
  // List player's books or read a specific book
  if (ctx.args.length === 0) {
    const result = creativeManager.listPlayerBooks(ctx.playerId);
    sendOutput(ctx.playerId, result.message);
  } else {
    const title = ctx.args.join(' ');
    const result = creativeManager.readBook(ctx.playerId, title);
    sendOutput(ctx.playerId, result.message);
  }
}

function processSongs(ctx: CommandContext): void {
  // List player's compositions
  const result = creativeManager.listPlayerCompositions(ctx.playerId);
  sendOutput(ctx.playerId, result.message);
}

function processHelp(ctx: CommandContext): void {
  const helpText = `
╔════════════════════════════════════════════════════════╗
║                    F R O B A R K                       ║
║           Commands of the Gamehenge Realm              ║
╠════════════════════════════════════════════════════════╣
║ MOVEMENT                                               ║
║   north/n, south/s, east/e, west/w, up/u, down/d       ║
║   flee - Escape from combat                            ║
╠════════════════════════════════════════════════════════╣
║ INTERACTION                                            ║
║   look/l [target] - Examine room or object             ║
║   take/get <item> - Pick up an item                    ║
║   drop <item> - Drop an item                           ║
║   talk <npc> - Speak with someone                      ║
║   eat/drink <item> - Consume food or drink             ║
╠════════════════════════════════════════════════════════╣
║ LIVING WORLD                                           ║
║   assist [npc] - Help an NPC with their task           ║
║   time - Check the time of day in Gamehenge            ║
║   vitals - Check your hunger, thirst, and gold         ║
╠════════════════════════════════════════════════════════╣
║ CHARACTER                                              ║
║   inventory/i - View carried items                     ║
║   equipment/eq - View equipped items                   ║
║   score/sc - View character stats                      ║
║   vitals - Quick survival status check                 ║
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
║   tell <name> <msg> - Speak directly to NPC or player  ║
║   reply/r <message> - Reply to the last NPC you spoke  ║
║   shout <message> - Shout across the area              ║
║   gossip/. <message> - Chat with all players           ║
║   who - List online players                            ║
║   where <player> - See where someone went              ║
║   people/scan - List everyone in this room             ║
╠════════════════════════════════════════════════════════╣
║ JOBS & ECONOMY                                         ║
║   jobs - See available work at your location           ║
║   apply <job#> - Apply for a job                       ║
║   work - Do a task for your job                        ║
║   quit - Quit your current job                         ║
║   give <amount> <player> - Give gold to someone        ║
╠════════════════════════════════════════════════════════╣
║ SHOPS                                                  ║
║   list - View shop inventory                           ║
║   buy <item> - Purchase an item                        ║
║   sell <item> - Sell an item                           ║
╠════════════════════════════════════════════════════════╣
║ RESOURCE GATHERING (requires tools)                    ║
║   dig   - Dig for resources (needs shovel)             ║
║   chop  - Chop wood (needs axe, forest only)           ║
║   mine  - Mine ore (needs pickaxe, underground)        ║
║   fish  - Catch fish (needs line, at river)            ║
╠════════════════════════════════════════════════════════╣
║ BUILDING (own a plot first)                            ║
║   plots       - View land for sale at this location    ║
║   survey      - View your plot as ASCII grid           ║
║   build <type> <x> <y> - Place a structure             ║
║   demolish <x> <y>     - Remove a structure            ║
║   materials   - List buildable structures & costs      ║
╠════════════════════════════════════════════════════════╣
║ CREATIVE ARTS                                          ║
║   write <title/text> - Start a book or add to one      ║
║   newpage            - Add new page to your book       ║
║   paint <title> [w h] - Start an ASCII artwork         ║
║   draw <x> <y> <char> - Draw on your canvas            ║
║   compose <title> [inst] - Start a musical composition ║
║   notes <notation>   - Add notes to composition        ║
║   preview            - View your work in progress      ║
║   finish             - Complete and save your work     ║
║   abandon            - Discard your work               ║
║   play <song>        - Perform a composition           ║
║   books              - List your written works         ║
║   songs              - List your compositions          ║
╠════════════════════════════════════════════════════════╣
║ TRAINING                                               ║
║   practice - Train skills at a guild                   ║
╠════════════════════════════════════════════════════════╣
║ GETTING HELP                                           ║
║   help - Show this command list                        ║
║   brain <question> - Ask how to do something           ║
║     Example: brain how do I see my equipment?          ║
╠════════════════════════════════════════════════════════╣
║ SURVIVAL                                               ║
║   rest/sleep - Rest to recover faster                  ║
║   wake/stand - Stop resting                            ║
╠════════════════════════════════════════════════════════╣
║ In Gamehenge, relationships matter. Help the folk      ║
║ you meet, and they will remember your kindness.        ║
╚════════════════════════════════════════════════════════╝
`;
  sendOutput(ctx.playerId, helpText);
}

// === IMPLEMENTOR COMMANDS ===
// These commands are only available to game administrators (Opus, Sprig)

function isImplementor(playerId: number): boolean {
  const db = getDatabase();
  const player = db.prepare(`SELECT is_implementor FROM players WHERE id = ?`).get(playerId) as { is_implementor: number } | undefined;
  return player?.is_implementor === 1;
}

function processImplementorCommand(ctx: CommandContext): void {
  if (!isImplementor(ctx.playerId)) {
    sendOutput(ctx.playerId, 'You lack the power to use that command.');
    return;
  }

  const subcommand = ctx.args[0]?.toLowerCase();

  if (!subcommand) {
    const help = `
╔════════════════════════════════════════════════════════╗
║              IMPLEMENTOR COMMANDS                      ║
╠════════════════════════════════════════════════════════╣
║  imm status          - World status overview           ║
║  imm teleport <room> - Teleport to any room            ║
║  imm gold <amount>   - Grant yourself gold             ║
║  imm heal            - Fully heal yourself             ║
║  journal <npc>       - Read an NPC's journal           ║
║  journals            - List all NPC journals           ║
║  npcrel <npc>        - View NPC's relationships        ║
║  goto <room>         - Teleport to a room              ║
╚════════════════════════════════════════════════════════╝
`;
    sendOutput(ctx.playerId, help);
    return;
  }

  const db = getDatabase();

  switch (subcommand) {
    case 'status': {
      const playerCount = db.prepare(`SELECT COUNT(*) as count FROM players`).get() as { count: number };
      const npcCount = db.prepare(`SELECT COUNT(*) as count FROM room_npcs`).get() as { count: number };
      const journalCount = db.prepare(`SELECT COUNT(*) as count FROM npc_journals`).get() as { count: number };
      const gossipCount = db.prepare(`SELECT COUNT(*) as count FROM npc_npc_gossip`).get() as { count: number };

      sendOutput(ctx.playerId, `
╔════════════════════════════════════════════════════════╗
║              FROBARK WORLD STATUS                      ║
╠════════════════════════════════════════════════════════╣
║  Total Players:     ${String(playerCount.count).padEnd(10)}                      ║
║  Active NPCs:       ${String(npcCount.count).padEnd(10)}                      ║
║  Journal Entries:   ${String(journalCount.count).padEnd(10)}                      ║
║  NPC Gossip Events: ${String(gossipCount.count).padEnd(10)}                      ║
╚════════════════════════════════════════════════════════╝
`);
      break;
    }

    case 'teleport':
    case 'goto': {
      const roomId = ctx.args[1];
      if (!roomId) {
        sendOutput(ctx.playerId, 'Teleport where? Use: imm teleport <room_id>');
        return;
      }
      db.prepare(`UPDATE players SET current_room = ? WHERE id = ?`).run(roomId, ctx.playerId);
      sendOutput(ctx.playerId, `You vanish in a flash of light and appear in ${roomId}.`);
      // Show new room
      const roomDesc = worldManager.getRoomDescription(roomId, ctx.playerId);
      sendOutput(ctx.playerId, roomDesc);
      break;
    }

    case 'gold': {
      const amount = parseInt(ctx.args[1]) || 1000;
      db.prepare(`UPDATE players SET gold = gold + ? WHERE id = ?`).run(amount, ctx.playerId);
      sendOutput(ctx.playerId, `You conjure ${amount} gold from thin air.`);
      break;
    }

    case 'heal': {
      db.prepare(`UPDATE players SET hp = max_hp, mana = max_mana, stamina = max_stamina, hunger = 100, thirst = 100 WHERE id = ?`).run(ctx.playerId);
      sendOutput(ctx.playerId, 'Divine light surrounds you. You are fully restored.');
      break;
    }

    default:
      sendOutput(ctx.playerId, `Unknown implementor command: ${subcommand}`);
  }
}

function processReadJournal(ctx: CommandContext): void {
  if (!isImplementor(ctx.playerId)) {
    // Regular players can only read journals they find in the world
    sendOutput(ctx.playerId, 'You don\'t have a journal to read.');
    return;
  }

  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Read whose journal? Use: journal <npc name or id>');
    return;
  }

  const npcQuery = ctx.args.join(' ').toLowerCase();
  const db = getDatabase();

  // Try to find NPC by name or ID
  let npcId: number | null = null;

  if (!isNaN(parseInt(npcQuery))) {
    npcId = parseInt(npcQuery);
  } else {
    // Search NPC templates by name
    const npc = getNpcById(parseInt(npcQuery));
    if (npc) {
      npcId = npc.id;
    } else {
      // Try to find by partial name match from npc_journals
      const found = db.prepare(`
        SELECT DISTINCT npc_id FROM npc_journals
      `).all() as { npc_id: number }[];

      for (const { npc_id } of found) {
        const template = getNpcById(npc_id);
        if (template && template.name.toLowerCase().includes(npcQuery)) {
          npcId = npc_id;
          break;
        }
      }
    }
  }

  if (!npcId) {
    sendOutput(ctx.playerId, `Couldn't find an NPC matching "${npcQuery}".`);
    return;
  }

  const journal = npcSocialManager.formatJournalForDisplay(npcId, true);
  sendOutput(ctx.playerId, journal);
}

function processAllJournals(ctx: CommandContext): void {
  if (!isImplementor(ctx.playerId)) {
    sendOutput(ctx.playerId, 'You lack the power to use that command.');
    return;
  }

  const journals = npcSocialManager.getAllJournals();

  if (journals.length === 0) {
    sendOutput(ctx.playerId, '\nNo NPC journals have been written yet.\n');
    return;
  }

  const lines: string[] = [
    '',
    '╔════════════════════════════════════════════════════════╗',
    '║              ALL NPC JOURNALS                          ║',
    '╠════════════════════════════════════════════════════════╣',
  ];

  for (const j of journals) {
    lines.push(`║  [${j.npcId}] ${j.npcName.padEnd(20)} ${j.entryCount} entries`);
  }

  lines.push('╠════════════════════════════════════════════════════════╣');
  lines.push('║  Use: journal <npc name or id> to read                 ║');
  lines.push('╚════════════════════════════════════════════════════════╝');
  lines.push('');

  sendOutput(ctx.playerId, lines.join('\n'));
}

function processNpcRelationships(ctx: CommandContext): void {
  if (!isImplementor(ctx.playerId)) {
    sendOutput(ctx.playerId, 'You lack the power to use that command.');
    return;
  }

  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'View whose relationships? Use: npcrel <npc id>');
    return;
  }

  const npcId = parseInt(ctx.args[0]);
  if (isNaN(npcId)) {
    sendOutput(ctx.playerId, 'Invalid NPC ID.');
    return;
  }

  const npc = getNpcById(npcId);
  const relationships = npcSocialManager.getAllRelationships(npcId);

  if (relationships.length === 0) {
    sendOutput(ctx.playerId, `\n${npc?.name || 'This NPC'} has no recorded relationships.\n`);
    return;
  }

  const lines: string[] = [
    '',
    `╔════════════════════════════════════════════════════════╗`,
    `║  Relationships of ${(npc?.name || 'Unknown').padEnd(20)}              ║`,
    `╠════════════════════════════════════════════════════════╣`,
  ];

  for (const rel of relationships) {
    const targetNpc = getNpcById(rel.targetNpcId);
    const affinityBar = rel.affinity >= 0 ? '+'.repeat(Math.min(10, rel.affinity / 10)) : '-'.repeat(Math.min(10, Math.abs(rel.affinity) / 10));
    lines.push(`║  ${(targetNpc?.name || 'Unknown').padEnd(20)} [${affinityBar.padEnd(10)}] ${rel.relationshipType}`);
    if (rel.notes) {
      lines.push(`║    "${rel.notes.substring(0, 45)}"`);
    }
  }

  lines.push('╚════════════════════════════════════════════════════════╝');
  lines.push('');

  sendOutput(ctx.playerId, lines.join('\n'));
}

function processGoto(ctx: CommandContext): void {
  if (!isImplementor(ctx.playerId)) {
    sendOutput(ctx.playerId, 'You lack the power to use that command.');
    return;
  }

  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, 'Go where? Use: goto <room_id>');
    return;
  }

  const roomId = ctx.args[0];
  const db = getDatabase();

  db.prepare(`UPDATE players SET current_room = ? WHERE id = ?`).run(roomId, ctx.playerId);
  sendOutput(ctx.playerId, `You vanish and reappear in ${roomId}.`);

  const roomDesc = worldManager.getRoomDescription(roomId, ctx.playerId);
  sendOutput(ctx.playerId, roomDesc);
}

// === BRAIN COMMAND ===
// Gemini-powered help that figures out what command the player needs

async function processBrainAsync(ctx: CommandContext): Promise<void> {
  if (ctx.args.length === 0) {
    sendOutput(ctx.playerId, '\nYou look inward and ask your brain... nothing.\n\nUsage: brain <your question>\nExample: brain how do I see what I am wearing?\n');
    return;
  }

  const question = ctx.args.join(' ');

  // Gather context for the brain
  const room = worldManager.getRoom(ctx.roomId);
  const npcsInRoom = npcManager.getNpcsInRoom(ctx.roomId);
  const npcNames = npcsInRoom.map(n => n.name);

  // Get player inventory (abbreviated)
  const inventory = playerManager.getInventory(ctx.playerId);
  const inventoryNames = inventory.slice(0, 5).map(i => i.name);

  sendOutput(ctx.playerId, '\nYou search your brain for the answer...\n');

  try {
    const response = await generateBrainHelp(
      question,
      room?.name || 'unknown area',
      npcNames,
      inventoryNames
    );

    sendOutput(ctx.playerId, `\n💭 ${response}\n`);
  } catch (error) {
    console.error('[Brain] Error:', error);
    sendOutput(ctx.playerId, '\nYour brain is foggy. Try "help" for a list of commands.\n');
  }
}

function processBrain(ctx: CommandContext): void {
  processBrainAsync(ctx).catch(err => {
    console.error('[Brain] Async error:', err);
    sendOutput(ctx.playerId, '\nYour thoughts are muddled. Try "help" for basic commands.\n');
  });
}
