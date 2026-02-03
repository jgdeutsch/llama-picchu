// Telnet Server for FROBARK MUD
// A living world set in Phish's Gamehenge universe
// Players can connect from anywhere using: telnet frobark.com 4000

import * as net from 'net';
import { initializeDatabase, getDatabase, accountQueries, playerQueries, equipmentQueries } from './database';
import { worldManager } from './managers/worldManager';
import { npcManager } from './managers/npcManager';
import { playerManager } from './managers/playerManager';
import { combatManager } from './managers/combatManager';
import { questManager } from './managers/questManager';
import { gameLoop } from './gameLoop';
import { processCommand } from './commands';
import bcrypt from 'bcrypt';

const TELNET_PORT = parseInt(process.env.TELNET_PORT || '4000', 10);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightCyan: '\x1b[96m',
};

interface TelnetConnection {
  socket: net.Socket;
  state: 'login' | 'password' | 'menu' | 'character_select' | 'character_create' | 'playing';
  accountId: number | null;
  playerId: number | null;
  playerName: string | null;
  username: string | null;
  inputBuffer: string;
  lastActivity: number;
  // Character creation state
  createState?: {
    step: 'class' | 'stats' | 'name';
    classId?: number;
    stats?: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  };
}

// Active connections
const connections: Map<net.Socket, TelnetConnection> = new Map();
const playerSockets: Map<number, net.Socket> = new Map();

// Send text to a socket with optional color
function send(socket: net.Socket, text: string, color?: string): void {
  if (socket.writable) {
    const output = color ? color + text + colors.reset : text;
    socket.write(output);
  }
}

function sendLine(socket: net.Socket, text: string, color?: string): void {
  send(socket, text + '\r\n', color);
}

function sendPrompt(socket: net.Socket, prompt: string = '> '): void {
  send(socket, prompt, colors.green);
}

// Send to a specific player by ID
function sendToPlayer(playerId: number, text: string, color?: string): void {
  const socket = playerSockets.get(playerId);
  if (socket) {
    sendLine(socket, text, color);
    // Re-show prompt if they're playing
    const conn = connections.get(socket);
    if (conn?.state === 'playing') {
      sendPrompt(socket);
    }
  }
}

// Broadcast to all players in a room
function sendToRoom(roomId: string, text: string, exceptPlayerId?: number): void {
  const playersInRoom = worldManager.getPlayersInRoom(roomId);
  for (const pid of playersInRoom) {
    if (pid !== exceptPlayerId) {
      sendToPlayer(pid, text);
    }
  }
}

// Broadcast to all connected players
function broadcast(text: string, exceptPlayerId?: number): void {
  for (const [socket, conn] of connections) {
    if (conn.state === 'playing' && conn.playerId !== exceptPlayerId) {
      sendLine(socket, text);
      sendPrompt(socket);
    }
  }
}

const TITLE_SCREEN = `
${colors.brightYellow}${colors.bold}
    ███████╗██████╗  ██████╗ ██████╗  █████╗ ██████╗ ██╗  ██╗
    ██╔════╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝
    █████╗  ██████╔╝██║   ██║██████╔╝███████║██████╔╝█████╔╝
    ██╔══╝  ██╔══██╗██║   ██║██╔══██╗██╔══██║██╔══██╗██╔═██╗
    ██║     ██║  ██║╚██████╔╝██████╔╝██║  ██║██║  ██║██║  ██╗
    ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝
${colors.reset}
${colors.cyan}    ╔═══════════════════════════════════════════════════════╗
    ║                   GAMEHENGE                           ║
    ║         A Living World Awaits You                     ║
    ║                                                       ║
    ║   The Lizards toil under Wilson's cruel reign.        ║
    ║   Icculus watches from his tower. Tela plots          ║
    ║   revolution in the shadows. The Helping Friendly     ║
    ║   Book holds secrets that could change everything.    ║
    ║                                                       ║
    ║   You arrive with nothing. Earn your place through    ║
    ║   work, relationships, and deeds. The NPCs here       ║
    ║   live their own lives - help them, and they'll       ║
    ║   remember. Wrong them, and they'll remember that     ║
    ║   too.                                                ║
    ╚═══════════════════════════════════════════════════════╝${colors.reset}

`;

const LOGIN_MENU = `
${colors.cyan}  1. Login
  2. Create New Account
  3. Quit${colors.reset}

Enter choice: `;

