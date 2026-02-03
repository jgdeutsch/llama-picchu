'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState,
  createInitialState,
  processCommand,
  getFallbackResponse,
} from '@/lib/gameEngine';

// Simpler boot screen that fits
const BOOT_SCREEN = `

    ██╗     ██╗      █████╗ ███╗   ███╗ █████╗
    ██║     ██║     ██╔══██╗████╗ ████║██╔══██╗
    ██║     ██║     ███████║██╔████╔██║███████║
    ██║     ██║     ██╔══██║██║╚██╔╝██║██╔══██║
    ███████╗███████╗██║  ██║██║ ╚═╝ ██║██║  ██║
    ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝

              ═══════════════════════════
               A Text Adventure in the
              Style of Rosencrantz and
                Guildenstern Are Dead
              ═══════════════════════════

                  INCAN ERA - 1450 CE

    SYSTEM READY...
    LOADING CONSCIOUSNESS...
    WOOL DENSITY: OPTIMAL
    PHILOSOPHICAL CAPACITY: MAXIMUM

`;

// ASCII Art for achievements
const ASCII_ART = {
  llama: `
                  @@@@
                 @@  @@
                @@    @@
               @@  @@  @@
               @@ @@@@ @@
                @@    @@
                 @@@@@@
                    @
           @@@@@@@@@@@@@@@@@
         @@                 @@
        @@    @@@@@@@@@@     @@
       @@   @@          @@    @@
      @@   @@            @@   @@
     @@   @@              @@   @@
     @@  @@                @@  @@
     @@ @@                  @@ @@
     @@@@                    @@@@
`,
  goldenLlama: `
╔═══════════════════════════════════════════════╗
║                                               ║
║     *  . *       *    .  *   *   .    *      ║
║  .    *    ████████    *    .       *        ║
║*    .      ██ ░░░░ ██      *    *  .         ║
║  *   .    ██ ░▓▓▓▓░ ██   .    *              ║
║.    *     ██ ░▓████▓░ ██    .     *    .     ║
║  .   *    ██ ░▓▓▓▓░ ██   *    .              ║
║*    .      ████████████     .   *      .     ║
║   *   .       ██  ██     *    .    *         ║
║ .    *  ██████████████████    *     .        ║
║   *   ██                  ██    .    *       ║
║.     ██  ████████████████  ██     *    .     ║
║  *  ██  ██              ██  ██  .            ║
║.   ██  ██                ██  ██    .     *   ║
║   ████                    ████   *    .      ║
║                                               ║
║        ★ THE GOLDEN LLAMA OF LEGEND ★        ║
║                                               ║
╚═══════════════════════════════════════════════╝
`,
  questionWin: `
╭─────────────────────────────────────╮
│     ___                             │
│    /   \\    MASTER OF QUESTIONS!   │
│   | ? ? |                           │
│    \\___/    You have defeated the  │
│      │      philosophical alpaca!   │
│   ╭──┴──╮                           │
│   │ ??? │   The ancient art of      │
│   ╰─────╯   rhetorical combat       │
│             is yours.               │
╰─────────────────────────────────────╯
`,
  secretDoor: `
┌─────────────────────────────────────┐
│  ╔═══════════════════════════════╗  │
│  ║ █████████████████████████████ ║  │
│  ║ █                           █ ║  │
│  ║ █   ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄   █ ║  │
│  ║ █   █ THE DOOR OPENS... █   █ ║  │
│  ║ █   █                   █   █ ║  │
│  ║ █   █  A passage east   █   █ ║  │
│  ║ █   █                   █   █ ║  │
│  ║ █   ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀   █ ║  │
│  ║ █                           █ ║  │
│  ║ █████████████████████████████ ║  │
│  ╚═══════════════════════════════╝  │
└─────────────────────────────────────┘
`,
};

const INTRO_TEXT = `You are a llama.

This is, perhaps, the only thing you know for certain.
You have four legs, excellent wool, and a vague sense
that something significant is about to happen.

The year is the Incan era. The sun is worshipped, the
stones are precisely cut, and you're standing in what
will one day be a major tourist attraction.

Type HELP for commands.`;

interface OutputLine {
  id: number;
  type: 'system' | 'input' | 'output' | 'error' | 'ascii';
  text: string;
}

const LINES_PER_PAGE = 20;

