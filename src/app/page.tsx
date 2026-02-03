'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState,
  createInitialState,
  processCommand,
  getFallbackResponse,
} from '@/lib/gameEngine';

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
  ╔═════════════════════════════════════════════════════╗
  ║                                                     ║
  ║       *  . *       *    .  *   *   .    *  *       ║
  ║    .    *    ████████    *    .       *     .      ║
  ║ *    .      ██ ░░░░ ██      *    *  .    *         ║
  ║   *   .    ██ ░▓▓▓▓░ ██   .    *      .            ║
  ║.    *     ██ ░▓████▓░ ██    .     *    .   *       ║
  ║  .   *    ██ ░▓▓▓▓░ ██   *    .     *              ║
  ║*    .      ████████████     .   *      .    *      ║
  ║   *   .       ██  ██     *    .    *      .        ║
  ║ .    *  ██████████████████    *     .   *          ║
  ║   *   ██                  ██    .    *     .       ║
  ║.     ██  ████████████████  ██     *    .    *      ║
  ║  *  ██  ██              ██  ██  .     *            ║
  ║.   ██  ██                ██  ██    .     *   .     ║
  ║   ████                    ████   *    .    *       ║
  ║                                                     ║
  ║          ★ THE GOLDEN LLAMA OF LEGEND ★            ║
  ║                                                     ║
  ╚═════════════════════════════════════════════════════╝
`,
  questionWin: `
  ╭───────────────────────────────────────╮
  │     ___                               │
  │    /   \\    MASTER OF QUESTIONS!     │
  │   | ? ? |                             │
  │    \\___/    You have defeated the    │
  │      │      philosophical alpaca!     │
  │   ╭──┴──╮                             │
  │   │ ??? │   The ancient art of        │
  │   ╰─────╯   rhetorical combat         │
  │             is yours.                 │
  ╰───────────────────────────────────────╯
`,
  secretDoor: `
  ┌───────────────────────────────────────┐
  │  ╔═════════════════════════════════╗  │
  │  ║ ███████████████████████████████ ║  │
  │  ║ █                             █ ║  │
  │  ║ █   ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄   █ ║  │
  │  ║ █   █ THE DOOR OPENS...   █   █ ║  │
  │  ║ █   █                     █   █ ║  │
  │  ║ █   █  A passage reveals  █   █ ║  │
  │  ║ █   █  itself to the east █   █ ║  │
  │  ║ █   █                     █   █ ║  │
  │  ║ █   ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀   █ ║  │
  │  ║ █                             █ ║  │
  │  ║ ███████████████████████████████ ║  │
  │  ╚═════════════════════════════════╝  │
  └───────────────────────────────────────┘
`,
  boot: `
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║   ██╗     ██╗      █████╗ ███╗   ███╗ █████╗       ██████╗  ██████╗║
║   ██║     ██║     ██╔══██╗████╗ ████║██╔══██╗     ██╔═══██╗██╔════╝║
║   ██║     ██║     ███████║██╔████╔██║███████║     ██║   ██║╚█████╗ ║
║   ██║     ██║     ██╔══██║██║╚██╔╝██║██╔══██║     ██║   ██║ ╚═══██╗║
║   ███████╗███████╗██║  ██║██║ ╚═╝ ██║██║  ██║     ╚██████╔╝██████╔╝║
║   ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝      ╚═════╝ ╚═════╝ ║
║                                                                    ║
║            ███╗   ███╗ █████╗  ██████╗██╗  ██╗██╗   ██╗            ║
║            ████╗ ████║██╔══██╗██╔════╝██║  ██║██║   ██║            ║
║            ██╔████╔██║███████║██║     ███████║██║   ██║            ║
║            ██║╚██╔╝██║██╔══██║██║     ██╔══██║██║   ██║            ║
║            ██║ ╚═╝ ██║██║  ██║╚██████╗██║  ██║╚██████╔╝            ║
║            ╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝             ║
║                                                                    ║
║               ██████╗ ██╗ ██████╗ ██████╗██╗  ██╗██╗   ██╗         ║
║               ██╔══██╗██║██╔════╝██╔════╝██║  ██║██║   ██║         ║
║               ██████╔╝██║██║     ██║     ███████║██║   ██║         ║
║               ██╔═══╝ ██║██║     ██║     ██╔══██║██║   ██║         ║
║               ██║     ██║╚██████╗╚██████╗██║  ██║╚██████╔╝         ║
║               ╚═╝     ╚═╝ ╚═════╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝          ║
║                                                                    ║
║   ═══════════════════════════════════════════════════════════════  ║
║               A Text Adventure in Uncertain Times                  ║
║                       INCAN ERA - 1450 CE                          ║
║   ═══════════════════════════════════════════════════════════════  ║
║                                                                    ║
║   SYSTEM READY...                                                  ║
║   LOADING CONSCIOUSNESS...                                         ║
║   WOOL DENSITY: OPTIMAL                                            ║
║   PHILOSOPHICAL CAPACITY: MAXIMUM                                  ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
`,
};

// Shorter intro that fits on screen
const INTRO_TEXT = `You are a llama.