function showTitleAndMenu(socket: net.Socket): void {
  send(socket, TITLE_SCREEN);
  send(socket, LOGIN_MENU);
}

// Handle new connection
function handleConnection(socket: net.Socket): void {
  const remoteAddr = socket.remoteAddress || 'unknown';
  console.log(`New telnet connection from ${remoteAddr}`);

  const conn: TelnetConnection = {
    socket,
    state: 'menu',
    accountId: null,
    playerId: null,
    playerName: null,
    username: null,
    inputBuffer: '',
    lastActivity: Date.now(),
  };

  connections.set(socket, conn);

  // Disable telnet echo for password entry
  // IAC WILL ECHO
  socket.write(Buffer.from([255, 251, 1]));

  showTitleAndMenu(socket);

  socket.on('data', (data) => handleData(socket, data));
  socket.on('close', () => handleDisconnect(socket));
  socket.on('error', (err) => {
    console.error(`Socket error from ${remoteAddr}:`, err.message);
    handleDisconnect(socket);
  });
}

// Handle incoming data
function handleData(socket: net.Socket, data: Buffer): void {
  const conn = connections.get(socket);
  if (!conn) return;

  conn.lastActivity = Date.now();

  // Convert to string and handle telnet control sequences
  let input = data.toString();

  // Remove telnet IAC sequences
  input = input.replace(/\xff[\xfb-\xfe]./g, '');
  input = input.replace(/\xff[\xf0-\xff]/g, '');

  // Add to buffer
  conn.inputBuffer += input;

  // Process complete lines
  while (conn.inputBuffer.includes('\n') || conn.inputBuffer.includes('\r')) {
    const lineEnd = Math.min(
      conn.inputBuffer.includes('\n') ? conn.inputBuffer.indexOf('\n') : Infinity,
      conn.inputBuffer.includes('\r') ? conn.inputBuffer.indexOf('\r') : Infinity
    );

    const line = conn.inputBuffer.substring(0, lineEnd).trim();
    conn.inputBuffer = conn.inputBuffer.substring(lineEnd + 1).replace(/^[\r\n]+/, '');

    if (line.length > 0) {
      processInput(socket, conn, line);
    }
  }
}

// Process a line of input based on connection state
function processInput(socket: net.Socket, conn: TelnetConnection, input: string): void {
  switch (conn.state) {
    case 'menu':
      handleMenuInput(socket, conn, input);
      break;
    case 'login':
      handleLoginUsername(socket, conn, input);
      break;
    case 'password':
      handleLoginPassword(socket, conn, input);
      break;
    case 'character_select':
      handleCharacterSelect(socket, conn, input);
      break;
    case 'character_create':
      handleCharacterCreate(socket, conn, input);
      break;
    case 'playing':
      handleGameCommand(socket, conn, input);
      break;
  }
}

// Menu handling
function handleMenuInput(socket: net.Socket, conn: TelnetConnection, input: string): void {
  switch (input) {
    case '1':
      conn.state = 'login';
      send(socket, '\r\nUsername: ');
      break;
    case '2':
      sendLine(socket, '\r\n--- Create New Account ---', colors.brightYellow);
      send(socket, 'Choose a username: ');
      conn.state = 'login';
      conn.username = null; // Will be creating new account
      break;
    case '3':
      sendLine(socket, '\r\nGoodbye!\r\n', colors.yellow);
      socket.end();
      break;
    default:
      sendLine(socket, 'Invalid choice.', colors.red);
      send(socket, LOGIN_MENU);
  }
}

// Login handling
function handleLoginUsername(socket: net.Socket, conn: TelnetConnection, input: string): void {
  conn.username = input;
  conn.state = 'password';
  send(socket, 'Password: ');
}

