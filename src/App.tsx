import { Check, X } from 'lucide-react';
import { useApp } from './context';
import { Layout } from './components/Layout';
import { Home, Games, Dashboard } from './pages/Home';
import { PlayPage } from './pages/Play';
import { Achievements, Leaderboard } from './pages/Community';
import { AuthDialog, Profile, ResetPassword, Settings } from './pages/Account';
import { AdminPage } from './pages/Admin';
import { SupportPage } from './pages/Support';
export default function App() {
  const { page, auth, toast, setToast } = useApp();
  const pages = {
    home: <Home />,
    games: <Games />,
    play: <PlayPage key="play" />,
    daily: <PlayPage daily key="daily" />,
    dashboard: <Dashboard />,
    profile: <Profile />,
    settings: <Settings />,
    admin: <AdminPage />,
    support: <SupportPage />,
    achievements: <Achievements />,
    leaderboard: <Leaderboard />,
    'reset-password': <ResetPassword />,
  };
  return (
    <>
      <Layout>{pages[page] || <Home />}</Layout>
      {auth && <AuthDialog />}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          <p>{toast}</p>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
