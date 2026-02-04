// Player Movement Tracker for FROBARK MUD
// Tracks where players went for the "where" command

interface PlayerLastSeen {
  roomId: string;
  direction?: string;
  timestamp: number;
}

// Track where players went for the "where" command
// Maps player name (lowercase) -> { room, direction, timestamp }
const playerLastSeen: Map<string, PlayerLastSeen> = new Map();

// Get player last seen info (for "where" command)
export function getPlayerLastSeen(playerName: string): PlayerLastSeen | undefined {
  return playerLastSeen.get(playerName.toLowerCase());
}

// Update player last seen when they move
export function updatePlayerLastSeen(playerName: string, roomId: string, direction?: string): void {
  playerLastSeen.set(playerName.toLowerCase(), { roomId, direction, timestamp: Date.now() });
}