This is, perhaps, the only thing you know for certain.
You have four legs, excellent wool, and a vague sense
that something significant is about to happen.

The year is the Incan era. The sun is worshipped, the
stones are precisely cut, and you're standing in what
will one day be a major tourist attraction.

Type HELP for commands. Press ↑/↓ to scroll history.`;

interface OutputLine {
  id: number;
  type: 'system' | 'input' | 'output' | 'error' | 'ascii' | 'more';
  text: string;
}

// Calculate how many lines fit on screen
const LINES_PER_PAGE = 18;

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
  const [pendingPages, setPendingPages] = useState<string[]>([]);
  const [waitingForMore, setWaitingForMore] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get visible lines based on current scroll position
  const visibleLines = outputBuffer.slice(
    Math.max(0, visibleStartIndex),
    visibleStartIndex + LINES_PER_PAGE
  );

  const canScrollUp = visibleStartIndex > 0;
  const canScrollDown = visibleStartIndex + LINES_PER_PAGE < outputBuffer.length;

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
        // Auto-scroll to show new content
        const newStart = Math.max(0, updated.length - LINES_PER_PAGE);
        setVisibleStartIndex(newStart);
        return updated;
      });

      return id;
    });
  }, []);

  // Handle paginated text that's too long
  const addPaginatedOutput = useCallback((text: string, type: OutputLine['type'] = 'output') => {
    const lines = text.split('\n');

    // If it fits on one screen, just add it
    if (lines.length <= LINES_PER_PAGE - 2) {
      addOutput(text, type);
      return;
    }

    // Split into pages
    const pages: string[] = [];
    for (let i = 0; i < lines.length; i += LINES_PER_PAGE - 2) {
      pages.push(lines.slice(i, i + LINES_PER_PAGE - 2).join('\n'));
    }

    // Show first page
    addOutput(pages[0], type);

    // Queue remaining pages
    if (pages.length > 1) {
      setPendingPages(pages.slice(1));
      setWaitingForMore(true);
      addOutput('── [SPACE] for more, [Q] to skip ──', 'more');
    }
  }, [addOutput]);

  const showNextPage = useCallback(() => {
    if (pendingPages.length === 0) {
      setWaitingForMore(false);
      return;
    }

    const [nextPage, ...remaining] = pendingPages;
    addOutput(nextPage, 'output');
    setPendingPages(remaining);

    if (remaining.length > 0) {
      addOutput('── [SPACE] for more, [Q] to skip ──', 'more');
    } else {
      setWaitingForMore(false);
    }
  }, [pendingPages, addOutput]);

  const skipPages = useCallback(() => {
    setPendingPages([]);
    setWaitingForMore(false);
    addOutput('── skipped ──', 'system');
  }, [addOutput]);

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      addOutput(ASCII_ART.boot, 'ascii');

      await new Promise(resolve => setTimeout(resolve, 2000));

      const initialState = createInitialState();
      setGameState(initialState);
      setIsBooting(false);

      // Clear and show game
      setOutputBuffer([]);
      setVisibleStartIndex(0);

      addOutput(ASCII_ART.llama, 'ascii');

      await new Promise(resolve => setTimeout(resolve, 300));

      addOutput(INTRO_TEXT, 'system');

      // Show initial room (compact)
      const room = initialState.rooms[initialState.player.location];
      const roomDesc = `
${room.name}
${'─'.repeat(room.name.length)}
${room.description}

