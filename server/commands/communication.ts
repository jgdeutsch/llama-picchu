// Communication Commands for FROBARK MUD
import { connectionManager } from '../managers/connectionManager';
import { worldManager } from '../managers/worldManager';
import { playerManager } from '../managers/playerManager';
import { npcManager } from '../managers/npcManager';
import { getDatabase, playerQueries, roomNpcQueries } from '../database';
import { generateNpcSpeechReaction, addNpcMemory } from '../services/geminiService';
import { npcTemplates, getNpcPersonalityPrompt } from '../data/npcs';
import type { CommandContext } from './index';

export function processCommunicationCommand(ctx: CommandContext, action: string): void {
  switch (action) {
    case 'say':
      processSay(ctx);
      break;
    case 'shout':
      processShout(ctx);
      break;
    case 'gossip':
      processGossip(ctx);
      break;
    case 'tell':
      processTell(ctx);
      break;
    case 'who':
      processWho(ctx);
      break;
  }
}

function sendOutput(playerId: number, text: string, type: 'normal' | 'chat' = 'normal'): void {
  connectionManager.sendToPlayer(playerId, {
    type: 'output',
    text,
    messageType: type === 'chat' ? 'chat' : 'normal',
  });
}

function processSay(ctx: CommandContext): void {
  const message = ctx.args.join(' ');

  // Send to speaker
  sendOutput(ctx.playerId, `You say, "${message}"`, 'chat');

  // Send to others in room
  const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
  for (const otherId of playersInRoom) {
    if (otherId !== ctx.playerId) {
      connectionManager.sendToPlayer(otherId, {
        type: 'chat',
        channel: 'say',
        from: ctx.playerName,
        message,
      });
    }
  }

  // NPCs in the room may react to what was said
  triggerNpcSpeechReactions(ctx, message);
}

// NPCs react to player speech - makes the world feel alive
async function triggerNpcSpeechReactions(ctx: CommandContext, message: string): Promise<void> {
  const db = getDatabase();

  // Get NPCs in this room
  const npcsInRoom = roomNpcQueries.getByRoom(db).all(ctx.roomId) as {
    id: number;
    npcTemplateId: number;
  }[];

  // Filter to friendly NPCs only
  const friendlyNpcs = npcsInRoom.filter(npc => {
    const template = npcTemplates.find(t => t.id === npc.npcTemplateId);
    return template && template.type !== 'enemy';
  });

  if (friendlyNpcs.length === 0) return;

  // Pick one random NPC to react (avoid spamming with all NPCs responding)
  const npc = friendlyNpcs[Math.floor(Math.random() * friendlyNpcs.length)];
  const template = npcTemplates.find(t => t.id === npc.npcTemplateId);
  if (!template) return;

  // Get NPC's relationship with player
  const relationship = db.prepare(`
    SELECT trust_level FROM social_capital
    WHERE player_id = ? AND npc_id = ?
  `).get(ctx.playerId, npc.npcTemplateId) as { trust_level: string } | undefined;

  const trustLevel = relationship?.trust_level || 'stranger';
  const personality = getNpcPersonalityPrompt(npc.npcTemplateId);

  // Get NPC's current task
  const npcState = db.prepare(`
    SELECT current_task FROM npc_state
    WHERE npc_template_id = ?
  `).get(npc.npcTemplateId) as { current_task: string | null } | undefined;

  console.log(`[NPC Speech] Generating reaction from ${template.name} (id: ${npc.npcTemplateId}) to "${message}"`);
  console.log(`[NPC Speech] Context: trustLevel=${trustLevel}, task=${npcState?.current_task || 'none'}`);

  try {
    const reaction = await generateNpcSpeechReaction(
      npc.npcTemplateId,
      template.name,
      personality,
      npcState?.current_task || null,
      ctx.playerId,
      ctx.playerName,
      message,
      trustLevel
    );
    console.log(`[NPC Speech] Gemini returned:`, JSON.stringify(reaction));

    // Record this interaction in NPC memory regardless of reaction
    addNpcMemory(
      npc.npcTemplateId,
      ctx.playerId,
      'interaction',
      `${ctx.playerName} said: "${message.substring(0, 80)}"`,
      3, // Medium importance
      0  // Neutral valence by default
    );

    // Check if we got a meaningful reaction
    const hasReaction = reaction && (reaction.emote || reaction.response);
    console.log(`[NPC Speech] ${template.name} reaction:`, JSON.stringify(reaction), `hasReaction: ${hasReaction}`);

    if (hasReaction) {
      // Send emote if present
      if (reaction.emote) {
        console.log(`[NPC Speech] Sending emote: "${template.name} ${reaction.emote}"`);
        sendOutput(ctx.playerId, `\n${template.name} ${reaction.emote}`);
      }

      // Send response if present
      if (reaction.response) {
        // Small delay if there was an emote
        if (reaction.emote) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        console.log(`[NPC Speech] Sending response: "${template.name} says, ${reaction.response}"`);
        sendOutput(ctx.playerId, `${template.name} says, "${reaction.response}"`);
      }
    } else {
      // Fallback: NPC always does something minimal
      const fallbackEmotes = [
        'glances up briefly.',
        'looks over.',
        'pauses for a moment.',
        'tilts their head slightly.',
        'acknowledges you with a nod.',
      ];
      const fallback = fallbackEmotes[Math.floor(Math.random() * fallbackEmotes.length)];
      console.log(`[NPC Speech] Using fallback: "${template.name} ${fallback}"`);
      sendOutput(ctx.playerId, `\n${template.name} ${fallback}`);
    }
  } catch (error) {
    // Fallback on error - NPC still reacts
    console.error(`[NPC Speech] Error for ${template.name}:`, error);
    console.log(`[NPC Speech] Error fallback: "${template.name} looks up at you."`);
    sendOutput(ctx.playerId, `\n${template.name} looks up at you.`);
  }
}

