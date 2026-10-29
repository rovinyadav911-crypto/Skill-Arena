import React, { useState } from 'react';
import { AdminRecord } from '../types';

interface AdminLoginViewProps {
  admins: AdminRecord[];
  onLoginSuccess: (admin: AdminRecord) => void;
  onSwitchToUser: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  admins,
  onLoginSuccess,
  onSwitchToUser,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    const matchedAdmin = admins.find(
      (a) =>
        a.username.toLowerCase() === trimmedUsername.toLowerCase() &&
        a.password === password
    );

    if (!matchedAdmin) {
      setError('Invalid admin username or password.');
      return;
    }

    onLoginSuccess(matchedAdmin);
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col justify-between px-4 py-8">
      <div className="max-w-md w-full mx-auto flex items-center justify-end">
        <button
          type="button"
          onClick={onSwitchToUser}
          className="text-xs text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1.5 py-2"
        >
          <i className="fa-solid fa-arrow-left text-amber-400"></i>
          <span>Back to Player App</span>
        </button>
      </div>

      <div className="max-w-md w-full mx-auto my-auto py-6">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-amber-500/40 p-2 shadow-xl flex items-center justify-center mb-4">
            <img
              src="/assets/aistudio/skill-arena-icon_ca7b5100.svg"
              alt="Skill Arena Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="font-display font-extrabold text-2xl tracking-wider text-white">
            SKILL <span className="text-amber-400">ARENA</span> · ADMIN
          </h1>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-amber-500 mt-1">
            Play. Compete. Conquer.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl"
        >
          <div className="text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span>Administrator Control Panel</span>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-rose-400"></i>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Admin Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin username"
              autoComplete="off"
              className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Admin Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoComplete="new-password"
              className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[48px]"
          >
            <i className="fa-solid fa-lock-open text-xs"></i>
            <span>Login to Admin Dashboard</span>
          </button>
        </form>
      </div>

      <footer className="max-w-md w-full mx-auto text-center text-xs text-slate-500">
        Skill Arena Admin Portal · Official Email: admin.skillarena@gmail.com
      </footer>
    </div>
  );
};
