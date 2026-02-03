'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Character {
  id: number;
  name: string;
  level: number;
  className: string;
  gold: number;
  lastLogin: string;
}

export default function CharacterSelectPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const accountId = localStorage.getItem('accountId');
    if (!accountId) {
      router.push('/');
      return;
    }

    fetchCharacters(accountId);
  }, [router]);

  const fetchCharacters = async (accountId: string) => {
    try {
      const res = await fetch(`/api/character/list?accountId=${accountId}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to fetch characters');
      } else {
        setCharacters(data.characters);
      }
    } catch {
      setError('Connection failed');
    }
    setLoading(false);
  };

  const handlePlay = async () => {
    if (!selectedId) return;

    setConnecting(true);
    const username = localStorage.getItem('username');

    try {
      // Get game token for selected character
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password: localStorage.getItem('tempPassword') || '',
          playerId: selectedId,
        }),
      });

      const data = await res.json();

      if (data.gameToken) {
        localStorage.setItem('gameToken', data.gameToken);
        router.push(`/game?token=${data.gameToken}`);
      } else {
        // If no password stored, need to re-login
        setError('Session expired. Please login again.');
        router.push('/');
      }
    } catch {
      setError('Connection failed');
    }
    setConnecting(false);
  };

  return (
    <div className="min-h-screen bg-black text-amber-100 font-mono flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl text-amber-400 mb-8">SELECT CHARACTER</h1>

      {loading && <p className="text-amber-600">Loading characters...</p>}

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {!loading && characters.length === 0 && (
        <div className="text-center">
          <p className="text-amber-300 mb-6">You have no characters yet.</p>
          <Link
            href="/character/create"
            className="bg-amber-600 hover:bg-amber-500 text-black py-3 px-6 font-bold"
          >
            CREATE YOUR FIRST CHARACTER
          </Link>
        </div>
      )}

      {!loading && characters.length > 0 && (
        <div className="w-full max-w-lg">
          <div className="border border-amber-800 mb-6">
            {characters.map((char) => (
              <div
                key={char.id}
                onClick={() => setSelectedId(char.id)}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedId === char.id
                    ? 'bg-amber-900/50 border-l-4 border-l-amber-500'
                    : 'hover:bg-amber-900/30'
                } ${characters.indexOf(char) !== characters.length - 1 ? 'border-b border-amber-800' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-amber-400 font-bold">{char.name}</h3>
                    <p className="text-amber-600 text-sm">
                      Level {char.level} {char.className}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-yellow-500">{char.gold} gold</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={handlePlay}
              disabled={!selectedId || connecting}
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-black py-3 px-6 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connecting ? 'CONNECTING...' : 'ENTER WORLD'}
            </button>

            <Link
              href="/character/create"
              className="bg-amber-800 hover:bg-amber-700 text-amber-100 py-3 px-6 font-bold text-center"
            >
              NEW CHARACTER
            </Link>
          </div>

          <Link
            href="/"
            className="block text-center text-amber-600 hover:text-amber-500 text-sm mt-6"
          >
            ← Back to Menu
          </Link>
        </div>
      )}

      {/* CRT Effect */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]" />
    </div>
  );
}
