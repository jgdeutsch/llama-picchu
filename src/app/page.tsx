'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState,
  createInitialState,
  processCommand,
  getFallbackResponse,
  INTRO_TEXT,
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
               @@                        @@
              @@                          @@
`,
  goldenLlama: `
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║         *  . *       *    .  *   *   .    *  *           ║
    ║      .    *    ████████    *    .       *     .          ║
    ║   *    .      ██ ░░░░ ██      *    *  .    *             ║
    ║     *   .    ██ ░▓▓▓▓░ ██   .    *      .                ║
    ║  .    *     ██ ░▓████▓░ ██    .     *    .   *           ║
    ║    .   *    ██ ░▓▓▓▓░ ██   *    .     *                  ║
    ║  *    .      ████████████     .   *      .    *          ║
    ║     *   .       ██  ██     *    .    *      .            ║
    ║   .    *  ██████████████████    *     .   *              ║
    ║     *   ██                  ██    .    *     .           ║
    ║  .     ██  ████████████████  ██     *    .    *          ║
    ║    *  ██  ██              ██  ██  .     *                ║
    ║  .   ██  ██                ██  ██    .     *   .         ║
    ║     ████                    ████   *    .    *           ║
    ║                                                           ║
    ║            ★ THE GOLDEN LLAMA OF LEGEND ★                ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
`,
  questionWin: `
    ╭─────────────────────────────────────────╮
    │     ___                                 │
    │    /   \\    MASTER OF QUESTIONS!       │
    │   | ? ? |                               │
    │    \\___/    You have defeated the      │
    │      │      philosophical alpaca!       │
    │   ╭──┴──╮                               │
    │   │ ??? │   The ancient art of          │
    │   ╰─────╯   rhetorical combat           │
    │             is yours.                   │
    ╰─────────────────────────────────────────╯
`,
  secretDoor: `
    ┌─────────────────────────────────────────┐
    │  ╔═══════════════════════════════════╗  │
    │  ║ █████████████████████████████████ ║  │
    │  ║ █                               █ ║  │
    │  ║ █   ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄   █ ║  │
    │  ║ █   █ THE DOOR OPENS...     █   █ ║  │
    │  ║ █   █                       █   █ ║  │
    │  ║ █   █   A passage reveals   █   █ ║  │
    │  ║ █   █   itself to the east  █   █ ║  │
    │  ║ █   █                       █   █ ║  │
    │  ║ █   ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀   █ ║  │
    │  ║ █                               █ ║  │
    │  ║ █████████████████████████████████ ║  │
    │  ╚═══════════════════════════════════╝  │
    └─────────────────────────────────────────┘
