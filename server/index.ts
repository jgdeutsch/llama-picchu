// Main Server Entry for Llama Picchu MUD
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { initializeDatabase, getDatabase } from './database';
import { connectionManager } from './managers/connectionManager';
import { worldManager } from './managers/worldManager';
import { npcManager } from './managers/npcManager';
import { gameLoop } from './gameLoop';
import { processCommand } from './commands';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  try {
    // Prepare Next.js
    await app.prepare();

    // Initialize database
    console.log('Initializing database...');
    initializeDatabase();

    // Initialize world
    console.log('Initializing world...');
    worldManager.initialize();

    // Initialize NPCs
    console.log('Spawning NPCs...');
    npcManager.initializeWorldNpcs();

    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    // Create WebSocket server - use noServer mode for proper upgrade handling
    const wss = new WebSocketServer({ noServer: true });

    // Handle WebSocket upgrade requests
    server.on('upgrade', (request, socket, head) => {
      const { pathname } = parse(request.url || '', true);

      if (pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    // Initialize connection manager with WebSocket server
    connectionManager.initialize(wss);

    // Set up event handlers
    connectionManager.on('command', (data: unknown) => {
      const { playerId, command } = data as { playerId: number; command: string };
      processCommand(playerId, command);
    });

    connectionManager.on('player_connected', (data: unknown) => {
      const { playerId, playerName } = data as { playerId: number; playerName: string };
      console.log(`Player connected: ${playerName} (ID: ${playerId})`);

      // Send initial room description
      const db = getDatabase();
      const player = db.prepare('SELECT current_room FROM players WHERE id = ?').get(playerId) as {
        current_room: string;
      };

      if (player) {
        const roomDesc = worldManager.getRoomDescription(player.current_room, playerId);
        connectionManager.sendToPlayer(playerId, {
          type: 'output',
          text: `\nWelcome to Llama Picchu MUD!\n${roomDesc}`,
          messageType: 'normal',
        });

        // Notify others in room
        const playersInRoom = worldManager.getPlayersInRoom(player.current_room);
        for (const otherId of playersInRoom) {
          if (otherId !== playerId) {
            connectionManager.sendToPlayer(otherId, {
              type: 'player_entered',
              playerName,
            });
          }
        }
      }
    });

    connectionManager.on('player_disconnected', (data: unknown) => {
      const { playerId, playerName } = data as { playerId: number; playerName: string | null };
      console.log(`Player disconnected: ${playerName || 'Unknown'} (ID: ${playerId})`);

      // Notify others in room
      const db = getDatabase();
      const player = db.prepare('SELECT current_room FROM players WHERE id = ?').get(playerId) as {
        current_room: string;
      } | undefined;

      if (player && playerName) {
        const playersInRoom = worldManager.getPlayersInRoom(player.current_room);
        for (const otherId of playersInRoom) {
          if (otherId !== playerId) {
            connectionManager.sendToPlayer(otherId, {
              type: 'player_left',
              playerName,
            });
          }
        }
      }
    });

    // Start game loop
    console.log('Starting game loop...');
    gameLoop.start();

    // Start server
    server.listen(port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║       🦙 LLAMA PICCHU MUD SERVER STARTED 🦙                   ║
║                                                               ║
║   HTTP Server: http://${hostname}:${port}                          ║
║   WebSocket:   ws://${hostname}:${port}/ws                         ║
║                                                               ║
║   ${dev ? 'Development Mode' : 'Production Mode'}                                         ║
║   Rooms: ${worldManager.getRoomCount()}                                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('\nShutting down...');
      gameLoop.stop();
      wss.close();
      server.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
