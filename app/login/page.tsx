'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stethoscope, Lock, User, ArrowRight, Activity } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        router.push('/');
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-400 via-blue-500 to-indigo-600 flex items-center justify-center p-4 relative overflow-hidden">

      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30vw] h-[30vw] bg-teal-300/20 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Medical Icon Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5">
        {[
          { t: 12, l: 45, s: 2.1, r: 30, d: 4 },
          { t: 78, l: 23, s: 1.5, r: 120, d: 5.5 },
          { t: 34, l: 67, s: 2.8, r: 200, d: 3.2 },
          { t: 56, l: 89, s: 1.2, r: 310, d: 6 },
          { t: 91, l: 12, s: 2.5, r: 45, d: 4.8 },
          { t: 5, l: 78, s: 1.8, r: 170, d: 3.5 },
          { t: 67, l: 34, s: 2.3, r: 260, d: 7 },
          { t: 23, l: 56, s: 1.4, r: 90, d: 5 },
          { t: 45, l: 11, s: 2.9, r: 340, d: 3.8 },
          { t: 82, l: 91, s: 1.7, r: 150, d: 6.5 },
          { t: 15, l: 38, s: 2.6, r: 210, d: 4.3 },
          { t: 60, l: 72, s: 1.3, r: 280, d: 5.2 },
          { t: 38, l: 5, s: 2.0, r: 60, d: 7.5 },
          { t: 88, l: 55, s: 1.6, r: 135, d: 3.9 },
          { t: 50, l: 82, s: 2.4, r: 225, d: 4.6 },
          { t: 8, l: 19, s: 1.9, r: 300, d: 6.2 },
          { t: 73, l: 48, s: 2.7, r: 15, d: 5.8 },
          { t: 28, l: 95, s: 1.1, r: 180, d: 3.3 },
          { t: 95, l: 62, s: 2.2, r: 75, d: 7.2 },
          { t: 42, l: 28, s: 1.5, r: 245, d: 4.1 },
        ].map((pos, i) => (
          <Activity
            key={i}
            className="absolute text-white animate-pulse"
            style={{
              top: `${pos.t}%`,
              left: `${pos.l}%`,
              transform: `scale(${pos.s}) rotate(${pos.r}deg)`,
              animationDuration: `${pos.d}s`
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 border border-white/40">
        <div className="p-10">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-tr from-teal-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <Stethoscope className="w-10 h-10 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-center text-slate-800 mb-2 tracking-tight">
            Farhad Medicos
          </h1>
          <p className="text-center text-slate-500 font-medium mb-8">
            Secure Medical Admin Access
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50/80 border border-red-200 text-red-600 rounded-xl text-sm font-semibold text-center backdrop-blur-sm">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 ml-1">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-900 caret-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all shadow-sm"
                  placeholder="Enter admin username"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-900 caret-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all shadow-sm"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-2xl text-white font-bold text-lg bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transform hover:-translate-y-0.5 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? (
                'Authenticating...'
              ) : (
                <>
                  Secure Login <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="bg-slate-50 border-t border-slate-100 p-6 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Authorized Personnel Only. <br />
            Powered by Next.js & MongoDB
          </p>
        </div>
      </div>
    </div>
  );
}