`,
  boot: `
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ██╗     ██╗      █████╗ ███╗   ███╗ █████╗       ██████╗  ██████╗         ║
║   ██║     ██║     ██╔══██╗████╗ ████║██╔══██╗     ██╔═══██╗██╔════╝         ║
║   ██║     ██║     ███████║██╔████╔██║███████║     ██║   ██║╚█████╗          ║
║   ██║     ██║     ██╔══██║██║╚██╔╝██║██╔══██║     ██║   ██║ ╚═══██╗         ║
║   ███████╗███████╗██║  ██║██║ ╚═╝ ██║██║  ██║     ╚██████╔╝██████╔╝         ║
║   ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝      ╚═════╝ ╚═════╝          ║
║                                                                              ║
║              ███╗   ███╗ █████╗  ██████╗██╗  ██╗██╗   ██╗                    ║
║              ████╗ ████║██╔══██╗██╔════╝██║  ██║██║   ██║                    ║
║              ██╔████╔██║███████║██║     ███████║██║   ██║                    ║
║              ██║╚██╔╝██║██╔══██║██║     ██╔══██║██║   ██║                    ║
║              ██║ ╚═╝ ██║██║  ██║╚██████╗██║  ██║╚██████╔╝                    ║
║              ╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝                     ║
║                                                                              ║
║                   ██████╗ ██╗ ██████╗ ██████╗██╗  ██╗██╗   ██╗              ║
║                   ██╔══██╗██║██╔════╝██╔════╝██║  ██║██║   ██║              ║
║                   ██████╔╝██║██║     ██║     ███████║██║   ██║              ║
║                   ██╔═══╝ ██║██║     ██║     ██╔══██║██║   ██║              ║
║                   ██║     ██║╚██████╗╚██████╗██║  ██║╚██████╔╝              ║
║                   ╚═╝     ╚═╝ ╚═════╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝               ║
║                                                                              ║
║   ═══════════════════════════════════════════════════════════════════════   ║
║                   A Text Adventure in Uncertain Times                        ║
║                           INCAN ERA - 1450 CE                                ║
║   ═══════════════════════════════════════════════════════════════════════   ║
║                                                                              ║
║   SYSTEM READY...                                                            ║
║   LOADING CONSCIOUSNESS...                                                   ║
║   WOOL DENSITY: OPTIMAL                                                      ║
║   PHILOSOPHICAL CAPACITY: MAXIMUM                                            ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`,
};

interface OutputLine {
  id: number;
  type: 'system' | 'input' | 'output' | 'error' | 'ascii';
  text: string;
  isTyping?: boolean;
}

// Typewriter component for retro terminal effect
function TypewriterText({
  text,
  onComplete,
  speed = 8,
  className = ''
}: {
  text: string;
  onComplete?: () => void;
  speed?: number;
  className?: string;
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (isComplete) return;

    let index = 0;
    const timer = setInterval(() => {
      if (index < text.length) {
        // Add characters in small chunks for faster rendering
        const chunkSize = Math.min(3, text.length - index);
        setDisplayedText(text.slice(0, index + chunkSize));
        index += chunkSize;
      } else {
        clearInterval(timer);
        setIsComplete(true);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed, onComplete, isComplete]);

  // Allow clicking to skip animation
  const handleClick = () => {
    if (!isComplete) {
      setDisplayedText(text);
      setIsComplete(true);
      onComplete?.();
    }
  };

  return (
    <span onClick={handleClick} className={className}>
      {displayedText}
      {!isComplete && <span className="animate-pulse">▌</span>}
    </span>
  );
}

export default function Game() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lineCounter, setLineCounter] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  const [currentTypingId, setCurrentTypingId] = useState<number | null>(null);
  const [scanlineEnabled] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const addOutput = useCallback((text: string, type: OutputLine['type'] = 'output', skipTyping = false) => {
    setLineCounter(prev => {
      const newId = prev + 1;
      setOutput(current => [...current, {
        id: newId,
        type,
        text,
        isTyping: !skipTyping && type !== 'input' && type !== 'ascii'
      }]);
      if (!skipTyping && type !== 'input' && type !== 'ascii') {
        setCurrentTypingId(newId);
      }
      return newId;
    });
  }, []);

  const handleTypingComplete = useCallback((lineId: number) => {
    setOutput(current =>
      current.map(line =>
        line.id === lineId ? { ...line, isTyping: false } : line
      )
    );
    setCurrentTypingId(null);
  }, []);

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      // Show boot screen
      addOutput(ASCII_ART.boot, 'ascii', true);

      await new Promise(resolve => setTimeout(resolve, 2000));

      const initialState = createInitialState();
      setGameState(initialState);
      setIsBooting(false);

      // Clear boot screen and show intro
      setOutput([]);

      // Show llama ASCII art
      addOutput(ASCII_ART.llama, 'ascii', true);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Show intro
      addOutput(INTRO_TEXT, 'system');

      // Show initial room
      const room = initialState.rooms[initialState.player.location];
      const roomDesc = `
${room.name}
${'═'.repeat(room.name.length)}
${room.description}

