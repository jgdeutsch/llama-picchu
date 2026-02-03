#!/usr/bin/env npx tsx
// Terminal Client for Llama Picchu MUD
// Run with: npx tsx scripts/terminal-client.ts

import * as readline from 'readline';
import WebSocket from 'ws';

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:3000/ws';
const API_URL = process.env.API_URL || 'http://localhost:3000';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Bright foreground
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Background
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

interface GameState {
  authenticated: boolean;
  playerName: string | null;
  gameToken: string | null;
  accountId: number | null;
}

const state: GameState = {
  authenticated: false,
  playerName: null,
  gameToken: null,
  accountId: null,
};

let ws: WebSocket | null = null;
let rl: readline.Interface;

function print(text: string, color: string = colors.reset): void {
  console.log(color + text + colors.reset);
}

function printTitle(): void {
  console.clear();
  print(`
${colors.yellow}${colors.bold}
    ██╗     ██╗      █████╗ ███╗   ███╗ █████╗
    ██║     ██║     ██╔══██╗████╗ ████║██╔══██╗
    ██║     ██║     ███████║██╔████╔██║███████║
    ██║     ██║     ██╔══██║██║╚██╔╝██║██╔══██║
    ███████╗███████╗██║  ██║██║ ╚═╝ ██║██║  ██║
    ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝
${colors.reset}
${colors.brightYellow}    ╔═══════════════════════════════════════╗
    ║        PICCHU MUD                     ║
    ║   Multi-User Dungeon Adventure        ║
    ╚═══════════════════════════════════════╝${colors.reset}
`);
}

function printMenu(): void {
  print('\n  1. Login', colors.brightCyan);
  print('  2. Create Account', colors.brightCyan);
  print('  3. Quit\n', colors.brightCyan);
}

async function apiCall(endpoint: string, method: string = 'GET', body?: object): Promise<any> {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  return response.json();
}

async function prompt(question: string, hidden: boolean = false): Promise<string> {
  return new Promise((resolve) => {
    if (hidden) {
      // For password input
      process.stdout.write(question);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      stdin.setRawMode(true);
      stdin.resume();

      let password = '';
      const onData = (char: Buffer) => {
        const c = char.toString();
        if (c === '\n' || c === '\r') {
          stdin.removeListener('data', onData);
          stdin.setRawMode(wasRaw);
          console.log();
          resolve(password);
        } else if (c === '\u0003') {
          // Ctrl+C
          process.exit();
        } else if (c === '\u007F') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          password += c;
          process.stdout.write('*');
        }
      };
      stdin.on('data', onData);
    } else {
      rl.question(question, resolve);
    }
  });
}

async function login(): Promise<boolean> {
  print('\n--- Login ---', colors.brightYellow);

  const username = await prompt('Username: ');
  const password = await prompt('Password: ', true);

  print('\nLogging in...', colors.dim);

  try {
    const result = await apiCall('/api/auth/login', 'POST', { username, password });

    if (result.success) {
      state.accountId = result.accountId;
      print('Login successful!', colors.green);

      if (result.characters && result.characters.length > 0) {
        return await selectCharacter(result.characters);
      } else {
        print('You have no characters. Let\'s create one!', colors.yellow);
        return await createCharacter();
      }
    } else {
      print(`Login failed: ${result.error || 'Invalid credentials'}`, colors.red);
      return false;
    }
  } catch (error) {
    print(`Connection error: ${error}`, colors.red);
    return false;
  }
}

async function register(): Promise<boolean> {
  print('\n--- Create Account ---', colors.brightYellow);

  const username = await prompt('Choose a username: ');
  const email = await prompt('Email address: ');
  const password = await prompt('Choose a password: ', true);
  const confirm = await prompt('Confirm password: ', true);

  if (password !== confirm) {
    print('Passwords do not match!', colors.red);
    return false;
  }

  print('\nCreating account...', colors.dim);

  try {
    const result = await apiCall('/api/auth/register', 'POST', { username, password, email });

    if (result.success) {
      state.accountId = result.accountId;
      print('Account created successfully!', colors.green);
      print('Now let\'s create your first character...', colors.yellow);
      return await createCharacter();
    } else {
      print(`Registration failed: ${result.error || 'Unknown error'}`, colors.red);
      return false;
    }
  } catch (error) {
    print(`Connection error: ${error}`, colors.red);
    return false;
  }
}

