import React, { useState } from 'react';
import { UserRecord } from '../types';
import {
  createNotification,
  createOrUpdateUser,
  evaluatePasswordStrength,
  generateRecoveryKey,
  generateSafeId,
  SECURITY_QUESTIONS,
} from '../services/dbService';

interface UserAuthViewProps {
  users: UserRecord[];
  onLoginSuccess: (user: UserRecord) => void;
  onSwitchToAdmin: () => void;
}

export const UserAuthView: React.FC<UserAuthViewProps> = ({
  users,
  onLoginSuccess,
  onSwitchToAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'recovery'>(
    'login'
  );
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign Up State
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupSecurityQuestion, setSignupSecurityQuestion] = useState(
    SECURITY_QUESTIONS[0]
  );
  const [signupSecurityAnswer, setSignupSecurityAnswer] = useState('');
  const [dpdpConsentChecked, setDpdpConsentChecked] = useState(false);
  const [ageVerifiedChecked, setAgeVerifiedChecked] = useState(false);
  const [showPrivacyNoticeModal, setShowPrivacyNoticeModal] = useState(false);

  // Master Recovery Key Backup Modal (shown right after signup or password reset)
  const [issuedRecoveryKit, setIssuedRecoveryKit] = useState<{
    user: UserRecord;
    recoveryKey: string;
    context: 'signup' | 'reset';
  } | null>(null);
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState(false);

  // 3-Step Account Recovery / Password Reset State
  const [recoveryStep, setRecoveryStep] = useState<1 | 2 | 3>(1);
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [targetRecoveryUser, setTargetRecoveryUser] =
    useState<UserRecord | null>(null);
  const [recoveryMethod, setRecoveryMethod] = useState<'key' | 'question'>(
    'key'
  );
  const [verifyEmailInput, setVerifyEmailInput] = useState('');
  const [verifyRecoveryKeyInput, setVerifyRecoveryKeyInput] = useState('');
  const [verifySecurityAnswerInput, setVerifySecurityAnswerInput] =
    useState('');
  const [verifyUpiInput, setVerifyUpiInput] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signupStrength = evaluatePasswordStrength(signupPassword);
  const resetStrength = evaluatePasswordStrength(resetNewPassword);

  const resetRecoveryWizard = () => {
    setRecoveryStep(1);
    setRecoveryIdentifier('');
    setTargetRecoveryUser(null);
    setVerifyEmailInput('');
    setVerifyRecoveryKeyInput('');
    setVerifySecurityAnswerInput('');
    setVerifyUpiInput('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setFeedback(null);
  };

  const handleCopyKey = async (keyText: string) => {
    try {
      await navigator.clipboard.writeText(keyText);
      setCopiedRecoveryKey(true);
      setTimeout(() => setCopiedRecoveryKey(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadRecoveryKit = (
    userObj: UserRecord,
    recoveryKey: string
  ) => {
    const content = [
      '====================================================',
      '   SKILL ARENA — MASTER ACCOUNT RECOVERY KIT',
      '====================================================',
      `Player Username  : ${userObj.username}`,
      `Registered Email : ${userObj.email}`,
      `Master Key       : ${recoveryKey}`,
      `Security Question: ${userObj.security_question || 'Configured in Profile'}`,
      `Generated At     : ${new Date().toISOString()}`,
      '----------------------------------------------------',
      'IMPORTANT SECURITY NOTICE:',
      'Keep this Master Recovery Key in a safe place.',
      'You can use this 12-character key anytime on the',
      '"Recover Account" screen to reset your password.',
      'Official Support: admin.skillarena@gmail.com',
      'Telegram Channel: https://t.me/skilIarena',
      '====================================================',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SkillArena_RecoveryKey_${userObj.username}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedUsername = loginUsername.trim();
    if (!trimmedUsername || !loginPassword) {
      setFeedback({
        type: 'error',
        message: 'Please enter both username and password.',
      });
      return;
    }

    const matchedUser = users.find(
      (u) =>
        (u.username.toLowerCase() === trimmedUsername.toLowerCase() ||
          u.email.toLowerCase() === trimmedUsername.toLowerCase()) &&
        u.password === loginPassword
    );

    if (!matchedUser) {
      setFeedback({
        type: 'error',
        message:
          'Invalid username/email or password. Forgot your password? Click "Recover Account" below.',
      });
      return;
    }

    if (matchedUser.is_blocked) {
      setFeedback({
        type: 'error',
        message: 'Your account has been suspended by the administrator.',
      });
      return;
    }

    onLoginSuccess(matchedUser);
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedUsername = signupUsername.trim();
    const trimmedEmail = signupEmail.trim();
    const trimmedAnswer = signupSecurityAnswer.trim();

    if (!trimmedUsername || !trimmedEmail || !signupPassword) {
      setFeedback({
        type: 'error',
        message: 'All fields (Username, Email, Password) are required.',
      });
      return;
    }

    if (signupPassword.length < 6) {
      setFeedback({
        type: 'error',
        message:
          'Password must be at least 6 characters long for account security.',
      });
      return;
    }

    if (!trimmedAnswer || trimmedAnswer.length < 2) {
      setFeedback({
        type: 'error',
        message:
          'Please provide an answer to your Security Question for account recovery.',
      });
      return;
    }

    if (!dpdpConsentChecked) {
      setFeedback({
        type: 'error',
        message:
          'Under Section 6 of the DPDP Act 2023, you must provide explicit consent to the Itemized Personal Data Notice before creating an account.',
      });
      return;
    }

    if (!ageVerifiedChecked) {
      setFeedback({
        type: 'error',
        message:
          'Under Section 9 of the DPDP Act 2023, you must confirm 18+ age eligibility (or verifiable parental consent) to participate.',
      });
      return;
    }

    const exists = users.some(
      (u) =>
        u.username.toLowerCase() === trimmedUsername.toLowerCase() ||
        u.email.toLowerCase() === trimmedEmail.toLowerCase()
    );

    if (exists) {
      setFeedback({
        type: 'error',
        message: 'Username or email is already registered.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const freshRecoveryKey = generateRecoveryKey();
      const newUser: UserRecord = {
        id: generateSafeId('user'),
        username: trimmedUsername,
        email: trimmedEmail,
        password: signupPassword,
        wallet_balance: 0,
        upi_id: '',
        is_blocked: false,
        dpdp_consent_accepted: true,
        dpdp_consent_at: nowStr,
        age_verified_18: true,
        nominee_name: '',
        nominee_contact: '',
        recovery_key: freshRecoveryKey,
        security_question: signupSecurityQuestion,
        security_answer: trimmedAnswer.toLowerCase(),
        last_password_reset_at: nowStr,
        created_at: nowStr,
      };
      await createOrUpdateUser(newUser);
      setIssuedRecoveryKit({
        user: newUser,
        recoveryKey: freshRecoveryKey,
        context: 'signup',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to create account. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Step 1 of Recovery: Locate user by Username or Email
  const handleRecoveryStep1Locate = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const query = recoveryIdentifier.trim().toLowerCase();
    if (!query) {
      setFeedback({
        type: 'error',
        message: 'Please enter your Username or Registered Email Address.',
      });
      return;
    }

    const found = users.find(
      (u) =>
        u.username.toLowerCase() === query || u.email.toLowerCase() === query
    );

    if (!found) {
      setFeedback({
        type: 'error',
        message:
          'No account found matching that Username or Email Address. Please check your spelling.',
      });
      return;
    }

    if (found.is_blocked) {
      setFeedback({
        type: 'error',
        message:
          'This account has been suspended by the administrator and cannot be recovered automatically.',
      });
      return;
    }

    setTargetRecoveryUser(found);
    // Default to Recovery Key method if user has one, else Security Question
    if (found.recovery_key) {
      setRecoveryMethod('key');
    } else if (found.security_question && found.security_answer) {
      setRecoveryMethod('question');
    } else {
      setRecoveryMethod('question');
    }
    setRecoveryStep(2);
  };

  // Step 2 of Recovery: Multi-Factor Identity Verification
  const handleRecoveryStep2Verify = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!targetRecoveryUser) return;

    const emailMatches =
      verifyEmailInput.trim().toLowerCase() ===
      targetRecoveryUser.email.trim().toLowerCase();

    if (!emailMatches) {
      setFeedback({
        type: 'error',
        message:
          'The email address you entered does not match the registered email for this account.',
      });
      return;
    }

    if (recoveryMethod === 'key') {
      if (!targetRecoveryUser.recovery_key) {
        setFeedback({
          type: 'error',
          message:
            'No Master Recovery Key is set on this account yet. Please switch to "Security Question / UPI Verification".',
        });
        return;
      }

      const normalizedInputKey = verifyRecoveryKeyInput
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
      const normalizedStoredKey = targetRecoveryUser.recovery_key
        .trim()
        .toUpperCase();

      if (normalizedInputKey !== normalizedStoredKey) {
        setFeedback({
          type: 'error',
          message:
            'Invalid Master Recovery Key. Please check your 12-character key (format: SA-XXXX-XXXX-XXXX).',
        });
        return;
      }

      setRecoveryStep(3);
      return;
    }

    // Method 2: Security Question + Email (+ UPI ID if configured)
    const hasSecurityQA = Boolean(
      targetRecoveryUser.security_question && targetRecoveryUser.security_answer
    );

    if (hasSecurityQA) {
      const normalizedAnswer = verifySecurityAnswerInput.trim().toLowerCase();
      if (
        !normalizedAnswer ||
        normalizedAnswer !==
          (targetRecoveryUser.security_answer || '').trim().toLowerCase()
      ) {
        setFeedback({
          type: 'error',
          message: 'Incorrect answer to your Security Question.',
        });
        return;
      }

      // If the user also has a saved UPI ID, verify it if entered or require it for extra protection
      if (
        targetRecoveryUser.upi_id &&
        verifyUpiInput.trim() &&
        verifyUpiInput.trim().toLowerCase() !==
          targetRecoveryUser.upi_id.trim().toLowerCase()
      ) {
        setFeedback({
          type: 'error',
          message: 'The UPI ID entered does not match your saved account UPI ID.',
        });
        return;
      }

      setRecoveryStep(3);
      return;
    }

    // Legacy account fallback (created before recovery keys/questions were added):
    // Require exact Email match + Saved UPI ID match (if UPI ID was set on the account)
    if (targetRecoveryUser.upi_id) {
      if (
        verifyUpiInput.trim().toLowerCase() !==
        targetRecoveryUser.upi_id.trim().toLowerCase()
      ) {
        setFeedback({
          type: 'error',
          message:
            'For accounts without a Recovery Key or Security Question, you must enter your exact saved UPI ID along with your registered Email.',
        });
        return;
      }
      setRecoveryStep(3);
      return;
    }

    setFeedback({
      type: 'error',
      message:
        'This legacy account has no Recovery Key, Security Question, or UPI ID on file. Please contact Admin Support via Telegram (https://t.me/skilIarena) or admin.skillarena@gmail.com for an instant Admin Password Reset.',
    });
  };

  // Step 3 of Recovery: Set New Password & Rotate Recovery Key
  const handleRecoveryStep3Reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!targetRecoveryUser) return;

    if (resetNewPassword.length < 6) {
      setFeedback({
        type: 'error',
        message: 'New password must be at least 6 characters long.',
      });
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setFeedback({
        type: 'error',
        message: 'New password and confirmation password do not match.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const rotatedRecoveryKey = generateRecoveryKey();

      const updatedUser: UserRecord = {
        ...targetRecoveryUser,
        password: resetNewPassword,
        recovery_key: rotatedRecoveryKey,
        last_password_reset_at: nowStr,
      };

      await createOrUpdateUser(updatedUser);

      // Log an in-app security notification for the user
      await createNotification({
        id: generateSafeId('notif'),
        user_id: updatedUser.id,
        tournament_id: '',
        type: 'payment_update',
        title: 'Security Alert: Password Reset Completed',
        message: `Your account password was reset on ${nowStr} and a new Master Recovery Key was issued.`,
        is_read: false,
        created_at: nowStr,
      }).catch(() => {});

      resetRecoveryWizard();
      setIssuedRecoveryKit({
        user: updatedUser,
        recoveryKey: rotatedRecoveryKey,
        context: 'reset',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to reset password. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to mask email hint during recovery (e.g., r***9@gmail.com)
  const getMaskedEmailHint = (email: string) => {
    const parts = email.split('@');
    if (parts.length !== 2) return '***@***';
    const name = parts[0];
    const domain = parts[1];
    const visibleStart = name.slice(0, 2);
    const visibleEnd = name.length > 3 ? name.slice(-1) : '';
    return `${visibleStart}***${visibleEnd}@${domain}`;
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col justify-between px-4 py-8">
      {/* Top Bar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowPrivacyNoticeModal(true)}
          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 py-2 cursor-pointer"
        >
          <i className="fa-solid fa-shield-halved"></i>
          <span>DPDP Act 2023 Notice</span>
        </button>

        <button
          type="button"
          onClick={onSwitchToAdmin}
          className="text-xs text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1.5 py-2 cursor-pointer"
        >
          <i className="fa-solid fa-user-shield text-amber-400"></i>
          <span>Admin Login</span>
        </button>
      </div>

      {/* Center Auth Card */}
      <div className="max-w-md w-full mx-auto my-auto py-6">
        {/* Brand Identity */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-24 h-24 rounded-3xl bg-slate-900/90 border border-amber-500/40 p-2 shadow-xl flex items-center justify-center mb-4">
            <img
              src="/assets/aistudio/skill-arena-icon_ca7b5100.svg"
              alt="Skill Arena Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="font-display font-extrabold text-3xl tracking-wider text-white">
            SKILL <span className="text-amber-400">ARENA</span>
          </h1>
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-amber-500 mt-1.5">
            Play. Compete. Conquer.
          </p>
          <p className="text-xs text-slate-400 mt-2 max-w-xs">
            Official Daily Mobile Esports Tournaments & Instant UPI Prize Arena
          </p>
        </div>

        {/* Auth Container */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          {/* Three Tabs: Login, Sign Up, and Recover Account */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#0B0F17] rounded-xl border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setFeedback(null);
              }}
              className={`py-2.5 text-xs font-semibold rounded-lg transition-colors min-h-[42px] cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-right-to-bracket mr-1"></i>
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setFeedback(null);
              }}
              className={`py-2.5 text-xs font-semibold rounded-lg transition-colors min-h-[42px] cursor-pointer ${
                activeTab === 'signup'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-user-plus mr-1"></i>
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('recovery');
                resetRecoveryWizard();
              }}
              className={`py-2.5 text-xs font-semibold rounded-lg transition-colors min-h-[42px] cursor-pointer ${
                activeTab === 'recovery'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-key mr-1"></i>
              Recover
            </button>
          </div>

          {feedback && (
            <div
              className={`mb-5 p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-700/60 text-rose-200'
              }`}
            >
              <i
                className={`fa-solid ${
                  feedback.type === 'success'
                    ? 'fa-circle-check text-emerald-400'
                    : 'fa-triangle-exclamation text-rose-400'
                } text-sm shrink-0`}
              ></i>
              <span>{feedback.message}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Username or Registered Email
                </label>
                <div className="relative">
                  <i className="fa-solid fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter username or email"
                    className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('recovery');
                      resetRecoveryWizard();
                      if (loginUsername.trim()) {
                        setRecoveryIdentifier(loginUsername.trim());
                      }
                    }}
                    className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
                  >
                    Forgot Password / Recover Account?
                  </button>
                </div>
                <div className="relative">
                  <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                    title="Toggle password visibility"
                  >
                    <i
                      className={`fa-solid ${
                        showLoginPassword ? 'fa-eye-slash' : 'fa-eye'
                      }`}
                    ></i>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[48px] shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                <span>Login to Skill Arena</span>
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </button>
            </form>
          )}

          {/* TAB 2: SIGN UP (WITH STRONG RECOVERY SETUP) */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <i className="fa-solid fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    placeholder="Choose a player tag"
                    className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <i className="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  <input
                    type="email"
                    required
                    maxLength={100}
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="player@example.com"
                    className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  {signupPassword && (
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${signupStrength.colorClass}`}
                    >
                      Strength: {signupStrength.label}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    required
                    maxLength={100}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create a strong password (min 6 chars)"
                    className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    <i
                      className={`fa-solid ${
                        showSignupPassword ? 'fa-eye-slash' : 'fa-eye'
                      }`}
                    ></i>
                  </button>
                </div>
              </div>

              {/* Account Recovery Security Question Setup */}
              <div className="bg-[#0B0F17] border border-amber-500/30 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <i className="fa-solid fa-key"></i>
                    <span>Account Recovery Setup</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    + Auto 12-Digit Master Key
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Recovery Security Question
                  </label>
                  <select
                    value={signupSecurityQuestion}
                    onChange={(e) => setSignupSecurityQuestion(e.target.value)}
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
                    Your Secret Recovery Answer
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={signupSecurityAnswer}
                    onChange={(e) => setSignupSecurityAnswer(e.target.value)}
                    placeholder="Enter memorable answer (case-insensitive)"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* DPDP Act 2023 Section 5 & Section 6 Verifiable Consent Box */}
              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <i className="fa-solid fa-scale-balanced"></i>
                    <span>DPDP Act, 2023 (India) Consent</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPrivacyNoticeModal(true)}
                    className="text-[11px] font-semibold text-amber-400 hover:underline cursor-pointer"
                  >
                    Read Itemized Notice
                  </button>
                </div>

                <label className="flex items-start gap-2.5 text-[11px] text-slate-300 cursor-pointer leading-relaxed">
                  <input
                    type="checkbox"
                    checked={dpdpConsentChecked}
                    onChange={(e) => setDpdpConsentChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-amber-500 shrink-0"
                  />
                  <span>
                    I have reviewed the{' '}
                    <button
                      type="button"
                      onClick={() => setShowPrivacyNoticeModal(true)}
                      className="text-amber-400 underline font-semibold"
                    >
                      Section 5 Itemized Privacy Notice
                    </button>{' '}
                    and give my free, specific, informed, and unambiguous consent (Section 6, DPDP Act 2023) to process my Username, Email, In-Game IDs, UPI ID, and Payment Screenshots strictly for tournament administration and prize settlement.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-[11px] text-slate-300 cursor-pointer leading-relaxed">
                  <input
                    type="checkbox"
                    checked={ageVerifiedChecked}
                    onChange={(e) => setAgeVerifiedChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-amber-500 shrink-0"
                  />
                  <span>
                    I confirm that I am <strong className="text-white">18 years of age or older</strong> (or hold verifiable parental consent in compliance with Section 9 of the DPDP Act, 2023).
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[48px] shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                <span>
                  {submitting
                    ? 'Creating Account...'
                    : 'Create Account & Generate Recovery Key'}
                </span>
                <i className="fa-solid fa-bolt text-xs"></i>
              </button>
            </form>
          )}

          {/* TAB 3: STRONG 3-STEP ACCOUNT RECOVERY & PASSWORD RESET */}
          {activeTab === 'recovery' && (
            <div className="space-y-4">
              {/* Step Progress Bar */}
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-mono font-bold ${
                    recoveryStep >= 1 ? 'text-amber-400' : 'text-slate-500'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px]">
                    1
                  </span>
                  <span>Locate</span>
                </div>
                <div className="flex-1 h-px bg-slate-800"></div>
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-mono font-bold ${
                    recoveryStep >= 2 ? 'text-amber-400' : 'text-slate-500'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px]">
                    2
                  </span>
                  <span>Verify Identity</span>
                </div>
                <div className="flex-1 h-px bg-slate-800"></div>
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-mono font-bold ${
                    recoveryStep === 3 ? 'text-amber-400' : 'text-slate-500'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px]">
                    3
                  </span>
                  <span>New Password</span>
                </div>
              </div>

              {/* STEP 1: LOCATE ACCOUNT */}
              {recoveryStep === 1 && (
                <form onSubmit={handleRecoveryStep1Locate} className="space-y-4">
                  <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 leading-relaxed">
                    Enter your <strong className="text-white">Player Username</strong> or{' '}
                    <strong className="text-white">Registered Email Address</strong> to initiate multi-factor account recovery.
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Username or Registered Email
                    </label>
                    <div className="relative">
                      <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                      <input
                        type="text"
                        required
                        value={recoveryIdentifier}
                        onChange={(e) => setRecoveryIdentifier(e.target.value)}
                        placeholder="e.g., ShadowHunter or player@gmail.com"
                        className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[48px] cursor-pointer"
                  >
                    <span>Find My Account</span>
                    <i className="fa-solid fa-arrow-right text-xs"></i>
                  </button>
                </form>
              )}

              {/* STEP 2: MULTI-FACTOR VERIFICATION */}
              {recoveryStep === 2 && targetRecoveryUser && (
                <form onSubmit={handleRecoveryStep2Verify} className="space-y-4">
                  <div className="bg-[#0B0F17] border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-mono uppercase text-amber-400">
                        Account Located
                      </div>
                      <div className="font-display font-bold text-sm text-white">
                        @{targetRecoveryUser.username}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Email Hint: {getMaskedEmailHint(targetRecoveryUser.email)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetRecoveryWizard}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {/* Verification Method Selector */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0B0F17] rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryMethod('key');
                        setFeedback(null);
                      }}
                      className={`py-2 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        recoveryMethod === 'key'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <i className="fa-solid fa-key mr-1"></i>
                      Master Recovery Key
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryMethod('question');
                        setFeedback(null);
                      }}
                      className={`py-2 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        recoveryMethod === 'question'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <i className="fa-solid fa-shield-halved mr-1"></i>
                      Security Question
                    </button>
                  </div>

                  {/* Factor 1: Confirm Full Registered Email */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Factor 1: Confirm Full Registered Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={verifyEmailInput}
                      onChange={(e) => setVerifyEmailInput(e.target.value)}
                      placeholder={`Enter full email (${getMaskedEmailHint(
                        targetRecoveryUser.email
                      )})`}
                      className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  {/* Factor 2A: Master Recovery Key */}
                  {recoveryMethod === 'key' ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Factor 2: 12-Character Master Recovery Key
                      </label>
                      <input
                        type="text"
                        required
                        value={verifyRecoveryKeyInput}
                        onChange={(e) =>
                          setVerifyRecoveryKeyInput(e.target.value.toUpperCase())
                        }
                        placeholder="SA-XXXX-XXXX-XXXX"
                        className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm font-mono uppercase tracking-wider text-amber-300 placeholder-slate-600 focus:outline-none"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Enter the Master Recovery Key saved when you created or last updated your account.
                      </p>
                    </div>
                  ) : (
                    /* Factor 2B: Security Question + Optional Saved UPI ID */
                    <div className="space-y-3">
                      {targetRecoveryUser.security_question ? (
                        <div>
                          <label className="block text-[11px] font-mono uppercase text-amber-400 mb-1">
                            Factor 2 — Your Security Question:
                          </label>
                          <div className="p-2.5 rounded-xl bg-[#0B0F17] border border-slate-800 text-xs font-semibold text-white mb-2">
                            {targetRecoveryUser.security_question}
                          </div>
                          <input
                            type="text"
                            required
                            value={verifySecurityAnswerInput}
                            onChange={(e) =>
                              setVerifySecurityAnswerInput(e.target.value)
                            }
                            placeholder="Enter your secret recovery answer"
                            className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                          No Security Question was set on this account. Verify using your saved UPI ID below, or contact Official Admin Support.
                        </div>
                      )}

                      {targetRecoveryUser.upi_id && (
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1.5">
                            Saved Account UPI ID{' '}
                            {!targetRecoveryUser.security_question
                              ? '(Required)'
                              : '(Optional Extra Check)'}
                          </label>
                          <input
                            type="text"
                            required={!targetRecoveryUser.security_question}
                            value={verifyUpiInput}
                            onChange={(e) => setVerifyUpiInput(e.target.value)}
                            placeholder="yourname@upi"
                            className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[48px] cursor-pointer"
                  >
                    <i className="fa-solid fa-user-check text-xs"></i>
                    <span>Verify Identity & Continue</span>
                  </button>
                </form>
              )}

              {/* STEP 3: SET NEW STRONG PASSWORD */}
              {recoveryStep === 3 && targetRecoveryUser && (
                <form onSubmit={handleRecoveryStep3Reset} className="space-y-4">
                  <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3.5 text-xs text-emerald-200 flex items-center gap-2.5">
                    <i className="fa-solid fa-circle-check text-emerald-400 text-base"></i>
                    <div>
                      <div className="font-bold text-white">
                        Identity Verified for @{targetRecoveryUser.username}
                      </div>
                      <div className="text-[11px] text-emerald-300">
                        Set a new strong password below. A new Master Recovery Key will also be generated.
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-slate-300">
                        New Password
                      </label>
                      {resetNewPassword && (
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${resetStrength.colorClass}`}
                        >
                          Strength: {resetStrength.label}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        required
                        maxLength={100}
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="Enter new strong password (min 6 chars)"
                        className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword((prev) => !prev)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                      >
                        <i
                          className={`fa-solid ${
                            showResetPassword ? 'fa-eye-slash' : 'fa-eye'
                          }`}
                        ></i>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <i className="fa-solid fa-check-double absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        required
                        maxLength={100}
                        value={resetConfirmPassword}
                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[48px] cursor-pointer"
                  >
                    <i className="fa-solid fa-rotate text-xs"></i>
                    <span>
                      {submitting
                        ? 'Resetting Password...'
                        : 'Save New Password & Rotate Recovery Key'}
                    </span>
                  </button>
                </form>
              )}

              {/* Direct Admin Recovery Assistance Box */}
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex flex-col gap-1.5">
                <div className="font-semibold text-slate-300">
                  Lost both your Recovery Key & Security Answer?
                </div>
                <p>
                  Contact Official Admin Support via{' '}
                  <a
                    href="https://t.me/skilIarena"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:underline font-semibold"
                  >
                    Telegram
                  </a>{' '}
                  or{' '}
                  <span className="font-mono text-slate-200">
                    admin.skillarena@gmail.com
                  </span>{' '}
                  for an Admin-verified password reset.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Master Recovery Key Backup Modal (Shown after Sign Up or Password Reset) */}
      {issuedRecoveryKit && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-slate-900 border-b border-amber-500/30">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono font-extrabold text-[10px] uppercase tracking-wider">
                <i className="fa-solid fa-key"></i>
                {issuedRecoveryKit.context === 'signup'
                  ? 'Account Created · Save Your Recovery Key'
                  : 'Password Reset Complete · New Recovery Key'}
              </span>
              <h3 className="font-display font-extrabold text-lg text-white mt-2">
                Your 12-Digit Master Recovery Key
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Save or download this key now. It allows you to instantly recover your account and reset your password anytime.
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-[#0B0F17] border border-amber-500/40 rounded-2xl p-4 text-center space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Master Recovery Key for @{issuedRecoveryKit.user.username}
                </div>
                <div className="font-mono font-extrabold text-xl sm:text-2xl tracking-widest text-amber-400 select-all">
                  {issuedRecoveryKit.recoveryKey}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleCopyKey(issuedRecoveryKit.recoveryKey)}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-copy text-amber-400"></i>
                  <span>{copiedRecoveryKey ? 'Copied!' : 'Copy Key'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadRecoveryKit(
                      issuedRecoveryKit.user,
                      issuedRecoveryKit.recoveryKey
                    )
                  }
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-download text-emerald-400"></i>
                  <span>Download .TXT</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const userToLogin = issuedRecoveryKit.user;
                  setIssuedRecoveryKit(null);
                  onLoginSuccess(userToLogin);
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>I Have Saved My Key — Enter Skill Arena</span>
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 5 Itemized Privacy Notice Modal (DPDP Act, 2023) */}
      {showPrivacyNoticeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPrivacyNoticeModal(false)}
        >
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 bg-[#0B0F17] flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">
                  SECTION 5 & SECTION 6 · DPDP ACT, 2023 (INDIA)
                </span>
                <h3 className="font-display font-bold text-base text-white mt-0.5">
                  Itemized Personal Data & Privacy Notice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyNoticeModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <i className="fa-solid fa-database text-amber-400"></i>
                  <span>1. Itemized Personal Data Collected (Section 5(1)(a))</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-400">
                  <li>
                    <strong className="text-slate-200">Account & Identity Data:</strong> Player Username, Email Address, and account recovery credentials.
                  </li>
                  <li>
                    <strong className="text-slate-200">Gameplay Roster Data:</strong> In-Game Names (IGNs) and Team Names submitted for Solo, Duo, and Squad lobby slots.
                  </li>
                  <li>
                    <strong className="text-slate-200">Financial & Settlement Data:</strong> Personal UPI ID (for prize withdrawals) and Deposit Payment Screenshots (for wallet credit verification).
                  </li>
                </ul>
              </div>

              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <i className="fa-solid fa-bullseye text-emerald-400"></i>
                  <span>2. Specified Purpose & Data Minimization (Section 6)</span>
                </div>
                <p className="text-slate-400">
                  Your personal data is processed strictly for: (a) verifying tournament slot registration, (b) delivering custom room credentials and 5-minute match alerts, (c) verifying manual UPI wallet top-ups, and (d) disbursing tournament winnings to your designated UPI ID. No personal data is sold or shared with third-party advertisers.
                </p>
              </div>

              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <i className="fa-solid fa-user-check text-amber-400"></i>
                  <span>3. Your Rights as a Data Principal (Sections 11–14)</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-400">
                  <li>
                    <strong className="text-slate-200">Right to Access (Sec 11):</strong> View and download a complete JSON summary of your personal data and transactions anytime from your Profile.
                  </li>
                  <li>
                    <strong className="text-slate-200">Right to Correction & Erasure (Sec 12):</strong> Rectify your account/UPI details or permanently erase your account and personal records from your Profile.
                  </li>
                  <li>
                    <strong className="text-slate-200">Right to Withdraw Consent (Sec 6(4)):</strong> Withdraw consent and delete your personal data at any time.
                  </li>
                  <li>
                    <strong className="text-slate-200">Right to Nominate (Sec 14):</strong> Appoint a Nominee in your Profile to exercise your Data Principal rights in the event of death or incapacity.
                  </li>
                </ul>
              </div>

              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <i className="fa-solid fa-headset"></i>
                  <span>4. Official Support, Socials & Grievance Desk (Sec 13)</span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  Data Fiduciary: Skill Arena Esports · Official Contact & Grievance Email:{' '}
                  <span className="font-mono text-white">admin.skillarena@gmail.com</span> · Resolution SLA: Within 7 days (acknowledgement within 24 hours). You may also escalate unresolved grievances to the Data Protection Board of India.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href="https://t.me/skilIarena"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 font-semibold text-[11px] inline-flex items-center gap-1.5"
                  >
                    <i className="fa-brands fa-telegram"></i>
                    <span>Official Telegram</span>
                  </a>
                  <a
                    href="https://www.instagram.com/arena.skill?obrf=MTAzOHBiOHRmczljdQ=="
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-pink-500/20 border border-pink-500/40 text-pink-300 font-semibold text-[11px] inline-flex items-center gap-1.5"
                  >
                    <i className="fa-brands fa-instagram"></i>
                    <span>Official Instagram</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-[#0B0F17] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDpdpConsentChecked(true);
                  setShowPrivacyNoticeModal(false);
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Accept Notice & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-md w-full mx-auto text-center text-xs text-slate-500 space-y-2 pb-12">
        <div className="flex items-center justify-center gap-3">
          <a
            href="https://t.me/skilIarena"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-sky-500/30 text-sky-400 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors"
          >
            <i className="fa-brands fa-telegram"></i>
            <span>Telegram Channel</span>
          </a>
          <a
            href="https://www.instagram.com/arena.skill?obrf=MTAzOHBiOHRmczljdQ=="
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-pink-500/30 text-pink-400 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors"
          >
            <i className="fa-brands fa-instagram"></i>
            <span>Instagram</span>
          </a>
        </div>
        <div>
          Skill Arena · Play. Compete. Conquer. · All values in Indian Rupees (₹)
        </div>
        <div className="text-[11px] text-slate-500">
          Protected under DPDP Act, 2023 · Contact:{' '}
          <span className="font-mono text-slate-400">
            admin.skillarena@gmail.com
          </span>
        </div>
      </footer>
    </div>
  );
};
