import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AdminRecord,
  DepositRecord,
  NotificationRecord,
  NotificationType,
  ParticipantRecord,
  SettingRecord,
  TeamMode,
  TournamentRecord,
  TransactionRecord,
  UserRecord,
  WithdrawalRecord,
} from '../types';

export function generateSafeId(prefix: string): string {
  const randomPart = Math.random().toString(36).substring(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function ensureSystemBootstrapped(): Promise<void> {
  try {
    const settingRef = doc(db, 'settings', 'global');
    const settingSnap = await getDoc(settingRef);

    if (!settingSnap.exists()) {
      const initialSetting: SettingRecord = {
        id: 'global',
        admin_upi_id: '',
        qr_code_url: '',
        schema_updated: true,
        installed: true,
      };
      await setDoc(settingRef, initialSetting);
    } else {
      const existingData = settingSnap.data() as SettingRecord;
      if (
        existingData.qr_code_url &&
        existingData.qr_code_url.startsWith('data:image/svg+xml')
      ) {
        await updateDoc(settingRef, { qr_code_url: '' });
      }
    }

    const adminRef = doc(db, 'admins', 'admin_default');
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      const defaultAdmin: AdminRecord = {
        id: 'admin_default',
        username: 'admin',
        password: 'admin123',
      };
      await setDoc(adminRef, defaultAdmin);
    }

    // Remove any previously seeded fake/demo tournaments, users, participants, and transactions
    const fakeTournamentIds = [
      'tour_bgmi_pro_01',
      'tour_freefire_clash_02',
      'tour_codm_sniper_03',
      'tour_valorant_completed_04',
    ];
    for (const fakeTourId of fakeTournamentIds) {
      await deleteDoc(doc(db, 'tournaments', fakeTourId)).catch(() => {});
    }

    await deleteDoc(doc(db, 'users', 'user_demo_player')).catch(() => {});

    const fakeParticipantIds = ['part_demo_01', 'part_demo_02'];
    for (const fakePartId of fakeParticipantIds) {
      await deleteDoc(doc(db, 'participants', fakePartId)).catch(() => {});
    }

    const fakeTransactionIds = ['tx_demo_01', 'tx_demo_02', 'tx_demo_03'];
    for (const fakeTxId of fakeTransactionIds) {
      await deleteDoc(doc(db, 'transactions', fakeTxId)).catch(() => {});
    }
  } catch (error) {
    console.error('Bootstrap error:', error);
  }
}

export const SECURITY_QUESTIONS: string[] = [
  'What was your first in-game tag or gamer username?',
  'What was the model or brand of your first gaming phone?',
  'What is the name of your favorite childhood best friend or pet?',
  'In which city or town did you attend primary school?',
  'What is your favorite esports team or pro player?',
];

export function generateRecoveryKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const group = () => {
    let s = '';
    for (let i = 0; i < 4; i++) {
      s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
  };
  return `SA-${group()}-${group()}-${group()}`;
}

export function evaluatePasswordStrength(password: string): {
  score: number;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  colorClass: string;
  checks: {
    minLength: boolean;
    hasMixedCase: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
  };
} {
  const minLength = password.length >= 8;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  const score = [minLength, hasMixedCase, hasNumber, hasSymbol].filter(
    Boolean
  ).length;

  if (score <= 1) {
    return {
      score,
      label: 'Weak',
      colorClass: 'text-rose-400 bg-rose-500/20 border-rose-500/40',
      checks: { minLength, hasMixedCase, hasNumber, hasSymbol },
    };
  }
  if (score === 2) {
    return {
      score,
      label: 'Fair',
      colorClass: 'text-amber-400 bg-amber-500/20 border-amber-500/40',
      checks: { minLength, hasMixedCase, hasNumber, hasSymbol },
    };
  }
  if (score === 3) {
    return {
      score,
      label: 'Good',
      colorClass: 'text-sky-400 bg-sky-500/20 border-sky-500/40',
      checks: { minLength, hasMixedCase, hasNumber, hasSymbol },
    };
  }
  return {
    score,
    label: 'Strong',
    colorClass: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40',
    checks: { minLength, hasMixedCase, hasNumber, hasSymbol },
  };
}

export async function createOrUpdateUser(user: UserRecord): Promise<void> {
  const path = 'users';
  try {
    await setDoc(doc(db, path, user.id), {
      id: user.id.slice(0, 128),
      username: user.username.trim().slice(0, 50),
      email: user.email.trim().slice(0, 100),
      password: user.password.slice(0, 100),
      wallet_balance: Math.max(0, Number(user.wallet_balance) || 0),
      upi_id: (user.upi_id || '').trim().slice(0, 100),
      is_blocked: Boolean(user.is_blocked),
      dpdp_consent_accepted:
        user.dpdp_consent_accepted !== undefined
          ? Boolean(user.dpdp_consent_accepted)
          : true,
      dpdp_consent_at: (user.dpdp_consent_at || user.created_at || '')
        .trim()
        .slice(0, 40),
      age_verified_18:
        user.age_verified_18 !== undefined ? Boolean(user.age_verified_18) : true,
      nominee_name: (user.nominee_name || '').trim().slice(0, 80),
      nominee_contact: (user.nominee_contact || '').trim().slice(0, 120),
      recovery_key: (user.recovery_key || '').trim().toUpperCase().slice(0, 32),
      security_question: (user.security_question || '').trim().slice(0, 140),
      security_answer: (user.security_answer || '')
        .trim()
        .toLowerCase()
        .slice(0, 100),
      last_password_reset_at: (user.last_password_reset_at || '')
        .trim()
        .slice(0, 40),
      created_at: user.created_at.slice(0, 40),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateAdminRecord(admin: AdminRecord): Promise<void> {
  const path = 'admins';
  try {
    await setDoc(doc(db, path, admin.id), {
      id: admin.id.slice(0, 128),
      username: admin.username.trim().slice(0, 50),
      password: admin.password.slice(0, 100),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function getPrizeBreakdown(tournament: TournamentRecord): {
  first: number;
  second: number;
  third: number;
  total: number;
} {
  const total = Math.max(0, Number(tournament.prize_pool) || 0);
  const hasExplicit =
    tournament.prize_1st !== undefined ||
    tournament.prize_2nd !== undefined ||
    tournament.prize_3rd !== undefined;

  if (hasExplicit) {
    const first = Math.max(0, Number(tournament.prize_1st) || 0);
    const second = Math.max(0, Number(tournament.prize_2nd) || 0);
    const third = Math.max(0, Number(tournament.prize_3rd) || 0);
    return {
      first,
      second,
      third,
      total: total > 0 ? total : first + second + third,
    };
  }

  // Default 50% / 30% / 20% split for legacy tournaments without explicit tier values
  const first = Math.round(total * 0.5);
  const second = Math.round(total * 0.3);
  const third = Math.max(0, total - first - second);
  return { first, second, third, total };
}

export function getWalletBreakdown(
  user: UserRecord,
  transactions: TransactionRecord[],
  withdrawals: WithdrawalRecord[]
): {
  total: number;
  withdrawable: number;
  deposited: number;
  pendingWithdrawal: number;
} {
  const total = Math.max(0, Number(user.wallet_balance) || 0);

  const totalPrizeWinnings = transactions
    .filter(
      (tx) =>
        tx.user_id === user.id &&
        tx.type === 'credit' &&
        tx.description.toLowerCase().includes('prize')
    )
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const completedWithdrawalsFromRecords = withdrawals
    .filter((w) => w.user_id === user.id && w.status === 'Completed')
    .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

  const completedWithdrawalsFromTx = transactions
    .filter(
      (tx) =>
        tx.user_id === user.id &&
        tx.type === 'debit' &&
        tx.description.toLowerCase().includes('withdrawal')
    )
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const totalCompletedWithdrawals = Math.max(
    completedWithdrawalsFromRecords,
    completedWithdrawalsFromTx
  );

  const pendingWithdrawal = withdrawals
    .filter((w) => w.user_id === user.id && w.status === 'Pending')
    .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

  const remainingWinnings = Math.max(
    0,
    totalPrizeWinnings - totalCompletedWithdrawals - pendingWithdrawal
  );

  const withdrawable = Math.min(
    Math.max(0, total - pendingWithdrawal),
    remainingWinnings
  );
  const deposited = Math.max(0, total - withdrawable);

  return {
    total,
    withdrawable,
    deposited,
    pendingWithdrawal,
  };
}

export interface TournamentRulePreset {
  id: string;
  label: string;
  badge: string;
  rules: string;
}

export const TOURNAMENT_RULE_PRESETS: TournamentRulePreset[] = [
  {
    id: 'bgmi_official_br',
    label: 'BGMI Official Rulebook (BMPS / BGIS Battle Royale)',
    badge: 'BGMI BR',
    rules: `1. Official 10-Point Scoring System: 1st = 10 pts, 2nd = 6 pts, 3rd = 5 pts, 4th = 4 pts, 5th = 3 pts, 6th = 2 pts, 7th–8th = 1 pt, 9th–16th = 0 pts · 1 Finish = 1 pt.
2. Room Parameters: Red Zone Disabled · Flare Guns Disabled · Aim Assist Disabled · Sound Visualization Disabled · All Weapons 2x Spawn Rate.
3. Lobby & Roster Rules: Players must occupy their assigned lobby slot at least 5 minutes prior to start. Handheld mobile smartphones only (iPads/Tablets & Emulators prohibited).
4. Tiebreaker Order: (1) Total WWCDs, (2) Total Placement Points, (3) Total Finish Points, (4) Placement in the most recent match.`,
  },
  {
    id: 'bgmi_official_tdm',
    label: 'BGMI Arena TDM Official Rulebook (Warehouse)',
    badge: 'BGMI TDM',
    rules: `1. Match Format: Arena Team Deathmatch (Warehouse) · Victory Condition: First to 40 Finishes or highest score at 10:00 time limit.
2. Permitted Loadout: Assault Rifles (M416, AKM, SCAR-L, Beryl M762) and SMGs only · Level 2 Vest & Helmet standard spawn.
3. Restricted Items: Shotguns, DMRs, Bolt-Action Snipers, LMGs, Pistols, Frag/Stun Grenades, Slide setting, and Crate weapons (Groza/AWM) are prohibited.
4. Arena Conduct: Players must exit their spawn area within 10 seconds; climbing onto unintended container roofs results in round forfeiture.`,
  },
  {
    id: 'ff_official_br',
    label: 'Free Fire MAX Official Rulebook (FFWS Battle Royale)',
    badge: 'FFWS BR',
    rules: `1. FFWS Point System: 1st (Booyah) = 12 pts, 2nd = 9 pts, 3rd = 8 pts, 4th = 7 pts, 5th = 6 pts, 6th = 5 pts, 7th = 4 pts, 8th = 3 pts, 9th = 2 pts, 10th = 1 pt, 11th–12th = 0 pts · 1 Elimination = 1 pt.
2. Custom Room Parameters: Revival System ON · In-Match Quests ON · High Tier Loot Zone OFF · Gun Property (Weapon Attributes) OFF · UAV Lite ON.
3. Device & Slot Policy: Handheld mobile phones only; players must remain in their registered team slot before match start.
4. Tiebreaker Order: (1) Total number of Booyahs, (2) Total Elimination Points, (3) Placement in the final match.`,
  },
  {
    id: 'ff_official_cs',
    label: 'Free Fire MAX Clash Squad Official Rulebook',
    badge: 'FFWS CS',
    rules: `1. Match Format: Clash Squad Custom Room · First to 7 Rounds (Win by 2 in Overtime) · Default Coin: 1500 · Gun Attributes: OFF · Air Drops: OFF.
2. Weapon Restrictions: Maximum 1 Sniper Rifle per squad; Double Vector, M79 Launcher, Charge Buster, MAG-7, and Flash Freeze are prohibited.
3. Character Skill Rules: Active/Passive skills permitted per lobby configuration (Orion, Sonia, Dimitri, and Wukong restricted in Competitive Mode).
4. Map Conduct: Using Gloo Walls to climb inaccessible rooftops or shooting through unrendered map textures is prohibited.`,
  },
  {
    id: 'codm_official_mp',
    label: 'COD Mobile World Championship Rulebook (MP)',
    badge: 'CODM MP',
    rules: `1. Official Modes & Targets: Hardpoint (250 Pts / 600s) · Search & Destroy (First to 6 Rounds / 120s round / Win by 2) · Control (First to 3 Rounds / 30 Lives).
2. Restricted Weapons & Attachments: NA-45, SVD, XPR-50, Shorty, Thumper, D13 Sector, Akimbo Perk, RPD Cooling Compressor Barrel, and Concussion Mag.
3. Restricted Operator Skills & Perks: Ballistic Shield, Bull Charge, TAK-5, Reactor Core, K9 Unit, Persistence, Restock, Martyrdom, C4, Trip Mine, and Heartbeat Sensor.
4. Controls: Touch screen controls on handheld mobile devices only; external controllers and emulators are prohibited.`,
  },
  {
    id: 'codm_official_br',
    label: 'COD Mobile Official Battle Royale Rulebook',
    badge: 'CODM BR',
    rules: `1. Official BR Scoring: 1st = 15 pts, 2nd = 12 pts, 3rd = 10 pts, 4th = 8 pts, 5th = 6 pts, 6th–7th = 4 pts, 8th–10th = 2 pts, 11th+ = 0 pts · 1 Elimination = 1 pt.
2. Class Restrictions: No duplicate BR Classes within the same squad · Ravager Launcher, Pumped, Defender, Igniter, and Hoverbike are prohibited.
3. Custom Lobby Settings: Map Isolated / Blackout · Custom Loadout Airdrops Enabled · Jackal Fighter Jet and Tank Airdrops Disabled.
4. Tiebreaker Order: (1) Total 1st Place Finishes, (2) Total Placement Points, (3) Total Elimination Points.`,
  },
];

export function getTournamentRules(tournament: TournamentRecord): string {
  if (tournament.rules && tournament.rules.trim().length > 0) {
    return tournament.rules.trim();
  }
  const lowerGame = tournament.game_name.toLowerCase();
  if (lowerGame.includes('bgmi')) {
    return TOURNAMENT_RULE_PRESETS[0].rules;
  }
  if (lowerGame.includes('free fire')) {
    return TOURNAMENT_RULE_PRESETS[2].rules;
  }
  if (lowerGame.includes('call of duty') || lowerGame.includes('cod')) {
    return TOURNAMENT_RULE_PRESETS[4].rules;
  }
  return TOURNAMENT_RULE_PRESETS[0].rules;
}

export function getTournamentMode(tournament: TournamentRecord): TeamMode {
  if (
    tournament.team_mode === 'Solo' ||
    tournament.team_mode === 'Duo' ||
    tournament.team_mode === 'Squad'
  ) {
    return tournament.team_mode;
  }
  const lower = tournament.title.toLowerCase();
  if (lower.includes('squad') || lower.includes('4v4')) {
    return 'Squad';
  }
  if (lower.includes('duo') || lower.includes('2v2')) {
    return 'Duo';
  }
  return 'Solo';
}

export function getDefaultMaxSlots(mode: TeamMode): number {
  if (mode === 'Squad') return 25;
  if (mode === 'Duo') return 50;
  return 100;
}

export function getTournamentMaxSlots(tournament: TournamentRecord): number {
  const mode = getTournamentMode(tournament);
  if (tournament.max_slots && tournament.max_slots >= 2) {
    return tournament.max_slots;
  }
  return getDefaultMaxSlots(mode);
}

export function getParticipantRoster(part: ParticipantRecord): string[] {
  const p1 = (part.player_1_ign || part.username || '').trim();
  const p2 = (part.player_2_ign || '').trim();
  const p3 = (part.player_3_ign || '').trim();
  const p4 = (part.player_4_ign || '').trim();
  return [p1, p2, p3, p4].filter(Boolean);
}

export function getParticipantDisplayName(
  part: ParticipantRecord,
  mode: TeamMode
): string {
  if (mode === 'Duo' || mode === 'Squad') {
    const cleanTeam = (part.team_name || '').trim();
    if (cleanTeam) {
      return cleanTeam;
    }
    const fallbackLeader = (part.player_1_ign || part.username || 'Slot').trim();
    return `Team ${fallbackLeader}`;
  }
  return (part.player_1_ign || part.username || '').trim();
}

export async function saveTournament(tournament: TournamentRecord): Promise<void> {
  const path = 'tournaments';
  try {
    const p1 = Math.max(0, Number(tournament.prize_1st) || 0);
    const p2 = Math.max(0, Number(tournament.prize_2nd) || 0);
    const p3 = Math.max(0, Number(tournament.prize_3rd) || 0);
    const totalPrize = Math.max(0, Number(tournament.prize_pool) || p1 + p2 + p3);
    const rulesText = (tournament.rules || getTournamentRules(tournament))
      .trim()
      .slice(0, 2000);
    const mode = getTournamentMode(tournament);
    const maxSlots = Math.min(
      500,
      Math.max(2, Number(tournament.max_slots) || getDefaultMaxSlots(mode))
    );

    await setDoc(doc(db, path, tournament.id), {
      id: tournament.id.slice(0, 128),
      title: tournament.title.trim().slice(0, 120),
      game_name: tournament.game_name.trim().slice(0, 80),
      team_mode: mode,
      max_slots: maxSlots,
      entry_fee: Math.max(0, Number(tournament.entry_fee) || 0),
      prize_pool: totalPrize,
      prize_1st: p1,
      prize_2nd: p2,
      prize_3rd: p3,
      match_time: tournament.match_time.trim().slice(0, 60),
      commission_percentage: Math.min(100, Math.max(0, Number(tournament.commission_percentage) || 0)),
      room_id: (tournament.room_id || '').trim().slice(0, 80),
      room_password: (tournament.room_password || '').trim().slice(0, 80),
      status: tournament.status,
      winner_id: (tournament.winner_id || '').slice(0, 128),
      winner_username: (tournament.winner_username || '').slice(0, 50),
      winner_2nd_id: (tournament.winner_2nd_id || '').slice(0, 128),
      winner_2nd_username: (tournament.winner_2nd_username || '').slice(0, 50),
      winner_3rd_id: (tournament.winner_3rd_id || '').slice(0, 128),
      winner_3rd_username: (tournament.winner_3rd_username || '').slice(0, 50),
      rules: rulesText,
      created_at: tournament.created_at.slice(0, 40),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeTournament(tournamentId: string): Promise<void> {
  const path = 'tournaments';
  try {
    await deleteDoc(doc(db, path, tournamentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createParticipant(part: ParticipantRecord): Promise<void> {
  const path = 'participants';
  try {
    const mode: TeamMode =
      part.team_mode === 'Solo' ||
      part.team_mode === 'Duo' ||
      part.team_mode === 'Squad'
        ? part.team_mode
        : 'Solo';
    const slotNum = Math.min(500, Math.max(1, Number(part.slot_number) || 1));

    await setDoc(doc(db, path, part.id), {
      id: part.id.slice(0, 128),
      user_id: part.user_id.slice(0, 128),
      username: part.username.slice(0, 50),
      tournament_id: part.tournament_id.slice(0, 128),
      team_mode: mode,
      slot_number: slotNum,
      team_name: (part.team_name || '').trim().slice(0, 60),
      player_1_ign: (part.player_1_ign || part.username || '').trim().slice(0, 50),
      player_2_ign: (part.player_2_ign || '').trim().slice(0, 50),
      player_3_ign: (part.player_3_ign || '').trim().slice(0, 50),
      player_4_ign: (part.player_4_ign || '').trim().slice(0, 50),
      created_at: part.created_at.slice(0, 40),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createTransaction(tx: TransactionRecord): Promise<void> {
  const path = 'transactions';
  try {
    await setDoc(doc(db, path, tx.id), {
      id: tx.id.slice(0, 128),
      user_id: tx.user_id.slice(0, 128),
      username: tx.username.slice(0, 50),
      amount: Math.max(0, Number(tx.amount) || 0),
      type: tx.type,
      description: tx.description.trim().slice(0, 200),
      created_at: tx.created_at.slice(0, 40),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveDeposit(dep: DepositRecord): Promise<void> {
  const path = 'deposits';
  try {
    await setDoc(doc(db, path, dep.id), {
      id: dep.id.slice(0, 128),
      user_id: dep.user_id.slice(0, 128),
      username: dep.username.slice(0, 50),
      amount: Math.max(1, Number(dep.amount) || 1),
      transaction_id: (dep.transaction_id || '').trim().slice(0, 80),
      screenshot_url: (dep.screenshot_url || '').slice(0, 500000),
      status: dep.status,
      admin_comment: (dep.admin_comment || '').trim().slice(0, 200),
      created_at: dep.created_at.slice(0, 40),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveWithdrawal(wit: WithdrawalRecord): Promise<void> {
  const path = 'withdrawals';
  try {
    await setDoc(doc(db, path, wit.id), {
      id: wit.id.slice(0, 128),
      user_id: wit.user_id.slice(0, 128),
      username: wit.username.slice(0, 50),
      amount: Math.max(1, Number(wit.amount) || 1),
      upi_id: wit.upi_id.trim().slice(0, 100),
      status: wit.status,
      admin_comment: (wit.admin_comment || '').trim().slice(0, 200),
      created_at: wit.created_at.slice(0, 40),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createNotification(
  notif: NotificationRecord
): Promise<void> {
  const path = 'notifications';
  try {
    await setDoc(doc(db, path, notif.id), {
      id: notif.id.slice(0, 128),
      user_id: notif.user_id.slice(0, 128),
      tournament_id: (notif.tournament_id || '').slice(0, 128),
      type: notif.type,
      title: notif.title.trim().slice(0, 120),
      message: notif.message.trim().slice(0, 500),
      is_read: Boolean(notif.is_read),
      created_at: notif.created_at.slice(0, 40),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markNotificationRead(
  notif: NotificationRecord
): Promise<void> {
  const path = 'notifications';
  try {
    await setDoc(doc(db, path, notif.id), {
      ...notif,
      id: notif.id.slice(0, 128),
      user_id: notif.user_id.slice(0, 128),
      tournament_id: (notif.tournament_id || '').slice(0, 128),
      title: notif.title.trim().slice(0, 120),
      message: notif.message.trim().slice(0, 500),
      is_read: true,
      created_at: notif.created_at.slice(0, 40),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function markAllNotificationsReadForUser(
  userId: string,
  notifications: NotificationRecord[]
): Promise<void> {
  const unread = notifications.filter(
    (n) => n.user_id === userId && !n.is_read
  );
  for (const n of unread) {
    await markNotificationRead(n);
  }
}

export async function deleteNotification(notifId: string): Promise<void> {
  const path = 'notifications';
  try {
    await deleteDoc(doc(db, path, notifId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function notifyTournamentParticipants(params: {
  tournament: TournamentRecord;
  participants: ParticipantRecord[];
  type: NotificationType;
  title: string;
  message: string;
}): Promise<number> {
  const { tournament, participants, type, title, message } = params;
  const joined = participants.filter((p) => p.tournament_id === tournament.id);
  const uniqueUserIds = Array.from(new Set(joined.map((p) => p.user_id)));
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

  for (const uid of uniqueUserIds) {
    await createNotification({
      id: generateSafeId('notif'),
      user_id: uid,
      tournament_id: tournament.id,
      type,
      title,
      message,
      is_read: false,
      created_at: nowStr,
    });
  }
  return uniqueUserIds.length;
}

export async function cancelTournamentAndRefundAll(params: {
  tournament: TournamentRecord;
  participants: ParticipantRecord[];
  users: UserRecord[];
  reason?: string;
}): Promise<{ refundedCount: number; totalRefunded: number }> {
  const { tournament, participants, users, reason } = params;
  const joined = participants.filter((p) => p.tournament_id === tournament.id);
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const entryFee = Math.max(0, Number(tournament.entry_fee) || 0);

  let refundedCount = 0;
  let totalRefunded = 0;

  if (tournament.status !== 'Cancelled' && tournament.status !== 'Completed') {
    for (const part of joined) {
      const targetUser = users.find((u) => u.id === part.user_id);
      if (targetUser) {
        if (entryFee > 0) {
          const updatedBalance = targetUser.wallet_balance + entryFee;
          targetUser.wallet_balance = updatedBalance;
          await createOrUpdateUser({
            ...targetUser,
            wallet_balance: updatedBalance,
          });

          const refundTx: TransactionRecord = {
            id: generateSafeId('tx_ref'),
            user_id: targetUser.id,
            username: targetUser.username,
            amount: entryFee,
            type: 'credit',
            description: `Refund: Tournament Cancelled (${tournament.title})`,
            created_at: nowStr,
          };
          await createTransaction(refundTx);
          totalRefunded += entryFee;
        }
        refundedCount += 1;

        const reasonNote = reason && reason.trim() ? ` Reason: ${reason.trim()}.` : '';
        await createNotification({
          id: generateSafeId('notif'),
          user_id: targetUser.id,
          tournament_id: tournament.id,
          type: 'cancelled',
          title: `Tournament Cancelled & Refunded: ${tournament.title}`,
          message:
            entryFee > 0
              ? `"${tournament.title}" has been cancelled by Admin.${reasonNote} Your ₹${entryFee} entry fee has been automatically refunded to your wallet.`
              : `"${tournament.title}" has been cancelled by Admin.${reasonNote}`,
          is_read: false,
          created_at: nowStr,
        });
      }
    }
  }

  await saveTournament({
    ...tournament,
    status: 'Cancelled',
  });

  return { refundedCount, totalRefunded };
}

export async function saveGlobalSettings(setting: SettingRecord): Promise<void> {
  const path = 'settings';
  try {
    await setDoc(doc(db, path, 'global'), {
      id: 'global',
      admin_upi_id: setting.admin_upi_id.trim().slice(0, 100),
      qr_code_url: setting.qr_code_url.slice(0, 150000),
      schema_updated: Boolean(setting.schema_updated),
      installed: Boolean(setting.installed),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function parseMatchTimeMs(matchTimeStr: string): number | null {
  if (!matchTimeStr || !matchTimeStr.trim()) return null;
  const raw = matchTimeStr.trim();

  // Match YYYY-MM-DD HH:MM(:SS) or YYYY-MM-DDTHH:MM(:SS)
  const ymdHm = raw.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/
  );
  if (ymdHm) {
    const year = Number(ymdHm[1]);
    const month = Number(ymdHm[2]) - 1;
    const day = Number(ymdHm[3]);
    const hour = Number(ymdHm[4]);
    const minute = Number(ymdHm[5]);
    const second = ymdHm[6] ? Number(ymdHm[6]) : 0;
    const dt = new Date(year, month, day, hour, minute, second);
    if (!Number.isNaN(dt.getTime())) {
      return dt.getTime();
    }
  }

  // Match HH:MM (today)
  const hmOnly = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hmOnly) {
    const now = new Date();
    const dt = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Number(hmOnly[1]),
      Number(hmOnly[2]),
      0
    );
    if (!Number.isNaN(dt.getTime())) {
      return dt.getTime();
    }
  }

  const parsed = Date.parse(raw.replace(' ', 'T'));
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  return null;
}

export function formatDateTimeForMatch(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function eraseUserPersonalData(params: {
  userId: string;
  participants: ParticipantRecord[];
  notifications: NotificationRecord[];
  deposits: DepositRecord[];
  withdrawals: WithdrawalRecord[];
  transactions: TransactionRecord[];
}): Promise<void> {
  const {
    userId,
    participants,
    notifications,
    deposits,
    withdrawals,
    transactions,
  } = params;

  // Delete personal notifications
  for (const n of notifications.filter((item) => item.user_id === userId)) {
    try {
      await deleteDoc(doc(db, 'notifications', n.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'notifications');
    }
  }

  // Delete tournament participations
  for (const p of participants.filter((item) => item.user_id === userId)) {
    try {
      await deleteDoc(doc(db, 'participants', p.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'participants');
    }
  }

  // Delete deposit requests & payment screenshots
  for (const d of deposits.filter((item) => item.user_id === userId)) {
    try {
      await deleteDoc(doc(db, 'deposits', d.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'deposits');
    }
  }

  // Delete withdrawal requests
  for (const w of withdrawals.filter((item) => item.user_id === userId)) {
    try {
      await deleteDoc(doc(db, 'withdrawals', w.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'withdrawals');
    }
  }

  // Delete wallet transactions
  for (const t of transactions.filter((item) => item.user_id === userId)) {
    try {
      await deleteDoc(doc(db, 'transactions', t.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'transactions');
    }
  }

  // Finally delete the user record
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'users');
  }
}