async function handleLoginPassword(socket: net.Socket, conn: TelnetConnection, input: string): Promise<void> {
  const db = getDatabase();
  const username = conn.username!;
  const password = input;

  // Check if account exists
  const account = accountQueries.findByUsername(db).get(username) as {
    id: number;
    password_hash: string;
  } | undefined;

  if (account) {
    // Verify password
    const valid = await bcrypt.compare(password, account.password_hash);
    if (valid) {
      conn.accountId = account.id;
      sendLine(socket, '\r\nLogin successful!', colors.green);
      showCharacterSelect(socket, conn);
    } else {
      sendLine(socket, '\r\nInvalid password.', colors.red);
      conn.state = 'menu';
      send(socket, LOGIN_MENU);
    }
  } else {
    // Create new account
    if (password.length < 4) {
      sendLine(socket, '\r\nPassword must be at least 4 characters.', colors.red);
      conn.state = 'menu';
      send(socket, LOGIN_MENU);
      return;
    }

    try {
      const hash = await bcrypt.hash(password, 10);
      const email = `${username}@telnet.local`; // Placeholder email for telnet users
      const result = accountQueries.create(db).run(username, hash, email);
      conn.accountId = result.lastInsertRowid as number;
      sendLine(socket, '\r\nAccount created successfully!', colors.green);
      sendLine(socket, "Now let's create your first character...", colors.yellow);
      startCharacterCreation(socket, conn);
    } catch (error: any) {
      if (error.message.includes('UNIQUE')) {
        sendLine(socket, '\r\nThat username is already taken.', colors.red);
      } else {
        sendLine(socket, '\r\nFailed to create account.', colors.red);
      }
      conn.state = 'menu';
      send(socket, LOGIN_MENU);
    }
  }
}

// Character selection
function showCharacterSelect(socket: net.Socket, conn: TelnetConnection): void {
  const db = getDatabase();
  const characters = playerQueries.findByAccountId(db).all(conn.accountId!) as {
    id: number;
    name: string;
    level: number;
    class_id: number;
    gold: number;
  }[];

  sendLine(socket, '\r\n--- Select Character ---', colors.brightYellow);

  if (characters.length === 0) {
    sendLine(socket, 'You have no characters yet.', colors.dim);
  } else {
    characters.forEach((char, i) => {
      const classDef = playerManager.getClassDefinition(char.class_id);
      sendLine(socket, `  ${i + 1}. ${char.name} - Level ${char.level} ${classDef?.name || 'Unknown'} (${char.gold} gold)`, colors.cyan);
    });
  }

  sendLine(socket, `  ${characters.length + 1}. Create New Character`, colors.cyan);
  sendLine(socket, `  ${characters.length + 2}. Logout`, colors.cyan);
  send(socket, '\r\nSelect: ');

  conn.state = 'character_select';
}

function handleCharacterSelect(socket: net.Socket, conn: TelnetConnection, input: string): void {
  const db = getDatabase();
  const characters = playerQueries.findByAccountId(db).all(conn.accountId!) as {
    id: number;
    name: string;
  }[];

  const choice = parseInt(input);

  if (choice === characters.length + 1) {
    // Create new character
    startCharacterCreation(socket, conn);
  } else if (choice === characters.length + 2) {
    // Logout
    conn.accountId = null;
    conn.state = 'menu';
    showTitleAndMenu(socket);
  } else if (choice >= 1 && choice <= characters.length) {
    // Select character
    const char = characters[choice - 1];
    conn.playerId = char.id;
    conn.playerName = char.name;
    enterGame(socket, conn);
  } else {
    sendLine(socket, 'Invalid choice.', colors.red);
    showCharacterSelect(socket, conn);
  }
}

// Character creation
function startCharacterCreation(socket: net.Socket, conn: TelnetConnection): void {
  conn.state = 'character_create';
  conn.createState = { step: 'class' };

  sendLine(socket, '\r\n--- Create Your Character ---', colors.brightYellow);
  sendLine(socket, `${colors.dim}You are a traveler who has stumbled into Gamehenge...${colors.reset}`, colors.white);
  sendLine(socket, '\r\nWhat was your trade before arriving?\r\n', colors.white);

  const classes = [
    { id: 1, name: 'Wandering Healer', role: 'Healer/Support', desc: 'Tend the sick and wounded, earn trust through compassion' },
    { id: 2, name: 'Traveling Merchant', role: 'Trader/Diplomat', desc: 'Silver tongue and sharp eye for opportunity' },
    { id: 3, name: 'Farmhand', role: 'Laborer/Crafter', desc: 'Strong back, honest work - the Lizards will respect you' },
    { id: 4, name: 'Forest Wanderer', role: 'Scout/Forager', desc: 'Know the wild places, find what others miss' },
    { id: 5, name: 'Runaway Scholar', role: 'Lore/Knowledge', desc: 'Books and mysteries call to you - Icculus may take note' },
    { id: 6, name: 'Drifter', role: 'Versatile/Survivor', desc: 'No particular skills, but adaptable and resourceful' },
  ];

  classes.forEach((cls, i) => {
    sendLine(socket, `  ${i + 1}. ${colors.brightCyan}${cls.name}${colors.reset} - ${cls.role}`, colors.white);
    sendLine(socket, `     ${cls.desc}`, colors.dim);
  });

  send(socket, '\r\nSelect class (1-6): ');
}

