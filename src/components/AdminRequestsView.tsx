import React, { useState } from 'react';
import {
  DepositRecord,
  TransactionRecord,
  UserRecord,
  WithdrawalRecord,
} from '../types';
import {
  createNotification,
  createOrUpdateUser,
  createTransaction,
  generateSafeId,
  saveDeposit,
  saveWithdrawal,
} from '../services/dbService';

interface AdminRequestsViewProps {
  mode: 'deposits' | 'withdrawals';
  deposits: DepositRecord[];
  withdrawals: WithdrawalRecord[];
  users: UserRecord[];
}

export const AdminRequestsView: React.FC<AdminRequestsViewProps> = ({
  mode,
  deposits,
  withdrawals,
  users,
}) => {
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [previewDepositScreenshot, setPreviewDepositScreenshot] =
    useState<DepositRecord | null>(null);

  const getComment = (id: string) => (comments[id] || '').trim();

  const handleCommentChange = (id: string, value: string) => {
    setComments((prev) => ({ ...prev, [id]: value }));
  };

  const handleApproveDeposit = async (dep: DepositRecord) => {
    if (dep.status !== 'Pending') return;
    setFeedback(null);
    setProcessingId(dep.id);

    try {
      const targetUser = users.find((u) => u.id === dep.user_id);
      if (!targetUser) {
        setFeedback({
          type: 'error',
          message: 'User account not found for this deposit request.',
        });
        return;
      }

      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const adminNote = getComment(dep.id);
      const commentSuffix = adminNote ? ` — Note: ${adminNote}` : '';

      // 1. Add requested amount to user's wallet_balance
      await createOrUpdateUser({
        ...targetUser,
        wallet_balance: targetUser.wallet_balance + dep.amount,
      });

      // 2. Create credit entry in transactions table
      const tx: TransactionRecord = {
        id: generateSafeId('tx'),
        user_id: targetUser.id,
        username: targetUser.username,
        amount: dep.amount,
        type: 'credit',
        description: `UPI Deposit Approved (Screenshot Verified)${commentSuffix}`,
        created_at: nowStr,
      };
      await createTransaction(tx);

      // 3. Mark deposit request status as 'Completed' with admin_comment
      await saveDeposit({
        ...dep,
        status: 'Completed',
        admin_comment: adminNote,
      });

      // 4. Send in-app notification to user
      await createNotification({
        id: generateSafeId('notif'),
        user_id: targetUser.id,
        tournament_id: '',
        type: 'payment_update',
        title: `Deposit Approved (+₹${dep.amount})`,
        message: `Your UPI deposit of ₹${dep.amount} has been approved after screenshot verification and credited to your wallet.${
          adminNote ? ` Admin Comment: "${adminNote}"` : ''
        }`,
        is_read: false,
        created_at: nowStr,
      });

      setFeedback({
        type: 'success',
        message: `Approved ₹${dep.amount} deposit for ${dep.username}! Wallet credited and player notified.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to approve deposit request.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectDeposit = async (dep: DepositRecord) => {
    if (dep.status !== 'Pending') return;
    setFeedback(null);
    setProcessingId(dep.id);
    try {
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const adminNote = getComment(dep.id);

      await saveDeposit({
        ...dep,
        status: 'Rejected',
        admin_comment: adminNote,
      });

      await createNotification({
        id: generateSafeId('notif'),
        user_id: dep.user_id,
        tournament_id: '',
        type: 'payment_update',
        title: `Deposit Request Rejected (₹${dep.amount})`,
        message: `Your UPI deposit request of ₹${dep.amount} was rejected.${
          adminNote ? ` Admin Comment: "${adminNote}"` : ''
        }`,
        is_read: false,
        created_at: nowStr,
      });

      setFeedback({
        type: 'success',
        message: `Deposit request of ₹${dep.amount} for ${dep.username} marked as 'Rejected' and player notified.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to reject deposit request.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteWithdrawal = async (wit: WithdrawalRecord) => {
    if (wit.status !== 'Pending') return;
    setFeedback(null);
    setProcessingId(wit.id);

    try {
      const targetUser = users.find((u) => u.id === wit.user_id);
      if (!targetUser) {
        setFeedback({
          type: 'error',
          message: 'User account not found for this withdrawal request.',
        });
        return;
      }

      if (targetUser.wallet_balance < wit.amount) {
        setFeedback({
          type: 'error',
          message: `User ${targetUser.username} only has ₹${targetUser.wallet_balance} in wallet (requested ₹${wit.amount}).`,
        });
        return;
      }

      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const adminNote = getComment(wit.id);
      const commentSuffix = adminNote ? ` — Note: ${adminNote}` : '';

      // 1. Deduct amount from user's wallet_balance
      await createOrUpdateUser({
        ...targetUser,
        wallet_balance: targetUser.wallet_balance - wit.amount,
      });

      // 2. Create a 'debit' entry in the user's transactions table
      const tx: TransactionRecord = {
        id: generateSafeId('tx'),
        user_id: targetUser.id,
        username: targetUser.username,
        amount: wit.amount,
        type: 'debit',
        description: `UPI Withdrawal Completed to ${wit.upi_id}${commentSuffix}`,
        created_at: nowStr,
      };
      await createTransaction(tx);

      // 3. Mark withdrawal request as 'Completed' with admin_comment
      await saveWithdrawal({
        ...wit,
        status: 'Completed',
        admin_comment: adminNote,
      });

      // 4. Send in-app notification to user
      await createNotification({
        id: generateSafeId('notif'),
        user_id: targetUser.id,
        tournament_id: '',
        type: 'payment_update',
        title: `Withdrawal Completed (₹${wit.amount})`,
        message: `Your withdrawal of ₹${wit.amount} to UPI ID ${wit.upi_id} has been processed and completed.${
          adminNote ? ` Admin Comment: "${adminNote}"` : ''
        }`,
        is_read: false,
        created_at: nowStr,
      });

      setFeedback({
        type: 'success',
        message: `Withdrawal of ₹${wit.amount} to ${wit.upi_id} marked 'Completed' and player notified!`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to complete withdrawal request.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectWithdrawal = async (wit: WithdrawalRecord) => {
    if (wit.status !== 'Pending') return;
    setFeedback(null);
    setProcessingId(wit.id);
    try {
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const adminNote = getComment(wit.id);

      await saveWithdrawal({
        ...wit,
        status: 'Rejected',
        admin_comment: adminNote,
      });

      await createNotification({
        id: generateSafeId('notif'),
        user_id: wit.user_id,
        tournament_id: '',
        type: 'payment_update',
        title: `Withdrawal Request Rejected (₹${wit.amount})`,
        message: `Your withdrawal request of ₹${wit.amount} to ${wit.upi_id} was rejected.${
          adminNote ? ` Admin Comment: "${adminNote}"` : ''
        }`,
        is_read: false,
        created_at: nowStr,
      });

      setFeedback({
        type: 'success',
        message: `Withdrawal request for ${wit.username} marked as 'Rejected' and player notified.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to reject withdrawal request.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const sortedDeposits = [...deposits].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  const sortedWithdrawals = [...withdrawals].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold tracking-widest uppercase text-amber-400">
          {mode === 'deposits'
            ? 'MANUAL UPI DEPOSIT SCREENSHOT VERIFICATION'
            : 'MANUAL UPI WITHDRAWAL PAYOUTS'}
        </div>
        <h1 className="font-display font-bold text-2xl text-white">
          {mode === 'deposits' ? 'Deposit Requests' : 'Withdrawal Requests'}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          {mode === 'deposits'
            ? 'Inspect the attached UPI payment screenshot, add an optional comment, and click Approve or Reject.'
            : 'Send the requested amount to the player UPI ID, add a transaction note or comment, and mark Completed or Reject.'}
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-700/70 text-emerald-200'
              : 'bg-rose-950/70 border-rose-700/70 text-rose-200'
          }`}
        >
          <i
            className={`fa-solid ${
              feedback.type === 'success'
                ? 'fa-circle-check text-emerald-400'
                : 'fa-circle-exclamation text-rose-400'
            } text-base`}
          ></i>
          <span>{feedback.message}</span>
        </div>
      )}

      {mode === 'deposits' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {sortedDeposits.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No UPI deposit requests found.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {sortedDeposits.map((dep) => (
                <div
                  key={dep.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Screenshot Thumbnail */}
                    {dep.screenshot_url ? (
                      <button
                        type="button"
                        onClick={() => setPreviewDepositScreenshot(dep)}
                        className="w-16 h-16 rounded-xl overflow-hidden border border-amber-500/40 bg-[#0B0F17] shrink-0 relative group"
                        title="Click to inspect full payment screenshot"
                      >
                        <img
                          src={dep.screenshot_url}
                          alt={`Payment Screenshot by ${dep.username}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <i className="fa-solid fa-magnifying-glass-plus text-white text-xs"></i>
                        </span>
                      </button>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-[#0B0F17] border border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                        <i className="fa-regular fa-image text-lg"></i>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-display font-bold text-base text-white">
                          {dep.username}
                        </span>
                        <span>·</span>
                        <span className="font-mono font-bold text-amber-400 text-sm tabular-nums">
                          ₹{dep.amount.toLocaleString('en-IN')}
                        </span>
                        <span>·</span>
                        <span
                          className={`font-mono font-semibold ${
                            dep.status === 'Completed'
                              ? 'text-emerald-400'
                              : dep.status === 'Rejected'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {dep.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {dep.screenshot_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewDepositScreenshot(dep)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold text-[11px] transition-colors"
                          >
                            <i className="fa-solid fa-image"></i>
                            <span>View Payment Screenshot</span>
                          </button>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px]">
                            No screenshot attached
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-slate-500">
                          Requested at {dep.created_at}
                        </span>
                      </div>

                      {dep.admin_comment && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0B0F17] border border-slate-800 text-xs text-slate-300">
                          <i className="fa-regular fa-comment-dots text-amber-400"></i>
                          <span>
                            Admin Comment:{' '}
                            <strong className="text-white">
                              {dep.admin_comment}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {dep.status === 'Pending' && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full lg:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <i className="fa-regular fa-comment-dots absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                        <input
                          type="text"
                          maxLength={200}
                          value={comments[dep.id] || ''}
                          onChange={(e) =>
                            handleCommentChange(dep.id, e.target.value)
                          }
                          placeholder="Add approval / rejection comment..."
                          className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl pl-8 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={processingId === dep.id}
                          onClick={() => handleApproveDeposit(dep)}
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs min-h-[40px] transition-colors whitespace-nowrap"
                        >
                          <i className="fa-solid fa-check mr-1.5"></i>
                          Approve (+₹{dep.amount})
                        </button>
                        <button
                          type="button"
                          disabled={processingId === dep.id}
                          onClick={() => handleRejectDeposit(dep)}
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800/60 text-rose-200 font-semibold text-xs min-h-[40px] transition-colors whitespace-nowrap"
                        >
                          <i className="fa-solid fa-xmark mr-1.5"></i>
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {sortedWithdrawals.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No UPI withdrawal requests found.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {sortedWithdrawals.map((wit) => (
                <div
                  key={wit.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-display font-bold text-base text-white">
                        {wit.username}
                      </span>
                      <span>·</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm tabular-nums">
                        ₹{wit.amount.toLocaleString('en-IN')}
                      </span>
                      <span>·</span>
                      <span
                        className={`font-mono font-semibold ${
                          wit.status === 'Completed'
                            ? 'text-emerald-400'
                            : wit.status === 'Rejected'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {wit.status}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-300">
                      Player Payout UPI ID:{' '}
                      <span className="text-amber-400 font-bold select-all">
                        {wit.upi_id}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Requested at {wit.created_at}
                    </div>
                    {wit.admin_comment && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0B0F17] border border-slate-800 text-xs text-slate-300">
                        <i className="fa-regular fa-comment-dots text-amber-400"></i>
                        <span>
                          Admin Comment:{' '}
                          <strong className="text-white">
                            {wit.admin_comment}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {wit.status === 'Pending' && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full lg:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <i className="fa-regular fa-comment-dots absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                        <input
                          type="text"
                          maxLength={200}
                          value={comments[wit.id] || ''}
                          onChange={(e) =>
                            handleCommentChange(wit.id, e.target.value)
                          }
                          placeholder="Add payout UTR / rejection comment..."
                          className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl pl-8 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={processingId === wit.id}
                          onClick={() => handleCompleteWithdrawal(wit)}
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs min-h-[40px] transition-colors whitespace-nowrap"
                        >
                          <i className="fa-solid fa-check-double mr-1.5"></i>
                          Mark Completed
                        </button>
                        <button
                          type="button"
                          disabled={processingId === wit.id}
                          onClick={() => handleRejectWithdrawal(wit)}
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800/60 text-rose-200 font-semibold text-xs min-h-[40px] transition-colors whitespace-nowrap"
                        >
                          <i className="fa-solid fa-xmark mr-1.5"></i>
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin Full Payment Screenshot Verification Modal */}
      {previewDepositScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewDepositScreenshot(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-white">
                  Payment Screenshot — {previewDepositScreenshot.username}
                </h3>
                <p className="text-xs font-mono text-amber-400">
                  Amount: ₹{previewDepositScreenshot.amount} ·{' '}
                  {previewDepositScreenshot.created_at}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDepositScreenshot(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl p-2 flex items-center justify-center max-h-[70vh] overflow-auto">
              {previewDepositScreenshot.screenshot_url ? (
                <img
                  src={previewDepositScreenshot.screenshot_url}
                  alt="Player Payment Screenshot"
                  className="max-h-[65vh] w-auto object-contain rounded-xl"
                />
              ) : (
                <div className="py-12 text-xs text-slate-500">
                  No screenshot available.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
