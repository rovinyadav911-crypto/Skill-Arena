import React, { useEffect, useRef, useState } from 'react';
import {
  NotificationRecord,
  ParticipantRecord,
  TournamentRecord,
  UserRecord,
  UserRoute,
} from '../types';
import {
  createNotification,
  deleteNotification,
  getTournamentMode,
  markAllNotificationsReadForUser,
  markNotificationRead,
  parseMatchTimeMs,
} from '../services/dbService';

interface UserLayoutProps {
  user: UserRecord;
  activeRoute: UserRoute;
  notifications: NotificationRecord[];
  tournaments: TournamentRecord[];
  participants: ParticipantRecord[];
  onNavigate: (route: UserRoute) => void;
  onSwitchToAdmin: () => void;
  children: React.ReactNode;
}

export const UserLayout: React.FC<UserLayoutProps> = ({
  user,
  activeRoute,
  notifications,
  tournaments,
  participants,
  onNavigate,
  onSwitchToAdmin,
  children,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [dismissedLiveIds, setDismissedLiveIds] = useState<string[]>([]);
  const [dismissedPopupKeys, setDismissedPopupKeys] = useState<string[]>([]);
  const [copiedPopupField, setCopiedPopupField] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const autoCreatedNotifKeysRef = useRef<Set<string>>(new Set());

  // Tick every second to detect the exact 5-minute countdown window before tournament start
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const userNotifications = notifications
    .filter((n) => n.user_id === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const unreadNotifications = userNotifications.filter((n) => !n.is_read);

  // Tournaments the user has registered for
  const userParticipations = participants.filter((p) => p.user_id === user.id);
  const userJoinedTournamentIds = new Set(
    userParticipations.map((p) => p.tournament_id)
  );

  // Detect any registered tournament that is within 5 minutes of starting (<= 300s before start up to 10 mins after start)
  // OR has an unread 'starting_soon' notification
  const fiveMinStartingTournaments = tournaments
    .filter((t) => {
      if (!userJoinedTournamentIds.has(t.id)) return false;
      if (t.status === 'Completed' || t.status === 'Cancelled') return false;

      const popupKey = `${t.id}_${t.match_time}`;
      if (dismissedPopupKeys.includes(popupKey)) return false;

      const startMs = parseMatchTimeMs(t.match_time);
      const isWithinFiveMinsWindow =
        startMs !== null &&
        startMs - nowMs <= 5 * 60 * 1000 &&
        startMs - nowMs >= -10 * 60 * 1000;

      const hasUnreadStartingNotif = unreadNotifications.some(
        (n) => n.tournament_id === t.id && n.type === 'starting_soon'
      );

      return isWithinFiveMinsWindow || hasUnreadStartingNotif;
    })
    .sort((a, b) => {
      const aMs = parseMatchTimeMs(a.match_time) ?? Number.MAX_SAFE_INTEGER;
      const bMs = parseMatchTimeMs(b.match_time) ?? Number.MAX_SAFE_INTEGER;
      return aMs - bMs;
    });

  // Automatically create a persistent 'starting_soon' notification in Firestore when a registered tournament hits the 5-minute window
  useEffect(() => {
    for (const t of tournaments) {
      if (!userJoinedTournamentIds.has(t.id)) continue;
      if (t.status !== 'Upcoming' && t.status !== 'Live') continue;

      const startMs = parseMatchTimeMs(t.match_time);
      if (startMs === null) continue;

      const diffMs = startMs - nowMs;
      if (diffMs <= 5 * 60 * 1000 && diffMs >= -60 * 1000) {
        const autoKey = `auto5min_${user.id}_${t.id}_${t.match_time.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        const alreadyExists = userNotifications.some(
          (n) =>
            n.id === autoKey ||
            (n.tournament_id === t.id &&
              n.type === 'starting_soon' &&
              !n.is_read)
        );
        if (!alreadyExists && !autoCreatedNotifKeysRef.current.has(autoKey)) {
          autoCreatedNotifKeysRef.current.add(autoKey);
          const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const roomNote = t.room_id
            ? ` Room ID: ${t.room_id}${t.room_password ? ` | Password: ${t.room_password}` : ''}.`
            : ' Check My Tournaments for Room ID & Password.';
          createNotification({
            id: autoKey.slice(0, 120),
            user_id: user.id,
            tournament_id: t.id,
            type: 'starting_soon',
            title: `Starting in 5 Mins: ${t.title}`,
            message: `Your registered match "${t.title}" starts at ${t.match_time} (in less than 5 minutes)!${roomNote} Join the custom room lobby immediately.`,
            is_read: false,
            created_at: nowStr,
          }).catch(() => {
            // Ignore duplicate notification race errors
          });
        }
      }
    }
  }, [nowMs, tournaments, user.id, userJoinedTournamentIds, userNotifications]);

  const activePopupTournament = fiveMinStartingTournaments[0] || null;

  const formatCountdown = (targetTimeStr: string): string => {
    const startMs = parseMatchTimeMs(targetTimeStr);
    if (startMs === null) return 'STARTING SOON';
    const diffSec = Math.floor((startMs - nowMs) / 1000);
    if (diffSec <= 0) return 'STARTING NOW · LOBBY LIVE';
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleDismissPopup = (tournament: TournamentRecord) => {
    const popupKey = `${tournament.id}_${tournament.match_time}`;
    setDismissedPopupKeys((prev) =>
      prev.includes(popupKey) ? prev : [...prev, popupKey]
    );
    // Also mark any unread starting_soon notifications for this tournament as read
    unreadNotifications
      .filter(
        (n) =>
          n.tournament_id === tournament.id && n.type === 'starting_soon'
      )
      .forEach((n) => {
        markNotificationRead(n);
      });
  };

  const handleCopyPopupText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedPopupField(label);
    setTimeout(() => setCopiedPopupField(null), 2000);
  };

  const liveOrStartingJoinedTournaments = tournaments.filter(
    (t) =>
      userJoinedTournamentIds.has(t.id) &&
      (t.status === 'Live' ||
        (t.status === 'Upcoming' && Boolean(t.room_id))) &&
      !dismissedLiveIds.includes(t.id)
  );

  const totalBadgeCount =
    unreadNotifications.length + liveOrStartingJoinedTournaments.length;

  const getNotifIcon = (type: NotificationRecord['type']) => {
    switch (type) {
      case 'starting_soon':
        return {
          icon: 'fa-bolt',
          color: 'text-amber-400',
          bg: 'bg-amber-500/15 border-amber-500/30',
          label: 'STARTING SOON',
        };
      case 'results_finalized':
        return {
          icon: 'fa-trophy',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/15 border-emerald-500/30',
          label: 'RESULTS FINALIZED',
        };
      case 'postponed':
        return {
          icon: 'fa-clock',
          color: 'text-amber-300',
          bg: 'bg-amber-500/15 border-amber-500/30',
          label: 'POSTPONED',
        };
      case 'cancelled':
        return {
          icon: 'fa-rotate-left',
          color: 'text-rose-400',
          bg: 'bg-rose-500/15 border-rose-500/30',
          label: 'CANCELLED & REFUNDED',
        };
      case 'payment_update':
      default:
        return {
          icon: 'fa-wallet',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/15 border-emerald-500/30',
          label: 'WALLET ALERT',
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col pb-20">
      {/* Top Navigation, Logo + Slogan, Notification Bell, and User's Wallet Balance */}
      <header className="sticky top-0 z-30 h-16 bg-[#0B0F17]/95 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand Zone: Logo + SKILL ARENA + Slogan */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-3 text-left group focus:outline-none shrink-0"
        >
          <img
            src="/assets/aistudio/skill-arena-icon_ca7b5100.svg"
            alt="Skill Arena Logo"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl object-contain border border-amber-500/30 shadow-sm group-hover:scale-105 transition-transform"
          />
          <div>
            <div className="font-display font-extrabold text-lg tracking-wider text-white leading-none flex items-center gap-1.5">
              SKILL <span className="text-amber-400">ARENA</span>
            </div>
            <p className="text-[10px] font-medium tracking-widest uppercase text-amber-500/90 mt-0.5">
              Play. Compete. Conquer.
            </p>
          </div>
        </button>

        {/* Desktop Quick Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeRoute === 'home' ? 'text-amber-400 font-semibold' : ''
            }`}
          >
            Upcoming Matches
          </button>
          <button
            type="button"
            onClick={() => onNavigate('my_tournaments')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeRoute === 'my_tournaments'
                ? 'text-amber-400 font-semibold'
                : ''
            }`}
          >
            My Tournaments
          </button>
          <button
            type="button"
            onClick={() => onNavigate('wallet')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeRoute === 'wallet' ? 'text-amber-400 font-semibold' : ''
            }`}
          >
            Wallet
          </button>
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeRoute === 'profile' ? 'text-amber-400 font-semibold' : ''
            }`}
          >
            Profile
          </button>
        </nav>

        {/* Right Action Zone: Notification Bell, Wallet Balance & Admin Switch */}
        <div className="flex items-center gap-2 shrink-0 relative">
          {/* Notification Bell Button */}
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            className="relative w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-200 hover:text-amber-400 transition-colors"
            title="Notifications & Match Alerts"
          >
            <i className="fa-solid fa-bell text-sm"></i>
            {totalBadgeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-950 font-mono font-extrabold text-[10px] flex items-center justify-center">
                {totalBadgeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('wallet')}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-amber-500/30 rounded-xl px-3.5 py-2 transition-colors min-h-[40px]"
            title="Open Wallet"
          >
            <i className="fa-solid fa-wallet text-amber-400 text-sm"></i>
            <span className="font-mono font-bold text-sm text-white tabular-nums">
              ₹{user.wallet_balance.toLocaleString('en-IN')}
            </span>
            <span className="w-5 h-5 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-bold">
              +
            </span>
          </button>

          <button
            type="button"
            onClick={onSwitchToAdmin}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-amber-400 text-xs font-medium transition-colors flex items-center gap-1.5 min-h-[40px] whitespace-nowrap shrink-0"
            title="Switch to Admin Panel"
          >
            <i className="fa-solid fa-user-shield text-amber-400"></i>
            <span className="hidden sm:inline">Admin Panel</span>
          </button>

          {/* Notification Dropdown / Drawer */}
          {notifOpen && (
            <div className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-13 z-50 w-[calc(100vw-24px)] sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0B0F17]">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-bell text-amber-400 text-xs"></i>
                  <span className="font-display font-bold text-sm text-white">
                    Match & Wallet Alerts ({userNotifications.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {unreadNotifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        markAllNotificationsReadForUser(
                          user.id,
                          userNotifications
                        )
                      }
                      className="text-[11px] font-semibold text-amber-400 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                  >
                    <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/80">
                {liveOrStartingJoinedTournaments.map((liveTour) => (
                  <div
                    key={`live_${liveTour.id}`}
                    className="p-3.5 bg-amber-500/10 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-bolt"></i>
                        <span>REGISTERED MATCH STARTING / LIVE</span>
                      </div>
                      <div className="text-xs font-bold text-white">
                        {liveTour.title}
                      </div>
                      <div className="text-[11px] text-slate-300">
                        Scheduled: {liveTour.match_time}
                        {liveTour.room_id
                          ? ` · Room ID: ${liveTour.room_id}`
                          : ''}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          onNavigate('my_tournaments');
                        }}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:underline"
                      >
                        <span>View Room ID & Password</span>
                        <i className="fa-solid fa-arrow-right text-[10px]"></i>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedLiveIds((prev) => [...prev, liveTour.id])
                      }
                      className="text-slate-500 hover:text-white text-xs p-1"
                      title="Dismiss reminder"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ))}

                {userNotifications.length === 0 &&
                liveOrStartingJoinedTournaments.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    <i className="fa-regular fa-bell-slash text-2xl mb-2 block text-slate-600"></i>
                    No match or wallet notifications yet. You will be alerted here when a tournament starts, is postponed, finalized, or refunded.
                  </div>
                ) : (
                  userNotifications.map((notif) => {
                    const meta = getNotifIcon(notif.type);
                    return (
                      <div
                        key={notif.id}
                        className={`p-3.5 transition-colors ${
                          notif.is_read ? 'bg-slate-900' : 'bg-[#0B0F17]/90'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${meta.bg} ${meta.color}`}
                            >
                              <i className={`fa-solid ${meta.icon} text-xs`}></i>
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-mono font-bold uppercase ${meta.color}`}
                                >
                                  {meta.label}
                                </span>
                                {!notif.is_read && (
                                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                )}
                              </div>
                              <div className="text-xs font-bold text-white">
                                {notif.title}
                              </div>
                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                {notif.message}
                              </p>
                              <div className="flex items-center gap-3 pt-1 text-[10px] font-mono text-slate-500">
                                <span>{notif.created_at}</span>
                                {!notif.is_read && (
                                  <button
                                    type="button"
                                    onClick={() => markNotificationRead(notif)}
                                    className="text-amber-400 hover:underline font-sans font-semibold"
                                  >
                                    Mark read
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    markNotificationRead(notif);
                                    setNotifOpen(false);
                                    onNavigate(
                                      notif.type === 'payment_update' ||
                                        notif.type === 'cancelled'
                                        ? 'wallet'
                                        : 'my_tournaments'
                                    );
                                  }}
                                  className="text-emerald-400 hover:underline font-sans font-semibold"
                                >
                                  Open
                                </button>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => deleteNotification(notif.id)}
                            className="text-slate-500 hover:text-rose-400 text-xs p-1 shrink-0"
                            title="Delete notification"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 lg:px-8 space-y-4">
        {/* In-App Live Alert Banners for Unread Notifications (Starting Soon / Postponed / Finalized / Cancelled / Payment) */}
        {unreadNotifications.slice(0, 2).map((notif) => {
          const meta = getNotifIcon(notif.type);
          return (
            <div
              key={notif.id}
              className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}
                >
                  <i className={`fa-solid ${meta.icon} text-sm`}></i>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {notif.created_at}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
                    {notif.title}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {notif.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    markNotificationRead(notif);
                    onNavigate(
                      notif.type === 'payment_update' ||
                        notif.type === 'cancelled'
                        ? 'wallet'
                        : 'my_tournaments'
                    );
                  }}
                  className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap"
                >
                  View Details
                </button>
                <button
                  type="button"
                  onClick={() => markNotificationRead(notif)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}

        {children}
      </main>

      {/* 5-MINUTE BEFORE TOURNAMENT STARTING POPUP NOTIFICATION MODAL */}
      {activePopupTournament &&
        (() => {
          const userSlot = userParticipations.find(
            (p) => p.tournament_id === activePopupTournament.id
          );
          const mode = getTournamentMode(activePopupTournament);
          const countdownText = formatCountdown(
            activePopupTournament.match_time
          );

          return (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Popup Header */}
                <div className="p-4 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-slate-900 border-b border-amber-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md shrink-0">
                      <i className="fa-solid fa-bell text-base animate-bounce"></i>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-extrabold uppercase tracking-widest text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                        <span>5-MINUTE MATCH STARTING ALERT</span>
                      </span>
                      <h3 className="font-display font-extrabold text-base text-white leading-tight mt-0.5">
                        Get Ready! Tournament Starting Soon
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDismissPopup(activePopupTournament)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0"
                    title="Close popup"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                {/* Popup Body */}
                <div className="p-5 space-y-4">
                  {/* Countdown Banner */}
                  <div className="bg-[#0B0F17] border border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        Time Remaining Until Match Start
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5 font-mono">
                        Scheduled: {activePopupTournament.match_time}
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 font-mono font-extrabold text-lg text-amber-300 tabular-nums">
                      {countdownText}
                    </div>
                  </div>

                  {/* Tournament Info */}
                  <div className="bg-[#0B0F17]/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold text-amber-400 uppercase">
                        {activePopupTournament.game_name}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-white uppercase">
                        {mode} Mode
                      </span>
                    </div>
                    <div className="font-display font-bold text-base text-white">
                      {activePopupTournament.title}
                    </div>
                    {userSlot && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono text-emerald-300">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 font-bold">
                          Your Slot: #{userSlot.slot_number || 1}
                        </span>
                        {userSlot.team_name && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                            Team: {userSlot.team_name}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Room ID & Password inside Popup */}
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2.5">
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <i className="fa-solid fa-key"></i>
                      <span>Custom Room Credentials</span>
                    </div>
                    {activePopupTournament.room_id ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] text-slate-400 uppercase">
                              Room ID
                            </div>
                            <div className="font-mono font-bold text-xs text-white truncate">
                              {activePopupTournament.room_id}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyPopupText(
                                activePopupTournament.room_id,
                                'popup_id'
                              )
                            }
                            className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] shrink-0"
                          >
                            {copiedPopupField === 'popup_id'
                              ? 'Copied!'
                              : 'Copy'}
                          </button>
                        </div>

                        <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] text-slate-400 uppercase">
                              Password
                            </div>
                            <div className="font-mono font-bold text-xs text-white truncate">
                              {activePopupTournament.room_password || 'N/A'}
                            </div>
                          </div>
                          {activePopupTournament.room_password && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyPopupText(
                                  activePopupTournament.room_password,
                                  'popup_pass'
                                )
                              }
                              className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] shrink-0"
                            >
                              {copiedPopupField === 'popup_pass'
                                ? 'Copied!'
                                : 'Copy'}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-300">
                        Room ID & Password will appear in your{' '}
                        <strong className="text-white">My Tournaments</strong>{' '}
                        lobby momentarily. Please open the lobby and take your assigned slot!
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        handleDismissPopup(activePopupTournament);
                        onNavigate('my_tournaments');
                      }}
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <i className="fa-solid fa-gamepad"></i>
                      <span>Open Match Lobby Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismissPopup(activePopupTournament)}
                      className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Fixed Bottom Navigation with Icons (Home, My Tournaments, Wallet, Profile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#0B0F17]/95 backdrop-blur-md border-t border-slate-800/90 grid grid-cols-4 items-center max-w-6xl mx-auto">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center justify-center h-full transition-colors ${
            activeRoute === 'home'
              ? 'text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <i className="fa-solid fa-house text-lg"></i>
          <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">
            Home
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('my_tournaments')}
          className={`flex flex-col items-center justify-center h-full transition-colors ${
            activeRoute === 'my_tournaments'
              ? 'text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <i className="fa-solid fa-trophy text-lg"></i>
          <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">
            My Tournaments
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('wallet')}
          className={`flex flex-col items-center justify-center h-full transition-colors ${
            activeRoute === 'wallet'
              ? 'text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <i className="fa-solid fa-wallet text-lg"></i>
          <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">
            Wallet
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className={`flex flex-col items-center justify-center h-full transition-colors ${
            activeRoute === 'profile'
              ? 'text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <i className="fa-solid fa-user text-lg"></i>
          <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">
            Profile
          </span>
        </button>
      </nav>
    </div>
  );
};