function handleCharacterCreate(socket: net.Socket, conn: TelnetConnection, input: string): void {
  const state = conn.createState!;

  switch (state.step) {
    case 'class': {
      const classId = parseInt(input);
      if (classId >= 1 && classId <= 6) {
        state.classId = classId;
        state.step = 'stats';
        rollAndShowStats(socket, conn);
      } else {
        sendLine(socket, 'Invalid class. Choose 1-6.', colors.red);
        send(socket, 'Select class (1-6): ');
      }
      break;
    }

    case 'stats': {
      if (input.toLowerCase() === 'r' || input.toLowerCase() === 'reroll') {
        rollAndShowStats(socket, conn);
      } else if (input.toLowerCase() === 'k' || input.toLowerCase() === 'keep' || input.toLowerCase() === 'y') {
        state.step = 'name';
        send(socket, '\r\nChoose a name (3-20 letters): ');
      } else {
        sendLine(socket, "Type 'r' to reroll or 'k' to keep these stats.", colors.dim);
        send(socket, 'Reroll or Keep? (r/k): ');
      }
      break;
    }

    case 'name': {
      const name = input.trim();
      if (name.length < 3 || name.length > 20) {
        sendLine(socket, 'Name must be 3-20 characters.', colors.red);
        send(socket, 'Choose a name: ');
        return;
      }
      if (!/^[a-zA-Z]+$/.test(name)) {
        sendLine(socket, 'Name must contain only letters.', colors.red);
        send(socket, 'Choose a name: ');
        return;
      }

      // Create the character
      const db = getDatabase();

      // Check if name exists
      const existing = playerQueries.findByName(db).get(name);
      if (existing) {
        sendLine(socket, 'That name is already taken.', colors.red);
        send(socket, 'Choose a different name: ');
        return;
      }

      const stats = state.stats!;
      const classId = state.classId!;

      // Calculate base HP/Mana based on class and stats
      const baseHp = 20 + stats.con * 2;
      const baseMana = 10 + stats.int + stats.wis;
      const baseStamina = 50 + stats.con;

      try {
        const result = playerQueries.create(db).run(
          conn.accountId,
          name,
          classId,
          stats.str, stats.dex, stats.con, stats.int, stats.wis, stats.cha,
          baseHp, baseHp,
          baseMana, baseMana,
          baseStamina, baseStamina
        );

        conn.playerId = result.lastInsertRowid as number;
        conn.playerName = name;

        // Create equipment record
        equipmentQueries.create(db).run(conn.playerId);

        sendLine(socket, `\r\n${colors.green}Character "${name}" created successfully!${colors.reset}`);
        enterGame(socket, conn);
      } catch (error: any) {
        sendLine(socket, 'Failed to create character: ' + error.message, colors.red);
        conn.state = 'menu';
        showTitleAndMenu(socket);
      }
      break;
    }
  }
}

function rollAndShowStats(socket: net.Socket, conn: TelnetConnection): void {
  const rollStat = (): number => {
    const rolls = [1, 2, 3, 4].map(() => Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => b - a);
    return rolls[0] + rolls[1] + rolls[2];
  };

  const stats = {
    str: rollStat(),
    dex: rollStat(),
    con: rollStat(),
    int: rollStat(),
    wis: rollStat(),
    cha: rollStat(),
  };

  conn.createState!.stats = stats;
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  sendLine(socket, '\r\n--- Your Stats (4d6 drop lowest) ---', colors.brightYellow);
  sendLine(socket, `  STR: ${stats.str}  DEX: ${stats.dex}  CON: ${stats.con}`, colors.cyan);
  sendLine(socket, `  INT: ${stats.int}  WIS: ${stats.wis}  CHA: ${stats.cha}`, colors.cyan);
  sendLine(socket, `  Total: ${total}`, total >= 72 ? colors.green : colors.yellow);
  send(socket, '\r\nReroll or Keep? (r/k): ');
}

