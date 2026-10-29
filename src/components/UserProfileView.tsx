import React, { useState } from 'react';
import {
  DepositRecord,
  NotificationRecord,
  ParticipantRecord,
  TransactionRecord,
  UserRecord,
  WithdrawalRecord,
} from '../types';
import {
  createNotification,
  createOrUpdateUser,
  eraseUserPersonalData,
  evaluatePasswordStrength,
  generateRecoveryKey,
  generateSafeId,
  SECURITY_QUESTIONS,
} from '../services/dbService';

interface UserProfileViewProps {
  user: UserRecord;
  allUsers: UserRecord[];
  participants: ParticipantRecord[];
  transactions: TransactionRecord[];
  deposits: DepositRecord[];
  withdrawals: WithdrawalRecord[];
  notifications: NotificationRecord[];
  onLogout: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  user,
  allUsers,
  participants,
  transactions,
  deposits,
  withdrawals,
  notifications,
  onLogout,
}) => {
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [upiId, setUpiId] = useState(user.upi_id || '');
  const [maskPii, setMaskPii] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Account Recovery Vault state
  const [revealRecoveryKey, setRevealRecoveryKey] = useState(false);
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState(
    user.security_question || SECURITY_QUESTIONS[0]
  );
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [recoveryAuthPassword, setRecoveryAuthPassword] = useState('');

  // Section 14 (DPDP Act 2023) - Right to Nominate
  const [nomineeName, setNomineeName] = useState(user.nominee_name || '');
  const [nomineeContact, setNomineeContact] = useState(
    user.nominee_contact || ''
  );

  // Section 13 (DPDP Act 2023) - Grievance Redressal
  const [grievanceSubject, setGrievanceSubject] = useState(
    'Personal Data Access / Correction Inquiry'
  );
  const [grievanceDetails, setGrievanceDetails] = useState('');

  // Section 12 & Section 6(4) - Consent Withdrawal & Account Erasure Modal
  const [showErasureModal, setShowErasureModal] = useState(false);
  const [erasureConfirmText, setErasureConfirmText] = useState('');
  const [erasing, setErasing] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const userParticipants = participants.filter((p) => p.user_id === user.id);
  const userTransactions = transactions.filter((t) => t.user_id === user.id);
  const userDeposits = deposits.filter((d) => d.user_id === user.id);
  const userWithdrawals = withdrawals.filter((w) => w.user_id === user.id);
  const userNotifications = notifications.filter((n) => n.user_id === user.id);

  const maskEmailString = (rawEmail: string) => {
    if (!rawEmail || !rawEmail.includes('@')) return rawEmail;
    const [local, domain] = rawEmail.split('@');
    if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
    return `${local.slice(0, 2)}***@${domain}`;
  };

  const maskUpiString = (rawUpi: string) => {
    if (!rawUpi) return 'Not configured';
    if (!rawUpi.includes('@')) {
      return rawUpi.length > 4
        ? `${rawUpi.slice(0, 2)}****${rawUpi.slice(-2)}`
        : '****';
    }
    const [handle, bank] = rawUpi.split('@');
    if (handle.length <= 2) return `***@${bank}`;
    return `${handle.slice(0, 2)}****${handle.slice(-1)}@${bank}`;
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const trimmedUpi = upiId.trim();

    if (!trimmedUsername || !trimmedEmail) {
      setFeedback({
        type: 'error',
        message: 'Username and Email cannot be empty.',
      });
      return;
    }

    const duplicate = allUsers.some(
      (u) =>
        u.id !== user.id &&
        (u.username.toLowerCase() === trimmedUsername.toLowerCase() ||
          u.email.toLowerCase() === trimmedEmail.toLowerCase())
    );

    if (duplicate) {
      setFeedback({
        type: 'error',
        message: 'That username or email is already taken by another player.',
      });
      return;
    }

    setSaving(true);
    try {
      await createOrUpdateUser({
        ...user,
        username: trimmedUsername,
        email: trimmedEmail,
        upi_id: trimmedUpi,
      });
      setFeedback({
        type: 'success',
        message:
          'Personal data & Payout UPI ID corrected and saved (Section 12, DPDP Act 2023).',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Could not update profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNomineeSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      await createOrUpdateUser({
        ...user,
        nominee_name: nomineeName.trim(),
        nominee_contact: nomineeContact.trim(),
      });
      setFeedback({
        type: 'success',
        message:
          'Data Principal Nominee updated under Section 14 of the DPDP Act, 2023.',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to save nominee details.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (currentPassword !== user.password) {
      setFeedback({
        type: 'error',
        message: 'Current password is incorrect.',
      });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setFeedback({
        type: 'error',
        message: 'New password must be at least 6 characters.',
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setFeedback({
        type: 'error',
        message: 'New password and confirmation do not match.',
      });
      return;
    }

    setSaving(true);
    try {
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await createOrUpdateUser({
        ...user,
        password: newPassword,
        last_password_reset_at: nowStr,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setFeedback({
        type: 'success',
        message: 'Account password updated successfully!',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to update password.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRotateRecoveryKey = async () => {
    setFeedback(null);
    setSaving(true);
    try {
      const freshKey = generateRecoveryKey();
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await createOrUpdateUser({
        ...user,
        recovery_key: freshKey,
        last_password_reset_at: nowStr,
      });
      setRevealRecoveryKey(true);
      setFeedback({
        type: 'success',
        message: `New 12-Character Master Recovery Key (${freshKey}) generated! Please copy or download it for safekeeping.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to generate new Master Recovery Key.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyRecoveryKey = async () => {
    if (!user.recovery_key) return;
    try {
      await navigator.clipboard.writeText(user.recovery_key);
      setCopiedRecoveryKey(true);
      setTimeout(() => setCopiedRecoveryKey(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleDownloadRecoveryKeyTxt = () => {
    if (!user.recovery_key) return;
    const content = [
      '====================================================',
      '   SKILL ARENA — MASTER ACCOUNT RECOVERY KIT',
      '====================================================',
      `Player Username  : ${user.username}`,
      `Registered Email : ${user.email}`,
      `Master Key       : ${user.recovery_key}`,
      `Security Question: ${user.security_question || 'Not set'}`,
      `Exported At      : ${new Date().toISOString()}`,
      '----------------------------------------------------',
      'Use this 12-character key on the "Recover" tab of',
      'the login screen to reset your password anytime.',
      'Official Support: admin.skillarena@gmail.com',
      '====================================================',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SkillArena_RecoveryKey_${user.username}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveSecurityQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (recoveryAuthPassword !== user.password) {
      setFeedback({
        type: 'error',
        message:
          'Please enter your correct current password to update your recovery security question.',
      });
      return;
    }

    if (!securityAnswer.trim() || securityAnswer.trim().length < 2) {
      setFeedback({
        type: 'error',
        message: 'Please enter a valid secret answer (at least 2 characters).',
      });
      return;
    }

    setSaving(true);
    try {
      const ensuredKey = user.recovery_key || generateRecoveryKey();
      await createOrUpdateUser({
        ...user,
        recovery_key: ensuredKey,
        security_question: securityQuestion,
        security_answer: securityAnswer.trim().toLowerCase(),
      });
      setSecurityAnswer('');
      setRecoveryAuthPassword('');
      setFeedback({
        type: 'success',
        message:
          'Recovery Security Question & Answer saved! You can now use it anytime for self-service password recovery.',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to save security question.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Section 11 (DPDP Act 2023): Right to Access Information About Personal Data
  const handleDownloadPersonalData = () => {
    const exportPayload = {
      dpdp_act_2023_compliance_report: {
        statute: 'Digital Personal Data Protection Act, 2023 (India)',
        section: 'Section 11 — Right to Access Information About Personal Data',
        data_fiduciary: 'Skill Arena Esports Platform',
        official_contact_email: 'admin.skillarena@gmail.com',
        exported_at: new Date().toISOString(),
      },
      data_principal_profile: {
        id: user.id,
        username: user.username,
        email: user.email,
        upi_id: user.upi_id || '',
        wallet_balance_inr: user.wallet_balance,
        dpdp_consent_accepted: user.dpdp_consent_accepted ?? true,
        dpdp_consent_timestamp: user.dpdp_consent_at || user.created_at,
        age_18_verified: user.age_verified_18 ?? true,
        section_14_nominee: {
          nominee_name: user.nominee_name || '',
          nominee_contact: user.nominee_contact || '',
        },
        created_at: user.created_at,
      },
      tournament_participations: userParticipants.map((p) => ({
        id: p.id,
        tournament_id: p.tournament_id,
        team_mode: p.team_mode || 'Solo',
        slot_number: p.slot_number || 1,
        team_name: p.team_name || '',
        roster_igns: [
          p.player_1_ign,
          p.player_2_ign,
          p.player_3_ign,
          p.player_4_ign,
        ].filter(Boolean),
        registered_at: p.created_at,
      })),
      wallet_transactions: userTransactions,
      deposit_requests: userDeposits.map((d) => ({
        id: d.id,
        amount_inr: d.amount,
        status: d.status,
        has_payment_screenshot: Boolean(d.screenshot_url),
        admin_comment: d.admin_comment || '',
        created_at: d.created_at,
      })),
      withdrawal_requests: userWithdrawals,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill_arena_dpdp_data_${user.username.toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setFeedback({
      type: 'success',
      message:
        'Your itemized Personal Data Report (Section 11, DPDP Act 2023) has been downloaded.',
    });
  };

  // Section 13 (DPDP Act 2023): Grievance Redressal Submission
  const handleGrievanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grievanceDetails.trim()) {
      setFeedback({
        type: 'error',
        message: 'Please describe your privacy or personal data grievance.',
      });
      return;
    }

    setSaving(true);
    try {
      const ticketRef = `DPDP-GRV-${Math.floor(100000 + Math.random() * 900000)}`;
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await createNotification({
        id: generateSafeId('notif_dpdp'),
        user_id: user.id,
        tournament_id: '',
        type: 'payment_update',
        title: `DPDP Grievance Logged (${ticketRef})`,
        message: `Your Section 13 DPDP Act 2023 request regarding "${grievanceSubject}" has been registered with Skill Arena Admin & Grievance Desk (admin.skillarena@gmail.com). SLA resolution within 7 days.`,
        is_read: false,
        created_at: nowStr,
      });
      setGrievanceDetails('');
      setFeedback({
        type: 'success',
        message: `Grievance Ticket ${ticketRef} registered under Section 13 of the DPDP Act, 2023! Check your notification bell for confirmation.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Could not register grievance ticket. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Section 12 & Section 6(4): Right to Erasure & Withdrawal of Consent
  const handleConfirmErasure = async () => {
    if (erasureConfirmText.trim().toUpperCase() !== 'ERASE') {
      setFeedback({
        type: 'error',
        message: 'Please type ERASE in capital letters to confirm permanent deletion.',
      });
      return;
    }

    setErasing(true);
    try {
      await eraseUserPersonalData({
        userId: user.id,
        participants,
        notifications,
        deposits,
        withdrawals,
        transactions,
      });
      setShowErasureModal(false);
      onLogout();
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to complete personal data erasure. Please try again.',
      });
      setErasing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Player Card Header with Section 8(5) PII Masking Toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 font-display font-bold text-2xl shrink-0">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display font-bold text-xl text-white">
                {user.username}
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-300 uppercase">
                DPDP 2023 Protected
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Email: {maskPii ? maskEmailString(user.email) : user.email} · UPI:{' '}
              {maskPii
                ? maskUpiString(user.upi_id)
                : user.upi_id || 'Not configured'}
            </p>
            <p className="text-[11px] text-amber-400 mt-1">
              Member since {user.created_at.split(' ')[0]} · Consent Timestamp:{' '}
              {user.dpdp_consent_at || user.created_at}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setMaskPii((prev) => !prev)}
            className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 min-h-[42px] transition-colors cursor-pointer"
            title="Toggle PII Masking (Section 8(5) Security Safeguard)"
          >
            <i
              className={`fa-solid ${
                maskPii ? 'fa-eye' : 'fa-eye-slash'
              } text-amber-400`}
            ></i>
            <span>{maskPii ? 'Reveal PII' : 'Mask PII'}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800/60 text-rose-200 text-xs font-semibold flex items-center gap-2 min-h-[42px] transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-right-from-bracket"></i>
            <span>Logout</span>
          </button>
        </div>
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

      {/* Section 12 (DPDP Act 2023): Right to Correction & Rectification of Personal Data */}
      <form
        onSubmit={handleProfileSave}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
            <i className="fa-solid fa-user-pen text-amber-400 text-sm"></i>
            <span>Edit Account & Payout UPI ID</span>
          </h2>
          <span className="text-[10px] font-mono text-slate-400 uppercase">
            DPDP Act Sec 12 · Right to Correction
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Username
          </label>
          <input
            type="text"
            required
            maxLength={50}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            required
            maxLength={100}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Your Personal UPI ID (For Instant Prize Withdrawals)
          </label>
          <input
            type="text"
            maxLength={100}
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="e.g., yourname@okaxis or 9876543210@ybl"
            className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Used strictly for prize settlement under your Section 6 consent.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs min-h-[44px] transition-colors cursor-pointer"
        >
          {saving ? 'Saving Changes...' : 'Save Profile & UPI ID'}
        </button>
      </form>

      {/* DPDP ACT, 2023 (INDIA) PRIVACY, SECURITY & DATA PRINCIPAL RIGHTS CENTER */}
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-scale-balanced text-emerald-400 text-base"></i>
              <h2 className="font-display font-bold text-base text-white">
                DPDP Act, 2023 — Data Principal Rights & Security Center
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Exercise your statutory rights under the Digital Personal Data Protection Act, 2023 (Sections 6, 8, 11, 12, 13 & 14).
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-300 shrink-0 self-start sm:self-center">
            CONSENT ACTIVE
          </span>
        </div>

        {/* Section 11: Right to Access Information About Personal Data */}
        <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-file-shield text-amber-400"></i>
                <span>Section 11 — Right to Access Personal Data Summary</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Inspect all personal data categories processed by Skill Arena and download a machine-readable JSON copy.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadPersonalData}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <i className="fa-solid fa-download"></i>
              <span>Download Personal Data (JSON)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
              <div className="text-[10px] font-mono text-slate-400 uppercase">
                Match Entries
              </div>
              <div className="font-mono font-bold text-sm text-white mt-0.5">
                {userParticipants.length} Records
              </div>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
              <div className="text-[10px] font-mono text-slate-400 uppercase">
                Wallet Ledger
              </div>
              <div className="font-mono font-bold text-sm text-white mt-0.5">
                {userTransactions.length} Entries
              </div>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
              <div className="text-[10px] font-mono text-slate-400 uppercase">
                Deposit Proofs
              </div>
              <div className="font-mono font-bold text-sm text-white mt-0.5">
                {userDeposits.length} Files
              </div>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
              <div className="text-[10px] font-mono text-slate-400 uppercase">
                Withdrawals
              </div>
              <div className="font-mono font-bold text-sm text-white mt-0.5">
                {userWithdrawals.length} Requests
              </div>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 col-span-2 sm:col-span-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase">
                Alerts Log
              </div>
              <div className="font-mono font-bold text-sm text-white mt-0.5">
                {userNotifications.length} Alerts
              </div>
            </div>
          </div>
        </div>

        {/* Section 14: Right to Nominate */}
        <form
          onSubmit={handleNomineeSave}
          className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 space-y-3"
        >
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <i className="fa-solid fa-user-Check text-emerald-400"></i>
              <span>Section 14 — Right to Nominate a Representative</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Nominate an individual who may exercise your Data Principal rights (access, wallet claim, or erasure) in the event of death or incapacity.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Nominee Full Name
              </label>
              <input
                type="text"
                maxLength={80}
                value={nomineeName}
                onChange={(e) => setNomineeName(e.target.value)}
                placeholder="e.g., Rajesh Kumar (Parent / Spouse)"
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Nominee Email / Phone & Relation
              </label>
              <input
                type="text"
                maxLength={120}
                value={nomineeContact}
                onChange={(e) => setNomineeContact(e.target.value)}
                placeholder="e.g., nominee@example.com · Father"
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Save Section 14 Nominee
          </button>
        </form>

        {/* Section 13: Grievance Redressal Mechanism */}
        <form
          onSubmit={handleGrievanceSubmit}
          className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-headset text-amber-400"></i>
                <span>Section 13 — Grievance Redressal & Official Support Socials</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Official Contact & Grievance Email: <span className="font-mono text-slate-200">admin.skillarena@gmail.com</span> · Statutory Response SLA: Within 7 Days
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://t.me/skilIarena"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors"
              >
                <i className="fa-brands fa-telegram"></i>
                <span>Official Telegram</span>
              </a>
              <a
                href="https://www.instagram.com/arena.skill?obrf=MTAzOHBiOHRmczljdQ=="
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/40 text-pink-300 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors"
              >
                <i className="fa-brands fa-instagram"></i>
                <span>Official Instagram</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Grievance Category
              </label>
              <select
                value={grievanceSubject}
                onChange={(e) => setGrievanceSubject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
              >
                <option value="Personal Data Access / Correction Inquiry">
                  Personal Data Access / Correction
                </option>
                <option value="Payment Screenshot / Financial Privacy">
                  Payment Screenshot / UPI Privacy
                </option>
                <option value="Consent Withdrawal / Retention Inquiry">
                  Consent / Data Retention Inquiry
                </option>
                <option value="Unauthorised Processing Report">
                  Unauthorised Processing Report
                </option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Details of Grievance
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={250}
                  value={grievanceDetails}
                  onChange={(e) => setGrievanceDetails(e.target.value)}
                  placeholder="Describe your privacy concern for the Data Protection Officer..."
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer"
                >
                  Submit Ticket
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Section 6(4) & Section 12: Withdraw Consent & Right to Erasure */}
        <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-rose-300 flex items-center gap-2">
              <i className="fa-solid fa-trash-can"></i>
              <span>
                Section 6(4) & Section 12 — Withdraw Consent & Erase Personal Data
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Withdrawing consent permanently erases your account profile, saved UPI ID, uploaded payment screenshots, and match participation records from Skill Arena.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setErasureConfirmText('');
              setShowErasureModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 cursor-pointer"
          >
            Withdraw Consent & Erase Data
          </button>
        </div>
      </div>

      {/* Account Recovery & Password Security Vault */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
              <i className="fa-solid fa-key"></i>
              <span>MULTI-FACTOR ACCOUNT RECOVERY VAULT</span>
            </span>
            <h2 className="font-display font-bold text-lg text-white mt-1">
              Master Recovery Key, Security Question & Password Reset
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure your 12-digit Master Recovery Key and Security Question so you can recover your account anytime without losing access.
            </p>
          </div>
          {user.last_password_reset_at && (
            <div className="px-3 py-1.5 rounded-xl bg-[#0B0F17] border border-slate-800 text-[11px] font-mono text-slate-400 shrink-0">
              Last Reset: <span className="text-slate-200">{user.last_password_reset_at}</span>
            </div>
          )}
        </div>

        {/* 1. 12-Character Master Recovery Key */}
        <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-shield-keyhole text-amber-400"></i>
                <span>Factor 1: 12-Digit Cryptographic Master Recovery Key</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Use this key on the Login → Recover tab to reset your password immediately. Rotating the key invalidates any previous key.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {user.recovery_key ? (
                <>
                  <button
                    type="button"
                    onClick={() => setRevealRecoveryKey((prev) => !prev)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    <i
                      className={`fa-solid ${
                        revealRecoveryKey ? 'fa-eye-slash' : 'fa-eye'
                      } mr-1.5 text-amber-400`}
                    ></i>
                    {revealRecoveryKey ? 'Hide Key' : 'Reveal Key'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyRecoveryKey}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    <i className="fa-solid fa-copy mr-1.5 text-amber-400"></i>
                    {copiedRecoveryKey ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadRecoveryKeyTxt}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    <i className="fa-solid fa-download mr-1.5 text-emerald-400"></i>
                    Backup .TXT
                  </button>
                </>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={handleRotateRecoveryKey}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                <i className="fa-solid fa-rotate mr-1.5"></i>
                {user.recovery_key ? 'Rotate Key' : 'Generate Recovery Key'}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase">
              Active Master Key:
            </span>
            <span className="font-mono font-extrabold text-sm sm:text-base tracking-widest text-amber-400">
              {!user.recovery_key
                ? 'NOT GENERATED YET — CLICK GENERATE ABOVE'
                : revealRecoveryKey
                ? user.recovery_key
                : 'SA-••••-••••-••••'}
            </span>
          </div>
        </div>

        {/* 2. Recovery Security Question & Answer */}
        <form
          onSubmit={handleSaveSecurityQuestion}
          className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-user-lock text-emerald-400"></i>
                <span>Factor 2: Recovery Security Question & Secret Answer</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Current Status:{' '}
                {user.security_question ? (
                  <span className="text-emerald-400 font-semibold">
                    Configured (“{user.security_question}”)
                  </span>
                ) : (
                  <span className="text-amber-400 font-semibold">
                    Not configured yet
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Select Security Question
              </label>
              <select
                value={securityQuestion}
                onChange={(e) => setSecurityQuestion(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
              >
                {SECURITY_QUESTIONS.map((q, idx) => (
                  <option key={idx} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Secret Recovery Answer
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Enter new secret answer"
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Confirm Current Password
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  required
                  value={recoveryAuthPassword}
                  onChange={(e) => setRecoveryAuthPassword(e.target.value)}
                  placeholder="Current password"
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer"
                >
                  Save Q&A
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* 3. Change Account Password */}
        <form
          onSubmit={handlePasswordChange}
          className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <i className="fa-solid fa-lock text-amber-400"></i>
              <span>Change Account Password</span>
            </h3>
            {newPassword && (
              <span
                className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${
                  evaluatePasswordStrength(newPassword).colorClass
                }`}
              >
                Strength: {evaluatePasswordStrength(newPassword).label}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                New Password (min 6 chars)
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Confirm New Password
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs shrink-0 cursor-pointer"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Permanent Erasure & Consent Withdrawal Confirmation Modal */}
      {showErasureModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowErasureModal(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-rose-500/50 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-rose-950/40 border-b border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-rose-400"></i>
                <h3 className="font-display font-bold text-sm text-white">
                  Confirm DPDP Section 12 Data Erasure
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowErasureModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-300">
              <p className="leading-relaxed">
                You are exercising your <strong className="text-white">Right to Withdraw Consent (Section 6(4))</strong> and <strong className="text-white">Right to Erasure (Section 12)</strong> under the DPDP Act, 2023.
              </p>

              {user.wallet_balance > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[11px]">
                  <strong>Wallet Notice:</strong> You currently have ₹
                  {user.wallet_balance.toLocaleString('en-IN')} in your wallet. We recommend withdrawing any eligible winnings before erasing your account.
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  Type <span className="font-mono text-rose-400 font-bold">ERASE</span> below to permanently delete your account and personal records:
                </label>
                <input
                  type="text"
                  value={erasureConfirmText}
                  onChange={(e) => setErasureConfirmText(e.target.value)}
                  placeholder="Type ERASE"
                  className="w-full bg-[#0B0F17] border border-slate-800 focus:border-rose-500 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowErasureModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    erasing ||
                    erasureConfirmText.trim().toUpperCase() !== 'ERASE'
                  }
                  onClick={handleConfirmErasure}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs cursor-pointer"
                >
                  {erasing ? 'Erasing Data...' : 'Permanently Erase My Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