You see: ${Object.keys(room.items).join(', ')}
Exits: north, east, south, west`;

      setTimeout(() => addOutput(roomDesc, 'output'), 100);
    };

    bootSequence();
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
    if (!input.trim() || !gameState || isLoading || currentTypingId) return;

    const userInput = input.trim();
    setInput('');

    // Show user input (no typing effect for user input)
    const prompt = gameState.questionGame.active ? 'Your question>' : '>';
    addOutput(`${prompt} ${userInput}`, 'input', true);

    // Process command
    const result = processCommand(gameState, userInput);

    // Check for achievements/ASCII art triggers
    let asciiToShow: string | null = null;

    // Check if door was just opened
    if (result.output?.includes('door recognizes these offerings')) {
      asciiToShow = ASCII_ART.secretDoor;
    }

    // Check if question game was won
    if (result.output?.includes("You've won this round")) {
      asciiToShow = ASCII_ART.questionWin;
    }

    // Check for victory (golden llama)
    if (result.output?.includes('VICTORY')) {
      asciiToShow = ASCII_ART.goldenLlama;
    }

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
      // Show ASCII art first if applicable
      if (asciiToShow) {
        addOutput(asciiToShow, 'ascii', true);
        setTimeout(() => addOutput(result.output, 'output'), 100);
      } else {
        addOutput(result.output);
      }
    }
  };

  const getLineColor = (type: OutputLine['type']) => {
    switch (type) {
      case 'system':
        return 'text-amber-500';
      case 'input':
        return 'text-green-400';
      case 'error':
        return 'text-red-500';
      case 'ascii':
        return 'text-amber-300';
      default:
        return 'text-amber-100';
    }
  };

  return (
    <div
      className="min-h-screen bg-black text-amber-100 font-mono p-0 flex flex-col relative overflow-hidden"
      onClick={focusInput}
    >
      {/* CRT Monitor effect - outer bezel */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Vignette effect */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black opacity-50" />

        {/* Scanlines */}
        {scanlineEnabled && (
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0, 0, 0, 0.3) 1px, rgba(0, 0, 0, 0.3) 2px)',
              backgroundSize: '100% 2px',
            }}
          />
        )}

        {/* Screen flicker */}
        <div className="absolute inset-0 animate-flicker opacity-[0.02] bg-amber-500 pointer-events-none" />

        {/* CRT curve effect (subtle) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 100px rgba(0,0,0,0.5), inset 0 0 200px rgba(0,0,0,0.3)',
          }}
        />
      </div>

      {/* Terminal content */}
      <div className="relative z-10 flex flex-col h-screen p-4 md:p-6">
        {/* Header */}
        <header className="text-center mb-4 border-b border-amber-700/50 pb-4">
          <div className="text-amber-500 text-xs mb-2 tracking-widest">
            ═══════════════════════════════════════════════════════════
          </div>
          <h1 className="text-xl md:text-2xl text-amber-400 font-bold tracking-[0.3em] uppercase">
            Llama at Machu Picchu
          </h1>
          <p className="text-amber-600/80 text-xs mt-1 tracking-wider">
            [ A Text Adventure in the Style of Rosencrantz & Guildenstern ]
          </p>
          <div className="text-amber-500 text-xs mt-2 tracking-widest">
            ═══════════════════════════════════════════════════════════
          </div>
        </header>

        {/* Game output - terminal screen */}
        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto mb-4 space-y-1 max-h-[calc(100vh-280px)] pr-2 scrollbar-thin scrollbar-thumb-amber-700/50 scrollbar-track-transparent"
          style={{
            textShadow: '0 0 5px rgba(251, 191, 36, 0.5), 0 0 10px rgba(251, 191, 36, 0.2)',
          }}
        >
          {output.map((line) => (
            <div
              key={line.id}
              className={`whitespace-pre-wrap leading-relaxed ${getLineColor(line.type)} ${
                line.type === 'ascii' ? 'text-[10px] md:text-xs leading-none' : 'text-sm md:text-base'
              }`}
            >
              {line.isTyping && currentTypingId === line.id ? (
                <TypewriterText
                  text={line.text}
                  onComplete={() => handleTypingComplete(line.id)}
                  speed={5}
                />
              ) : (
                line.text
              )}
            </div>
          ))}
          {isLoading && (
            <div className="text-amber-600 animate-pulse flex items-center gap-2">
              <span className="inline-block animate-spin">◐</span>
              <span>PROCESSING...</span>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-amber-700/50 pt-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <span className="text-green-400 font-bold">
              {gameState?.questionGame.active ? '??>' : 'C:\\>'}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              disabled={isLoading || isBooting || currentTypingId !== null}
              className="flex-1 bg-transparent border-none outline-none text-green-400 placeholder-amber-700/50 uppercase tracking-wider caret-green-400"
              placeholder={isLoading ? 'PROCESSING...' : currentTypingId ? '' : 'ENTER COMMAND...'}
              autoFocus
              autoComplete="off"
              spellCheck="false"
              style={{
                textShadow: '0 0 5px rgba(74, 222, 128, 0.5)',
              }}
            />
            <span className="text-green-400 animate-pulse">▌</span>
          </form>
        </div>

        {/* Quick commands */}
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          <span className="text-amber-600/60 mr-1">[F1-F8]:</span>
          {['LOOK', 'INV', 'HELP', 'THINK', 'N', 'S', 'E', 'W'].map((cmd, i) => (
            <button
              key={cmd}
              onClick={() => {
                setInput(cmd);
                inputRef.current?.focus();
              }}
              className="px-2 py-0.5 bg-amber-900/30 hover:bg-amber-800/50 text-amber-500 border border-amber-700/30 hover:border-amber-500/50 transition-all uppercase tracking-wider text-[10px]"
              style={{
                textShadow: '0 0 3px rgba(251, 191, 36, 0.3)',
              }}
            >
              F{i + 1}:{cmd}
            </button>
          ))}
        </div>

        {/* Footer / Status bar */}
        <footer className="mt-3 text-center text-amber-700/60 text-[10px] border-t border-amber-800/30 pt-3 tracking-wider">
          <div className="flex justify-between items-center">
            <span>MEM: 640K OK</span>
            <span>LLAMA OS v1.0</span>
            <span>TURN: {gameState?.turnCount || 0}</span>
          </div>
        </footer>
      </div>

      {/* Styles for animations */}
      <style jsx global>{`
        @keyframes flicker {
          0%, 100% { opacity: 0.02; }
          50% { opacity: 0.04; }
        }
        .animate-flicker {
          animation: flicker 0.15s infinite;
        }

        /* Custom scrollbar */
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(251, 191, 36, 0.3);
          border-radius: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(251, 191, 36, 0.5);
        }

        /* Radial gradient for vignette */
        .bg-gradient-radial {
          background: radial-gradient(ellipse at center, var(--tw-gradient-from) 0%, var(--tw-gradient-via) 50%, var(--tw-gradient-to) 100%);
        }

        /* Ensure monospace font */
        * {
          font-family: 'JetBrains Mono', 'IBM Plex Mono', 'Courier New', monospace !important;
        }
      `}</style>
    </div>
  );
}
