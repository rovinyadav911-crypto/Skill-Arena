import React, { useState } from 'react';
import {
  DepositRecord,
  SettingRecord,
  TransactionRecord,
  UserRecord,
  UserRoute,
  WithdrawalRecord,
} from '../types';
import {
  generateSafeId,
  getWalletBreakdown,
  saveDeposit,
  saveWithdrawal,
} from '../services/dbService';

interface UserWalletViewProps {
  user: UserRecord;
  settings: SettingRecord;
  transactions: TransactionRecord[];
  deposits: DepositRecord[];
  withdrawals: WithdrawalRecord[];
  onNavigate: (route: UserRoute) => void;
}

export const UserWalletView: React.FC<UserWalletViewProps> = ({
  user,
  settings,
  transactions,
  deposits,
  withdrawals,
  onNavigate,
}) => {
  const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | null>(
    null
  );
  const [depositAmount, setDepositAmount] = useState('100');
  const [depositScreenshotUrl, setDepositScreenshotUrl] = useState('');
  const [depositScreenshotName, setDepositScreenshotName] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [previewScreenshotUrl, setPreviewScreenshotUrl] = useState<
    string | null
  >(null);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const userTransactions = transactions
    .filter((t) => t.user_id === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const userDeposits = deposits
    .filter((d) => d.user_id === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const userWithdrawals = withdrawals
    .filter((w) => w.user_id === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const walletBreakdown = getWalletBreakdown(user, transactions, withdrawals);

  const handleScreenshotFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({
        type: 'error',
        message: 'Please select a valid image file (PNG, JPG, WEBP) for your payment screenshot.',
      });
      return;
    }

    setDepositScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) return;

      // Compress image on client side so it fits comfortably within Firestore document size limits
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.68);
          setDepositScreenshotUrl(compressed.slice(0, 490000));
        } else {
          setDepositScreenshotUrl(rawDataUrl.slice(0, 490000));
        }
      };
      img.onerror = () => {
        setDepositScreenshotUrl(rawDataUrl.slice(0, 490000));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const amountNum = Number(depositAmount);

    if (!amountNum || amountNum <= 0) {
      setFeedback({
        type: 'error',
        message: 'Please enter a valid deposit amount in ₹.',
      });
      return;
    }

    if (!depositScreenshotUrl) {
      setFeedback({
        type: 'error',
        message:
          'Please attach a screenshot of your UPI payment before submitting.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const newDeposit: DepositRecord = {
        id: generateSafeId('dep'),
        user_id: user.id,
        username: user.username,
        amount: amountNum,
        transaction_id: '',
        screenshot_url: depositScreenshotUrl,
        status: 'Pending',
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      };
      await saveDeposit(newDeposit);
      setDepositScreenshotUrl('');
      setDepositScreenshotName('');
      setActiveModal(null);
      setFeedback({
        type: 'success',
        message: `Deposit request of ₹${amountNum} with payment screenshot submitted with 'Pending' status! Admin will verify your screenshot and credit your wallet shortly.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to submit deposit request. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!user.upi_id) {
      setFeedback({
        type: 'error',
        message:
          'Please save your UPI ID in your Profile before requesting a withdrawal.',
      });
      return;
    }

    const amountNum = Number(withdrawAmount);
    if (!amountNum || amountNum <= 0) {
      setFeedback({
        type: 'error',
        message: 'Please enter a valid amount to withdraw.',
      });
      return;
    }

    if (amountNum < 50) {
      setFeedback({
        type: 'error',
        message: 'Minimum withdrawal amount is ₹50.',
      });
      return;
    }

    if (amountNum > walletBreakdown.withdrawable) {
      setFeedback({
        type: 'error',
        message: `Deposited amount cannot be withdrawn. Only winning amount can be withdrawn (Available Winning Balance: ₹${walletBreakdown.withdrawable}).`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const newWithdrawal: WithdrawalRecord = {
        id: generateSafeId('wit'),
        user_id: user.id,
        username: user.username,
        amount: amountNum,
        upi_id: user.upi_id,
        status: 'Pending',
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      };
      await saveWithdrawal(newWithdrawal);
      setWithdrawAmount('');
      setActiveModal(null);
      setFeedback({
        type: 'success',
        message: `Withdrawal request of ₹${amountNum} to ${user.upi_id} created with 'Pending' status! Payment will be reflected within 24 hr of request submission.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to submit withdrawal request. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Large Prominent Wallet Balance Card */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              SKILL ARENA TOTAL WALLET BALANCE
            </div>
            <div className="font-mono font-extrabold text-4xl sm:text-5xl text-white tabular-nums mt-2">
              ₹{user.wallet_balance.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-400 mt-2 flex items-center gap-2">
              <span>Saved Payout UPI ID:</span>
              {user.upi_id ? (
                <span className="font-mono text-emerald-400 font-semibold">
                  {user.upi_id}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate('profile')}
                  className="text-amber-400 underline font-medium"
                >
                  Not set (Click to add in Profile)
                </button>
              )}
            </div>
          </div>

          {/* Add Money & Withdraw Buttons */}
          <div className="grid grid-cols-2 sm:flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setActiveModal('deposit');
              }}
              className="px-5 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 min-h-[48px] transition-colors shadow-lg shadow-amber-500/10"
            >
              <i className="fa-solid fa-circle-plus"></i>
              <span>Add Money</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setActiveModal('withdraw');
              }}
              className="px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 min-h-[48px] transition-colors"
            >
              <i className="fa-solid fa-building-columns text-amber-400"></i>
              <span>Withdraw</span>
            </button>
          </div>
        </div>

        {/* Winning vs Deposited Balance Split & Withdrawal Policy Notice */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-800">
          <div className="bg-[#0B0F17] border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <i className="fa-solid fa-trophy"></i>
                <span>Winning Amount (Withdrawable)</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Can be withdrawn to UPI (Min ₹50)
              </div>
            </div>
            <div className="font-mono font-extrabold text-xl text-emerald-400 tabular-nums">
              ₹{walletBreakdown.withdrawable.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <i className="fa-solid fa-wallet"></i>
                <span>Deposited Amount (Play Only)</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Cannot be withdrawn · Use to join matches
              </div>
            </div>
            <div className="font-mono font-extrabold text-xl text-amber-400 tabular-nums">
              ₹{walletBreakdown.deposited.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-circle-info text-amber-400 shrink-0"></i>
            <span>
              <strong>Withdrawal Policy:</strong> Minimum withdrawal amount is ₹50. Deposited amount cannot be withdrawn — only winning amount can be withdrawn.
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
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

      {/* Pending / Recent UPI Requests & Transaction History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction History List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-display font-bold text-base text-white mb-4 flex items-center justify-between">
            <span>
              <i className="fa-solid fa-clock-rotate-left text-amber-400 mr-2"></i>
              Transaction History
            </span>
            <span className="text-xs font-mono font-normal text-slate-400">
              {userTransactions.length} entries
            </span>
          </h2>

          {userTransactions.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No wallet transactions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {userTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="py-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.type === 'credit'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                          : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                      }`}
                    >
                      <i
                        className={`fa-solid ${
                          tx.type === 'credit' ? 'fa-arrow-down' : 'fa-arrow-up'
                        } text-xs`}
                      ></i>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-medium text-white truncate">
                        {tx.description}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {tx.created_at} · {tx.type.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`font-mono font-bold text-sm tabular-nums shrink-0 ${
                      tx.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {tx.type === 'credit' ? '+' : '-'}₹
                    {tx.amount.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual UPI Deposit & Withdrawal Request Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
          <div>
            <h2 className="font-display font-bold text-base text-white mb-3 flex items-center justify-between">
              <span>
                <i className="fa-solid fa-qrcode text-amber-400 mr-2"></i>
                UPI Deposit Requests
              </span>
              <span className="text-xs font-mono font-normal text-slate-400">
                {userDeposits.length} requests
              </span>
            </h2>

            {userDeposits.length === 0 ? (
              <div className="py-4 text-xs text-slate-500">
                No manual UPI deposit requests submitted yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {userDeposits.map((dep) => (
                  <div
                    key={dep.id}
                    className="py-3 flex flex-col gap-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {dep.screenshot_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewScreenshotUrl(dep.screenshot_url || null)
                            }
                            className="w-11 h-11 rounded-lg overflow-hidden border border-amber-500/40 bg-[#0B0F17] shrink-0 relative group"
                            title="View Attached Payment Screenshot"
                          >
                            <img
                              src={dep.screenshot_url}
                              alt="Payment Screenshot"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <i className="fa-solid fa-magnifying-glass-plus text-white text-[10px]"></i>
                            </span>
                          </button>
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-[#0B0F17] border border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                            <i className="fa-regular fa-image"></i>
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <span>Payment Screenshot Attached</span>
                            {dep.screenshot_url && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewScreenshotUrl(
                                    dep.screenshot_url || null
                                  )
                                }
                                className="text-[11px] font-mono text-amber-400 hover:underline"
                              >
                                (View)
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {dep.created_at}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-bold text-amber-400 tabular-nums">
                          ₹{dep.amount.toLocaleString('en-IN')}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            dep.status === 'Completed'
                              ? 'text-emerald-400'
                              : dep.status === 'Rejected'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {dep.status}
                        </div>
                      </div>
                    </div>
                    {dep.admin_comment && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#0B0F17] border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5">
                        <i className="fa-regular fa-comment-dots text-amber-400"></i>
                        <span>
                          Admin Remark:{' '}
                          <strong className="text-white">
                            {dep.admin_comment}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800">
            <div className="mb-3">
              <h2 className="font-display font-bold text-base text-white flex items-center justify-between">
                <span>
                  <i className="fa-solid fa-money-bill-transfer text-amber-400 mr-2"></i>
                  UPI Withdrawal Requests
                </span>
                <span className="text-xs font-mono font-normal text-slate-400">
                  {userWithdrawals.length} requests
                </span>
              </h2>
              <div className="mt-1.5 space-y-1 text-[11px]">
                <p className="text-amber-400/90 flex items-center gap-1.5">
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>
                    Minimum withdrawal amount is ₹50. Deposited amount cannot be withdrawn — only winning amount can be withdrawn.
                  </span>
                </p>
                <p className="text-slate-400 flex items-center gap-1.5">
                  <i className="fa-regular fa-clock text-amber-400"></i>
                  <span>
                    Payment will be reflected within 24 hr of request submission.
                  </span>
                </p>
              </div>
            </div>

            {userWithdrawals.length === 0 ? (
              <div className="py-4 text-xs text-slate-500">
                No UPI withdrawal requests submitted yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {userWithdrawals.map((wit) => (
                  <div
                    key={wit.id}
                    className="py-3 flex flex-col gap-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono font-semibold text-white">
                          UPI: {wit.upi_id}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {wit.created_at}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-bold text-white tabular-nums">
                          ₹{wit.amount.toLocaleString('en-IN')}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            wit.status === 'Completed'
                              ? 'text-emerald-400'
                              : wit.status === 'Rejected'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {wit.status}
                        </div>
                      </div>
                    </div>
                    {wit.admin_comment && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#0B0F17] border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5">
                        <i className="fa-regular fa-comment-dots text-amber-400"></i>
                        <span>
                          Admin Remark:{' '}
                          <strong className="text-white">
                            {wit.admin_comment}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal 1: Add Money (Manual UPI Deposit Modal with Screenshot Attachment) */}
      {activeModal === 'deposit' && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-white">
                  Add Cash via UPI
                </h3>
                <p className="text-xs text-slate-400">
                  Scan QR or pay to Admin UPI ID, then attach your payment screenshot
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Admin QR Code Image and UPI ID fetched from database */}
            <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center">
              {settings.qr_code_url ? (
                <img
                  src={settings.qr_code_url}
                  alt="Admin UPI QR Code"
                  referrerPolicy="no-referrer"
                  className="w-44 h-44 object-contain rounded-xl bg-white p-2 border border-slate-700"
                />
              ) : (
                <div className="w-44 h-44 rounded-xl bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                  No QR Uploaded
                </div>
              )}

              <div className="mt-3">
                <div className="text-[11px] text-slate-400">
                  Official Merchant UPI ID
                </div>
                <div className="font-mono font-bold text-sm text-amber-400 mt-0.5 select-all">
                  {settings.admin_upi_id || 'skillarena@upi'}
                </div>
              </div>
            </div>

            {/* Deposit Form with Amount Paid (₹) and Payment Screenshot Attachment */}
            <form onSubmit={handleDepositSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  1. Amount Paid (₹)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="e.g., 100"
                  className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  2. Attach Payment Screenshot (PhonePe, GPay, Paytm) *
                </label>

                {!depositScreenshotUrl ? (
                  <label className="w-full bg-[#0B0F17] hover:bg-slate-950 border-2 border-dashed border-slate-700 hover:border-amber-500/70 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2">
                      <i className="fa-solid fa-cloud-arrow-up text-lg"></i>
                    </div>
                    <span className="text-xs font-semibold text-white">
                      Click to Upload Payment Screenshot
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Supports PNG, JPG, WEBP from your gallery
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotFileChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="bg-[#0B0F17] border border-emerald-500/40 rounded-2xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <i className="fa-solid fa-circle-check text-emerald-400 text-xs shrink-0"></i>
                        <span className="text-xs font-mono text-emerald-300 truncate">
                          {depositScreenshotName || 'Payment Screenshot Attached'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDepositScreenshotUrl('');
                          setDepositScreenshotName('');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-[11px] font-semibold shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 max-h-48 flex items-center justify-center">
                      <img
                        src={depositScreenshotUrl}
                        alt="Attached Payment Screenshot Preview"
                        className="max-h-48 w-auto object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !depositScreenshotUrl}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs min-h-[44px]"
                >
                  {submitting ? 'Submitting...' : 'Submit Deposit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Withdraw Money Modal */}
      {activeModal === 'withdraw' && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-white">
                  Request UPI Withdrawal
                </h3>
                <p className="text-xs text-slate-400">
                  Winnings are transferred directly to your saved UPI ID
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Display User's Saved UPI ID for Confirmation */}
            <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400">
                  Confirm Destination UPI ID
                </div>
                {user.upi_id ? (
                  <div className="font-mono font-bold text-sm text-emerald-400 mt-0.5">
                    {user.upi_id}
                  </div>
                ) : (
                  <div className="text-xs text-rose-400 font-medium mt-0.5">
                    No UPI ID saved in your Profile!
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('profile');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-amber-400"
              >
                {user.upi_id ? 'Change' : 'Set UPI ID'}
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              {/* Balance Breakdown inside Modal */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-[#0B0F17] border border-emerald-500/30 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400">
                    Withdrawable Winnings
                  </div>
                  <div className="font-mono font-bold text-base text-emerald-400 mt-0.5 tabular-nums">
                    ₹{walletBreakdown.withdrawable.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400">
                    Deposited (Non-Withdrawable)
                  </div>
                  <div className="font-mono font-bold text-base text-amber-400 mt-0.5 tabular-nums">
                    ₹{walletBreakdown.deposited.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Amount to Withdraw (₹) — Min ₹50 · Max ₹
                  {walletBreakdown.withdrawable}
                </label>
                <input
                  type="number"
                  min={50}
                  max={Math.max(50, walletBreakdown.withdrawable)}
                  required
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Minimum ₹50 (Winnings only)"
                  className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 text-xs text-amber-200">
                <div className="flex items-start gap-2">
                  <i className="fa-solid fa-circle-exclamation text-amber-400 mt-0.5 shrink-0"></i>
                  <span>
                    Minimum withdrawal amount is <strong>₹50</strong>. Deposited
                    amount cannot be withdrawn —{' '}
                    <strong>only winning amount can be withdrawn</strong>.
                  </span>
                </div>
                <div className="flex items-center gap-2 text-amber-300/90">
                  <i className="fa-regular fa-clock text-amber-400 shrink-0"></i>
                  <span>
                    Payment will be reflected within 24 hr of request submission.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !user.upi_id ||
                    walletBreakdown.withdrawable < 50
                  }
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs min-h-[44px]"
                >
                  {submitting
                    ? 'Requesting...'
                    : walletBreakdown.withdrawable < 50
                    ? 'Min ₹50 Winnings Required'
                    : 'Submit Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Payment Screenshot Lightbox Modal */}
      {previewScreenshotUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewScreenshotUrl(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-sm text-white flex items-center gap-2">
                <i className="fa-solid fa-image text-amber-400"></i>
                <span>Attached Payment Screenshot</span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewScreenshotUrl(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl p-2 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={previewScreenshotUrl}
                alt="Attached Payment Screenshot"
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
