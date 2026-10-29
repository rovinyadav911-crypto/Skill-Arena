import React from 'react';
import { AdminRecord, AdminRoute } from '../types';

interface AdminLayoutProps {
  admin: AdminRecord;
  activeRoute: AdminRoute;
  pendingDepositsCount: number;
  pendingWithdrawalsCount: number;
  onNavigate: (route: AdminRoute) => void;
  onLogout: () => void;
  onSwitchToUser: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  admin,
  activeRoute,
  pendingDepositsCount,
  pendingWithdrawalsCount,
  onNavigate,
  onLogout,
  onSwitchToUser,
  children,
}) => {
  const navItems: { route: AdminRoute; label: string; icon: string; count?: number }[] = [
    { route: 'admin_dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
    { route: 'admin_tournaments', label: 'Tournaments', icon: 'fa-gamepad' },
    {
      route: 'admin_deposits',
      label: 'Deposits',
      icon: 'fa-arrow-down-to-bracket',
      count: pendingDepositsCount,
    },
    {
      route: 'admin_withdrawals',
      label: 'Withdrawals',
      icon: 'fa-money-bill-transfer',
      count: pendingWithdrawalsCount,
    },
    { route: 'admin_users', label: 'Users', icon: 'fa-users' },
    { route: 'admin_settings', label: 'Settings & UPI', icon: 'fa-sliders' },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col pb-20 lg:pb-8">
      {/* admin/common/header.php */}
      <header className="sticky top-0 z-30 h-16 bg-[#0B0F17]/95 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onNavigate('admin_dashboard')}
          className="flex items-center gap-3 text-left focus:outline-none shrink-0"
        >
          <img
            src="/assets/aistudio/skill-arena-icon_ca7b5100.svg"
            alt="Skill Arena Logo"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl object-contain border border-amber-500/40"
          />
          <div>
            <div className="font-display font-extrabold text-lg tracking-wider text-white leading-none">
              SKILL <span className="text-amber-400">ARENA</span>{' '}
              <span className="text-xs font-mono font-normal text-slate-400 ml-1">
                · ADMIN
              </span>
            </div>
            <p className="text-[10px] font-medium tracking-widest uppercase text-amber-500/90 mt-0.5">
              Play. Compete. Conquer.
            </p>
          </div>
        </button>

        {/* Desktop Admin Nav Links */}
        <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-400">
          {navItems.map((item) => (
            <button
              key={item.route}
              type="button"
              onClick={() => onNavigate(item.route)}
              className={`hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 py-1 ${
                activeRoute === item.route ||
                (item.route === 'admin_tournaments' &&
                  activeRoute === 'admin_manage_tournament')
                  ? 'text-amber-400 font-semibold border-b-2 border-amber-400'
                  : ''
              }`}
            >
              <i className={`fa-solid ${item.icon} text-xs`}></i>
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span className="font-mono text-xs text-amber-400 font-bold tabular-nums">
                  ({item.count})
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">

          <button
            type="button"
            onClick={onSwitchToUser}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 min-h-[40px] whitespace-nowrap"
          >
            <i className="fa-solid fa-mobile-screen text-emerald-400"></i>
            <span className="hidden sm:inline">User App</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800/50 text-xs font-medium text-rose-200 transition-colors flex items-center gap-1.5 min-h-[40px] whitespace-nowrap"
            title={`Logged in as ${admin.username}`}
          >
            <i className="fa-solid fa-right-from-bracket"></i>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 lg:px-8">
        {children}
      </main>

      {/* admin/common/bottom.php: Mobile Bottom Bar for Admin */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#0B0F17]/95 backdrop-blur-md border-t border-slate-800/90 grid grid-cols-6 items-center">
        {navItems.map((item) => {
          const isActive =
            activeRoute === item.route ||
            (item.route === 'admin_tournaments' &&
              activeRoute === 'admin_manage_tournament');
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => onNavigate(item.route)}
              className={`flex flex-col items-center justify-center h-full transition-colors relative ${
                isActive ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className={`fa-solid ${item.icon} text-base`}></i>
              <span className="text-[10px] font-medium tracking-tight mt-1 truncate max-w-[60px]">
                {item.label.split(' ')[0]}
              </span>
              {item.count !== undefined && item.count > 0 && (
                <span className="absolute top-1.5 right-3 text-[10px] font-mono font-bold text-amber-400">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