async function selectCharacter(characters: any[]): Promise<boolean> {
  print('\n--- Select Character ---', colors.brightYellow);

  characters.forEach((char, i) => {
    print(`  ${i + 1}. ${char.name} - Level ${char.level} ${char.className} (${char.gold} gold)`, colors.brightCyan);
  });
  print(`  ${characters.length + 1}. Create New Character`, colors.brightCyan);

  const choice = await prompt('\nSelect character: ');
  const index = parseInt(choice) - 1;

  if (index === characters.length) {
    return await createCharacter();
  }

  if (index < 0 || index >= characters.length) {
    print('Invalid selection', colors.red);
    return await selectCharacter(characters);
  }

  const char = characters[index];

  // Login with selected character
  const result = await apiCall('/api/auth/login', 'POST', {
    username: '', // We already have accountId
    password: '',
    playerId: char.id,
  });

  if (result.gameToken) {
    state.gameToken = result.gameToken;
    state.playerName = char.name;
    return true;
  }

  print('Failed to select character', colors.red);
  return false;
}

async function createCharacter(): Promise<boolean> {
  print('\n--- Create Character ---', colors.brightYellow);

  // Get classes
  const classData = await apiCall('/api/character/create');
  const classes = classData.classes;

  print('\nChoose your class:', colors.brightYellow);
  classes.forEach((cls: any, i: number) => {
    print(`  ${i + 1}. ${cls.name} - ${cls.role}`, colors.brightCyan);
    print(`     ${cls.description}`, colors.dim);
  });

  const classChoice = await prompt('\nSelect class (1-6): ');
  const classIndex = parseInt(classChoice) - 1;

  if (classIndex < 0 || classIndex >= classes.length) {
    print('Invalid class selection', colors.red);
    return await createCharacter();
  }

  const selectedClass = classes[classIndex];

  // Roll stats
  print('\n--- Rolling Stats (4d6 drop lowest) ---', colors.brightYellow);

  const rollStat = (): number => {
    const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => b - a);
    return rolls[0] + rolls[1] + rolls[2];
  };

  let stats = {
    str: rollStat(),
    dex: rollStat(),
    con: rollStat(),
    int: rollStat(),
    wis: rollStat(),
    cha: rollStat(),
  };

  const showStats = () => {
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    print(`\n  STR: ${stats.str}  DEX: ${stats.dex}  CON: ${stats.con}`, colors.brightCyan);
    print(`  INT: ${stats.int}  WIS: ${stats.wis}  CHA: ${stats.cha}`, colors.brightCyan);
    print(`  Total: ${total}`, total >= 72 ? colors.green : colors.yellow);
    print(`\n  Primary: ${selectedClass.primaryStat.toUpperCase()}  Secondary: ${selectedClass.secondaryStat.toUpperCase()}`, colors.dim);
  };

  showStats();

  let reroll = await prompt('\nKeep these stats? (y/n): ');
  while (reroll.toLowerCase() === 'n') {
    stats = {
      str: rollStat(),
      dex: rollStat(),
      con: rollStat(),
      int: rollStat(),
      wis: rollStat(),
      cha: rollStat(),
    };
    showStats();
    reroll = await prompt('\nKeep these stats? (y/n): ');
  }

  // Choose name
  const name = await prompt('\nChoose a name (3-20 letters): ');

  if (name.length < 3 || name.length > 20 || !/^[a-zA-Z]+$/.test(name)) {
    print('Invalid name. Must be 3-20 letters only.', colors.red);
    return await createCharacter();
  }

  print('\nCreating character...', colors.dim);

  try {
    const result = await apiCall('/api/character/create', 'POST', {
      accountId: state.accountId,
      name,
      classId: selectedClass.id,
      stats,
    });

    if (result.success) {
      state.gameToken = result.gameToken;
      state.playerName = result.playerName;
      print(`\nCharacter "${result.playerName}" created successfully!`, colors.green);
      return true;
    } else {
      print(`Failed to create character: ${result.error}`, colors.red);
      return false;
    }
  } catch (error) {
    print(`Connection error: ${error}`, colors.red);
    return false;
  }
}

function connectWebSocket(): void {
  print('\nConnecting to server...', colors.dim);

  ws = new WebSocket(SERVER_URL);

  ws.on('open', () => {
    print('Connected!', colors.green);
    // Authenticate
    ws!.send(JSON.stringify({ type: 'auth', token: state.gameToken }));
  });

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      handleServerMessage(message);
    } catch (error) {
      print(`Invalid message: ${data}`, colors.red);
    }
  });

  ws.on('close', () => {
    print('\nDisconnected from server.', colors.yellow);
    state.authenticated = false;
    ws = null;

    // Try to reconnect
    setTimeout(() => {
      if (state.gameToken) {
        print('Reconnecting...', colors.dim);
        connectWebSocket();
      }
    }, 3000);
  });

  ws.on('error', (error) => {
    print(`Connection error: ${error.message}`, colors.red);
  });
}

