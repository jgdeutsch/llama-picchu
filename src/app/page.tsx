'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState,
  createInitialState,
  processCommand,
  getFallbackResponse,
  INTRO_TEXT,
} from '@/lib/gameEngine';

interface OutputLine {
  id: number;
  type: 'system' | 'input' | 'output' | 'error';
  text: string;
}

export default function Game() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lineCounter, setLineCounter] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const addOutput = useCallback((text: string, type: OutputLine['type'] = 'output') => {
    setLineCounter(prev => {
      const newId = prev + 1;
      setOutput(current => [...current, { id: newId, type, text }]);
      return newId;
    });
  }, []);

  // Initialize game
  useEffect(() => {
    const initialState = createInitialState();
    setGameState(initialState);

    // Show intro
    addOutput(INTRO_TEXT, 'system');

    // Show initial room
    const room = initialState.rooms[initialState.player.location];
    const roomDesc = `
${room.name}
${'-'.repeat(room.name.length)}
${room.description}

You see: ${Object.keys(room.items).join(', ')}
Exits: north, east, south, west`;
    addOutput(roomDesc, 'output');
  }, [addOutput]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Focus input on click
  const focusInput = () => {
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !gameState || isLoading) return;

    const userInput = input.trim();
    setInput('');

    // Show user input
    const prompt = gameState.questionGame.active ? 'Your question>' : '>';
    addOutput(`${prompt} ${userInput}`, 'input');

    // Process command
    const result = processCommand(gameState, userInput);
    setGameState(result.state);

    if (result.needsLLM) {
      // Get response from Gemini API
      setIsLoading(true);
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userInput: result.userInput }),
        });
        const data = await response.json();
        addOutput(data.response || getFallbackResponse());
      } catch {
        addOutput(getFallbackResponse());
      }
      setIsLoading(false);
    } else if (result.output) {
      addOutput(result.output);
    }
  };

  return (
    <div
      className="min-h-screen bg-stone-900 text-amber-100 font-mono p-4 flex flex-col"
      onClick={focusInput}
    >
      {/* Header */}
      <header className="text-center mb-4 border-b border-amber-700 pb-4">
        <h1 className="text-2xl md:text-3xl text-amber-400 font-bold tracking-wider">
          🦙 LLAMA AT MACHU PICCHU 🏔️
        </h1>
        <p className="text-amber-600 text-sm mt-1">
          A Text Adventure in the Style of Rosencrantz and Guildenstern Are Dead
        </p>
      </header>

      {/* Game output */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto mb-4 space-y-2 max-h-[calc(100vh-200px)] scrollbar-thin scrollbar-thumb-amber-700 scrollbar-track-stone-800"
      >
        {output.map((line) => (
          <div
            key={line.id}
            className={`whitespace-pre-wrap ${
              line.type === 'system'
                ? 'text-amber-500'
                : line.type === 'input'
                ? 'text-emerald-400'
                : line.type === 'error'
                ? 'text-red-400'
                : 'text-amber-100'
            }`}
          >
            {line.text}
          </div>
        ))}
        {isLoading && (
          <div className="text-amber-600 animate-pulse">
            The llama ponders...
          </div>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-amber-700 pt-4">
        <span className="text-emerald-400">
          {gameState?.questionGame.active ? 'Your question>' : '>'}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          className="flex-1 bg-transparent border-none outline-none text-amber-100 placeholder-amber-700"
          placeholder={isLoading ? 'Thinking...' : 'Enter command...'}
          autoFocus
          autoComplete="off"
          spellCheck="false"
        />
      </form>

      {/* Quick commands */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="text-amber-600">Quick:</span>
        {['look', 'inventory', 'help', 'think', 'north', 'south', 'east', 'west'].map((cmd) => (
          <button
            key={cmd}
            onClick={() => {
              setInput(cmd);
              inputRef.current?.focus();
            }}
            className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 rounded border border-amber-800 hover:border-amber-600 transition-colors"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-4 text-center text-amber-700 text-xs border-t border-amber-800 pt-4">
        <p>
          Inspired by Zork, Rosencrantz & Guildenstern Are Dead, and the noble llamas of Peru
        </p>
        <p className="mt-1">
          Type <span className="text-amber-500">help</span> for commands •{' '}
          <span className="text-amber-500">questions</span> at Intihuatana for the Question Game
        </p>
      </footer>
    </div>
  );
}
