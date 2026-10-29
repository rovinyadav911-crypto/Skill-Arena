export interface UserRecord {
  id: string;
  username: string;
  email: string;
  password: string;
  wallet_balance: number;
  upi_id: string;
  is_blocked: boolean;
  dpdp_consent_accepted?: boolean;
  dpdp_consent_at?: string;
  age_verified_18?: boolean;
  nominee_name?: string;
  nominee_contact?: string;
  recovery_key?: string;
  security_question?: string;
  security_answer?: string;
  last_password_reset_at?: string;
  created_at: string;
}

export interface AdminRecord {
  id: string;
  username: string;
  password: string;
}

export type TeamMode = 'Solo' | 'Duo' | 'Squad';

export interface TournamentRecord {
  id: string;
  title: string;
  game_name: string;
  team_mode?: TeamMode;
  max_slots?: number;
  entry_fee: number;
  prize_pool: number;
  prize_1st?: number;
  prize_2nd?: number;
  prize_3rd?: number;
  match_time: string;
  commission_percentage: number;
  room_id: string;
  room_password: string;
  status: 'Upcoming' | 'Live' | 'Completed' | 'Cancelled';
  winner_id: string;
  winner_username: string;
  winner_2nd_id?: string;
  winner_2nd_username?: string;
  winner_3rd_id?: string;
  winner_3rd_username?: string;
  rules?: string;
  created_at: string;
}

export interface ParticipantRecord {
  id: string;
  user_id: string;
  username: string;
  tournament_id: string;
  team_mode?: TeamMode;
  slot_number?: number;
  team_name?: string;
  player_1_ign?: string;
  player_2_ign?: string;
  player_3_ign?: string;
  player_4_ign?: string;
  created_at: string;
}

export interface TransactionRecord {
  id: string;
  user_id: string;
  username: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  created_at: string;
}

export interface DepositRecord {
  id: string;
  user_id: string;
  username: string;
  amount: number;
  transaction_id: string;
  screenshot_url?: string;
  status: 'Pending' | 'Completed' | 'Rejected';
  admin_comment?: string;
  created_at: string;
}

export interface WithdrawalRecord {
  id: string;
  user_id: string;
  username: string;
  amount: number;
  upi_id: string;
  status: 'Pending' | 'Completed' | 'Rejected';
  admin_comment?: string;
  created_at: string;
}

export type NotificationType =
  | 'starting_soon'
  | 'results_finalized'
  | 'postponed'
  | 'cancelled'
  | 'payment_update';

export interface NotificationRecord {
  id: string;
  user_id: string;
  tournament_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface SettingRecord {
  id: string;
  admin_upi_id: string;
  qr_code_url: string;
  schema_updated: boolean;
  installed: boolean;
}

export type UserRoute = 'login' | 'home' | 'my_tournaments' | 'wallet' | 'profile';
export type AdminRoute =
  | 'admin_login'
  | 'admin_dashboard'
  | 'admin_tournaments'
  | 'admin_manage_tournament'
  | 'admin_users'
  | 'admin_deposits'
  | 'admin_withdrawals'
  | 'admin_settings';
