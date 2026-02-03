// Game State Hook for Llama Picchu MUD
'use client';

import { useState, useCallback } from 'react';
import type { PlayerResources, PlayerVitals } from '../../shared/types/player';
import type { ServerMessage, InventoryItem, EquipmentItem } from '../../shared/types/websocket';

interface GameState {
  playerId: number | null;
  playerName: string | null;
  resources: PlayerResources | null;
  vitals: PlayerVitals | null;
  inventory: InventoryItem[];
  equipment: Record<string, EquipmentItem | null>;
  inCombat: boolean;
  combatTarget: { type: string; id: number; name: string } | null;
  output: OutputLine[];
}

export interface OutputLine {
  id: string;
  text: string;
  type: 'normal' | 'system' | 'combat' | 'chat' | 'whisper' | 'emote' | 'error';
  timestamp: number;
}

const initialState: GameState = {
  playerId: null,
  playerName: null,
  resources: null,
  vitals: null,
  inventory: [],
  equipment: {},
  inCombat: false,
  combatTarget: null,
  output: [],
};

export function useGameState() {
  const [state, setState] = useState<GameState>(initialState);

  const addOutput = useCallback((text: string, type: OutputLine['type'] = 'normal') => {
    const line: OutputLine = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      type,
      timestamp: Date.now(),
    };

    setState((prev) => ({
      ...prev,
      output: [...prev.output.slice(-500), line], // Keep last 500 lines
    }));
  }, []);

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'auth_success':
        setState((prev) => ({
          ...prev,
          playerId: message.playerId,
          playerName: message.playerName,
        }));
        break;

      case 'output':
        addOutput(message.text, message.messageType as OutputLine['type'] || 'normal');
        break;

      case 'player_update':
        setState((prev) => ({
          ...prev,
          resources: message.resources
            ? { ...prev.resources, ...message.resources } as PlayerResources
            : prev.resources,
          vitals: message.vitals
            ? { ...prev.vitals, ...message.vitals } as PlayerVitals
            : prev.vitals,
        }));
        break;

      case 'combat_update':
        setState((prev) => ({
          ...prev,
          inCombat: message.combat.inCombat,
          combatTarget: message.combat.target,
        }));
        break;

      case 'combat_round':
        // Combat round results are sent as output messages
        break;

      case 'player_entered':
        addOutput(`${message.playerName} has arrived.`, 'system');
        break;

      case 'player_left':
        const direction = message.direction ? ` ${message.direction}` : '';
        addOutput(`${message.playerName} has left${direction}.`, 'system');
        break;

      case 'chat':
        addOutput(`[${message.channel}] ${message.from}: ${message.message}`, 'chat');
        break;

      case 'whisper':
        addOutput(`${message.from} whispers to you: "${message.message}"`, 'whisper');
        break;

      case 'emote':
        addOutput(`${message.from} ${message.action}`, 'emote');
        break;

      case 'system':
        addOutput(message.message, 'system');
        break;

      case 'level_up':
        addOutput(`*** LEVEL UP! You are now level ${message.level}! ***`, 'system');
        break;

      case 'inventory_update':
        setState((prev) => ({
          ...prev,
          inventory: message.items,
        }));
        break;

      case 'equipment_update':
        setState((prev) => ({
          ...prev,
          equipment: {
            ...prev.equipment,
            [message.slot]: message.item,
          },
        }));
        break;

      case 'npc_action':
        addOutput(`${message.npcName} ${message.action}.`, 'normal');
        break;

      case 'npc_say':
        addOutput(`${message.npcName} says, "${message.message}"`, 'normal');
        break;

      case 'error':
        addOutput(message.message, 'error');
        break;

      case 'pong':
        // Ping response, no action needed
        break;

      default:
        console.log('Unhandled message type:', message);
    }
  }, [addOutput]);

  const clearOutput = useCallback(() => {
    setState((prev) => ({
      ...prev,
      output: [],
    }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    state,
    handleMessage,
    addOutput,
    clearOutput,
    reset,
  };
}
