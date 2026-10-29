import React, { useEffect, useRef, useState } from 'react';
import {
  DepositRecord,
  ParticipantRecord,
  SettingRecord,
  TournamentRecord,
  TransactionRecord,
  UserRecord,
  UserRoute,
  WithdrawalRecord,
} from '../types';
import {
  getPrizeBreakdown,
  getTournamentMaxSlots,
  getTournamentMode,
  getWalletBreakdown,
} from '../services/dbService';

export const OFFICIAL_TELEGRAM_URL = 'https://t.me/skilIarena';
export const OFFICIAL_INSTAGRAM_URL =
  'https://www.instagram.com/arena.skill?obrf=MTAzOHBiOHRmczljdQ==';
export const OFFICIAL_SUPPORT_EMAIL = 'admin.skillarena@gmail.com';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  bullets?: string[];
  actionRoute?: {
    label: string;
    route: UserRoute;
  };
  showSocials?: boolean;
  timestamp: string;
}

interface SupportChatWidgetProps {
  user?: UserRecord | null;
  tournaments?: TournamentRecord[];
  participants?: ParticipantRecord[];
  transactions?: TransactionRecord[];
  deposits?: DepositRecord[];
  withdrawals?: WithdrawalRecord[];
  settings?: SettingRecord;
  onNavigate?: (route: UserRoute) => void;
}

const QUICK_TOPICS = [
  {
    id: 'wallet_status',
    label: 'My Wallet & Balance',
    icon: 'fa-wallet',
    query: 'What is my wallet balance and withdrawable winnings?',
  },
  {
    id: 'room_id',
    label: 'Room ID & My Matches',
    icon: 'fa-key',
    query: 'Where do I get the Room ID, Password, and 5-minute alert?',
  },
  {
    id: 'add_cash',
    label: 'How to Add Cash (Deposit)',
    icon: 'fa-circle-plus',
    query: 'How do I add money to my wallet using payment screenshot?',
  },
  {
    id: 'withdraw_help',
    label: 'Withdrawal Rules & Status',
    icon: 'fa-money-bill-transfer',
    query: 'How do I withdraw winnings and what is my withdrawal status?',
  },
  {
    id: 'modes_guide',
    label: 'Solo / Duo / Squad Registration',
    icon: 'fa-users',
    query: 'How do Solo, Duo, and Squad slots and Team Name winners work?',
  },
  {
    id: 'refund_policy',
    label: 'Cancelled & Postponed Matches',
    icon: 'fa-rotate-left',
    query: 'What happens if a tournament is cancelled or postponed?',
  },
  {
    id: 'game_rules',
    label: 'Official Esports Rules',
    icon: 'fa-scale-balanced',
    query: 'What are the official tournament rules for BGMI, Free Fire & CODM?',
  },
  {
    id: 'account_recovery',
    label: 'Account Recovery & Password Reset',
    icon: 'fa-user-lock',
    query: 'How do I reset my password or recover my account using my Master Recovery Key?',
  },
  {
    id: 'dpdp_privacy',
    label: 'DPDP Act 2023 & Account Privacy',
    icon: 'fa-shield-halved',
    query: 'How is my data protected under DPDP Act 2023 and how can I manage my profile?',
  },
  {
    id: 'socials',
    label: 'Official Telegram & Instagram',
    icon: 'fa-share-nodes',
    query: 'What are the official Skill Arena support socials and contact links?',
  },
];