export default function Game() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [input, setInput] = useState('');
  const [outputBuffer, setOutputBuffer] = useState<OutputLine[]>([]);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lineCounter, setLineCounter] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [waitingForSpace, setWaitingForSpace] = useState(false);
  const [pendingContent, setPendingContent] = useState<{text: string, type: OutputLine['type']}[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get visible lines
  const visibleLines = outputBuffer.slice(
    Math.max(0, visibleStartIndex),
    visibleStartIndex + LINES_PER_PAGE
  );

  const hasMoreContent = visibleStartIndex + LINES_PER_PAGE < outputBuffer.length || pendingContent.length > 0;

  const addOutput = useCallback((text: string, type: OutputLine['type'] = 'output') => {
    const lines = text.split('\n');

    setLineCounter(prev => {
      let id = prev;
      const newLines: OutputLine[] = lines.map(line => ({
        id: ++id,
        type,
        text: line
      }));

      setOutputBuffer(current => {
        const updated = [...current, ...newLines];
        // Check if content overflows
        if (updated.length > LINES_PER_PAGE) {
          setWaitingForSpace(true);
        }
        // Show from start, user presses space to see more
        return updated;
      });

      return id;
    });
  }, []);

  // Queue content to show after space press
  const queueContent = useCallback((text: string, type: OutputLine['type'] = 'output') => {
    setPendingContent(prev => [...prev, { text, type }]);
    if (!waitingForSpace) {
      setWaitingForSpace(true);
    }
  }, [waitingForSpace]);

  // Advance to next page on SPACE
  const advancePage = useCallback(() => {
    const newStart = visibleStartIndex + LINES_PER_PAGE;

    if (newStart < outputBuffer.length) {
      // More content in buffer to show
      setVisibleStartIndex(newStart);
      if (newStart + LINES_PER_PAGE >= outputBuffer.length && pendingContent.length === 0) {
        setWaitingForSpace(false);
      }
    } else if (pendingContent.length > 0) {
      // Add next pending content
      const [next, ...rest] = pendingContent;
      setPendingContent(rest);
      addOutput(next.text, next.type);
      // Stay waiting if more pending
      if (rest.length === 0) {
        setWaitingForSpace(false);
      }
    } else {
      setWaitingForSpace(false);
    }
  }, [visibleStartIndex, outputBuffer.length, pendingContent, addOutput]);

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      addOutput(BOOT_SCREEN, 'ascii');
      setWaitingForSpace(true);
    };

    bootSequence();
  }, [addOutput]);

  // Handle boot -> game transition
  const startGame = useCallback(() => {
    const initialState = createInitialState();
    setGameState(initialState);
    setIsBooting(false);

    // Clear and show game
    setOutputBuffer([]);
    setVisibleStartIndex(0);
    setLineCounter(0);
    setWaitingForSpace(false);
    setPendingContent([]);

    // Queue all intro content
    setTimeout(() => {
      addOutput(ASCII_ART.llama, 'ascii');
      addOutput('', 'output');
      addOutput(INTRO_TEXT, 'system');
      addOutput('', 'output');

      const room = initialState.rooms[initialState.player.location];
      addOutput(room.name, 'output');
      addOutput('─'.repeat(room.name.length), 'output');
      addOutput(room.description, 'output');
      addOutput('', 'output');
      addOutput(`You see: ${Object.keys(room.items).join(', ')}`, 'output');
      addOutput(`Exits: north, east, south, west`, 'output');
    }, 100);
  }, [addOutput]);

  // Focus input
  const focusInput = () => {
    inputRef.current?.focus();
  };

  // Global SPACE handler
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && waitingForSpace) {
        e.preventDefault();
        if (isBooting) {
          startGame();
        } else {
          advancePage();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [waitingForSpace, isBooting, startGame, advancePage]);

  // Handle keyboard in input
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (waitingForSpace && e.key === ' ') {
      e.preventDefault();
      if (isBooting) {
        startGame();
      } else {
        advancePage();
      }
      return;
    }

    // Command history with up/down arrows
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1
          ? historyIndex + 1
          : historyIndex;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
      return;
    }
  }, [waitingForSpace, isBooting, startGame, advancePage, commandHistory, historyIndex]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !gameState || isLoading || waitingForSpace) return;

    const userInput = input.trim();
    setInput('');
    setHistoryIndex(-1);

    // Add to command history
    setCommandHistory(prev => [...prev.slice(-50), userInput]);

    // Show user input
    const prompt = gameState.questionGame.active ? '??>' : 'C:\\>';
    addOutput(`${prompt} ${userInput}`, 'input');

    // Process command
    const result = processCommand(gameState, userInput);

    // Check for achievements/ASCII art triggers
    let asciiToShow: string | null = null;
    if (result.output?.includes('door recognizes these offerings')) {
      asciiToShow = ASCII_ART.secretDoor;
    }
    if (result.output?.includes("You've won this round")) {
      asciiToShow = ASCII_ART.questionWin;
    }
    if (result.output?.includes('VICTORY')) {
      asciiToShow = ASCII_ART.goldenLlama;
    }

    setGameState(result.state);

    if (result.needsLLM) {
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
      if (asciiToShow) {
        addOutput(asciiToShow, 'ascii');
      }
      addOutput(result.output);

      // Auto-scroll to end to show new content
      setVisibleStartIndex(prev => {
        const newTotal = outputBuffer.length + result.output.split('\n').length + (asciiToShow ? asciiToShow.split('\n').length : 0);
        return Math.max(0, newTotal - LINES_PER_PAGE);
      });
    }
  };

  const getLineColor = (type: OutputLine['type']) => {
    switch (type) {
      case 'system': return 'text-amber-500';
      case 'input': return 'text-green-400';
      case 'error': return 'text-red-500';
      case 'ascii': return 'text-amber-400';
      default: return 'text-amber-100';
    }
  };

  return (
    <div
      className="h-screen w-screen bg-black text-amber-100 font-mono flex flex-col relative overflow-hidden select-none"
      onClick={focusInput}
    >
      {/* CRT effects */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black opacity-30" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0, 0, 0, 0.3) 1px, rgba(0, 0, 0, 0.3) 2px)',
            backgroundSize: '100% 2px',
          }}
        />
      </div>

      {/* Terminal content */}
      <div className="relative z-10 flex flex-col h-full p-4">
        {/* Header */}
        <header className="text-center mb-3 pb-2 border-b border-amber-700/40">
          <h1 className="text-xl text-amber-400 font-bold tracking-[0.25em] uppercase">
            LLAMA AT MACHU PICCHU
          </h1>
          <div className="text-amber-600/50 text-[10px] tracking-widest mt-1">
            ════════════════════════════════════════════
          </div>
        </header>

        {/* Terminal output */}
        <div
          className="flex-1 overflow-hidden"
          style={{
            textShadow: '0 0 4px rgba(251, 191, 36, 0.3)',
          }}
        >
          {visibleLines.map((line) => (
            <div
              key={line.id}
              className={`whitespace-pre leading-snug ${getLineColor(line.type)} ${
                line.type === 'ascii' ? 'text-[10px] md:text-xs leading-none' : 'text-sm'
              }`}
            >
              {line.text || '\u00A0'}
            </div>
          ))}
          {isLoading && (
            <div className="text-amber-600 animate-pulse text-sm">
              ◐ PROCESSING...
            </div>
          )}
        </div>

        {/* PRESS SPACE stripe - full width, prominent */}
        {waitingForSpace && (
          <div className="absolute bottom-20 left-0 right-0 z-30">
            <div className="bg-amber-600 text-black py-2 text-center font-bold text-sm tracking-widest animate-pulse">
              ════════════════  PRESS SPACE TO CONTINUE  ════════════════
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-amber-700/40 pt-3 mt-2">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <span className="text-green-400 font-bold text-sm">
              {gameState?.questionGame.active ? '??>' : 'C:\\>'}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              disabled={isLoading || isBooting || waitingForSpace}
              className="flex-1 bg-transparent border-none outline-none text-green-400 placeholder-amber-700/40 uppercase tracking-wider text-sm"
              placeholder={
                waitingForSpace ? '' :
                isLoading ? 'PROCESSING...' :
                'ENTER COMMAND...'
              }
              autoFocus
              autoComplete="off"
              spellCheck="false"
              style={{ textShadow: '0 0 4px rgba(74, 222, 128, 0.4)' }}
            />
            {!waitingForSpace && <span className="text-green-400 animate-pulse">▌</span>}
          </form>
        </div>

        {/* Status bar */}
        <footer className="mt-2 text-[9px] text-amber-700/40 border-t border-amber-800/30 pt-2">
          <div className="flex justify-between items-center">
            <span>↑↓ HISTORY</span>
            <span>LLAMA OS v1.0</span>
            <span>TURN: {gameState?.turnCount || 0}</span>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        .bg-gradient-radial {
          background: radial-gradient(ellipse at center, transparent 0%, transparent 60%, black 100%);
        }
        * {
          font-family: 'JetBrains Mono', 'IBM Plex Mono', 'Consolas', 'Courier New', monospace !important;
        }
        html, body {
          overflow: hidden;
          height: 100%;
          background: black;
        }
      `}</style>
    </div>
  );
}