function handleServerMessage(message: any): void {
  switch (message.type) {
    case 'auth_success':
      state.authenticated = true;
      print(`\nWelcome, ${message.playerName}!\n`, colors.brightGreen);
      startGameLoop();
      break;

    case 'auth_failure':
      print(`Authentication failed: ${message.reason}`, colors.red);
      process.exit(1);
      break;

    case 'output':
      printGameOutput(message.text, message.messageType);
      break;

    case 'system':
      print(message.message, colors.yellow);
      break;

    case 'error':
      print(message.message, colors.red);
      break;

    case 'player_update':
      // Could show a status line here
      break;

    case 'player_entered':
      print(`${message.playerName} has arrived.`, colors.cyan);
      break;

    case 'player_left':
      print(`${message.playerName} has left.`, colors.cyan);
      break;

    case 'combat_update':
      print(`[COMBAT] ${message.message}`, colors.red);
      break;

    case 'pong':
      // Heartbeat response
      break;

    default:
      // Unknown message type
      break;
  }
}

function printGameOutput(text: string, messageType?: string): void {
  let color = colors.reset;

  switch (messageType) {
    case 'system':
      color = colors.yellow;
      break;
    case 'combat':
      color = colors.red;
      break;
    case 'chat':
      color = colors.cyan;
      break;
    case 'whisper':
      color = colors.magenta;
      break;
    case 'emote':
      color = colors.brightYellow;
      break;
    case 'error':
      color = colors.brightRed;
      break;
    default:
      // Apply MUD-style coloring
      text = colorizeText(text);
      console.log(text);
      return;
  }

  print(text, color);
}

function colorizeText(text: string): string {
  // Add colors to common MUD elements
  return text
    // Room titles (lines in all caps or with special formatting)
    .replace(/^([A-Z][A-Za-z\s]+)$/gm, colors.brightYellow + '$1' + colors.reset)
    // Exits
    .replace(/\[Exits: ([^\]]+)\]/g, colors.cyan + '[Exits: $1]' + colors.reset)
    // Gold
    .replace(/(\d+)\s*gold/gi, colors.yellow + '$1 gold' + colors.reset)
    // HP/Mana/Stamina numbers
    .replace(/HP:\s*(\d+)\/(\d+)/g, colors.red + 'HP: $1/$2' + colors.reset)
    .replace(/Mana:\s*(\d+)\/(\d+)/g, colors.blue + 'Mana: $1/$2' + colors.reset)
    // NPCs (names followed by descriptions)
    .replace(/^(\s*\*\s*.+)$/gm, colors.green + '$1' + colors.reset)
    // Items on ground
    .replace(/^(\s*-\s*.+)$/gm, colors.brightCyan + '$1' + colors.reset);
}

function startGameLoop(): void {
  rl.on('line', (input) => {
    const trimmed = input.trim();

    if (!trimmed) {
      process.stdout.write('> ');
      return;
    }

    // Local commands
    if (trimmed.toLowerCase() === 'quit' || trimmed.toLowerCase() === 'exit') {
      print('\nGoodbye!', colors.yellow);
      ws?.close();
      process.exit(0);
    }

    if (trimmed.toLowerCase() === 'clear' || trimmed.toLowerCase() === 'cls') {
      console.clear();
      process.stdout.write('> ');
      return;
    }

    // Send to server
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'command', command: trimmed }));
    } else {
      print('Not connected to server.', colors.red);
    }

    process.stdout.write('> ');
  });

  // Heartbeat
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);

  process.stdout.write('> ');
}

async function main(): Promise<void> {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  printTitle();

  // Main menu loop
  while (!state.gameToken) {
    printMenu();
    const choice = await prompt('Select option: ');

    switch (choice) {
      case '1':
        if (await login()) {
          break;
        }
        continue;

      case '2':
        if (await register()) {
          break;
        }
        continue;

      case '3':
        print('\nGoodbye!', colors.yellow);
        process.exit(0);

      default:
        print('Invalid option', colors.red);
        continue;
    }

    if (state.gameToken) {
      break;
    }
  }

  // Connect to game
  connectWebSocket();
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  print('\n\nGoodbye!', colors.yellow);
  ws?.close();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