// Enter the game
function enterGame(socket: net.Socket, conn: TelnetConnection): void {
  conn.state = 'playing';
  playerSockets.set(conn.playerId!, socket);

  const db = getDatabase();
  const player = playerQueries.findById(db).get(conn.playerId!) as {
    current_room: string;
    gold: number;
    hunger: number;
    thirst: number;
  };

  // Check if this is a new character (first login - no gold, at border)
  const isNewCharacter = player.current_room === 'border_checkpoint' && player.gold === 0;

  if (isNewCharacter) {
    // New player arrival sequence - atmospheric intro
    sendLine(socket, '');
    sendLine(socket, `${colors.dim}═════════════════════════════════════════════════════════${colors.reset}`);
    sendLine(socket, '');
    sendLine(socket, `${colors.yellow}The journey has been long.${colors.reset}`);
    sendLine(socket, '');
    sendLine(socket, `${colors.dim}Days, perhaps weeks of travel have brought you here, to the`);
    sendLine(socket, `border of a land you\'ve heard whispered about in taverns and`);
    sendLine(socket, `around dying campfires. Gamehenge. A realm under the shadow`);
    sendLine(socket, `of a tyrant king named Wilson, where the Lizards live in fear`);
    sendLine(socket, `and the Helping Friendly Book has been stolen away.${colors.reset}`);
    sendLine(socket, '');
    sendLine(socket, `${colors.dim}You have nothing. Your purse is empty. Your last bread crust`);
    sendLine(socket, `is hard as stone. Your waterskin is dry. The clothes on your`);
    sendLine(socket, `back are threadbare and offer no protection.${colors.reset}`);
    sendLine(socket, '');
    sendLine(socket, `${colors.yellow}But you have arrived.${colors.reset}`);
    sendLine(socket, '');
    sendLine(socket, `${colors.dim}In Gamehenge, you must earn your place. Talk to the folk`);
    sendLine(socket, `you meet. Help them with their work. Build relationships.`);
    sendLine(socket, `In time, you may find gold, shelter, perhaps even a purpose.${colors.reset}`);
    sendLine(socket, '');
    sendLine(socket, `${colors.dim}═════════════════════════════════════════════════════════${colors.reset}`);
    sendLine(socket, '');
    sendLine(socket, `${colors.brightGreen}Welcome to Gamehenge, ${conn.playerName}.${colors.reset}`);
    sendLine(socket, `${colors.dim}Type "help" for commands. "look" to see where you are.${colors.reset}`);
    sendLine(socket, '');
  } else {
    // Returning player
    sendLine(socket, `\r\n${colors.brightGreen}Welcome back to Gamehenge, ${conn.playerName}.${colors.reset}`);

    // Show vitals status if low
    if (player.hunger < 30) {
      sendLine(socket, `${colors.yellow}Your stomach growls insistently. You need food.${colors.reset}`);
    }
    if (player.thirst < 30) {
      sendLine(socket, `${colors.yellow}Your throat is parched. You need water.${colors.reset}`);
    }
    sendLine(socket, '');
  }

  // Show room
  const roomDesc = worldManager.getRoomDescription(player.current_room, conn.playerId!);
  sendLine(socket, roomDesc);

  // Notify others
  const playersInRoom = worldManager.getPlayersInRoom(player.current_room);
  for (const otherId of playersInRoom) {
    if (otherId !== conn.playerId) {
      sendToPlayer(otherId, `\r\n${conn.playerName} has entered the world.`);
    }
  }

  sendPrompt(socket);

  console.log(`[FROBARK] ${conn.playerName} entered Gamehenge from ${socket.remoteAddress}`);
}

// Handle game commands
function handleGameCommand(socket: net.Socket, conn: TelnetConnection, input: string): void {
  const trimmed = input.trim();
  if (!trimmed) {
    sendPrompt(socket);
    return;
  }

  // Handle quit/logout
  if (trimmed.toLowerCase() === 'quit' || trimmed.toLowerCase() === 'logout') {
    handleLogout(socket, conn);
    return;
  }

  // Process the command through the game engine
  // We need to intercept the output
  processCommandWithOutput(conn.playerId!, trimmed, (text, messageType) => {
    let color = colors.reset;
    switch (messageType) {
      case 'system': color = colors.yellow; break;
      case 'combat': color = colors.red; break;
      case 'chat': color = colors.cyan; break;
      case 'error': color = colors.brightRed; break;
    }
    sendLine(socket, text, color);
  });

  sendPrompt(socket);
}

