'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'menu' | 'login' | 'register'>('menu');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Store account info
      localStorage.setItem('accountId', String(data.accountId));
      localStorage.setItem('username', username);

      // Navigate to character select
      router.push('/character/select');
    } catch {
      setError('Connection failed');
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Auto-login after registration
      localStorage.setItem('accountId', String(data.accountId));
      localStorage.setItem('username', username);
      router.push('/character/create');
    } catch {
      setError('Connection failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-amber-100 font-mono flex flex-col items-center justify-center p-4">
      {/* ASCII Title */}
      <pre className="text-amber-400 text-xs md:text-sm mb-8 text-center">
{`
    ██╗     ██╗      █████╗ ███╗   ███╗ █████╗
    ██║     ██║     ██╔══██╗████╗ ████║██╔══██╗
    ██║     ██║     ███████║██╔████╔██║███████║
    ██║     ██║     ██╔══██║██║╚██╔╝██║██╔══██║
    ███████╗███████╗██║  ██║██║ ╚═╝ ██║██║  ██║
    ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝

    ╔═══════════════════════════════════════╗
    ║        PICCHU MUD                     ║
    ║   Multi-User Dungeon Adventure        ║
    ╚═══════════════════════════════════════╝
`}
      </pre>

      {mode === 'menu' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-amber-300 text-center max-w-lg mb-4">
            Welcome to Llama Picchu, a DikuMUD-style adventure set in the ancient Incan citadel.
            Play as a llama, choose your class, and explore the mystical ruins with other players!
          </p>

          <div className="flex flex-col gap-3 w-64">
            <button
              onClick={() => setMode('login')}
              className="bg-amber-600 hover:bg-amber-500 text-black py-3 px-6 font-bold transition-colors"
            >
              LOGIN
            </button>
            <button
              onClick={() => setMode('register')}
              className="bg-amber-800 hover:bg-amber-700 text-amber-100 py-3 px-6 font-bold transition-colors"
            >
              CREATE ACCOUNT
            </button>
            <Link
              href="/singleplayer"
              className="bg-amber-900/50 hover:bg-amber-800/50 text-amber-300 py-3 px-6 font-bold text-center transition-colors mt-4"
            >
              SINGLE PLAYER MODE
            </Link>
          </div>

          <p className="text-amber-600 text-xs mt-8">
            Incan Era - 1450 CE
          </p>
        </div>
      )}

      {mode === 'login' && (
        <div className="w-full max-w-sm">
          <h2 className="text-xl text-amber-400 mb-6 text-center">LOGIN</h2>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-amber-500 text-sm block mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black border border-amber-700 text-amber-100 p-2 focus:border-amber-500 outline-none"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="text-amber-500 text-sm block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-amber-700 text-amber-100 p-2 focus:border-amber-500 outline-none"
                required
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-500 text-black py-3 px-6 font-bold transition-colors disabled:opacity-50"
            >
              {loading ? 'CONNECTING...' : 'LOGIN'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('menu'); setError(''); }}
              className="text-amber-600 hover:text-amber-500 text-sm"
            >
              ← Back to Menu
            </button>
          </form>
        </div>
      )}

      {mode === 'register' && (
        <div className="w-full max-w-sm">
          <h2 className="text-xl text-amber-400 mb-6 text-center">CREATE ACCOUNT</h2>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div>
              <label className="text-amber-500 text-sm block mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black border border-amber-700 text-amber-100 p-2 focus:border-amber-500 outline-none"
                autoFocus
                required
                minLength={3}
                maxLength={20}
              />
            </div>

            <div>
              <label className="text-amber-500 text-sm block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-amber-700 text-amber-100 p-2 focus:border-amber-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="text-amber-500 text-sm block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-amber-700 text-amber-100 p-2 focus:border-amber-500 outline-none"
                required
                minLength={6}
              />
              <span className="text-amber-700 text-xs">Minimum 6 characters</span>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-500 text-black py-3 px-6 font-bold transition-colors disabled:opacity-50"
            >
              {loading ? 'CREATING...' : 'CREATE ACCOUNT'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('menu'); setError(''); }}
              className="text-amber-600 hover:text-amber-500 text-sm"
            >
              ← Back to Menu
            </button>
          </form>
        </div>
      )}

      {/* CRT Effect */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]" />
    </div>
  );
}
