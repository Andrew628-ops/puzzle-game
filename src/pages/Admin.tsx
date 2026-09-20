import {
  CalendarDays,
  Gamepad2,
  LayoutDashboard,
  LoaderCircle,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '../components/UI';
import { useApp } from '../context';
import { AdminAchievements } from './admin/Achievements';
import { AdminAnnouncements } from './admin/Announcements';
import { AdminDaily } from './admin/Daily';
import { AdminGames } from './admin/Games';
import { AdminOverview } from './admin/Overview';
import { AdminReports } from './admin/Reports';
import { AdminUsers } from './admin/Users';
type AdminTab =
  'overview' | 'users' | 'daily' | 'achievements' | 'games' | 'reports' | 'announcements';

const tabs: { id: AdminTab; label: string; icon: typeof Users }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Players', icon: Users },
  { id: 'daily', label: 'Daily puzzles', icon: CalendarDays },
  { id: 'achievements', label: 'Achievements', icon: Sparkles },
  { id: 'games', label: 'Game library', icon: Gamepad2 },
  { id: 'reports', label: 'Reports', icon: MessageSquare },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
];

export function AdminPage() {
  const { player, loaded, setAuth, navigate } = useApp();
  if (!loaded)
    return (
      <div className="admin-loading">
        <LoaderCircle className="spinner" />
        Checking your account…
      </div>
    );
  if (player?.role !== 'admin')
    return (
      <EmptyState
        icon={<ShieldCheck size={34} />}
        title="A space for the people behind the puzzles."
        description={
          player
            ? 'This account doesn’t have administrator access.'
            : 'Sign in with your administrator account to manage PuzzleMind.'
        }
        action={player ? 'Back to your dashboard' : 'Log in'}
        onClick={() => (player ? navigate('dashboard') : setAuth('login'))}
      />
    );
  return <AdminStudio />;
}

function AdminStudio() {
  const [tab, setTab] = useState<AdminTab>('overview');
  return (
    <>
      <div className="page-intro admin-intro">
        <div>
          <div className="eyebrow">
            <ShieldCheck size={15} />
            BEHIND THE LITTLE WINS
          </div>
          <h1>Keep the good things growing.</h1>
          <p>Your players, puzzles, and community. All in one place.</p>
        </div>
        <span className="admin-role">
          <ShieldCheck size={14} />
          ADMIN STUDIO
        </span>
      </div>
      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tabs.find((item) => item.id === tab)?.label} key={tab}>
        {tab === 'overview' ? (
          <AdminOverview />
        ) : tab === 'users' ? (
          <AdminUsers />
        ) : tab === 'daily' ? (
          <AdminDaily />
        ) : tab === 'achievements' ? (
          <AdminAchievements />
        ) : tab === 'games' ? (
          <AdminGames />
        ) : tab === 'reports' ? (
          <AdminReports />
        ) : (
          <AdminAnnouncements />
        )}
      </div>
    </>
  );
}
