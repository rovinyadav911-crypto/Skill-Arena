import React, { useState } from 'react';
import {
  ParticipantRecord,
  TournamentRecord,
  TransactionRecord,
  UserRecord,
} from '../types';
import {
  createNotification,
  createOrUpdateUser,
  generateRecoveryKey,
  generateSafeId,
  getPrizeBreakdown,
} from '../services/dbService';

interface AdminUsersViewProps {
  users: UserRecord[];
  participants: ParticipantRecord[];
  tournaments: TournamentRecord[];
  transactions: TransactionRecord[];
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  users,
  participants,
  tournaments,
  transactions,
}) => {
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [resettingUser, setResettingUser] = useState<UserRecord | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleToggleBlock = async (user: UserRecord) => {
    setFeedback(null);
    await createOrUpdateUser({
      ...user,
      is_blocked: !user.is_blocked,
    });
    setFeedback(
      `User "${user.username}" has been ${
        !user.is_blocked ? 'blocked' : 'unblocked'
      }.`
    );
  };

  const handleAdminPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    const trimmed = adminNewPassword.trim();
    if (trimmed.length < 6) return;

    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const freshKey = generateRecoveryKey();

    await createOrUpdateUser({
      ...resettingUser,
      password: trimmed,
      recovery_key: freshKey,
      last_password_reset_at: nowStr,
    });

    await createNotification({
      id: generateSafeId('notif'),
      user_id: resettingUser.id,
      tournament_id: '',
      type: 'payment_update',
      title: 'Admin Account Recovery Completed',
      message: `Your account password was reset by Official Admin Support on ${nowStr} and a new Master Recovery Key (${freshKey}) was generated.`,
      is_read: false,
      created_at: nowStr,
    }).catch(() => {});

    setFeedback(
      `Password reset for @${resettingUser.username}! New Master Recovery Key issued: ${freshKey}`
    );
    setResettingUser(null);
    setAdminNewPassword('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-white">
          Registered Users ({users.length})
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Inspect player wallet balances, UPI IDs, match history, perform Admin Account Recovery, or block/unblock accounts.
        </p>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-700/60 text-emerald-200 text-xs flex items-center gap-2">
          <i className="fa-solid fa-circle-check text-emerald-400"></i>
          <span>{feedback}</span>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {users.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No registered players yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {users.map((u) => {
              const joinedCount = participants.filter(
                (p) => p.user_id === u.id
              ).length;
              return (
                <div
                  key={u.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-bold text-base text-white">
                        {u.username}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        · {u.email}
                      </span>
                      {u.recovery_key && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                          Key: {u.recovery_key}
                        </span>
                      )}
                      {u.is_blocked && (
                        <span className="text-xs font-mono font-semibold text-rose-400">
                          · BLOCKED
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                      Wallet:{' '}
                      <span className="text-emerald-400 font-bold">
                        ₹{u.wallet_balance.toLocaleString('en-IN')}
                      </span>{' '}
                      · UPI: {u.upi_id || 'Not set'} · Matches Joined:{' '}
                      {joinedCount}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setResettingUser(u);
                        setAdminNewPassword('');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-xs font-semibold text-amber-300 min-h-[40px] transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-key mr-1.5"></i>
                      Reset Password
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedUser(u)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white min-h-[40px] transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-clock-rotate-left text-amber-400 mr-1.5"></i>
                      Match History
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleBlock(u)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold min-h-[40px] transition-colors cursor-pointer ${
                        u.is_blocked
                          ? 'bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300'
                          : 'bg-rose-950/70 hover:bg-rose-900 border border-rose-800/60 text-rose-300'
                      }`}
                    >
                      <i
                        className={`fa-solid ${
                          u.is_blocked ? 'fa-unlock' : 'fa-ban'
                        } mr-1.5`}
                      ></i>
                      {u.is_blocked ? 'Unblock User' : 'Block User'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Password Reset / Account Recovery Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
                  ADMIN ACCOUNT RECOVERY
                </span>
                <h3 className="font-display font-bold text-lg text-white">
                  Reset Password for @{resettingUser.username}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResettingUser(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3 text-xs space-y-1 font-mono text-slate-300">
              <div>Email: {resettingUser.email}</div>
              <div>UPI ID: {resettingUser.upi_id || 'Not set'}</div>
              <div>
                Current Recovery Key:{' '}
                <span className="text-amber-400">
                  {resettingUser.recovery_key || 'Not generated'}
                </span>
              </div>
            </div>

            <form onSubmit={handleAdminPasswordReset} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Set New Password (min 6 characters)
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  maxLength={100}
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  placeholder="Enter new temporary password for user"
                  className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Save Password & Issue New Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Match History Modal for Selected User */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-white">
                  {selectedUser.username} — Match & Wallet History
                </h3>
                <p className="text-xs font-mono text-slate-400">
                  Balance: ₹{selectedUser.wallet_balance} · UPI:{' '}
                  {selectedUser.upi_id || 'None'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
                Joined Tournaments
              </h4>
              {participants.filter((p) => p.user_id === selectedUser.id)
                .length === 0 ? (
                <p className="text-xs text-slate-500">
                  No tournaments joined yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {participants
                    .filter((p) => p.user_id === selectedUser.id)
                    .map((p) => {
                      const t = tournaments.find(
                        (tour) => tour.id === p.tournament_id
                      );
                      const prizes = t
                        ? getPrizeBreakdown(t)
                        : { first: 0, second: 0, third: 0, total: 0 };
                      const won1st = t?.winner_id === selectedUser.id;
                      const won2nd = t?.winner_2nd_id === selectedUser.id;
                      const won3rd = t?.winner_3rd_id === selectedUser.id;
                      return (
                        <div
                          key={p.id}
                          className="py-2.5 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-semibold text-white">
                              {t ? t.title : p.tournament_id}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {t?.game_name} · Joined {p.created_at}
                            </div>
                          </div>
                          <div className="font-mono font-semibold">
                            {won1st ? (
                              <span className="text-amber-400">
                                1st Winner (+₹{prizes.first})
                              </span>
                            ) : won2nd ? (
                              <span className="text-slate-200">
                                2nd Place (+₹{prizes.second})
                              </span>
                            ) : won3rd ? (
                              <span className="text-amber-500">
                                3rd Place (+₹{prizes.third})
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                {t?.status || 'Participated'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
                Recent Wallet Transactions
              </h4>
              {transactions.filter((tx) => tx.user_id === selectedUser.id)
                .length === 0 ? (
                <p className="text-xs text-slate-500">No transactions found.</p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {transactions
                    .filter((tx) => tx.user_id === selectedUser.id)
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="py-2 flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-slate-300 truncate pr-2">
                          {tx.description}
                        </span>
                        <span
                          className={
                            tx.type === 'credit'
                              ? 'text-emerald-400 font-bold'
                              : 'text-rose-400 font-bold'
                          }
                        >
                          {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
