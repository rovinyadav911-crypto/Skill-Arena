import React from 'react';
import {
  AdminRoute,
  DepositRecord,
  ParticipantRecord,
  TournamentRecord,
  UserRecord,
  WithdrawalRecord,
} from '../types';
import { getPrizeBreakdown } from '../services/dbService';

interface AdminDashboardViewProps {
  users: UserRecord[];
  tournaments: TournamentRecord[];
  participants: ParticipantRecord[];
  deposits: DepositRecord[];
  withdrawals: WithdrawalRecord[];
  onNavigate: (route: AdminRoute) => void;
  onManageTournament: (tournamentId: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  users,
  tournaments,
  participants,
  deposits,
  withdrawals,
  onNavigate,
  onManageTournament,
}) => {
  // Calculate stats as specified in admin/index.php:
  // Total Users, Total Tournaments, Total Prize Distributed, Total Revenue (Commission)
  const totalUsers = users.length;
  const totalTournaments = tournaments.length;

  const completedTournaments = tournaments.filter(
    (t) => t.status === 'Completed'
  );

  const totalPrizeDistributed = completedTournaments.reduce(
    (sum, t) => sum + (Number(t.prize_pool) || 0),
    0
  );

  const totalRevenueCommission = tournaments.reduce((sum, t) => {
    const joinedCount = participants.filter(
      (p) => p.tournament_id === t.id
    ).length;
    const grossEntry = joinedCount * (Number(t.entry_fee) || 0);
    const commissionRate = (Number(t.commission_percentage) || 0) / 100;
    return sum + Math.round(grossEntry * commissionRate);
  }, 0);

  const pendingDeposits = deposits.filter((d) => d.status === 'Pending');
  const pendingWithdrawals = withdrawals.filter((w) => w.status === 'Pending');

  return (
    <div className="space-y-6">
      {/* Top Banner + Quick-Action Button: "Create New Tournament" */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold tracking-widest uppercase text-amber-400">
            SKILL ARENA COMMAND CENTER
          </div>
          <h1 className="font-display font-bold text-2xl text-white mt-0.5">
            Admin Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor live tournament revenue, prize distributions, and pending UPI verifications.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('admin_tournaments')}
          className="px-5 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 min-h-[48px] transition-colors shrink-0 shadow-lg shadow-amber-500/10"
        >
          <i className="fa-solid fa-plus"></i>
          <span>Create New Tournament</span>
        </button>
      </div>

      {/* Quick Stats using Small Tailwind Grid Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Users</span>
            <i className="fa-solid fa-users text-amber-400"></i>
          </div>
          <div className="font-mono font-extrabold text-3xl text-white tabular-nums mt-2">
            {totalUsers.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Registered arena players
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Tournaments</span>
            <i className="fa-solid fa-trophy text-amber-400"></i>
          </div>
          <div className="font-mono font-extrabold text-3xl text-white tabular-nums mt-2">
            {totalTournaments.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {completedTournaments.length} Completed ·{' '}
            {totalTournaments - completedTournaments.length} Active
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Prize Distributed</span>
            <i className="fa-solid fa-award text-emerald-400"></i>
          </div>
          <div className="font-mono font-extrabold text-3xl text-emerald-400 tabular-nums mt-2">
            ₹{totalPrizeDistributed.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Credited to winners&apos; wallets
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Revenue (Commission)</span>
            <i className="fa-solid fa-indian-rupee-sign text-amber-400"></i>
          </div>
          <div className="font-mono font-extrabold text-3xl text-amber-400 tabular-nums mt-2">
            ₹{totalRevenueCommission.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Platform commission earned
          </div>
        </div>
      </div>

      {/* Pending UPI Action Queues & Active Tournament Quick Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* UPI Deposit & Withdrawal Action Center */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="font-display font-bold text-base text-white flex items-center justify-between">
            <span>
              <i className="fa-solid fa-bolt text-amber-400 mr-2"></i>
              UPI Verification Queue
            </span>
            <span className="text-xs font-mono text-slate-400">
              Manual UPI System
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onNavigate('admin_deposits')}
              className="bg-[#0B0F17] hover:bg-slate-800/70 border border-slate-800 rounded-xl p-4 text-left transition-colors flex items-center justify-between"
            >
              <div>
                <div className="text-xs text-slate-400">Deposit Requests</div>
                <div className="font-mono font-bold text-xl text-amber-400 mt-1 tabular-nums">
                  {pendingDeposits.length} Pending
                </div>
              </div>
              <i className="fa-solid fa-chevron-right text-slate-500"></i>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('admin_withdrawals')}
              className="bg-[#0B0F17] hover:bg-slate-800/70 border border-slate-800 rounded-xl p-4 text-left transition-colors flex items-center justify-between"
            >
              <div>
                <div className="text-xs text-slate-400">
                  Withdrawal Requests
                </div>
                <div className="font-mono font-bold text-xl text-emerald-400 mt-1 tabular-nums">
                  {pendingWithdrawals.length} Pending
                </div>
              </div>
              <i className="fa-solid fa-chevron-right text-slate-500"></i>
            </button>
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('admin_settings')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              <i className="fa-solid fa-qrcode text-amber-400 mr-1.5"></i>
              Configure Admin UPI & QR Code
            </button>
            <button
              type="button"
              onClick={() => onNavigate('admin_users')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              <i className="fa-solid fa-user-gear text-amber-400 mr-1.5"></i>
              Manage Registered Users
            </button>
          </div>
        </div>

        {/* Active Tournaments Quick List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-base text-white">
              <i className="fa-solid fa-gamepad text-amber-400 mr-2"></i>
              Recent Tournaments
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('admin_tournaments')}
              className="text-xs text-amber-400 hover:underline font-medium"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-800/80">
            {tournaments.slice(0, 4).map((t) => {
              const joinedCount = participants.filter(
                (p) => p.tournament_id === t.id
              ).length;
              const prizes = getPrizeBreakdown(t);
              return (
                <div
                  key={t.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-white truncate">
                      {t.title}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {t.game_name} · {joinedCount} Players · Pool ₹
                      {prizes.total} (1st: ₹{prizes.first} / 2nd: ₹
                      {prizes.second} / 3rd: ₹{prizes.third})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onManageTournament(t.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-xs font-semibold text-slate-200 transition-colors shrink-0"
                  >
                    Manage
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