// Wrapper to capture command output
function processCommandWithOutput(
  playerId: number,
  command: string,
  outputHandler: (text: string, messageType?: string) => void
): void {
  // Temporarily override the connection manager's sendToPlayer
  const originalSend = require('./managers/connectionManager').connectionManager.sendToPlayer;

  require('./managers/connectionManager').connectionManager.sendToPlayer = (
    targetId: number,
    message: any
  ) => {
    if (targetId === playerId && message.type === 'output') {
      outputHandler(message.text, message.messageType);
    } else {
      // For messages to other players, use the telnet system
      const socket = playerSockets.get(targetId);
      if (socket) {
        sendLine(socket, message.text || message.message);
        const conn = connections.get(socket);
        if (conn?.state === 'playing') {
          sendPrompt(socket);
        }
      }
    }
  };

  try {
    processCommand(playerId, command);
  } finally {
    // Restore original
    require('./managers/connectionManager').connectionManager.sendToPlayer = originalSend;
  }
}

// Handle logout
function handleLogout(socket: net.Socket, conn: TelnetConnection): void {
  if (conn.playerId) {
    const db = getDatabase();
    const player = playerQueries.findById(db).get(conn.playerId) as { current_room: string };

    // Notify others
    if (player) {
      const playersInRoom = worldManager.getPlayersInRoom(player.current_room);
      for (const otherId of playersInRoom) {
        if (otherId !== conn.playerId) {
          sendToPlayer(otherId, `\r\n${conn.playerName} has left the world.`);
        }
      }
    }

    playerSockets.delete(conn.playerId);
    console.log(`[FROBARK] ${conn.playerName} left Gamehenge`);
  }

  conn.playerId = null;
  conn.playerName = null;

  sendLine(socket, '\r\nYou have been logged out.', colors.yellow);
  showCharacterSelect(socket, conn);
}

// Handle disconnect
function handleDisconnect(socket: net.Socket): void {
  const conn = connections.get(socket);
  if (!conn) return;

  if (conn.playerId) {
    const db = getDatabase();
    const player = playerQueries.findById(db).get(conn.playerId) as { current_room: string } | undefined;

    if (player) {
      // Notify others in room
      const playersInRoom = worldManager.getPlayersInRoom(player.current_room);
      for (const otherId of playersInRoom) {
        if (otherId !== conn.playerId) {
          sendToPlayer(otherId, `\r\n${conn.playerName} has disconnected.`);
        }
      }
    }

    playerSockets.delete(conn.playerId);
    console.log(`[FROBARK] ${conn.playerName} disconnected`);
  }

  connections.delete(socket);
  console.log(`Connection closed from ${socket.remoteAddress}`);
}

// Idle timeout check
function checkIdleConnections(): void {
  const now = Date.now();
  const idleTimeout = 30 * 60 * 1000; // 30 minutes

  for (const [socket, conn] of connections) {
    if (now - conn.lastActivity > idleTimeout) {
      sendLine(socket, '\r\nYou have been disconnected due to inactivity.', colors.yellow);
      socket.end();
    }
  }
}

// Main startup
async function main(): Promise<void> {
  console.log('Initializing FROBARK - Gamehenge MUD Server...');

  // Initialize database
  initializeDatabase();

  // Initialize world
  worldManager.initialize();

  // Initialize NPCs
  npcManager.initializeWorldNpcs();

  // Start game loop
  gameLoop.start();

  // Idle check every minute
  setInterval(checkIdleConnections, 60000);

  // Create telnet server
  const server = net.createServer(handleConnection);

  server.listen(TELNET_PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║     ███████╗██████╗  ██████╗ ██████╗  █████╗ ██████╗ ██╗  ██╗     ║
║     ██╔════╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝     ║
║     █████╗  ██████╔╝██║   ██║██████╔╝███████║██████╔╝█████╔╝      ║
║     ██╔══╝  ██╔══██╗██║   ██║██╔══██╗██╔══██║██╔══██╗██╔═██╗      ║
║     ██║     ██║  ██║╚██████╔╝██████╔╝██║  ██║██║  ██║██║  ██╗     ║
║     ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝     ║
║                                                                   ║
║              GAMEHENGE - A Living World Awaits                    ║
║                                                                   ║
║   Connect: telnet frobark.com ${TELNET_PORT}                                  ║
║   Port: ${TELNET_PORT}                                                        ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    broadcast('\r\n\r\nServer is shutting down. Goodbye!\r\n');
    gameLoop.stop();
    server.close();
    process.exit(0);
  });
}

function getPublicIP(): string {
  // Placeholder - in production you'd detect the actual public IP
  return 'yourserver.com';
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
