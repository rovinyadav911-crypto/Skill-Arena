import React, { useState } from 'react';
import {
  ParticipantRecord,
  TeamMode,
  TournamentRecord,
  UserRecord,
} from '../types';
import {
  cancelTournamentAndRefundAll,
  formatDateTimeForMatch,
  generateSafeId,
  getDefaultMaxSlots,
  getPrizeBreakdown,
  getTournamentMaxSlots,
  getTournamentMode,
  getTournamentRules,
  notifyTournamentParticipants,
  removeTournament,
  saveTournament,
  TOURNAMENT_RULE_PRESETS,
} from '../services/dbService';

interface AdminTournamentsViewProps {
  tournaments: TournamentRecord[];
  participants: ParticipantRecord[];
  users: UserRecord[];
  onManageTournament: (tournamentId: string) => void;
}

export const AdminTournamentsView: React.FC<AdminTournamentsViewProps> = ({
  tournaments,
  participants,
  users,
  onManageTournament,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [gameName, setGameName] = useState('BGMI (Battlegrounds Mobile India)');
  const [teamMode, setTeamMode] = useState<TeamMode>('Squad');
  const [maxSlots, setMaxSlots] = useState('25');
  const [entryFee, setEntryFee] = useState('50');
  const [prize1st, setPrize1st] = useState('500');
  const [prize2nd, setPrize2nd] = useState('300');
  const [prize3rd, setPrize3rd] = useState('200');
  const [matchTime, setMatchTime] = useState('2026-10-23 20:00');
  const [commissionPercentage, setCommissionPercentage] = useState('20');
  const [status, setStatus] = useState<
    'Upcoming' | 'Live' | 'Completed' | 'Cancelled'
  >('Upcoming');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    TOURNAMENT_RULE_PRESETS[0].id
  );
  const [rules, setRules] = useState<string>(TOURNAMENT_RULE_PRESETS[0].rules);
  const [adminModeFilter, setAdminModeFilter] = useState<'ALL' | TeamMode>(
    'ALL'
  );

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalPrizeCalculated =
    (Math.max(0, Number(prize1st)) || 0) +
    (Math.max(0, Number(prize2nd)) || 0) +
    (Math.max(0, Number(prize3rd)) || 0);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setGameName('BGMI (Battlegrounds Mobile India)');
    setTeamMode('Squad');
    setMaxSlots('25');
    setEntryFee('50');
    setPrize1st('500');
    setPrize2nd('300');
    setPrize3rd('200');
    setMatchTime('2026-10-23 20:00');
    setCommissionPercentage('20');
    setStatus('Upcoming');
    setSelectedPresetId(TOURNAMENT_RULE_PRESETS[0].id);
    setRules(TOURNAMENT_RULE_PRESETS[0].rules);
  };

  const handleEditClick = (t: TournamentRecord) => {
    const breakdown = getPrizeBreakdown(t);
    const loadedRules = getTournamentRules(t);
    const mode = getTournamentMode(t);
    const slots = getTournamentMaxSlots(t);
    const matchingPreset = TOURNAMENT_RULE_PRESETS.find(
      (p) => p.rules.trim() === loadedRules.trim()
    );
    setEditingId(t.id);
    setTitle(t.title);
    setGameName(t.game_name);
    setTeamMode(mode);
    setMaxSlots(String(slots));
    setEntryFee(String(t.entry_fee));
    setPrize1st(String(breakdown.first));
    setPrize2nd(String(breakdown.second));
    setPrize3rd(String(breakdown.third));
    setMatchTime(t.match_time);
    setCommissionPercentage(String(t.commission_percentage));
    setStatus(t.status);
    setSelectedPresetId(matchingPreset ? matchingPreset.id : 'custom');
    setRules(loadedRules);
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAutoSplitTotal = (totalAmount: number) => {
    const first = Math.round(totalAmount * 0.5);
    const second = Math.round(totalAmount * 0.3);
    const third = Math.max(0, totalAmount - first - second);
    setPrize1st(String(first));
    setPrize2nd(String(second));
    setPrize3rd(String(third));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!title.trim() || !gameName.trim() || !matchTime.trim()) {
      setFeedback({
        type: 'error',
        message: 'Title, Game Name, and Match Time are required.',
      });
      return;
    }

    const p1 = Math.max(0, Number(prize1st) || 0);
    const p2 = Math.max(0, Number(prize2nd) || 0);
    const p3 = Math.max(0, Number(prize3rd) || 0);
    const totalPrize = p1 + p2 + p3;

    if (totalPrize <= 0) {
      setFeedback({
        type: 'error',
        message: 'Total Prize Pool must be greater than ₹0.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const existing = editingId
        ? tournaments.find((t) => t.id === editingId)
        : undefined;

      // If Admin set status to Cancelled on an existing non-cancelled tournament, run automatic refund
      if (
        existing &&
        status === 'Cancelled' &&
        existing.status !== 'Cancelled'
      ) {
        const { refundedCount, totalRefunded } =
          await cancelTournamentAndRefundAll({
            tournament: existing,
            participants,
            users,
          });
        setFeedback({
          type: 'success',
          message: `Tournament "${existing.title}" cancelled! Automatically refunded ₹${totalRefunded} across ${refundedCount} registered player(s).`,
        });
        resetForm();
        return;
      }

      const record: TournamentRecord = {
        id: existing ? existing.id : generateSafeId('tour'),
        title: title.trim(),
        game_name: gameName.trim(),
        team_mode: teamMode,
        max_slots: Math.min(
          500,
          Math.max(2, Number(maxSlots) || getDefaultMaxSlots(teamMode))
        ),
        entry_fee: Math.max(0, Number(entryFee) || 0),
        prize_pool: totalPrize,
        prize_1st: p1,
        prize_2nd: p2,
        prize_3rd: p3,
        match_time: matchTime.trim(),
        commission_percentage: Math.min(
          100,
          Math.max(0, Number(commissionPercentage) || 0)
        ),
        room_id: existing ? existing.room_id : '',
        room_password: existing ? existing.room_password : '',
        status: status,
        winner_id: existing ? existing.winner_id : '',
        winner_username: existing ? existing.winner_username : '',
        winner_2nd_id: existing ? existing.winner_2nd_id || '' : '',
        winner_2nd_username: existing ? existing.winner_2nd_username || '' : '',
        winner_3rd_id: existing ? existing.winner_3rd_id || '' : '',
        winner_3rd_username: existing ? existing.winner_3rd_username || '' : '',
        rules: rules.trim(),
        created_at: existing
          ? existing.created_at
          : new Date().toISOString().slice(0, 19).replace('T', ' '),
      };

      await saveTournament(record);

      // If match time changed on an existing tournament, notify all registered participants that it was postponed/rescheduled
      let postponeNotice = '';
      if (existing && existing.match_time.trim() !== record.match_time.trim()) {
        const notifiedCount = await notifyTournamentParticipants({
          tournament: record,
          participants,
          type: 'postponed',
          title: `Tournament Postponed: ${record.title}`,
          message: `The match schedule for "${record.title}" has been updated from ${existing.match_time} to ${record.match_time}. Please join the lobby at the new scheduled time.`,
        });
        if (notifiedCount > 0) {
          postponeNotice = ` Sent postponement alert to ${notifiedCount} registered player(s).`;
        }
      }

      setFeedback({
        type: 'success',
        message: editingId
          ? `Tournament "${record.title}" updated with 1st (₹${p1}), 2nd (₹${p2}), 3rd (₹${p3}) prizes!${postponeNotice}`
          : `New tournament "${record.title}" created with ₹${totalPrize} total prize pool!`,
      });
      resetForm();
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to save tournament. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAndRefund = async (tournament: TournamentRecord) => {
    if (
      tournament.status === 'Cancelled' ||
      tournament.status === 'Completed'
    ) {
      return;
    }
    setFeedback(null);
    setSubmitting(true);
    try {
      const { refundedCount, totalRefunded } =
        await cancelTournamentAndRefundAll({
          tournament,
          participants,
          users,
        });
      setFeedback({
        type: 'success',
        message: `Cancelled "${tournament.title}"! Automatically refunded ₹${totalRefunded} to ${refundedCount} registered player(s) and sent cancellation alerts.`,
      });
      if (editingId === tournament.id) {
        resetForm();
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to cancel tournament and refund players.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tournament: TournamentRecord) => {
    setFeedback(null);
    try {
      // If tournament is Upcoming or Live and has registered participants, refund them automatically before deleting
      let refundSummary = '';
      if (
        tournament.status === 'Upcoming' ||
        tournament.status === 'Live'
      ) {
        const { refundedCount, totalRefunded } =
          await cancelTournamentAndRefundAll({
            tournament,
            participants,
            users,
            reason: 'Tournament removed by Admin',
          });
        if (refundedCount > 0) {
          refundSummary = ` Automatically refunded ₹${totalRefunded} to ${refundedCount} registered player(s).`;
        }
      }
      await removeTournament(tournament.id);
      setFeedback({
        type: 'success',
        message: `Deleted tournament "${tournament.title}".${refundSummary}`,
      });
      if (editingId === tournament.id) {
        resetForm();
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to delete tournament.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-white">
          Create & Manage Tournaments
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure tournament schedules, entry fees, 1st/2nd/3rd prizes, and automatic cancellation refunds.
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

      {/* Standard Form to Add / Edit a Tournament */}
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-white">
            {editingId ? 'Edit Tournament & Prize Tiers' : 'Add New Tournament'}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Tournament Title
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Skill Arena Pro Squad Cup #45"
              className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Game Name
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="e.g., BGMI, Free Fire Max, COD Mobile"
              className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Entry Fee (₹)
            </label>
            <input
              type="number"
              min={0}
              required
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Match Time (YYYY-MM-DD HH:MM)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setMatchTime(
                      formatDateTimeForMatch(
                        new Date(Date.now() + 5 * 60 * 1000)
                      )
                    )
                  }
                  className="px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-mono font-bold text-amber-300 transition-colors"
                  title="Set match time to 5 minutes from now (triggers 5-min popup alert)"
                >
                  +5 Mins
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMatchTime(
                      formatDateTimeForMatch(
                        new Date(Date.now() + 15 * 60 * 1000)
                      )
                    )
                  }
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono font-semibold text-slate-300 transition-colors"
                >
                  +15 Mins
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMatchTime(
                      formatDateTimeForMatch(
                        new Date(Date.now() + 60 * 60 * 1000)
                      )
                    )
                  }
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono font-semibold text-slate-300 transition-colors"
                >
                  +1 Hr
                </button>
              </div>
            </div>
            <input
              type="text"
              required
              maxLength={60}
              value={matchTime}
              onChange={(e) => setMatchTime(e.target.value)}
              placeholder="2026-10-25 20:00"
              className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Solo / Duo / Squad Format & Lobby Slot Configuration */}
        <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
                <i className="fa-solid fa-users-viewfinder text-amber-400"></i>
                <span>Match Format (Solo / Duo / Squad) & Lobby Slots</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Choose whether players register solo (1 player/slot), duo (2 players/slot), or squad (4 players/slot).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {(['Solo', 'Duo', 'Squad'] as TeamMode[]).map((modeOption) => {
              const active = teamMode === modeOption;
              const playersPerSlot =
                modeOption === 'Solo'
                  ? '1 Player / Slot'
                  : modeOption === 'Duo'
                  ? '2 Players / Slot'
                  : '4 Players / Slot';
              return (
                <button
                  key={modeOption}
                  type="button"
                  onClick={() => {
                    setTeamMode(modeOption);
                    setMaxSlots(String(getDefaultMaxSlots(modeOption)));
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-colors flex flex-col justify-between ${
                    active
                      ? 'bg-amber-500/15 border-amber-500 text-white'
                      : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-sm flex items-center gap-1.5">
                      <i
                        className={`fa-solid ${
                          modeOption === 'Solo'
                            ? 'fa-user'
                            : modeOption === 'Duo'
                            ? 'fa-user-group'
                            : 'fa-users'
                        } text-amber-400 text-xs`}
                      ></i>
                      <span>{modeOption} Mode</span>
                    </span>
                    {active && (
                      <i className="fa-solid fa-circle-check text-amber-400 text-xs"></i>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    {playersPerSlot}
                  </div>
                </button>
              );
            })}

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
              <label className="block text-xs font-semibold text-amber-400 mb-1">
                Total {teamMode} Slots
              </label>
              <input
                type="number"
                min={2}
                max={500}
                required
                value={maxSlots}
                onChange={(e) => setMaxSlots(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Detailed 1st, 2nd, 3rd Prize Pool Configuration */}
        <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
                <i className="fa-solid fa-trophy text-amber-400"></i>
                <span>Prize Pool Breakdown (1st, 2nd & 3rd Place)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Set the individual cash prizes for top 3 finishers. Total Prize Pool updates automatically.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-400">Total Pool:</span>
              <span className="font-mono font-extrabold text-lg text-emerald-400 tabular-nums">
                ₹{totalPrizeCalculated.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3">
              <label className="block text-xs font-semibold text-amber-400 mb-1.5 flex items-center gap-1.5">
                <i className="fa-solid fa-crown"></i>
                <span>1st Prize (Winner) ₹</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={prize1st}
                onChange={(e) => setPrize1st(e.target.value)}
                placeholder="500"
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none"
              />
            </div>

            <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3">
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <i className="fa-solid fa-medal text-slate-300"></i>
                <span>2nd Prize (Runner-Up) ₹</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={prize2nd}
                onChange={(e) => setPrize2nd(e.target.value)}
                placeholder="300"
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none"
              />
            </div>

            <div className="bg-slate-900/90 border border-amber-700/40 rounded-xl p-3">
              <label className="block text-xs font-semibold text-amber-500/90 mb-1.5 flex items-center gap-1.5">
                <i className="fa-solid fa-award"></i>
                <span>3rd Prize (2nd Runner-Up) ₹</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={prize3rd}
                onChange={(e) => setPrize3rd(e.target.value)}
                placeholder="200"
                className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-400">Quick Presets:</span>
            {[500, 1000, 2000, 5000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleAutoSplitTotal(preset)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono text-[11px] transition-colors"
              >
                ₹{preset} Pool (50/30/20)
              </button>
            ))}
          </div>
        </div>

        {/* Tournament Rule Presets & Custom Rules Editor */}
        <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
                <i className="fa-solid fa-scroll text-amber-400"></i>
                <span>Tournament Rule Presets & Match Guidelines</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Select a preset rule template below or customize the match rules for players.
              </p>
            </div>
            <span className="text-[11px] font-mono text-amber-400 shrink-0">
              {selectedPresetId === 'custom'
                ? 'Custom Rules Active'
                : `Preset: ${
                    TOURNAMENT_RULE_PRESETS.find(
                      (p) => p.id === selectedPresetId
                    )?.badge || 'Active'
                  }`}
            </span>
          </div>

          {/* Preset Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {TOURNAMENT_RULE_PRESETS.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedPresetId(preset.id);
                    setRules(preset.rules);
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors flex flex-col justify-between gap-1 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-white'
                      : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#0B0F17] text-amber-400 border border-amber-500/30">
                      {preset.badge}
                    </span>
                    {isSelected && (
                      <i className="fa-solid fa-circle-check text-amber-400 text-xs"></i>
                    )}
                  </div>
                  <div className="text-xs font-semibold mt-1 leading-snug">
                    {preset.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Editable Rules Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Match Rules Shown to Players (Editable)
              </label>
              <span className="text-[11px] font-mono text-slate-500">
                {rules.length}/2000 chars
              </span>
            </div>
            <textarea
              rows={5}
              maxLength={2000}
              required
              value={rules}
              onChange={(e) => {
                setRules(e.target.value);
                setSelectedPresetId('custom');
              }}
              placeholder="Select a preset above or type tournament rules here..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl p-3.5 text-xs font-mono text-slate-200 leading-relaxed focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Commission (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              required
              value={commissionPercentage}
              onChange={(e) => setCommissionPercentage(e.target.value)}
              className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Status
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
              className="w-full bg-[#0B0F17] border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-3 text-sm text-white focus:outline-none"
            >
              <option value="Upcoming">Upcoming</option>
              <option value="Live">Live</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled (Auto-Refunds Players)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm min-h-[48px] transition-colors"
        >
          <i className="fa-solid fa-floppy-disk mr-2"></i>
          {submitting
            ? 'Saving...'
            : editingId
            ? 'Update Tournament & Prizes'
            : 'Create Tournament'}
        </button>
      </form>

      {/* Below the form, show a list of all created tournaments with options to Manage / Edit / Cancel & Refund / Delete */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="font-display font-bold text-base text-white">
            All Created Tournaments ({tournaments.length})
          </h2>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(['ALL', 'Solo', 'Duo', 'Squad'] as const).map((filterOpt) => (
              <button
                key={filterOpt}
                type="button"
                onClick={() => setAdminModeFilter(filterOpt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  adminModeFilter === filterOpt
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-[#0B0F17] border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {filterOpt === 'ALL' ? 'All Formats' : filterOpt}
              </button>
            ))}
          </div>
        </div>

        {tournaments.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No tournaments created yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {tournaments
              .filter(
                (t) =>
                  adminModeFilter === 'ALL' ||
                  getTournamentMode(t) === adminModeFilter
              )
              .map((t) => {
                const joinedCount = participants.filter(
                  (p) => p.tournament_id === t.id
                ).length;
                const prizes = getPrizeBreakdown(t);
                const mode = getTournamentMode(t);
                const slotsTotal = getTournamentMaxSlots(t);
                return (
                  <div
                    key={t.id}
                    className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="text-amber-400 font-semibold">
                          {t.game_name}
                        </span>
                        <span>·</span>
                        <span className="font-mono font-bold text-white">
                          {mode.toUpperCase()}
                        </span>
                        <span>·</span>
                        <span
                          className={`font-mono font-bold ${
                            t.status === 'Live'
                              ? 'text-emerald-400'
                              : t.status === 'Cancelled'
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {t.status.toUpperCase()}
                        </span>
                        <span>·</span>
                        <span className="font-mono">
                          Slots: {joinedCount}/{slotsTotal}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-base text-white mt-0.5">
                        {t.title}
                      </h3>
                      <div className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                        Time: {t.match_time} · Entry: ₹{t.entry_fee} · Total
                        Pool:{' '}
                        <span className="text-emerald-400 font-bold">
                          ₹{prizes.total}
                        </span>{' '}
                        (1st: ₹{prizes.first} · 2nd: ₹{prizes.second} · 3rd: ₹
                        {prizes.third}) · Comm: {t.commission_percentage}%
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onManageTournament(t.id)}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs min-h-[40px] transition-colors"
                      >
                        <i className="fa-solid fa-sliders mr-1.5"></i>
                        Manage / Slots
                      </button>
                      {(t.status === 'Upcoming' || t.status === 'Live') && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleCancelAndRefund(t)}
                          className="px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-xs font-semibold min-h-[40px] transition-colors"
                          title="Cancel tournament and automatically refund entry fee to all registered players"
                        >
                          <i className="fa-solid fa-ban mr-1.5"></i>
                          Cancel & Refund
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEditClick(t)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium min-h-[40px] transition-colors"
                        title="Edit Tournament"
                      >
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
                        className="px-3 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800/50 text-rose-300 text-xs font-medium min-h-[40px] transition-colors"
                        title="Delete Tournament"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
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
