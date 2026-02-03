'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useGameState, OutputLine } from '@/hooks/useGameState';

export default function GamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const { state, handleMessage, addOutput, clearOutput } = useGameState();

  const { connected, authenticated, sendCommand, connect, disconnect } = useWebSocket({
    onMessage: handleMessage,
    onConnect: () => {
      addOutput('Connected to Llama Picchu MUD!', 'system');
    },
    onDisconnect: () => {
      addOutput('Disconnected from server.', 'system');
    },
  });

  // Connect on mount if token present
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    // Prevent double-connection in strict mode
    if (hasConnectedRef.current) return;

    const token = searchParams.get('token') || localStorage.getItem('gameToken');
    if (token) {
      localStorage.setItem('gameToken', token);
      hasConnectedRef.current = true;
      connect(token);
    } else {
      router.push('/');
    }

    return () => {
      // Only disconnect on actual unmount, not strict mode re-render
      // The cleanup will happen when the component is truly unmounted
    };
  }, [searchParams, router]); // Remove connect/disconnect from deps

  // Handle actual page unload
  useEffect(() => {
    const handleUnload = () => {
      disconnect();
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      disconnect();
    };
  }, [disconnect]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [state.output]);

  // Focus input on click
  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add to history
    setCommandHistory((prev) => [...prev.slice(-49), input]);
    setHistoryIndex(-1);

    // Show command in output
    addOutput(`> ${input}`, 'normal');

    // Send command
    sendCommand(input);

    // Clear input
    setInput('');
  }, [input, addOutput, sendCommand]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
        }
      }
    }
  };

  const getLineClass = (type: OutputLine['type']) => {
    switch (type) {
      case 'system':
        return 'text-amber-500';
      case 'combat':
        return 'text-red-400';
      case 'chat':
        return 'text-cyan-400';
      case 'whisper':
        return 'text-purple-400';
      case 'emote':
        return 'text-yellow-300';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-amber-100';
    }
  };

  return (
    <div
      className="min-h-screen bg-black text-amber-100 font-mono flex flex-col cursor-text"
      onClick={handleContainerClick}
    >
      {/* Status Bar */}
      <div className="border-b border-amber-800 bg-black/50 px-4 py-2 flex justify-between items-center text-sm">
        <div className="flex items-center gap-4">
          <span className="text-amber-500">
            {state.playerName || 'Unknown'}
          </span>
          {state.resources && (
            <>
              <span className="text-red-400">
                HP: {state.resources.hp}/{state.resources.maxHp}
              </span>
              <span className="text-blue-400">
                Mana: {state.resources.mana}/{state.resources.maxMana}
              </span>
              <span className="text-green-400">
                Stamina: {state.resources.stamina}/{state.resources.maxStamina}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {state.inCombat && (
            <span className="text-red-500 animate-pulse">*** COMBAT ***</span>
          )}
          <span className={connected ? 'text-green-500' : 'text-red-500'}>
            {connected ? (authenticated ? '● Online' : '● Connecting...') : '○ Offline'}
          </span>
        </div>
      </div>

      {/* Output Area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
        style={{ maxHeight: 'calc(100vh - 120px)' }}
      >
        {state.output.map((line) => (
          <div key={line.id} className={`whitespace-pre-wrap ${getLineClass(line.type)}`}>
            {line.text}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="border-t border-amber-800 bg-black/50 p-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <span className="text-green-400">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-amber-100 placeholder-amber-700"
            placeholder={authenticated ? 'Enter command...' : 'Connecting...'}
            disabled={!authenticated}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </form>
      </div>

      {/* CRT Effect Overlay */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]" />
    </div>
  );
}
