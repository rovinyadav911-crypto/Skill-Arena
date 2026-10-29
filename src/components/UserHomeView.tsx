import React, { useState } from 'react';
import {
  ParticipantRecord,
  TeamMode,
  TournamentRecord,
  TransactionRecord,
  UserRecord,
  UserRoute,
} from '../types';
import {
  createOrUpdateUser,
  createParticipant,
  createTransaction,
  generateSafeId,
  getParticipantDisplayName,
  getParticipantRoster,
  getPrizeBreakdown,
  getTournamentMaxSlots,
  getTournamentMode,
  getTournamentRules,
} from '../services/dbService';

interface UserHomeViewProps {
  user: UserRecord;
  tournaments: TournamentRecord[];
  participants: ParticipantRecord[];
  onNavigate: (route: UserRoute) => void;
}

export const UserHomeView: React.FC<UserHomeViewProps> = ({
  user,
  tournaments,
  participants,
  onNavigate,
}) => {
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>('ALL');
  const [selectedModeFilter, setSelectedModeFilter] = useState<'ALL' | TeamMode>(
    'ALL'
  );
  const [expandedRulesId, setExpandedRulesId] = useState<string | null>(null);

  // Registration modal state for Solo / Duo / Squad slot & teammate entry
  const [registeringTournament, setRegisteringTournament] =
    useState<TournamentRecord | null>(null);
  const [selectedSlotNumber, setSelectedSlotNumber] = useState<number>(1);
  const [teamName, setTeamName] = useState<string>('');
  const [player1Ign, setPlayer1Ign] = useState<string>(user.username);
  const [player2Ign, setPlayer2Ign] = useState<string>('');
  const [player3Ign, setPlayer3Ign] = useState<string>('');
  const [player4Ign, setPlayer4Ign] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Filter upcoming & live tournaments for the homepage
  const activeTournaments = tournaments.filter(
    (t) => t.status === 'Upcoming' || t.status === 'Live'
  );

  const uniqueGames = Array.from(
    new Set(activeTournaments.map((t) => t.game_name))
  );

  const filteredTournaments = activeTournaments.filter((t) => {
    const matchesGame =
      selectedGameFilter === 'ALL' || t.game_name === selectedGameFilter;
    const matchesMode =
      selectedModeFilter === 'ALL' ||
      getTournamentMode(t) === selectedModeFilter;
    return matchesGame && matchesMode;
  });

  const handleOpenRegistrationModal = (
    e: React.FormEvent,
    tournament: TournamentRecord
  ) => {
    e.preventDefault();
    setFeedback(null);
    setModalError(null);

    const alreadyJoined = participants.some(
      (p) => p.tournament_id === tournament.id && p.user_id === user.id
    );

    if (alreadyJoined) {
      setFeedback({
        type: 'error',
        message: `You have already joined "${tournament.title}". Check My Tournaments for your Slot & Room details.`,
      });
      return;
    }

    const tourParticipants = participants.filter(
      (p) => p.tournament_id === tournament.id
    );
    const maxSlots = getTournamentMaxSlots(tournament);
    if (tourParticipants.length >= maxSlots) {
      setFeedback({
        type: 'error',
        message: `All ${maxSlots} slots for "${tournament.title}" are currently full.`,
      });
      return;
    }

    if (user.wallet_balance < tournament.entry_fee) {
      setFeedback({
        type: 'error',
        message: `Insufficient wallet balance (₹${user.wallet_balance}). You need ₹${tournament.entry_fee} to join "${tournament.title}".`,
      });
      return;
    }

    const takenSlots = new Set(
      tourParticipants.map((p, idx) => p.slot_number || idx + 1)
    );
    let firstAvailableSlot = 1;
    for (let s = 1; s <= maxSlots; s++) {
      if (!takenSlots.has(s)) {
        firstAvailableSlot = s;
        break;
      }
    }

    setSelectedSlotNumber(firstAvailableSlot);
    setTeamName('');
    setPlayer1Ign(user.username);
    setPlayer2Ign('');
    setPlayer3Ign('');
    setPlayer4Ign('');
    setRegisteringTournament(tournament);
  };

  const handleConfirmSlotRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registeringTournament) return;
    setModalError(null);

    const mode = getTournamentMode(registeringTournament);
    const trimmedTeamName = teamName.trim();
    const p1 = player1Ign.trim();
    const p2 = player2Ign.trim();
    const p3 = player3Ign.trim();
    const p4 = player4Ign.trim();

    if ((mode === 'Duo' || mode === 'Squad') && !trimmedTeamName) {
      setModalError(
        `Please enter your ${mode} Team Name (winners are declared by Team Name).`
      );
      return;
    }

    if (!p1) {
      setModalError('Please enter Player 1 username.');
      return;
    }

    if (mode === 'Duo' && !p2) {
      setModalError(
        'Please enter Player 2 username to complete your Duo slot.'
      );
      return;
    }

    if (mode === 'Squad' && (!p2 || !p3 || !p4)) {
      setModalError(
        'Please enter all 4 player usernames (Player 1, Player 2, Player 3, and Player 4) for your Squad slot.'
      );
      return;
    }

    const enteredNames =
      mode === 'Solo'
        ? [p1]
        : mode === 'Duo'
        ? [p1, p2]
        : [p1, p2, p3, p4];
    const lowerSet = new Set(enteredNames.map((n) => n.toLowerCase()));
    if (lowerSet.size !== enteredNames.length) {
      setModalError('Each player in the slot must have a unique username.');
      return;
    }

    if (user.wallet_balance < registeringTournament.entry_fee) {
      setModalError(
        `Insufficient wallet balance (₹${user.wallet_balance}). Entry fee is ₹${registeringTournament.entry_fee}.`
      );
      return;
    }

    setJoiningId(registeringTournament.id);
    try {
      const updatedBalance =
        user.wallet_balance - registeringTournament.entry_fee;
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

      // 1. Deduct entry fee from user wallet
      await createOrUpdateUser({
        ...user,
        wallet_balance: updatedBalance,
      });

      // 2. Add user & full Solo/Duo/Squad roster to participants table
      const newParticipant: ParticipantRecord = {
        id: generateSafeId('part'),
        user_id: user.id,
        username: user.username,
        tournament_id: registeringTournament.id,
        team_mode: mode,
        slot_number: selectedSlotNumber,
        team_name: teamName.trim(),
        player_1_ign: p1,
        player_2_ign: mode === 'Duo' || mode === 'Squad' ? p2 : '',
        player_3_ign: mode === 'Squad' ? p3 : '',
        player_4_ign: mode === 'Squad' ? p4 : '',
        created_at: nowStr,
      };
      await createParticipant(newParticipant);

      // 3. Record debit transaction
      const newTx: TransactionRecord = {
        id: generateSafeId('tx'),
        user_id: user.id,
        username: user.username,
        amount: registeringTournament.entry_fee,
        type: 'debit',
        description: `Joined ${mode} Slot #${selectedSlotNumber}: ${registeringTournament.title}`,
        created_at: nowStr,
      };
      await createTransaction(newTx);

      const joinedTitle = registeringTournament.title;
      const feePaid = registeringTournament.entry_fee;
      const rosterStr = enteredNames.join(', ');
      setRegisteringTournament(null);

      setFeedback({
        type: 'success',
        message: `Registered ${mode} Slot #${selectedSlotNumber} (${rosterStr}) in "${joinedTitle}"! ₹${feePaid} deducted from your wallet.`,
      });
    } catch {
      setModalError('Could not complete registration. Please try again.');
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner with Logo & Slogan */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src="/assets/aistudio/skill-arena-icon_ca7b5100.svg"
            alt="Skill Arena Emblem"
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-2xl object-contain border border-amber-500/40 shrink-0"
          />
          <div>
            <div className="text-xs font-medium text-amber-400 tracking-widest uppercase">
              SKILL ARENA · PLAY. COMPETE. CONQUER.
            </div>
            <h1 className="font-display font-bold text-xl sm:text-2xl text-white mt-0.5">
              Upcoming & Live Tournaments
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Join official daily matches, get Room ID & Password before start, and win instant UPI cash prizes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('my_tournaments')}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors min-h-[42px] whitespace-nowrap"
          >
            <i className="fa-solid fa-trophy text-amber-400 mr-1.5"></i>
            My Joined ({participants.filter((p) => p.user_id === user.id).length})
          </button>
          <button
            type="button"
            onClick={() => onNavigate('wallet')}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors min-h-[42px] whitespace-nowrap"
          >
            <i className="fa-solid fa-plus mr-1"></i>
            Add Cash
          </button>
        </div>
      </div>

      {/* Status Message Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-700/70 text-emerald-200'
              : 'bg-rose-950/70 border-rose-700/70 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <i
              className={`fa-solid ${
                feedback.type === 'success'
                  ? 'fa-circle-check text-emerald-400'
                  : 'fa-circle-exclamation text-rose-400'
              } text-base`}
            ></i>
            <span>{feedback.message}</span>
          </div>
          {feedback.type === 'error' &&
            feedback.message.includes('Insufficient wallet balance') && (
              <button
                type="button"
                onClick={() => onNavigate('wallet')}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0"
              >
                Add Money
              </button>
            )}
        </div>
      )}

      {/* Interactive Game & Team Format (Solo / Duo / Squad) Filter Bars */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {uniqueGames.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedGameFilter('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
                selectedGameFilter === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Games ({activeTournaments.length})
            </button>
            {uniqueGames.map((game) => (
              <button
                key={game}
                type="button"
                onClick={() => setSelectedGameFilter(game)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
                  selectedGameFilter === game
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {game}
              </button>
            ))}
          </div>
        )}

        {/* Solo / Duo / Squad Mode Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
          {(['ALL', 'Solo', 'Duo', 'Squad'] as const).map((modeOpt) => (
            <button
              key={modeOpt}
              type="button"
              onClick={() => setSelectedModeFilter(modeOpt)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap min-h-[40px] flex items-center gap-1.5 ${
                selectedModeFilter === modeOpt
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <i
                className={`fa-solid ${
                  modeOpt === 'ALL'
                    ? 'fa-layer-group'
                    : modeOpt === 'Solo'
                    ? 'fa-user'
                    : modeOpt === 'Duo'
                    ? 'fa-user-group'
                    : 'fa-users'
                } text-[11px]`}
              ></i>
              <span>{modeOpt === 'ALL' ? 'All Modes' : modeOpt}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Card Grid Format of Upcoming Tournaments */}
      {filteredTournaments.length === 0 ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-10 text-center">
          <i className="fa-solid fa-gamepad text-3xl text-slate-600 mb-3"></i>
          <h3 className="font-display font-bold text-base text-white">
            No Upcoming Tournaments Found
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            New matches are scheduled daily by the Skill Arena Admin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTournaments.map((tournament) => {
            const userParticipant = participants.find(
              (p) => p.tournament_id === tournament.id && p.user_id === user.id
            );
            const isJoined = Boolean(userParticipant);
            const joinedCount = participants.filter(
              (p) => p.tournament_id === tournament.id
            ).length;
            const mode = getTournamentMode(tournament);
            const maxSlots = getTournamentMaxSlots(tournament);
            const prizes = getPrizeBreakdown(tournament);

            return (
              <div
                key={tournament.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-colors"
              >
                <div>
                  {/* Quiet 1-line text kicker with unboxed metadata separators */}
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-2">
                    <span className="font-medium text-amber-400 truncate">
                      {tournament.game_name}
                    </span>
                    <span className="shrink-0 font-mono text-[11px]">
                      {tournament.status === 'Live' ? (
                        <span className="text-emerald-400 font-semibold">
                          LIVE NOW
                        </span>
                      ) : (
                        <span>UPCOMING</span>
                      )}
                      <span aria-hidden="true"> · </span>
                      <span className="text-white font-bold">
                        {mode.toUpperCase()}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>
                        Slots {joinedCount}/{maxSlots}
                      </span>
                    </span>
                  </div>

                  {/* Tournament Title */}
                  <h2 className="font-display font-bold text-lg text-white leading-snug">
                    {tournament.title}
                  </h2>

                  {/* Match Time & Team Format Info */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mt-2">
                    <span className="font-mono tabular-nums flex items-center gap-1.5">
                      <i className="fa-regular fa-clock text-amber-400"></i>
                      <span>{tournament.match_time}</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-300 flex items-center gap-1">
                      <i
                        className={`fa-solid ${
                          mode === 'Solo'
                            ? 'fa-user'
                            : mode === 'Duo'
                            ? 'fa-user-group'
                            : 'fa-users'
                        } text-amber-400 text-[10px]`}
                      ></i>
                      <span>
                        {mode === 'Solo'
                          ? 'Solo (1 Player)'
                          : mode === 'Duo'
                          ? 'Duo (2 Players/Slot)'
                          : 'Squad (4 Players/Slot)'}
                      </span>
                    </span>
                  </div>

                  {/* Detailed Prize Pool & Entry Fee Breakdown */}
                  <div className="my-4 pt-4 border-t border-slate-800/80 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-[#0B0F17] border border-slate-800/90 rounded-xl p-3">
                        <div className="text-[11px] text-slate-400">
                          Total Prize Pool
                        </div>
                        <div className="font-mono font-bold text-lg text-emerald-400 tabular-nums mt-0.5">
                          ₹{prizes.total.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="bg-[#0B0F17] border border-slate-800/90 rounded-xl p-3">
                        <div className="text-[11px] text-slate-400">
                          Entry Fee
                        </div>
                        <div className="font-mono font-bold text-lg text-amber-400 tabular-nums mt-0.5">
                          ₹{tournament.entry_fee.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* 1st, 2nd & 3rd Place Prize Tiers */}
                    <div className="bg-[#0B0F17] border border-slate-800/90 rounded-xl p-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                        <span>Prize Distribution</span>
                        <span className="text-amber-400/90 font-mono">
                          Top 3 Winners
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-900/90 border border-amber-500/25 rounded-lg py-1.5 px-2">
                          <div className="text-[10px] font-semibold text-amber-400 flex items-center justify-center gap-1">
                            <i className="fa-solid fa-crown text-[9px]"></i>
                            <span>1st</span>
                          </div>
                          <div className="font-mono font-bold text-xs text-white tabular-nums mt-0.5">
                            ₹{prizes.first.toLocaleString('en-IN')}
                          </div>
                        </div>

                        <div className="bg-slate-900/90 border border-slate-700/70 rounded-lg py-1.5 px-2">
                          <div className="text-[10px] font-semibold text-slate-300 flex items-center justify-center gap-1">
                            <i className="fa-solid fa-medal text-[9px]"></i>
                            <span>2nd</span>
                          </div>
                          <div className="font-mono font-bold text-xs text-white tabular-nums mt-0.5">
                            ₹{prizes.second.toLocaleString('en-IN')}
                          </div>
                        </div>

                        <div className="bg-slate-900/90 border border-amber-700/30 rounded-lg py-1.5 px-2">
                          <div className="text-[10px] font-semibold text-amber-500/90 flex items-center justify-center gap-1">
                            <i className="fa-solid fa-award text-[9px]"></i>
                            <span>3rd</span>
                          </div>
                          <div className="font-mono font-bold text-xs text-white tabular-nums mt-0.5">
                            ₹{prizes.third.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Match Rules Toggle & Expandable Box */}
                    <div className="bg-[#0B0F17] border border-slate-800/90 rounded-xl p-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRulesId(
                            expandedRulesId === tournament.id
                              ? null
                              : tournament.id
                          )
                        }
                        className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-amber-400 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <i className="fa-solid fa-scroll text-amber-400 text-[11px]"></i>
                          <span>Match Rules & Guidelines</span>
                        </span>
                        <span className="text-[11px] font-mono text-amber-400 flex items-center gap-1">
                          <span>
                            {expandedRulesId === tournament.id ? 'Hide' : 'View'}
                          </span>
                          <i
                            className={`fa-solid fa-chevron-${
                              expandedRulesId === tournament.id ? 'up' : 'down'
                            } text-[10px]`}
                          ></i>
                        </span>
                      </button>

                      {expandedRulesId === tournament.id && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 text-[11px] font-mono text-slate-300 whitespace-pre-line leading-relaxed">
                          {getTournamentRules(tournament)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Each card has a "Join Now" button inside a <form> tag that opens the Solo/Duo/Squad Slot Registration */}
                <form
                  onSubmit={(e) => handleOpenRegistrationModal(e, tournament)}
                  className="mt-1"
                >
                  {isJoined && userParticipant ? (
                    <button
                      type="button"
                      onClick={() => onNavigate('my_tournaments')}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/50 text-emerald-300 font-semibold text-xs flex items-center justify-center gap-2 min-h-[44px] transition-colors"
                    >
                      <i className="fa-solid fa-circle-check"></i>
                      <span>
                        Slot #{userParticipant.slot_number || 1} ·{' '}
                        {getParticipantDisplayName(userParticipant, mode)} (
                        {getParticipantRoster(userParticipant).join(', ')})
                      </span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={
                        joiningId === tournament.id || joinedCount >= maxSlots
                      }
                      className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 min-h-[44px] transition-colors shadow-md shadow-amber-500/10"
                    >
                      <i className="fa-solid fa-bolt"></i>
                      <span>
                        {joinedCount >= maxSlots
                          ? 'All Slots Full'
                          : `Join ${mode} Slot (₹${tournament.entry_fee})`}
                      </span>
                    </button>
                  )}
                </form>
              </div>
            );
          })}
        </div>
      )}

      {/* Solo / Duo / Squad Slot & Team Roster Registration Modal */}
      {registeringTournament && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            {(() => {
              const mode = getTournamentMode(registeringTournament);
              const maxSlots = getTournamentMaxSlots(registeringTournament);
              const tourParts = participants.filter(
                (p) => p.tournament_id === registeringTournament.id
              );
              const takenSlots = new Set(
                tourParts.map((p, idx) => p.slot_number || idx + 1)
              );

              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                        {registeringTournament.game_name} · {mode.toUpperCase()}{' '}
                        REGISTRATION
                      </div>
                      <h3 className="font-display font-bold text-lg text-white mt-0.5">
                        {registeringTournament.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {mode === 'Solo'
                          ? 'Select your Lobby Slot and enter your in-game username.'
                          : mode === 'Duo'
                          ? 'One player registers both Duo teammates by selecting a slot and entering both player usernames.'
                          : 'One player registers the entire 4-player Squad by selecting a slot and entering all 4 teammates’ usernames.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRegisteringTournament(null)}
                      className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center shrink-0"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>

                  {modalError && (
                    <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-700/70 text-rose-200 text-xs flex items-center gap-2">
                      <i className="fa-solid fa-circle-exclamation text-rose-400"></i>
                      <span>{modalError}</span>
                    </div>
                  )}

                  <form
                    onSubmit={handleConfirmSlotRegistration}
                    className="space-y-4"
                  >
                    {/* Step 1: Select Lobby Slot Number */}
                    <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                          <i className="fa-solid fa-table-cells-large"></i>
                          <span>
                            1. Select {mode} Lobby Slot (Selected: Slot #
                            {selectedSlotNumber})
                          </span>
                        </label>
                        <span className="text-[11px] font-mono text-slate-400">
                          {maxSlots - takenSlots.size} of {maxSlots} Free
                        </span>
                      </div>

                      <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {Array.from(
                          { length: maxSlots },
                          (_, index) => index + 1
                        ).map((slotNum) => {
                          const isBooked = takenSlots.has(slotNum);
                          const isSelected = selectedSlotNumber === slotNum;
                          return (
                            <button
                              key={slotNum}
                              type="button"
                              disabled={isBooked}
                              onClick={() => setSelectedSlotNumber(slotNum)}
                              className={`py-2 px-1.5 rounded-lg font-mono text-xs font-bold transition-colors border ${
                                isBooked
                                  ? 'bg-slate-950 border-slate-800/50 text-slate-600 cursor-not-allowed line-through'
                                  : isSelected
                                  ? 'bg-amber-500 border-amber-400 text-slate-950'
                                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                              }`}
                            >
                              #{slotNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 2: Enter Team Name (for Duo & Squad) & Player Usernames */}
                    <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                          <i className="fa-solid fa-users"></i>
                          <span>
                            2. Enter {mode} Player Username
                            {mode === 'Solo' ? '' : 's'} for Slot #
                            {selectedSlotNumber}
                          </span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {mode === 'Solo'
                            ? '1 Slot'
                            : mode === 'Duo'
                            ? '2 Player Slots'
                            : '4 Player Slots'}
                        </span>
                      </div>

                      {(mode === 'Duo' || mode === 'Squad') && (
                        <div>
                          <label className="block text-xs font-semibold text-amber-400 mb-1">
                            {mode} Team Name * (Used for Winner Selection)
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={50}
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            placeholder={`Enter your ${mode} Team Name`}
                            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none"
                          />
                        </div>
                      )}

                      {/* Player 1 Slot (Always shown for Solo, Duo, Squad) */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Slot Player 1{' '}
                          {mode !== 'Solo' ? '(Team Leader / IGL)' : ''} Username
                          *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={50}
                          value={player1Ign}
                          onChange={(e) => setPlayer1Ign(e.target.value)}
                          placeholder="Enter Player 1 username"
                          className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none"
                        />
                      </div>

                      {/* Player 2 Slot (Shown for Duo & Squad) */}
                      {(mode === 'Duo' || mode === 'Squad') && (
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Slot Player 2 Username *
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={50}
                            value={player2Ign}
                            onChange={(e) => setPlayer2Ign(e.target.value)}
                            placeholder="Enter Player 2 username"
                            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none"
                          />
                        </div>
                      )}

                      {/* Player 3 & Player 4 Slots (Shown for Squad) */}
                      {mode === 'Squad' && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              Slot Player 3 Username *
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={50}
                              value={player3Ign}
                              onChange={(e) => setPlayer3Ign(e.target.value)}
                              placeholder="Enter Player 3 username"
                              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              Slot Player 4 Username *
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={50}
                              value={player4Ign}
                              onChange={(e) => setPlayer4Ign(e.target.value)}
                              placeholder="Enter Player 4 username"
                              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Wallet & Fee Summary */}
                    <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">
                        Your Wallet: ₹{user.wallet_balance}
                      </span>
                      <span className="text-amber-400 font-bold">
                        Entry Fee: ₹{registeringTournament.entry_fee}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setRegisteringTournament(null)}
                        className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 min-h-[44px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={joiningId === registeringTournament.id}
                        className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs min-h-[44px]"
                      >
                        {joiningId === registeringTournament.id
                          ? 'Booking Slot...'
                          : `Confirm Slot #${selectedSlotNumber} (₹${registeringTournament.entry_fee})`}
                      </button>
                    </div>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
