// Movement Commands for FROBARK MUD
import { connectionManager } from '../managers/connectionManager';
import { worldManager } from '../managers/worldManager';
import { questManager } from '../managers/questManager';
import { npcLifeManager } from '../managers/npcLifeManager';
import type { CommandContext } from './index';
import type { Direction } from '../../shared/types/room';

export function processMovementCommand(ctx: CommandContext, direction: Direction): void {
  const result = worldManager.movePlayer(ctx.playerId, direction);

  if (!result.success) {
    connectionManager.sendToPlayer(ctx.playerId, {
      type: 'output',
      text: result.message,
      messageType: 'normal',
    });
    return;
  }

  // Update quest progress for exploration
  if (result.newRoomId) {
    questManager.updateProgress(ctx.playerId, 'explore', result.newRoomId, 1);

    // Activate NPCs in the room - this triggers the "catch up" mechanic
    // where NPCs simulate time passing since the last player visited
    npcLifeManager.onPlayerEntersRoom(ctx.playerId, result.newRoomId);
  }

  // Send new room description
  const roomDesc = worldManager.getRoomDescription(result.newRoomId!, ctx.playerId);
  connectionManager.sendToPlayer(ctx.playerId, {
    type: 'output',
    text: roomDesc,
    messageType: 'normal',
  });

  // Update room state
  const roomState = worldManager.getRoomState(result.newRoomId!);
  if (roomState) {
    connectionManager.sendToPlayer(ctx.playerId, {
      type: 'room_update',
      room: roomState,
    });
  }
}
