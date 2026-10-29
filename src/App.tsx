import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  AdminRecord,
  AdminRoute,
  DepositRecord,
  NotificationRecord,
  ParticipantRecord,
  SettingRecord,
  TournamentRecord,
  TransactionRecord,
  UserRecord,
  UserRoute,
  WithdrawalRecord,
} from './types';
import { ensureSystemBootstrapped } from './services/dbService';
import { UserLayout } from './components/UserLayout';
import { AdminLayout } from './components/AdminLayout';
import { UserAuthView } from './components/UserAuthView';
import { UserHomeView } from './components/UserHomeView';
import { UserMyTournamentsView } from './components/UserMyTournamentsView';
import { UserWalletView } from './components/UserWalletView';
import { UserProfileView } from './components/UserProfileView';
import { AdminLoginView } from './components/AdminLoginView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AdminTournamentsView } from './components/AdminTournamentsView';
import { AdminManageTournamentView } from './components/AdminManageTournamentView';
import { AdminUsersView } from './components/AdminUsersView';
import { AdminRequestsView } from './components/AdminRequestsView';
import { AdminSettingsView } from './components/AdminSettingsView';
import { SupportChatWidget } from './components/SupportChatWidget';

const SESSION_USER_KEY = 'skill_arena_session_user_id';
const SESSION_ADMIN_KEY = 'skill_arena_session_admin_id';
const SESSION_PORTAL_KEY = 'skill_arena_portal_mode';