function processShout(ctx: CommandContext): void {
  const message = ctx.args.join(' ');

  // Send to shouter
  sendOutput(ctx.playerId, `You shout, "${message}"`, 'chat');

  // Get current room's area
  const currentRoom = worldManager.getRoom(ctx.roomId);
  if (!currentRoom) return;

  // Send to all players in same area
  const allRoomIds = worldManager.getAllRoomIds();
  for (const roomId of allRoomIds) {
    const room = worldManager.getRoom(roomId);
    if (room && room.area === currentRoom.area) {
      const playersInRoom = worldManager.getPlayersInRoom(roomId);
      for (const otherId of playersInRoom) {
        if (otherId !== ctx.playerId) {
          connectionManager.sendToPlayer(otherId, {
            type: 'chat',
            channel: 'shout',
            from: ctx.playerName,
            message,
          });
        }
      }
    }
  }
}

function processGossip(ctx: CommandContext): void {
  const message = ctx.args.join(' ');

  // Send to speaker
  sendOutput(ctx.playerId, `[Gossip] You: ${message}`, 'chat');

  // Broadcast to all other connected players
  connectionManager.broadcastExcept(
    {
      type: 'chat',
      channel: 'gossip',
      from: ctx.playerName,
      message,
    },
    ctx.playerId
  );
}

function processTell(ctx: CommandContext): void {
  const targetName = ctx.args[0];
  const message = ctx.args.slice(1).join(' ');

  // Find target player
  const db = getDatabase();
  const targetPlayer = playerQueries.findByName(db).get(targetName) as {
    id: number;
    name: string;
  } | undefined;

  if (!targetPlayer) {
    sendOutput(ctx.playerId, `No player named "${targetName}" found.`);
    return;
  }

  // Check if online
  if (!connectionManager.isPlayerConnected(targetPlayer.id)) {
    sendOutput(ctx.playerId, `${targetPlayer.name} is not online.`);
    return;
  }

  // Send to sender
  sendOutput(ctx.playerId, `You tell ${targetPlayer.name}, "${message}"`, 'chat');

  // Send to recipient
  connectionManager.sendToPlayer(targetPlayer.id, {
    type: 'whisper',
    from: ctx.playerName,
    message,
  });
}

function processWho(ctx: CommandContext): void {
  const connectedPlayerIds = connectionManager.getConnectedPlayerIds();

  if (connectedPlayerIds.length === 0) {
    sendOutput(ctx.playerId, '\nNo other players online.\n');
    return;
  }

  const db = getDatabase();
  const lines: string[] = [
    '',
    '╔════════════════════════════════════════╗',
    '║         PLAYERS ONLINE                 ║',
    '╠════════════════════════════════════════╣',
  ];

  for (const playerId of connectedPlayerIds) {
    const player = playerQueries.findById(db).get(playerId) as {
      name: string;
      level: number;
      class_id: number;
    } | undefined;

    if (player) {
      const classDef = playerManager.getClassDefinition(player.class_id);
      const className = classDef?.name || 'Unknown';
      const you = playerId === ctx.playerId ? ' (You)' : '';
      lines.push(`║  ${player.name.padEnd(15)} Lv${String(player.level).padStart(2)} ${className.padEnd(15)}${you.padEnd(5)} ║`);
    }
  }

  lines.push('╚════════════════════════════════════════╝');
  lines.push(`Total: ${connectedPlayerIds.length} player(s) online`);
  lines.push('');

  sendOutput(ctx.playerId, lines.join('\n'));
}
