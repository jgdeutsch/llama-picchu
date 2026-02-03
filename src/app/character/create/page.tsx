'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ClassInfo {
  id: number;
  name: string;
  description: string;
  role: string;
  primaryStat: string;
  secondaryStat: string;
}

interface Stats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

const STAT_NAMES: Record<keyof Stats, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

// Roll 4d6, drop lowest
function rollStat(): number {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  rolls.sort((a, b) => b - a);
  return rolls[0] + rolls[1] + rolls[2];
}

function rollAllStats(): Stats {
  return {
    str: rollStat(),
    dex: rollStat(),
    con: rollStat(),
    int: rollStat(),
    wis: rollStat(),
    cha: rollStat(),
  };
}

export default function CharacterCreatePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [name, setName] = useState('');
  const [stats, setStats] = useState<Stats>(rollAllStats);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'class' | 'stats' | 'name'>('class');

  useEffect(() => {
    const accountId = localStorage.getItem('accountId');
    if (!accountId) {
      router.push('/');
      return;
    }

    fetchClasses();
  }, [router]);

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/character/create');
      const data = await res.json();
      setClasses(data.classes);
    } catch {
      setError('Failed to load classes');
    }
  };

  const handleReroll = () => {
    setStats(rollAllStats());
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !name.trim()) return;

    setLoading(true);
    setError('');

    const accountId = localStorage.getItem('accountId');

    try {
      const res = await fetch('/api/character/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: parseInt(accountId || '0'),
          name: name.trim(),
          classId: selectedClass.id,
          stats,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create character');
        setLoading(false);
        return;
      }

      // Store token and navigate to game
      localStorage.setItem('gameToken', data.gameToken);
      router.push(`/game?token=${data.gameToken}`);
    } catch {
      setError('Connection failed');
    }
    setLoading(false);
  };

  const getStatColor = (value: number) => {
    if (value >= 16) return 'text-green-400';
    if (value >= 13) return 'text-amber-300';
    if (value >= 10) return 'text-amber-100';
    if (value >= 8) return 'text-orange-400';
    return 'text-red-400';
  };

  const totalStats = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-black text-amber-100 font-mono p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl text-amber-400 text-center mb-8">CREATE CHARACTER</h1>

        {/* Progress indicator */}
        <div className="flex justify-center gap-4 mb-8">
          {['class', 'stats', 'name'].map((s, i) => (
            <div
              key={s}
              className={`px-4 py-1 ${
                step === s
                  ? 'bg-amber-600 text-black'
                  : (step === 'stats' && s === 'class') || (step === 'name' && s !== 'name')
                  ? 'bg-amber-900 text-amber-400'
                  : 'bg-amber-900/30 text-amber-700'
              }`}
            >
              {i + 1}. {s.toUpperCase()}
            </div>
          ))}
        </div>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        {/* Step 1: Class Selection */}
        {step === 'class' && (
          <div>
            <p className="text-center text-amber-300 mb-6">
              Choose your path. Each class has unique abilities and playstyle.
            </p>

            <div className="grid gap-4">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => setSelectedClass(cls)}
                  className={`p-4 border cursor-pointer transition-colors ${
                    selectedClass?.id === cls.id
                      ? 'border-amber-500 bg-amber-900/50'
                      : 'border-amber-800 hover:border-amber-600'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-amber-400 font-bold">{cls.name}</h3>
                      <p className="text-amber-600 text-sm">{cls.role}</p>
                    </div>
                    <div className="text-right text-xs text-amber-600">
                      <p>Primary: {cls.primaryStat.toUpperCase()}</p>
                      <p>Secondary: {cls.secondaryStat.toUpperCase()}</p>
                    </div>
                  </div>
                  <p className="text-amber-300 text-sm mt-2">{cls.description}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-6">
              <Link
                href="/character/select"
                className="flex-1 bg-amber-900/50 hover:bg-amber-800/50 text-amber-300 py-3 px-6 font-bold text-center"
              >
                BACK
              </Link>
              <button
                onClick={() => setStep('stats')}
                disabled={!selectedClass}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-black py-3 px-6 font-bold disabled:opacity-50"
              >
                NEXT
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Stats */}
        {step === 'stats' && (
          <div>
            <p className="text-center text-amber-300 mb-6">
              Roll your attributes. Stats are generated using 4d6, dropping the lowest die.
            </p>

            <div className="border border-amber-800 p-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                {(Object.entries(stats) as [keyof Stats, number][]).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-amber-500">{STAT_NAMES[key]}:</span>
                    <span className={`font-bold text-xl ${getStatColor(value)}`}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-amber-800 mt-4 pt-4 flex justify-between">
                <span className="text-amber-600">Total:</span>
                <span className={`font-bold ${totalStats >= 72 ? 'text-green-400' : 'text-amber-300'}`}>
                  {totalStats}
                </span>
              </div>
            </div>

            {selectedClass && (
              <p className="text-amber-500 text-sm text-center mb-4">
                As a {selectedClass.name}, your primary stat is{' '}
                <span className="text-amber-400 font-bold">{selectedClass.primaryStat.toUpperCase()}</span>
                {' '}and secondary is{' '}
                <span className="text-amber-400 font-bold">{selectedClass.secondaryStat.toUpperCase()}</span>
              </p>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep('class')}
                className="flex-1 bg-amber-900/50 hover:bg-amber-800/50 text-amber-300 py-3 px-6 font-bold"
              >
                BACK
              </button>
              <button
                onClick={handleReroll}
                className="flex-1 bg-amber-800 hover:bg-amber-700 text-amber-100 py-3 px-6 font-bold"
              >
                REROLL
              </button>
              <button
                onClick={() => setStep('name')}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-black py-3 px-6 font-bold"
              >
                ACCEPT
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Name */}
        {step === 'name' && (
          <form onSubmit={handleCreate}>
            <p className="text-center text-amber-300 mb-6">
              Choose a name for your {selectedClass?.name}. Names must be 3-20 letters only.
            </p>

            <div className="mb-6">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                maxLength={20}
                className="w-full bg-black border border-amber-700 text-amber-100 p-4 text-xl text-center focus:border-amber-500 outline-none"
                placeholder="Enter name..."
                autoFocus
              />
              <p className="text-amber-600 text-xs text-center mt-2">
                {name.length}/20 characters
              </p>
            </div>

            {/* Summary */}
            <div className="border border-amber-800 p-4 mb-6">
              <h3 className="text-amber-400 text-center mb-2">CHARACTER SUMMARY</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-amber-600">Name:</span>
                <span className="text-amber-100">{name || '???'}</span>
                <span className="text-amber-600">Class:</span>
                <span className="text-amber-100">{selectedClass?.name}</span>
                <span className="text-amber-600">Role:</span>
                <span className="text-amber-100">{selectedClass?.role}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep('stats')}
                className="flex-1 bg-amber-900/50 hover:bg-amber-800/50 text-amber-300 py-3 px-6 font-bold"
              >
                BACK
              </button>
              <button
                type="submit"
                disabled={loading || name.length < 3}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-black py-3 px-6 font-bold disabled:opacity-50"
              >
                {loading ? 'CREATING...' : 'CREATE CHARACTER'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* CRT Effect */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]" />
    </div>
  );
}