You see: ${Object.keys(room.items).join(', ')}
Exits: north, east, south, west`;

      setTimeout(() => addOutput(roomDesc, 'output'), 100);
    };

    bootSequence();
  }, [addOutput]);

  // Focus input
  const focusInput = () => {
    inputRef.current?.focus();
  };

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle "more" pagination
    if (waitingForMore) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        showNextPage();
        return;
      }
      if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') {
        e.preventDefault();
        skipPages();
        return;
      }
      return;
    }

    // Scroll through output history with Page Up/Down
    if (e.key === 'PageUp') {
      e.preventDefault();
      setVisibleStartIndex(prev => Math.max(0, prev - LINES_PER_PAGE));
      return;
    }
    if (e.key === 'PageDown') {
      e.preventDefault();
      setVisibleStartIndex(prev =>
        Math.min(Math.max(0, outputBuffer.length - LINES_PER_PAGE), prev + LINES_PER_PAGE)
      );
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
  }, [waitingForMore, showNextPage, skipPages, commandHistory, historyIndex, outputBuffer.length]);

  // Global key handler for pagination
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (waitingForMore) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          showNextPage();
        } else if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') {
          e.preventDefault();
          skipPages();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [waitingForMore, showNextPage, skipPages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !gameState || isLoading || waitingForMore) return;

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
        setTimeout(() => addPaginatedOutput(result.output, 'output'), 50);
      } else {
        addPaginatedOutput(result.output);
      }
    }
  };

  const getLineColor = (type: OutputLine['type']) => {
    switch (type) {
      case 'system': return 'text-amber-500';
      case 'input': return 'text-green-400';
      case 'error': return 'text-red-500';
      case 'ascii': return 'text-amber-300';
      case 'more': return 'text-cyan-400 animate-pulse';
      default: return 'text-amber-100';
    }
  };

  return (
    <div
      className="h-screen w-screen bg-black text-amber-100 font-mono p-0 flex flex-col relative overflow-hidden select-none"
      onClick={focusInput}
    >
      {/* CRT effects */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black opacity-40" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0, 0, 0, 0.4) 1px, rgba(0, 0, 0, 0.4) 2px)',
            backgroundSize: '100% 2px',
          }}
        />
        <div className="absolute inset-0 animate-flicker opacity-[0.015] bg-amber-500" />
      </div>

      {/* Terminal content */}
      <div className="relative z-10 flex flex-col h-full p-3 md:p-4">
        {/* Compact header */}
        <header className="text-center mb-2 pb-2 border-b border-amber-700/40">
          <h1 className="text-lg md:text-xl text-amber-400 font-bold tracking-[0.2em] uppercase">
            LLAMA AT MACHU PICCHU
          </h1>
          <div className="text-amber-600/60 text-[10px] tracking-wider">
            ═══════════════════════════════════════════
          </div>
        </header>

        {/* Terminal output - NO SCROLLBAR */}
        <div
          className="flex-1 overflow-hidden mb-2"
          style={{
            textShadow: '0 0 4px rgba(251, 191, 36, 0.4)',
          }}
        >
          {visibleLines.map((line) => (
            <div
              key={line.id}
              className={`whitespace-pre leading-tight ${getLineColor(line.type)} ${
                line.type === 'ascii' ? 'text-[9px] md:text-[11px] leading-none' : 'text-xs md:text-sm'
              }`}
            >
              {line.text || ' '}
            </div>
          ))}
          {isLoading && (
            <div className="text-amber-600 animate-pulse text-xs md:text-sm">
              ◐ PROCESSING...
            </div>
          )}
        </div>

        {/* Scroll indicators */}
        <div className="flex justify-between text-[10px] text-amber-600/50 mb-1 px-1">
          <span>{canScrollUp ? '▲ PgUp' : ''}</span>
          <span>
            {outputBuffer.length > 0 &&
              `${Math.min(visibleStartIndex + LINES_PER_PAGE, outputBuffer.length)}/${outputBuffer.length}`
            }
          </span>
          <span>{canScrollDown ? '▼ PgDn' : ''}</span>
        </div>

        {/* Input area */}
        <div className="border-t border-amber-700/40 pt-2">
          <form onSubmit={handleSubmit} className="flex items-center gap-1">
            <span className="text-green-400 font-bold text-sm">
              {waitingForMore ? '[MORE]' : gameState?.questionGame.active ? '??>' : 'C:\\>'}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              disabled={isLoading || isBooting}
              className="flex-1 bg-transparent border-none outline-none text-green-400 placeholder-amber-700/40 uppercase tracking-wider text-sm"
              placeholder={
                waitingForMore ? 'SPACE=more Q=skip' :
                isLoading ? 'PROCESSING...' :
                'ENTER COMMAND...'
              }
              autoFocus
              autoComplete="off"
              spellCheck="false"
              style={{ textShadow: '0 0 4px rgba(74, 222, 128, 0.4)' }}
            />
            <span className="text-green-400 animate-pulse">▌</span>
          </form>
        </div>

        {/* Status bar */}
        <footer className="mt-2 text-[9px] text-amber-700/50 border-t border-amber-800/30 pt-2">
          <div className="flex justify-between items-center">
            <span>↑↓=HISTORY</span>
            <span>PGUP/PGDN=SCROLL</span>
            <span>MEM:640K</span>
            <span>TURN:{gameState?.turnCount || 0}</span>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        @keyframes flicker {
          0%, 100% { opacity: 0.015; }
          50% { opacity: 0.025; }
        }
        .animate-flicker {
          animation: flicker 0.1s infinite;
        }
        .bg-gradient-radial {
          background: radial-gradient(ellipse at center, transparent 0%, transparent 60%, black 100%);
        }
        * {
          font-family: 'JetBrains Mono', 'IBM Plex Mono', 'Consolas', 'Courier New', monospace !important;
        }
        /* Disable all scrolling */
        html, body {
          overflow: hidden;
          height: 100%;
        }
      `}</style>
    </div>
  );
}
