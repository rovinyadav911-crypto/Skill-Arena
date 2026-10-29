import React, { useState } from 'react';
import {
  ParticipantRecord,
  TeamMode,
  TournamentRecord,
  TransactionRecord,
  UserRecord,
} from '../types';
import {
  cancelTournamentAndRefundAll,
  createOrUpdateUser,
  createTransaction,
  generateSafeId,
  getDefaultMaxSlots,
  getParticipantDisplayName,
  getParticipantRoster,
  getPrizeBreakdown,
  getTournamentMaxSlots,
  getTournamentMode,
  getTournamentRules,
  notifyTournamentParticipants,
  saveTournament,
  TOURNAMENT_RULE_PRESETS,
} from '../services/dbService';

interface AdminManageTournamentViewProps {
  tournament: TournamentRecord | undefined;
  participants: ParticipantRecord[];
  users: UserRecord[];
  onBack: () => void;
}

export const AdminManageTournamentView: React.FC<
  AdminManageTournamentViewProps
> = ({ tournament, participants, users, onBack }) => {
  const initialPrizes = tournament
    ? getPrizeBreakdown(tournament)
    : { first: 0, second: 0, third: 0, total: 0 };

  const [roomId, setRoomId] = useState(tournament?.room_id || '');
  const [roomPassword, setRoomPassword] = useState(
    tournament?.room_password || ''
  );
  const [matchTime, setMatchTime] = useState(tournament?.match_time || '');
  const [status, setStatus] = useState<
    'Upcoming' | 'Live' | 'Completed' | 'Cancelled'
  >(tournament?.status || 'Upcoming');
  const [teamMode, setTeamMode] = useState<TeamMode>(
    tournament ? getTournamentMode(tournament) : 'Squad'
  );
  const [maxSlots, setMaxSlots] = useState<string>(
    String(tournament ? getTournamentMaxSlots(tournament) : 25)
  );

  const [prize1st, setPrize1st] = useState(String(initialPrizes.first));
  const [prize2nd, setPrize2nd] = useState(String(initialPrizes.second));
  const [prize3rd, setPrize3rd] = useState(String(initialPrizes.third));
  const [rules, setRules] = useState(
    tournament ? getTournamentRules(tournament) : TOURNAMENT_RULE_PRESETS[0].rules
  );

  const [winner1stId, setWinner1stId] = useState(tournament?.winner_id || '');
  const [winner2ndId, setWinner2ndId] = useState(
    tournament?.winner_2nd_id || ''
  );
  const [winner3rdId, setWinner3rdId] = useState(
    tournament?.winner_3rd_id || ''
  );

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!tournament) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <p className="text-sm text-slate-400 mb-4">Tournament not found.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
        >
          Back to Tournaments
        </button>
      </div>
    );
  }

  const joinedParticipants = participants.filter(
    (p) => p.tournament_id === tournament.id
  );

  const p1Amount = Math.max(0, Number(prize1st) || 0);
  const p2Amount = Math.max(0, Number(prize2nd) || 0);
  const p3Amount = Math.max(0, Number(prize3rd) || 0);
  const totalPrizePool = p1Amount + p2Amount + p3Amount;

  const handleRoomAndPrizesUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      // If Admin selected Cancelled status, trigger automatic refund to all registered players
      if (status === 'Cancelled' && tournament.status !== 'Cancelled') {
        const { refundedCount, totalRefunded } =
          await cancelTournamentAndRefundAll({
            tournament,
            participants,
            users,
          });
        setStatus('Cancelled');
        setFeedback({
          type: 'success',
          message: `Tournament cancelled! Automatically refunded ₹${totalRefunded} across ${refundedCount} registered player(s) and sent cancellation notifications.`,
        });
        return;
      }

      const nextStatus =
        roomId.trim() && status === 'Upcoming' ? 'Live' : status;
      const oldMatchTime = tournament.match_time.trim();
      const newMatchTime = (matchTime || tournament.match_time).trim();
      const wasPostponed = oldMatchTime !== newMatchTime;
      const becameLiveOrRoomAdded =
        (nextStatus === 'Live' && tournament.status !== 'Live') ||
        (roomId.trim() && roomId.trim() !== tournament.room_id.trim());

      const updatedRecord: TournamentRecord = {
        ...tournament,
        team_mode: teamMode,
        max_slots: Math.min(
          500,
          Math.max(2, Number(maxSlots) || getDefaultMaxSlots(teamMode))
        ),
        match_time: newMatchTime,
        room_id: roomId.trim(),
        room_password: roomPassword.trim(),
        status: nextStatus,
        prize_1st: p1Amount,
        prize_2nd: p2Amount,
        prize_3rd: p3Amount,
        prize_pool: totalPrizePool,
        rules: rules.trim(),
      };

      await saveTournament(updatedRecord);
      setStatus(nextStatus);

      const alertNotes: string[] = [];

      if (wasPostponed) {
        const count = await notifyTournamentParticipants({
          tournament: updatedRecord,
          participants,
          type: 'postponed',
          title: `Tournament Postponed: ${updatedRecord.title}`,
          message: `The match start time for "${updatedRecord.title}" has been postponed from ${oldMatchTime} to ${newMatchTime}.`,
        });
        if (count > 0) {
          alertNotes.push(`Postponement alert sent to ${count} player(s)`);
        }
      }

      if (becameLiveOrRoomAdded) {
        const roomDetailsText = updatedRecord.room_id
          ? ` Room ID: ${updatedRecord.room_id}${
              updatedRecord.room_password
                ? ` · Password: ${updatedRecord.room_password}`
                : ''
            }.`
          : '';
        const count = await notifyTournamentParticipants({
          tournament: updatedRecord,
          participants,
          type: 'starting_soon',
          title: `Match Starting Soon: ${updatedRecord.title}`,
          message: `Your registered tournament "${updatedRecord.title}" is starting soon!${roomDetailsText} Join your assigned slot now.`,
        });
        if (count > 0) {
          alertNotes.push(`Starting Soon alert sent to ${count} player(s)`);
        }
      }

      setFeedback({
        type: 'success',
        message: `Updated Room credentials, schedule, and Prize Pool!${
          alertNotes.length > 0 ? ` (${alertNotes.join(' · ')})` : ''
        }`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to update Room details and prizes.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendStartingSoonAlert = async () => {
    setFeedback(null);
    setSaving(true);
    try {
      const roomDetailsText = roomId.trim()
        ? ` Room ID: ${roomId.trim()}${
            roomPassword.trim() ? ` · Password: ${roomPassword.trim()}` : ''
          }.`
        : ' Room ID & Password will be visible in My Tournaments.';
      const count = await notifyTournamentParticipants({
        tournament,
        participants,
        type: 'starting_soon',
        title: `Tournament Starting Soon: ${tournament.title}`,
        message: `Get ready! "${tournament.title}" (${tournament.game_name}) is about to start at ${matchTime || tournament.match_time}.${roomDetailsText}`,
      });
      setFeedback({
        type: 'success',
        message: `Sent "Starting Soon" alert to ${count} registered player(s)!`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to send Starting Soon alert.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelTournamentWithRefund = async () => {
    if (
      tournament.status === 'Cancelled' ||
      tournament.status === 'Completed'
    ) {
      return;
    }
    setFeedback(null);
    setSaving(true);
    try {
      const { refundedCount, totalRefunded } =
        await cancelTournamentAndRefundAll({
          tournament,
          participants,
          users,
        });
      setStatus('Cancelled');
      setFeedback({
        type: 'success',
        message: `Tournament cancelled! Automatically refunded ₹${totalRefunded} to ${refundedCount} registered player(s) and sent in-app notifications.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to cancel tournament and refund players.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeclareWinners = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (
      tournament.status === 'Completed' ||
      tournament.status === 'Cancelled'
    ) {
      setFeedback({
        type: 'error',
        message: `This tournament is already marked ${tournament.status}.`,
      });
      return;
    }

    const isTeamTournament = teamMode === 'Duo' || teamMode === 'Squad';

    if (!winner1stId) {
      setFeedback({
        type: 'error',
        message: isTeamTournament
          ? 'Please select at least the 1st Place Winning Team from the dropdown.'
          : 'Please select at least the 1st Place Winner from the dropdown.',
      });
      return;
    }

    const selectedIds = [winner1stId, winner2ndId, winner3rdId].filter(Boolean);
    if (new Set(selectedIds).size !== selectedIds.length) {
      setFeedback({
        type: 'error',
        message: isTeamTournament
          ? 'Please select different Teams for 1st, 2nd, and 3rd places.'
          : 'Please select different players for 1st, 2nd, and 3rd places.',
      });
      return;
    }

    const part1st = joinedParticipants.find((p) => p.user_id === winner1stId);
    const part2nd = winner2ndId
      ? joinedParticipants.find((p) => p.user_id === winner2ndId)
      : undefined;
    const part3rd = winner3rdId
      ? joinedParticipants.find((p) => p.user_id === winner3rdId)
      : undefined;

    const user1st = users.find((u) => u.id === winner1stId);
    const user2nd = winner2ndId
      ? users.find((u) => u.id === winner2ndId)
      : undefined;
    const user3rd = winner3rdId
      ? users.find((u) => u.id === winner3rdId)
      : undefined;

    if (!user1st || !part1st) {
      setFeedback({
        type: 'error',
        message: 'Selected 1st place record was not found.',
      });
      return;
    }

    const winner1stLabel = getParticipantDisplayName(part1st, teamMode);
    const winner2ndLabel =
      part2nd && user2nd ? getParticipantDisplayName(part2nd, teamMode) : '';
    const winner3rdLabel =
      part3rd && user3rd ? getParticipantDisplayName(part3rd, teamMode) : '';

    setSaving(true);
    try {
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const distributedSummary: string[] = [];

      // 1. Distribute 1st Place Prize
      if (p1Amount > 0) {
        await createOrUpdateUser({
          ...user1st,
          wallet_balance: user1st.wallet_balance + p1Amount,
        });
        const tx1: TransactionRecord = {
          id: generateSafeId('tx1'),
          user_id: user1st.id,
          username: user1st.username,
          amount: p1Amount,
          type: 'credit',
          description: `1st Place Prize (${winner1stLabel}): ${tournament.title}`,
          created_at: nowStr,
        };
        await createTransaction(tx1);
        distributedSummary.push(`1st: ${winner1stLabel} (+₹${p1Amount})`);
      }

      // 2. Distribute 2nd Place Prize (if selected and prize > 0)
      if (user2nd && part2nd && p2Amount > 0) {
        await createOrUpdateUser({
          ...user2nd,
          wallet_balance: user2nd.wallet_balance + p2Amount,
        });
        const tx2: TransactionRecord = {
          id: generateSafeId('tx2'),
          user_id: user2nd.id,
          username: user2nd.username,
          amount: p2Amount,
          type: 'credit',
          description: `2nd Place Prize (${winner2ndLabel}): ${tournament.title}`,
          created_at: nowStr,
        };
        await createTransaction(tx2);
        distributedSummary.push(`2nd: ${winner2ndLabel} (+₹${p2Amount})`);
      }

      // 3. Distribute 3rd Place Prize (if selected and prize > 0)
      if (user3rd && part3rd && p3Amount > 0) {
        await createOrUpdateUser({
          ...user3rd,
          wallet_balance: user3rd.wallet_balance + p3Amount,
        });
        const tx3: TransactionRecord = {
          id: generateSafeId('tx3'),
          user_id: user3rd.id,
          username: user3rd.username,
          amount: p3Amount,
          type: 'credit',
          description: `3rd Place Prize (${winner3rdLabel}): ${tournament.title}`,
          created_at: nowStr,
        };
        await createTransaction(tx3);
        distributedSummary.push(`3rd: ${winner3rdLabel} (+₹${p3Amount})`);
      }

      // 4. Mark tournament as Completed and save all winners (by Team Name for Duo/Squad, or Player Name for Solo)
      const finalizedTournament: TournamentRecord = {
        ...tournament,
        team_mode: teamMode,
        status: 'Completed',
        prize_pool: totalPrizePool,
        prize_1st: p1Amount,
        prize_2nd: p2Amount,
        prize_3rd: p3Amount,
        winner_id: user1st.id,
        winner_username: winner1stLabel,
        winner_2nd_id: user2nd ? user2nd.id : '',
        winner_2nd_username: winner2ndLabel,
        winner_3rd_id: user3rd ? user3rd.id : '',
        winner_3rd_username: winner3rdLabel,
      };
      await saveTournament(finalizedTournament);
      setStatus('Completed');

      // 5. Notify all registered participants that results are finalized
      const podiumSummary = [
        `1st: ${winner1stLabel} (₹${p1Amount})`,
        winner2ndLabel ? `2nd: ${winner2ndLabel} (₹${p2Amount})` : '',
        winner3rdLabel ? `3rd: ${winner3rdLabel} (₹${p3Amount})` : '',
      ]
        .filter(Boolean)
        .join(' · ');

      await notifyTournamentParticipants({
        tournament: finalizedTournament,
        participants,
        type: 'results_finalized',
        title: `Results Finalized: ${tournament.title}`,
        message: `Official results for "${tournament.title}" have been finalized! ${podiumSummary}. Winning prizes have been credited to winners' wallets.`,
      });

      setFeedback({
        type: 'success',
        message: `Winners declared, prizes credited & players notified! ${distributedSummary.join(
          ' · '
        )}`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to declare winners and distribute prizes.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">
            Manage: {tournament.title}
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {tournament.game_name} · Format: {teamMode.toUpperCase()} (Slots:{' '}
            {joinedParticipants.length}/{maxSlots}) · Total Pool: ₹
            {totalPrizePool} (1st: ₹{p1Amount} · 2nd: ₹{p2Amount} · 3rd: ₹
            {p3Amount}) · Entry: ₹{tournament.entry_fee}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {(tournament.status === 'Upcoming' || tournament.status === 'Live') && (
            <>
              <button
                type="button"
                disabled={saving || joinedParticipants.length === 0}
                onClick={handleSendStartingSoonAlert}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold text-xs min-h-[42px] transition-colors"
              >
                <i className="fa-solid fa-bell mr-1.5"></i>
                Notify Starting Soon
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleCancelTournamentWithRefund}
                className="px-3.5 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 font-semibold text-xs min-h-[42px] transition-colors"
              >
                <i className="fa-solid fa-ban mr-1.5"></i>
                Cancel & Refund All
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white min-h-[42px]"
          >
            <i className="fa-solid fa-arrow-left mr-1.5"></i>
            Back
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form 1: Enter/Update Room ID, Password, Match Time & Prize Breakdown */}
        <form
          onSubmit={handleRoomAndPrizesUpdate}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
            <i className="fa-solid fa-key text-amber-400 text-sm"></i>
            <span>Update Room, Schedule (Postpone) & Prizes</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Room ID
              </label>
              <input
                type="text"
                maxLength={80}
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter custom lobby Room ID"
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Room Password
              </label>
              <input
                type="text"
                maxLength={80}
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                placeholder="Enter custom lobby Password"
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Match Start Time (Changing sends Postponed Alert to registered players)
            </label>
            <input
              type="text"
              maxLength={60}
              value={matchTime}
              onChange={(e) => setMatchTime(e.target.value)}
              placeholder="YYYY-MM-DD HH:MM"
              className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none"
            />
          </div>

          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-amber-400">
                1st / 2nd / 3rd Place Prizes (₹)
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                Total: ₹{totalPrizePool}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  1st Place (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={prize1st}
                  onChange={(e) => setPrize1st(e.target.value)}
                  className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  2nd Place (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={prize2nd}
                  onChange={(e) => setPrize2nd(e.target.value)}
                  className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  3rd Place (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={prize3rd}
                  onChange={(e) => setPrize3rd(e.target.value)}
                  className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Team Format
              </label>
              <select
                value={teamMode}
                onChange={(e) => {
                  const nextMode = e.target.value as TeamMode;
                  setTeamMode(nextMode);
                  setMaxSlots(String(getDefaultMaxSlots(nextMode)));
                }}
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none"
              >
                <option value="Solo">Solo (1 Player)</option>
                <option value="Duo">Duo (2 Players)</option>
                <option value="Squad">Squad (4 Players)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Total Slots
              </label>
              <input
                type="number"
                min={2}
                max={500}
                value={maxSlots}
                onChange={(e) => setMaxSlots(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-mono text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Match Status
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value as
                      | 'Upcoming'
                      | 'Live'
                      | 'Completed'
                      | 'Cancelled'
                  )
                }
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none"
              >
                <option value="Upcoming">Upcoming</option>
                <option value="Live">Live (Shows Room)</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled (Auto-Refund)</option>
              </select>
            </div>
          </div>

          {/* Quick Rule Presets & Rules Editor */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <i className="fa-solid fa-scroll"></i>
                <span>Match Rules & Quick Presets</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TOURNAMENT_RULE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setRules(preset.rules)}
                  className="px-2.5 py-1 rounded-lg bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 transition-colors"
                >
                  {preset.badge}
                </button>
              ))}
            </div>
            <textarea
              rows={4}
              maxLength={2000}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-xs font-mono text-slate-200 leading-relaxed focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs min-h-[44px] transition-colors"
          >
            Save Room, Schedule, Prizes & Rules
          </button>
        </form>

        {/* Form 2: Dropdown Menus to Select 1st, 2nd & 3rd Place Winners & Distribute Prizes */}
        <form
          onSubmit={handleDeclareWinners}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
              <i className="fa-solid fa-crown text-amber-400 text-sm"></i>
              <span>
                Declare 1st, 2nd & 3rd{' '}
                {teamMode === 'Solo' ? 'Winners' : `${teamMode} Teams`} &
                Distribute Prizes
              </span>
            </h2>

            <p className="text-xs text-slate-400">
              {teamMode === 'Solo'
                ? 'Select the top solo finishers from the joined participants. Submitting automatically credits their respective prizes and notifies all registered players.'
                : `Select the winning ${teamMode} Teams by Team Name. Submitting automatically credits the respective prize to each winning team's wallet and notifies all players.`}
            </p>

            {/* 1st Place Winner */}
            <div>
              <label className="block text-xs font-semibold text-amber-400 mb-1">
                <i className="fa-solid fa-crown mr-1.5"></i>
                1st Place {teamMode === 'Solo' ? 'Winner' : 'Winning Team'} (+₹
                {p1Amount.toLocaleString('en-IN')}) *
              </label>
              <select
                value={winner1stId}
                onChange={(e) => setWinner1stId(e.target.value)}
                disabled={
                  tournament.status === 'Completed' ||
                  tournament.status === 'Cancelled'
                }
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none disabled:opacity-60"
              >
                <option value="">
                  {teamMode === 'Solo'
                    ? '-- Select 1st Place Player --'
                    : `-- Select 1st Place ${teamMode} Team --`}
                </option>
                {[...joinedParticipants]
                  .sort(
                    (a, b) => (a.slot_number || 999) - (b.slot_number || 999)
                  )
                  .map((p, idx) => (
                    <option key={p.id} value={p.user_id}>
                      Slot #{p.slot_number || idx + 1} —{' '}
                      {getParticipantDisplayName(p, teamMode)}
                    </option>
                  ))}
              </select>
            </div>

            {/* 2nd Place Winner */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                <i className="fa-solid fa-medal mr-1.5"></i>
                2nd Place {teamMode === 'Solo' ? 'Runner-Up' : 'Runner-Up Team'}{' '}
                (+₹{p2Amount.toLocaleString('en-IN')}) — Optional
              </label>
              <select
                value={winner2ndId}
                onChange={(e) => setWinner2ndId(e.target.value)}
                disabled={
                  tournament.status === 'Completed' ||
                  tournament.status === 'Cancelled'
                }
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none disabled:opacity-60"
              >
                <option value="">
                  {teamMode === 'Solo'
                    ? '-- Select 2nd Place Player (Optional) --'
                    : `-- Select 2nd Place ${teamMode} Team (Optional) --`}
                </option>
                {[...joinedParticipants]
                  .sort(
                    (a, b) => (a.slot_number || 999) - (b.slot_number || 999)
                  )
                  .map((p, idx) => (
                    <option key={p.id} value={p.user_id}>
                      Slot #{p.slot_number || idx + 1} —{' '}
                      {getParticipantDisplayName(p, teamMode)}
                    </option>
                  ))}
              </select>
            </div>

            {/* 3rd Place Winner */}
            <div>
              <label className="block text-xs font-semibold text-amber-500/90 mb-1">
                <i className="fa-solid fa-award mr-1.5"></i>
                3rd Place {teamMode === 'Solo' ? 'Finisher' : 'Team'} (+₹
                {p3Amount.toLocaleString('en-IN')}) — Optional
              </label>
              <select
                value={winner3rdId}
                onChange={(e) => setWinner3rdId(e.target.value)}
                disabled={
                  tournament.status === 'Completed' ||
                  tournament.status === 'Cancelled'
                }
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none disabled:opacity-60"
              >
                <option value="">
                  {teamMode === 'Solo'
                    ? '-- Select 3rd Place Player (Optional) --'
                    : `-- Select 3rd Place ${teamMode} Team (Optional) --`}
                </option>
                {[...joinedParticipants]
                  .sort(
                    (a, b) => (a.slot_number || 999) - (b.slot_number || 999)
                  )
                  .map((p, idx) => (
                    <option key={p.id} value={p.user_id}>
                      Slot #{p.slot_number || idx + 1} —{' '}
                      {getParticipantDisplayName(p, teamMode)}
                    </option>
                  ))}
              </select>
            </div>

            {tournament.winner_username && (
              <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/50 text-xs text-emerald-200 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>1st Place:</span>
                  <span className="font-bold text-amber-400">
                    {tournament.winner_username} (+₹{p1Amount})
                  </span>
                </div>
                {tournament.winner_2nd_username && (
                  <div className="flex justify-between">
                    <span>2nd Place:</span>
                    <span className="font-bold text-slate-200">
                      {tournament.winner_2nd_username} (+₹{p2Amount})
                    </span>
                  </div>
                )}
                {tournament.winner_3rd_username && (
                  <div className="flex justify-between">
                    <span>3rd Place:</span>
                    <span className="font-bold text-amber-500">
                      {tournament.winner_3rd_username} (+₹{p3Amount})
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={
              saving ||
              tournament.status === 'Completed' ||
              tournament.status === 'Cancelled' ||
              joinedParticipants.length === 0
            }
            className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs min-h-[48px] transition-colors flex items-center justify-center gap-2 mt-4"
          >
            <i className="fa-solid fa-trophy"></i>
            <span>
              {tournament.status === 'Completed'
                ? 'Prizes Already Distributed'
                : tournament.status === 'Cancelled'
                ? 'Tournament Cancelled & Refunded'
                : 'Declare Winners & Distribute Prizes'}
            </span>
          </button>
        </form>
      </div>

      {/* List of All Registered Slots & Player Rosters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h2 className="font-display font-bold text-base text-white">
            Registered {teamMode} Slots & Player Rosters (
            {joinedParticipants.length}/{maxSlots})
          </h2>
          <span className="text-xs font-mono text-amber-400">
            {teamMode === 'Solo'
              ? '1 Player per Slot'
              : teamMode === 'Duo'
              ? '2 Players per Slot'
              : '4 Players per Slot'}
          </span>
        </div>

        {joinedParticipants.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No players or teams have registered for this tournament yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {[...joinedParticipants]
              .sort(
                (a, b) => (a.slot_number || 999) - (b.slot_number || 999)
              )
              .map((part, idx) => {
                const player = users.find((u) => u.id === part.user_id);
                const roster = getParticipantRoster(part);
                const slotNum = part.slot_number || idx + 1;
                return (
                  <div
                    key={part.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 bg-[#0B0F17] border border-amber-500/30 px-2.5 py-1 rounded-lg">
                          Slot #{slotNum}
                        </span>
                        <span className="font-display font-bold text-white">
                          {getParticipantDisplayName(part, teamMode)}
                        </span>
                        {teamMode !== 'Solo' && (
                          <span className="text-[11px] font-mono text-amber-400/90">
                            ({teamMode} Team)
                          </span>
                        )}
                        {player && (
                          <span className="text-slate-500 font-mono">
                            ({player.email})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
                        <span className="text-slate-400">
                          {teamMode} Roster:
                        </span>
                        {roster.map((ign, pIdx) => (
                          <span
                            key={pIdx}
                            className="bg-[#0B0F17] border border-slate-800 px-2.5 py-1 rounded-lg text-emerald-300"
                          >
                            P{pIdx + 1}: {ign}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="font-mono text-slate-400 shrink-0">
                      Joined {part.created_at}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};