export default function App() {
  const [portalMode, setPortalMode] = useState<'user' | 'admin'>(() => {
    const saved = localStorage.getItem(SESSION_PORTAL_KEY);
    return saved === 'admin' ? 'admin' : 'user';
  });

  const [userRoute, setUserRoute] = useState<UserRoute>('home');
  const [adminRoute, setAdminRoute] = useState<AdminRoute>('admin_dashboard');
  const [managedTournamentId, setManagedTournamentId] = useState<string | null>(
    null
  );

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([]);
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [settings, setSettings] = useState<SettingRecord>({
    id: 'global',
    admin_upi_id: '',
    qr_code_url: '',
    schema_updated: true,
    installed: true,
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    localStorage.getItem(SESSION_USER_KEY)
  );
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(() =>
    localStorage.getItem(SESSION_ADMIN_KEY)
  );
  const [bootstrapping, setBootstrapping] = useState(true);

  // Security & User Experience requirement from specification:
  // Disable right-click, text selection, and zoom in/out using JavaScript
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')
      ) {
        e.preventDefault();
      }
    };
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Bootstrap initial database tables and real-time listeners
  useEffect(() => {
    let active = true;

    ensureSystemBootstrapped().finally(() => {
      if (active) setBootstrapping(false);
    });

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UserRecord);
        setUsers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubAdmins = onSnapshot(
      collection(db, 'admins'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as AdminRecord);
        setAdmins(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'admins')
    );

    const unsubTournaments = onSnapshot(
      collection(db, 'tournaments'),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as TournamentRecord)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        setTournaments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tournaments')
    );

    const unsubParticipants = onSnapshot(
      collection(db, 'participants'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as ParticipantRecord);
        setParticipants(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'participants')
    );

    const unsubTransactions = onSnapshot(
      collection(db, 'transactions'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as TransactionRecord);
        setTransactions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );

    const unsubDeposits = onSnapshot(
      collection(db, 'deposits'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as DepositRecord);
        setDeposits(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'deposits')
    );

    const unsubWithdrawals = onSnapshot(
      collection(db, 'withdrawals'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as WithdrawalRecord);
        setWithdrawals(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'withdrawals')
    );

    const unsubNotifications = onSnapshot(
      collection(db, 'notifications'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as NotificationRecord);
        setNotifications(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    const unsubSettings = onSnapshot(
      collection(db, 'settings'),
      (snap) => {
        const globalDoc = snap.docs.find((d) => d.id === 'global');
        if (globalDoc) {
          setSettings(globalDoc.data() as SettingRecord);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'settings')
    );

    return () => {
      active = false;
      unsubUsers();
      unsubAdmins();
      unsubTournaments();
      unsubParticipants();
      unsubTransactions();
      unsubDeposits();
      unsubWithdrawals();
      unsubNotifications();
      unsubSettings();
    };
  }, []);

  const currentUser = users.find((u) => u.id === currentUserId) || null;
  const currentAdmin = admins.find((a) => a.id === currentAdminId) || null;

  const handleUserLoginSuccess = (user: UserRecord) => {
    setCurrentUserId(user.id);
    localStorage.setItem(SESSION_USER_KEY, user.id);
    setPortalMode('user');
    localStorage.setItem(SESSION_PORTAL_KEY, 'user');
    setUserRoute('home');
  };

  const handleUserLogout = () => {
    setCurrentUserId(null);
    localStorage.removeItem(SESSION_USER_KEY);
    setUserRoute('login');
  };

  const handleAdminLoginSuccess = (admin: AdminRecord) => {
    setCurrentAdminId(admin.id);
    localStorage.setItem(SESSION_ADMIN_KEY, admin.id);
    setPortalMode('admin');
    localStorage.setItem(SESSION_PORTAL_KEY, 'admin');
    setAdminRoute('admin_dashboard');
  };

  const handleAdminLogout = () => {
    setCurrentAdminId(null);
    localStorage.removeItem(SESSION_ADMIN_KEY);
    setAdminRoute('admin_login');
  };

  const switchPortal = (target: 'user' | 'admin') => {
    setPortalMode(target);
    localStorage.setItem(SESSION_PORTAL_KEY, target);
  };

  if (bootstrapping && users.length === 0 && tournaments.length === 0) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col items-center justify-center p-6">
        <img
          src="/assets/aistudio/skill-arena-icon_ca7b5100.svg"
          alt="Skill Arena Logo"
          referrerPolicy="no-referrer"
          className="w-20 h-20 object-contain mb-4 animate-pulse"
        />
        <div className="font-display font-extrabold text-2xl tracking-wider text-white">
          SKILL <span className="text-amber-400">ARENA</span>
        </div>
        <div className="text-xs font-semibold tracking-[0.2em] uppercase text-amber-500 mt-1">
          Play. Compete. Conquer.
        </div>
      </div>
    );
  }

  return (
    <>
      {portalMode === 'admin' ? (
        !currentAdmin ? (
          <AdminLoginView
            admins={admins}
            onLoginSuccess={handleAdminLoginSuccess}
            onSwitchToUser={() => switchPortal('user')}
          />
        ) : (
          <AdminLayout
            admin={currentAdmin}
            activeRoute={adminRoute}
            pendingDepositsCount={
              deposits.filter((d) => d.status === 'Pending').length
            }
            pendingWithdrawalsCount={
              withdrawals.filter((w) => w.status === 'Pending').length
            }
            onNavigate={(route) => setAdminRoute(route)}
            onLogout={handleAdminLogout}
            onSwitchToUser={() => switchPortal('user')}
          >
            {adminRoute === 'admin_dashboard' && (
              <AdminDashboardView
                users={users}
                tournaments={tournaments}
                participants={participants}
                deposits={deposits}
                withdrawals={withdrawals}
                onNavigate={(r) => setAdminRoute(r)}
                onManageTournament={(tId) => {
                  setManagedTournamentId(tId);
                  setAdminRoute('admin_manage_tournament');
                }}
              />
            )}

            {adminRoute === 'admin_tournaments' && (
              <AdminTournamentsView
                tournaments={tournaments}
                participants={participants}
                users={users}
                onManageTournament={(tId) => {
                  setManagedTournamentId(tId);
                  setAdminRoute('admin_manage_tournament');
                }}
              />
            )}

            {adminRoute === 'admin_manage_tournament' && (
              <AdminManageTournamentView
                tournament={tournaments.find(
                  (t) => t.id === managedTournamentId
                )}
                participants={participants}
                users={users}
                onBack={() => setAdminRoute('admin_tournaments')}
              />
            )}

            {adminRoute === 'admin_users' && (
              <AdminUsersView
                users={users}
                participants={participants}
                tournaments={tournaments}
                transactions={transactions}
              />
            )}

            {adminRoute === 'admin_deposits' && (
              <AdminRequestsView
                mode="deposits"
                deposits={deposits}
                withdrawals={withdrawals}
                users={users}
              />
            )}

            {adminRoute === 'admin_withdrawals' && (
              <AdminRequestsView
                mode="withdrawals"
                deposits={deposits}
                withdrawals={withdrawals}
                users={users}
              />
            )}

            {adminRoute === 'admin_settings' && (
              <AdminSettingsView
                admin={currentAdmin}
                settings={settings}
                onAdminUpdated={(updated) => setCurrentAdminId(updated.id)}
              />
            )}
          </AdminLayout>
        )
      ) : !currentUser || currentUser.is_blocked ? (
        <UserAuthView
          users={users}
          onLoginSuccess={handleUserLoginSuccess}
          onSwitchToAdmin={() => switchPortal('admin')}
        />
      ) : (
        <UserLayout
          user={currentUser}
          activeRoute={userRoute}
          notifications={notifications}
          tournaments={tournaments}
          participants={participants}
          onNavigate={(route) => setUserRoute(route)}
          onSwitchToAdmin={() => switchPortal('admin')}
        >
          {userRoute === 'home' && (
            <UserHomeView
              user={currentUser}
              tournaments={tournaments}
              participants={participants}
              onNavigate={(r) => setUserRoute(r)}
            />
          )}

          {userRoute === 'my_tournaments' && (
            <UserMyTournamentsView
              user={currentUser}
              tournaments={tournaments}
              participants={participants}
              onNavigate={(r) => setUserRoute(r)}
            />
          )}

          {userRoute === 'wallet' && (
            <UserWalletView
              user={currentUser}
              settings={settings}
              transactions={transactions}
              deposits={deposits}
              withdrawals={withdrawals}
              onNavigate={(r) => setUserRoute(r)}
            />
          )}

          {userRoute === 'profile' && (
            <UserProfileView
              user={currentUser}
              allUsers={users}
              participants={participants}
              transactions={transactions}
              deposits={deposits}
              withdrawals={withdrawals}
              notifications={notifications}
              onLogout={handleUserLogout}
            />
          )}
        </UserLayout>
      )}

      {portalMode === 'user' && (
        <SupportChatWidget
          user={currentUser}
          tournaments={tournaments}
          participants={participants}
          transactions={transactions}
          deposits={deposits}
          withdrawals={withdrawals}
          settings={settings}
          onNavigate={
            currentUser && !currentUser.is_blocked
              ? (r) => setUserRoute(r)
              : undefined
          }
        />
      )}
    </>
  );
}