export const SupportChatWidget: React.FC<SupportChatWidgetProps> = ({
  user = null,
  tournaments = [],
  participants = [],
  transactions = [],
  deposits = [],
  withdrawals = [],
  settings,
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const getNowTime = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome_msg',
      sender: 'bot',
      text: user
        ? `Hello ${user.username}! Welcome to Skill Arena 24/7 Support Desk. Ask me anything about your wallet, deposits, withdrawals, Room ID & Password, Solo/Duo/Squad slots, tournament rules, or DPDP privacy rights.`
        : 'Welcome to Skill Arena 24/7 Support Desk! Ask any question about how tournaments, UPI deposits, instant prize withdrawals, Solo/Duo/Squad modes, or account security work.',
      bullets: [
        'Instant answers backed by your live account, tournament & wallet data',
        'Direct links to our Official Telegram Channel & Official Instagram',
        `Official Support & Grievance Email: ${OFFICIAL_SUPPORT_EMAIL}`,
      ],
      showSocials: true,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const buildSmartAnswer = (
    rawQuery: string
  ): Omit<ChatMessage, 'id' | 'sender' | 'timestamp'> => {
    const q = rawQuery.toLowerCase().trim();

    const userParts = user
      ? participants.filter((p) => p.user_id === user.id)
      : [];
    const userDeposits = user
      ? deposits
          .filter((d) => d.user_id === user.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      : [];
    const userWithdrawals = user
      ? withdrawals
          .filter((w) => w.user_id === user.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      : [];
    const walletBreakdown = user
      ? getWalletBreakdown(user, transactions, withdrawals)
      : null;

    const activeTournaments = tournaments.filter(
      (t) => t.status === 'Upcoming' || t.status === 'Live'
    );

    // 1. Official Socials / Telegram / Instagram / Contact / Support
    if (
      q.includes('telegram') ||
      q.includes('tg') ||
      q.includes('insta') ||
      q.includes('social') ||
      q.includes('channel') ||
      q.includes('link') ||
      q.includes('contact') ||
      q.includes('email') ||
      q.includes('admin') ||
      q.includes('support')
    ) {
      return {
        text: 'Here are Skill Arena’s official verified support channels and social links:',
        bullets: [
          `Official Telegram Channel: ${OFFICIAL_TELEGRAM_URL} (Join for live match updates, room updates & announcements)`,
          `Official Instagram: ${OFFICIAL_INSTAGRAM_URL} (Follow for daily tournament highlights, winners & support)`,
          `Official Support & DPDP Grievance Email: ${OFFICIAL_SUPPORT_EMAIL}`,
        ],
        showSocials: true,
      };
    }

    // 2. Deposit / Add Cash / Screenshot / UPI QR
    if (
      q.includes('add cash') ||
      q.includes('add money') ||
      q.includes('deposit') ||
      q.includes('screenshot') ||
      q.includes('qr') ||
      q.includes('top up') ||
      q.includes('topup')
    ) {
      const latestDep = userDeposits[0];
      const pendingCount = userDeposits.filter(
        (d) => d.status === 'Pending'
      ).length;
      const adminUpi = settings?.admin_upi_id || 'Configured in Wallet';

      const bullets = [
        `Step 1: Open the Wallet tab and click "Add Cash".`,
        `Step 2: Pay the desired amount (₹) via any UPI app to Admin UPI ID (${adminUpi}) or scan the Admin QR code.`,
        'Step 3: Take a screenshot of your completed UPI payment and upload it in the Add Cash form (no manual UTR typing needed).',
        'Step 4: Admin verifies your attached screenshot and approves the deposit, crediting your wallet immediately with an approval comment.',
      ];

      if (user) {
        bullets.push(
          latestDep
            ? `Your Latest Deposit: ₹${latestDep.amount} is currently "${latestDep.status}"${
                latestDep.admin_comment
                  ? ` (Admin Note: ${latestDep.admin_comment})`
                  : ''
              }. Pending requests: ${pendingCount}.`
            : 'You have no deposit requests yet.'
        );
      }

      return {
        text: 'How to Add Cash to your Skill Arena Wallet using a Payment Screenshot:',
        bullets,
        actionRoute: user
          ? { label: 'Open Wallet & Add Cash', route: 'wallet' }
          : undefined,
      };
    }

    // 3. Withdrawal / Payout / Winning Balance / Why can't I withdraw
    if (
      q.includes('withdraw') ||
      q.includes('payout') ||
      q.includes('cashout') ||
      q.includes('minimum') ||
      q.includes('upi id')
    ) {
      const latestWit = userWithdrawals[0];
      const bullets = [
        'Only Tournament Winning Balance can be withdrawn to your bank/UPI. Deposited cash is strictly for joining tournaments.',
        'Minimum withdrawal amount is ₹50.',
        'Make sure your personal UPI ID is saved under Profile → Account Settings before requesting a withdrawal.',
        'Approved withdrawals are transferred to your UPI ID within 24 hours of submission.',
      ];

      if (user && walletBreakdown) {
        bullets.unshift(
          `Your Available Withdrawable Winning Balance: ₹${walletBreakdown.withdrawable} (Total Wallet: ₹${walletBreakdown.total} | Play-Only Deposit Balance: ₹${walletBreakdown.deposited}).`,
          `Your Saved UPI ID: ${user.upi_id ? user.upi_id : 'Not set yet — please save it in Profile'}.`
        );
        if (latestWit) {
          bullets.push(
            `Your Latest Withdrawal: ₹${latestWit.amount} to ${latestWit.upi_id} — Status: "${latestWit.status}"${
              latestWit.admin_comment
                ? ` (Admin Note: ${latestWit.admin_comment})`
                : ''
            }.`
          );
        }
      }

      return {
        text: 'Skill Arena Withdrawal Rules & Your Live Payout Status:',
        bullets,
        actionRoute: user
          ? {
              label: user.upi_id ? 'Go to Wallet' : 'Save UPI ID in Profile',
              route: user.upi_id ? 'wallet' : 'profile',
            }
          : undefined,
      };
    }

    // 4. Wallet Balance Overview
    if (q.includes('wallet') || q.includes('balance') || q.includes('money')) {
      if (user && walletBreakdown) {
        return {
          text: `Here is your real-time Skill Arena Wallet breakdown for @${user.username}:`,
          bullets: [
            `Total Wallet Balance: ₹${walletBreakdown.total}`,
            `Withdrawable Winning Balance: ₹${walletBreakdown.withdrawable} (Can be withdrawn to UPI anytime, min ₹50, or used to join matches)`,
            `Deposited Play Balance: ₹${walletBreakdown.deposited} (Used to join Solo, Duo, and Squad tournaments)`,
            `Total Transactions Logged: ${
              transactions.filter((t) => t.user_id === user.id).length
            }`,
          ],
          actionRoute: { label: 'Open My Wallet', route: 'wallet' },
        };
      }
      return {
        text: 'Your Skill Arena Wallet separates your funds into two transparent balances:',
        bullets: [
          'Deposited Balance: Added via UPI payment screenshot verification; usable for all tournament entry fees.',
          'Winning Balance: Earned from 1st, 2nd, or 3rd place finishes; 100% withdrawable to your UPI ID (minimum ₹50).',
          'No signup bonus is given; all balances reflect real verified deposits and tournament prizes.',
        ],
      };
    }

    // 5. Room ID / Password / 5-Minute Notification / My Matches
    if (
      q.includes('room') ||
      q.includes('password') ||
      q.includes('5 min') ||
      q.includes('five min') ||
      q.includes('popup') ||
      q.includes('alert') ||
      q.includes('start') ||
      q.includes('my tournament') ||
      q.includes('lobby')
    ) {
      const joinedActiveDetails: string[] = [];
      if (user && userParts.length > 0) {
        for (const p of userParts) {
          const t = tournaments.find((tour) => tour.id === p.tournament_id);
          if (t && (t.status === 'Upcoming' || t.status === 'Live')) {
            joinedActiveDetails.push(
              `${t.title} (${t.status} · ${t.match_time}) — Your Slot: #${
                p.slot_number || 1
              }${p.team_name ? ` (${p.team_name})` : ''} | Room ID: ${
                t.room_id || 'Will be published before start'
              } | Password: ${t.room_password || 'N/A'}`
            );
          }
        }
      }

      return {
        text: 'How Custom Room ID, Password & 5-Minute Match Alerts Work:',
        bullets: [
          'Once you register for a tournament, your assigned Slot # and match card appear in the "My Tournaments" tab.',
          'Before match start, the Admin publishes the Custom Room ID and Password inside your match card with one-click Copy buttons.',
          '5-Minute Popup Alert: Exactly 5 minutes before your registered tournament starts, an automatic Popup Notification Modal appears on your screen with a live MM:SS countdown and Room credentials.',
          ...(joinedActiveDetails.length > 0
            ? joinedActiveDetails
            : user
            ? ['You currently have no active Upcoming/Live joined tournaments.']
            : []),
        ],
        actionRoute: user
          ? { label: 'Go to My Tournaments', route: 'my_tournaments' }
          : undefined,
      };
    }

    // 6. Solo / Duo / Squad Registration & Team Name Winners
    if (
      q.includes('solo') ||
      q.includes('duo') ||
      q.includes('squad') ||
      q.includes('slot') ||
      q.includes('teammate') ||
      q.includes('team name') ||
      q.includes('winner') ||
      q.includes('join') ||
      q.includes('register') ||
      q.includes('prize')
    ) {
      return {
        text: 'How Solo, Duo & Squad Tournaments, Slots, and Winner Selection Work:',
        bullets: [
          'Solo Tournaments: Up to 100 Slots (1 Player per slot). Enter your In-Game Name (IGN) and pick an available slot.',
          'Duo Tournaments: Up to 50 Team Slots (2 Players per slot). One player registers the team by entering the Duo Team Name + Player 1 & Player 2 usernames.',
          'Squad Tournaments: Up to 25 Team Slots (4 Players per slot). One player registers the full squad by entering the Squad Team Name + all 4 player usernames.',
          'Winner Selection Rule: In Duo and Squad tournaments, 1st, 2nd, and 3rd place winners are officially selected and displayed by Team Name, and the prize is credited to the registering team leader’s wallet.',
          `Active Tournaments Right Now: ${activeTournaments.length} match(es) open in the Arena.`,
        ],
        actionRoute: user
          ? { label: 'Browse Tournaments', route: 'home' }
          : undefined,
      };
    }

    // 7. Cancelled / Postponed / Refund Policy
    if (
      q.includes('cancel') ||
      q.includes('postpone') ||
      q.includes('refund') ||
      q.includes('reschedule')
    ) {
      return {
        text: 'Automatic Refund & Match Postponement Policy:',
        bullets: [
          'Cancelled Tournaments (100% Auto-Refund): If an Admin cancels any tournament, every registered player automatically receives a 100% entry fee refund directly to their wallet balance, along with a credit transaction record and an instant notification.',
          'Postponed Tournaments: If a tournament’s match time is rescheduled/postponed by the Admin, all registered participants immediately receive a "Tournament Postponed" notification with the updated match date & time.',
        ],
        actionRoute: user
          ? { label: 'Check My Tournaments', route: 'my_tournaments' }
          : undefined,
      };
    }

    // 8. Official Esports Rules (BGMI, Free Fire Max, COD Mobile)
    if (
      q.includes('rule') ||
      q.includes('bgmi') ||
      q.includes('free fire') ||
      q.includes('cod') ||
      q.includes('emulator') ||
      q.includes('ipad') ||
      q.includes('point') ||
      q.includes('hack') ||
      q.includes('cheat')
    ) {
      return {
        text: 'Official Esports Rulebooks Enforced on Skill Arena:',
        bullets: [
          'Device Policy (All Games): Strictly Mobile Handheld Devices Only (iOS & Android phones). Emulators (BlueStacks, Gameloop, etc.), tablets/iPads, triggers, macros, and third-party scripts result in immediate disqualification.',
          'Lobby & Slot Discipline: Players/Teams must occupy ONLY their registered Slot Number in the custom room at least 5 minutes before match start. Never share the Room ID or Password with unregistered players.',
          'BGMI Official Rules (BMPS/BGIS 10-Point System): 1st = 10 pts, 2nd = 6 pts, 3rd = 5 pts, 4th = 4 pts, 5th = 3 pts, 6th = 2 pts, 7th–8th = 1 pt, plus 1 pt per Finish.',
          'Free Fire Max Official Rules (FFWS 12-Point System): Booyah (1st) = 12 pts, 2nd = 9 pts, 3rd = 8 pts, down to 10th = 1 pt, plus 1 pt per Elimination.',
          'COD Mobile Official Rules: Official CODM Esports settings apply for Battle Royale & 5v5 Multiplayer modes.',
        ],
      };
    }

    // 9. Account Recovery / Forgot Password / Master Recovery Key / Security Question
    if (
      q.includes('recover') ||
      q.includes('forgot') ||
      q.includes('reset') ||
      q.includes('master key') ||
      q.includes('recovery key') ||
      q.includes('security question') ||
      q.includes('password')
    ) {
      return {
        text: 'How the Multi-Factor Account Recovery & Password Reset System Works:',
        bullets: [
          'Method 1 — 12-Digit Master Recovery Key: Every account receives a unique 12-character Master Recovery Key (SA-XXXX-XXXX-XXXX) at signup or inside Profile → Account Recovery Vault. Enter your Registered Email + Master Key on the Login → "Recover" tab to reset your password immediately.',
          'Method 2 — Security Question + Email/UPI Verification: Answer your configured Security Question along with your Registered Email Address on the Login → "Recover" tab.',
          'Automatic Key Rotation: Whenever you reset your password, Skill Arena automatically generates a fresh Master Recovery Key and invalidates the old key.',
          `Admin-Assisted Recovery: If you lost both your Master Key and Security Answer, reach out on Telegram (${OFFICIAL_TELEGRAM_URL}) or email ${OFFICIAL_SUPPORT_EMAIL} for an Admin-verified password reset.`,
        ],
        actionRoute: user
          ? { label: 'Open Recovery Vault in Profile', route: 'profile' }
          : undefined,
        showSocials: true,
      };
    }

    // 10. DPDP Act 2023 / Privacy / Delete Account / Data Export / Nominee / Grievance
    if (
      q.includes('dpdp') ||
      q.includes('privacy') ||
      q.includes('data') ||
      q.includes('delete') ||
      q.includes('erase') ||
      q.includes('nominee') ||
      q.includes('grievance') ||
      q.includes('security') ||
      q.includes('profile')
    ) {
      return {
        text: 'DPDP Act, 2023 (India) Security & Your Data Principal Rights:',
        bullets: [
          'Section 8(5) PII Masking: Toggle privacy masking in your Profile to hide your email and UPI ID on screen.',
          'Section 11 Right to Access: Download a complete machine-readable JSON copy of all your personal data, participations, and transactions from your Profile.',
          'Section 12 Right to Correction & Erasure: Update your email, password, or UPI ID anytime, or permanently erase your account and personal records.',
          'Section 14 Right to Nominate: Designate a trusted Nominee in your Profile.',
          `Section 13 Grievance Redressal Desk: Submit a formal privacy ticket in your Profile or email ${OFFICIAL_SUPPORT_EMAIL}.`,
        ],
        actionRoute: user
          ? { label: 'Open Profile & Privacy Center', route: 'profile' }
          : undefined,
      };
    }

    // 10. Default comprehensive overview that answers general queries + lists live tournaments
    const tournamentSummary =
      activeTournaments.length > 0
        ? activeTournaments.slice(0, 3).map((t) => {
            const prizes = getPrizeBreakdown(t);
            const maxSlots = getTournamentMaxSlots(t);
            return `Live/Upcoming: "${t.title}" (${t.game_name} · ${getTournamentMode(
              t
            )}) — Entry: ₹${t.entry_fee} | Prize Pool: ₹${t.prize_pool} (1st: ₹${
              prizes.first
            }) | Max Slots: ${maxSlots}`;
          })
        : [
            'No tournaments are currently scheduled by the Admin. Check back soon or follow our Telegram channel for new match drops!',
          ];

    return {
      text: 'I can help you with every feature in Skill Arena! Here is a quick summary based on your query:',
      bullets: [
        ...tournamentSummary,
        'Tournaments: Join Solo (100 slots), Duo (50 team slots), or Squad (25 team slots). Duo/Squad winners are awarded by Team Name.',
        'Wallet: Add cash by uploading a UPI payment screenshot. Withdraw winnings (min ₹50) to your UPI ID within 24 hours.',
        'Alerts & Refunds: Automatic 5-minute countdown popup before match start, and 100% automatic wallet refund if a tournament is cancelled.',
        `Need human assistance? Reach us on Telegram, Instagram, or ${OFFICIAL_SUPPORT_EMAIL}.`,
      ],
      showSocials: true,
    };
  };

  const handleSendQuery = (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: getNowTime(),
    };

    const replyData = buildSmartAnswer(trimmed);
    const botMsg: ChatMessage = {
      id: `bot_${Date.now() + 1}`,
      sender: 'bot',
      timestamp: getNowTime(),
      ...replyData,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInputQuery('');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendQuery(inputQuery);
  };

  return (
    <>
      {/* Floating Support Chat Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-20 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-2xl shadow-amber-500/25 border border-amber-300 transition-all cursor-pointer"
        title="Open 24/7 Support Chat & Official Socials"
      >
        <i
          className={`fa-solid ${
            isOpen ? 'fa-xmark' : 'fa-headset'
          } text-base`}
        ></i>
        <span>{isOpen ? 'Close Support' : '24/7 Chat Support'}</span>
      </button>

      {/* Support Chat Modal / Drawer */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-36 sm:right-4 z-50 sm:w-[410px] sm:max-h-[640px] bg-slate-900 border border-slate-700 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-[#0B0F17] border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <i className="fa-solid fa-headset text-lg"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-sm text-white">
                    Skill Arena Support Chat
                  </h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-mono font-bold text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    ONLINE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Instant App Assistant & Official Social Channels
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Official Support Socials Banner */}
          <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Official Socials:
            </span>
            <div className="flex items-center gap-2">
              <a
                href={OFFICIAL_TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
              >
                <i className="fa-brands fa-telegram"></i>
                <span>Telegram</span>
              </a>
              <a
                href={OFFICIAL_INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/40 text-pink-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
              >
                <i className="fa-brands fa-instagram"></i>
                <span>Instagram</span>
              </a>
            </div>
          </div>

          {/* Quick-Ask Topic Chips */}
          <div className="px-3.5 py-2.5 bg-[#0B0F17]/60 border-b border-slate-800/80 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
            {QUICK_TOPICS.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => handleSendQuery(topic.query)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-700 text-[11px] font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
              >
                <i className={`fa-solid ${topic.icon} text-[10px]`}></i>
                <span>{topic.label}</span>
              </button>
            ))}
          </div>

          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[360px] sm:max-h-[340px] bg-[#0B0F17]/40">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl p-3.5 text-xs leading-relaxed space-y-2 ${
                    msg.sender === 'user'
                      ? 'bg-amber-500 text-slate-950 font-semibold rounded-br-none'
                      : 'bg-slate-800/95 border border-slate-700/80 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p>{msg.text}</p>

                  {msg.bullets && msg.bullets.length > 0 && (
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300">
                      {msg.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}

                  {msg.actionRoute && onNavigate && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate(msg.actionRoute!.route);
                          setIsOpen(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{msg.actionRoute.label}</span>
                        <i className="fa-solid fa-arrow-right text-[10px]"></i>
                      </button>
                    </div>
                  )}

                  {msg.showSocials && (
                    <div className="pt-2 border-t border-slate-700/70 flex flex-wrap items-center gap-2">
                      <a
                        href={OFFICIAL_TELEGRAM_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 font-semibold text-[11px] inline-flex items-center gap-1.5"
                      >
                        <i className="fa-brands fa-telegram"></i>
                        <span>Join Telegram Channel</span>
                      </a>
                      <a
                        href={OFFICIAL_INSTAGRAM_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-300 font-semibold text-[11px] inline-flex items-center gap-1.5"
                      >
                        <i className="fa-brands fa-instagram"></i>
                        <span>Follow Instagram</span>
                      </a>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 font-mono mt-1 px-1">
                  {msg.sender === 'user' ? 'You' : 'Skill Arena Support'} ·{' '}
                  {msg.timestamp}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Form */}
          <form
            onSubmit={handleFormSubmit}
            className="p-3 bg-[#0B0F17] border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask any question about Skill Arena..."
              className="flex-1 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <i className="fa-solid fa-paper-plane text-xs"></i>
              <span>Ask</span>
            </button>
          </form>
        </div>
      )}
    </>
  );
};
