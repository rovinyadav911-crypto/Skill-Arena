import React, { useState } from 'react';
import {
  ParticipantRecord,
  TournamentRecord,
  UserRecord,
  UserRoute,
} from '../types';
import {
  getParticipantRoster,
  getPrizeBreakdown,
  getTournamentMode,
  getTournamentRules,
} from '../services/dbService';

interface UserMyTournamentsViewProps {
  user: UserRecord;
  tournaments: TournamentRecord[];
  participants: ParticipantRecord[];
  onNavigate: (route: UserRoute) => void;
}

export const UserMyTournamentsView: React.FC<UserMyTournamentsViewProps> = ({
  user,
  tournaments,
  participants,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'upcoming_live' | 'completed'>(
    'upcoming_live'
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedRulesId, setExpandedRulesId] = useState<string | null>(null);

  const userJoinedTournamentIds = new Set(
    participants.filter((p) => p.user_id === user.id).map((p) => p.tournament_id)
  );

  const joinedTournaments = tournaments.filter((t) =>
    userJoinedTournamentIds.has(t.id)
  );

  const upcomingOrLive = joinedTournaments.filter(
    (t) => t.status === 'Upcoming' || t.status === 'Live'
  );

  const completed = joinedTournaments.filter(
    (t) => t.status === 'Completed' || t.status === 'Cancelled'
  );

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">
            My Tournaments
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Access live Room ID & Password or inspect completed & refunded match results.
          </p>
        </div>

        {/* Two-tab layout: "Upcoming/Live" tab and "Completed" tab */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-full sm:w-auto min-w-[280px]">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming_live')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors min-h-[40px] whitespace-nowrap ${
              activeTab === 'upcoming_live'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Upcoming / Live ({upcomingOrLive.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors min-h-[40px] whitespace-nowrap ${
              activeTab === 'completed'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Completed / Past ({completed.length})
          </button>
        </div>
      </div>

      {activeTab === 'upcoming_live' ? (
        upcomingOrLive.length === 0 ? (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-10 text-center">
            <i className="fa-solid fa-ticket text-3xl text-slate-600 mb-3"></i>
            <h3 className="font-display font-bold text-base text-white">
              No Active Joined Tournaments
            </h3>
            <p className="text-xs text-slate-400 mt-1 mb-5">
              You haven&apos;t joined any upcoming or live tournaments yet.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors min-h-[42px]"
            >
              Browse Upcoming Matches
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingOrLive.map((tournament) => {
              const hasRoomDetails =
                Boolean(tournament.room_id) || Boolean(tournament.room_password);
              const prizes = getPrizeBreakdown(tournament);
              const mode = getTournamentMode(tournament);
              const myParticipant = participants.find(
                (p) =>
                  p.tournament_id === tournament.id && p.user_id === user.id
              );
              const roster = myParticipant
                ? getParticipantRoster(myParticipant)
                : [user.username];
              const slotNum = myParticipant?.slot_number || 1;

              return (
                <div
                  key={tournament.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-1.5">
                      <span className="text-amber-400 font-medium">
                        {tournament.game_name} · {mode.toUpperCase()}
                      </span>
                      <span className="font-mono font-semibold">
                        {tournament.status === 'Live' ? (
                          <span className="text-emerald-400">LIVE MATCH</span>
                        ) : (
                          <span className="text-slate-300">UPCOMING</span>
                        )}
                      </span>
                    </div>

                    <h2 className="font-display font-bold text-lg text-white">
                      {tournament.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2 font-mono tabular-nums">
                      <span>
                        <i className="fa-regular fa-clock text-amber-400 mr-1.5"></i>
                        {tournament.match_time}
                      </span>
                      <span>·</span>
                      <span className="text-amber-400 font-bold">
                        Assigned Slot #{slotNum}
                      </span>
                      <span>·</span>
                      <span className="text-emerald-400 font-semibold">
                        Total Pool: ₹{prizes.total}
                      </span>
                    </div>

                    {/* Registered Solo / Duo / Squad Player Slots Box */}
                    <div className="mt-3 bg-[#0B0F17] border border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                          <i className="fa-solid fa-users"></i>
                          <span>
                            Your {mode} Slot #{slotNum}{' '}
                            {myParticipant?.team_name
                              ? `(${myParticipant.team_name})`
                              : 'Roster'}
                          </span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {roster.length}{' '}
                          {roster.length === 1 ? 'Player' : 'Players'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
                        {roster.map((playerName, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center gap-2 truncate"
                          >
                            <span className="text-[10px] text-amber-400 font-bold">
                              P{idx + 1}
                            </span>
                            <span className="text-white truncate">
                              {playerName}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 1st, 2nd, 3rd Prize Pills */}
                    <div className="grid grid-cols-3 gap-2 mt-3 bg-[#0B0F17] border border-slate-800 rounded-xl p-2 text-center font-mono">
                      <div>
                        <div className="text-[10px] text-amber-400 font-sans font-semibold">
                          1st Prize
                        </div>
                        <div className="text-xs font-bold text-white">
                          ₹{prizes.first}
                        </div>
                      </div>
                      <div className="border-x border-slate-800">
                        <div className="text-[10px] text-slate-300 font-sans font-semibold">
                          2nd Prize
                        </div>
                        <div className="text-xs font-bold text-white">
                          ₹{prizes.second}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-amber-500/90 font-sans font-semibold">
                          3rd Prize
                        </div>
                        <div className="text-xs font-bold text-white">
                          ₹{prizes.third}
                        </div>
                      </div>
                    </div>

                    {/* Match Rules Toggle */}
                    <div className="mt-2.5 bg-[#0B0F17] border border-slate-800 rounded-xl p-2.5">
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
                          <span>Match Rules & Fair-Play Guidelines</span>
                        </span>
                        <span className="text-[11px] font-mono text-amber-400">
                          {expandedRulesId === tournament.id
                            ? 'Hide Rules'
                            : 'View Rules'}
                        </span>
                      </button>
                      {expandedRulesId === tournament.id && (
                        <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-line leading-relaxed">
                          {getTournamentRules(tournament)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Room ID and Password Box */}
                  <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <i className="fa-solid fa-key text-amber-400"></i>
                        Match Room Credentials
                      </span>
                      {copiedField && (
                        <span className="text-[11px] text-emerald-400 font-mono">
                          Copied {copiedField}!
                        </span>
                      )}
                    </div>

                    {tournament.status === 'Live' || hasRoomDetails ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] text-slate-400">
                              Room ID
                            </div>
                            <div className="font-mono font-bold text-sm text-amber-400 tabular-nums">
                              {tournament.room_id || 'Waiting...'}
                            </div>
                          </div>
                          {tournament.room_id && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(tournament.room_id, 'Room ID')
                              }
                              className="p-2 text-slate-400 hover:text-white transition-colors"
                              title="Copy Room ID"
                            >
                              <i className="fa-regular fa-copy text-xs"></i>
                            </button>
                          )}
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] text-slate-400">
                              Password
                            </div>
                            <div className="font-mono font-bold text-sm text-emerald-400 tabular-nums">
                              {tournament.room_password || 'Waiting...'}
                            </div>
                          </div>
                          {tournament.room_password && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(tournament.room_password, 'Password')
                              }
                              className="p-2 text-slate-400 hover:text-white transition-colors"
                              title="Copy Room Password"
                            >
                              <i className="fa-regular fa-copy text-xs"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Room ID and Password will be published here by the Admin 15 minutes before match start.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : completed.length === 0 ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-10 text-center">
          <i className="fa-solid fa-medal text-3xl text-slate-600 mb-3"></i>
          <h3 className="font-display font-bold text-base text-white">
            No Completed Tournaments Yet
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Your finished tournaments and winner results will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {completed.map((tournament) => {
            const prizes = getPrizeBreakdown(tournament);
            const mode = getTournamentMode(tournament);
            const isTeamMode = mode === 'Duo' || mode === 'Squad';
            const isCancelled = tournament.status === 'Cancelled';
            const is1st = tournament.winner_id === user.id;
            const is2nd = tournament.winner_2nd_id === user.id;
            const is3rd = tournament.winner_3rd_id === user.id;
            const userPlacementLabel = isCancelled
              ? `Match Cancelled — ₹${tournament.entry_fee} Entry Fee Refunded`
              : is1st
              ? `1st Place ${isTeamMode ? 'Winning Team' : 'Winner'} (+₹${prizes.first})`
              : is2nd
              ? `2nd Place ${isTeamMode ? 'Runner-Up Team' : 'Runner-Up'} (+₹${prizes.second})`
              : is3rd
              ? `3rd Place ${isTeamMode ? 'Team' : 'Finisher'} (+₹${prizes.third})`
              : 'Participated';

            return (
              <div
                key={tournament.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span className="text-amber-400 font-medium">
                      {tournament.game_name} · {mode.toUpperCase()}
                    </span>
                    <span
                      className={`font-mono font-semibold ${
                        isCancelled ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      {isCancelled ? 'CANCELLED & REFUNDED' : 'COMPLETED'}
                    </span>
                  </div>
                  <h2 className="font-display font-bold text-lg text-white">
                    {tournament.title}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    Scheduled {tournament.match_time} · Total Pool: ₹{prizes.total}
                  </p>
                </div>

                <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400">Your Result</div>
                      <div
                        className={`font-display font-bold text-sm sm:text-base mt-0.5 flex items-center gap-1.5 ${
                          isCancelled
                            ? 'text-emerald-400'
                            : is1st || is2nd || is3rd
                            ? 'text-amber-400'
                            : 'text-slate-300'
                        }`}
                      >
                        <i
                          className={`fa-solid ${
                            isCancelled
                              ? 'fa-rotate-left text-emerald-400'
                              : is1st
                              ? 'fa-crown text-amber-400'
                              : is2nd || is3rd
                              ? 'fa-medal text-amber-400'
                              : 'fa-user-check text-slate-400'
                          }`}
                        ></i>
                        <span>{userPlacementLabel}</span>
                      </div>
                    </div>
                  </div>

                  {!isCancelled && (
                    <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-800/80 text-center font-mono text-xs">
                      <div className="bg-slate-900/90 border border-amber-500/25 rounded-lg p-2">
                        <div className="text-[10px] text-amber-400 font-sans font-semibold">
                          1st {isTeamMode ? 'Team' : ''} (₹{prizes.first})
                        </div>
                        <div className="text-white font-bold truncate mt-0.5">
                          {tournament.winner_username || 'TBA'}
                        </div>
                      </div>
                      <div className="bg-slate-900/90 border border-slate-700/70 rounded-lg p-2">
                        <div className="text-[10px] text-slate-300 font-sans font-semibold">
                          2nd {isTeamMode ? 'Team' : ''} (₹{prizes.second})
                        </div>
                        <div className="text-white font-bold truncate mt-0.5">
                          {tournament.winner_2nd_username || '—'}
                        </div>
                      </div>
                      <div className="bg-slate-900/90 border border-amber-700/30 rounded-lg p-2">
                        <div className="text-[10px] text-amber-500/90 font-sans font-semibold">
                          3rd {isTeamMode ? 'Team' : ''} (₹{prizes.third})
                        </div>
                        <div className="text-white font-bold truncate mt-0.5">
                          {tournament.winner_3rd_username || '—'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
