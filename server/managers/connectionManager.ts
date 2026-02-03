// Connection Manager for Llama Picchu MUD
import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import type { ClientMessage, ServerMessage } from '../../shared/types/websocket';
import type { Player } from '../../shared/types/player';

const JWT_SECRET = process.env.JWT_SECRET || 'llama-picchu-secret-key-change-in-production';

export interface Connection {
  ws: WebSocket;
  accountId: number | null;
  playerId: number | null;
  playerName: string | null;
  authenticated: boolean;
  lastPing: number;
  ip: string;
}

class ConnectionManager {
  private connections: Map<WebSocket, Connection> = new Map();
  private playerConnections: Map<number, WebSocket> = new Map();
  private wss: WebSocketServer | null = null;

  initialize(wss: WebSocketServer): void {
    this.wss = wss;

    wss.on('connection', (ws: WebSocket, req) => {
      const ip = req.socket.remoteAddress || 'unknown';
      console.log(`New connection from ${ip}`);

      const connection: Connection = {
        ws,
        accountId: null,
        playerId: null,
        playerName: null,
        authenticated: false,
        lastPing: Date.now(),
        ip,
      };

      this.connections.set(ws, connection);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as ClientMessage;
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Invalid message format:', error);
          this.sendToConnection(ws, {
            type: 'error',
            message: 'Invalid message format',
          });
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnect(ws);
      });

      // Send initial connection acknowledgment
      this.sendToConnection(ws, {
        type: 'system',
        message: 'Connected to Llama Picchu MUD. Please authenticate.',
      });
    });
  }

  private handleMessage(ws: WebSocket, message: ClientMessage): void {
    const connection = this.connections.get(ws);
    if (!connection) return;

    switch (message.type) {
      case 'auth':
        this.handleAuth(ws, connection, message.token);
        break;

      case 'command':
        if (!connection.authenticated || !connection.playerId) {
          this.sendToConnection(ws, {
            type: 'error',
            message: 'You must authenticate first.',
          });
          return;
        }
        // Commands are handled by the game engine
        this.emit('command', {
          playerId: connection.playerId,
          command: message.command,
        });
        break;

      case 'ping':
        connection.lastPing = Date.now();
        this.sendToConnection(ws, { type: 'pong' });
        break;
    }
  }

  private handleAuth(ws: WebSocket, connection: Connection, token: string): void {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        accountId: number;
        playerId: number;
        playerName: string;
      };

      // Check if player is already connected
      const existingWs = this.playerConnections.get(decoded.playerId);
      if (existingWs && existingWs !== ws) {
        // Disconnect the old connection
        this.sendToConnection(existingWs, {
          type: 'system',
          message: 'You have been disconnected because you logged in from another location.',
        });
        existingWs.close();
      }

      connection.accountId = decoded.accountId;
      connection.playerId = decoded.playerId;
      connection.playerName = decoded.playerName;
      connection.authenticated = true;

      this.playerConnections.set(decoded.playerId, ws);

      this.sendToConnection(ws, {
        type: 'auth_success',
        playerId: decoded.playerId,
        playerName: decoded.playerName,
      });

      // Emit player connected event
      this.emit('player_connected', {
        playerId: decoded.playerId,
        playerName: decoded.playerName,
      });

      console.log(`Player ${decoded.playerName} authenticated`);
    } catch (error) {
      this.sendToConnection(ws, {
        type: 'auth_failure',
        reason: 'Invalid or expired token',
      });
    }
  }

  private handleDisconnect(ws: WebSocket): void {
    const connection = this.connections.get(ws);
    if (!connection) return;

    if (connection.playerId) {
      this.playerConnections.delete(connection.playerId);
      this.emit('player_disconnected', {
        playerId: connection.playerId,
        playerName: connection.playerName,
      });
      console.log(`Player ${connection.playerName} disconnected`);
    }

    this.connections.delete(ws);
  }

  // Send message to a specific connection
  sendToConnection(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Send message to a specific player by ID
  sendToPlayer(playerId: number, message: ServerMessage): void {
    const ws = this.playerConnections.get(playerId);
    if (ws) {
      this.sendToConnection(ws, message);
    }
  }

  // Send message to all players in a room
  sendToRoom(roomId: string, message: ServerMessage, playerIds: number[]): void {
    for (const playerId of playerIds) {
      this.sendToPlayer(playerId, message);
    }
  }

  // Send message to all players except one
  sendToRoomExcept(
    roomId: string,
    message: ServerMessage,
    playerIds: number[],
    exceptPlayerId: number
  ): void {
    for (const playerId of playerIds) {
      if (playerId !== exceptPlayerId) {
        this.sendToPlayer(playerId, message);
      }
    }
  }

  // Broadcast to all authenticated players
  broadcast(message: ServerMessage): void {
    for (const [ws, connection] of this.connections) {
      if (connection.authenticated) {
        this.sendToConnection(ws, message);
      }
    }
  }

  // Broadcast to all except one player
  broadcastExcept(message: ServerMessage, exceptPlayerId: number): void {
    for (const [ws, connection] of this.connections) {
      if (connection.authenticated && connection.playerId !== exceptPlayerId) {
        this.sendToConnection(ws, message);
      }
    }
  }

  // Get connection by player ID
  getConnectionByPlayerId(playerId: number): Connection | undefined {
    const ws = this.playerConnections.get(playerId);
    return ws ? this.connections.get(ws) : undefined;
  }

  // Get all connected player IDs
  getConnectedPlayerIds(): number[] {
    return Array.from(this.playerConnections.keys());
  }

  // Check if player is connected
  isPlayerConnected(playerId: number): boolean {
    return this.playerConnections.has(playerId);
  }

  // Get player count
  getPlayerCount(): number {
    return this.playerConnections.size;
  }

  // Event emitter functionality
  private eventHandlers: Map<string, ((data: unknown) => void)[]> = new Map();

  on(event: string, handler: (data: unknown) => void): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  off(event: string, handler: (data: unknown) => void): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }

  // Cleanup stale connections
  cleanup(): void {
    const now = Date.now();
    const timeout = 60000; // 1 minute

    for (const [ws, connection] of this.connections) {
      if (now - connection.lastPing > timeout) {
        console.log(`Closing stale connection for ${connection.playerName || 'unauthenticated'}`);
        ws.close();
      }
    }
  }

  // Generate JWT token for player
  static generateToken(accountId: number, playerId: number, playerName: string): string {
    return jwt.sign(
      { accountId, playerId, playerName },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  // Verify JWT token
  static verifyToken(token: string): { accountId: number; playerId: number; playerName: string } | null {
    try {
      return jwt.verify(token, JWT_SECRET) as {
        accountId: number;
        playerId: number;
        playerName: string;
      };
    } catch {
      return null;
    }
  }
}

export const connectionManager = new ConnectionManager();
export default connectionManager;
