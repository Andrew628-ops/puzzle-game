import { Check, X } from 'lucide-react';
import { useApp } from './context';
import { Layout } from './components/Layout';
import { Home, Games, Dashboard } from './pages/Home';
import { PlayPage } from './pages/Play';
import { ArcadePage } from './pages/Arcade';
import { ARCADE_GAMES, type ArcadeGame } from '../shared/arcade';
import { Achievements, Leaderboard } from './pages/Community';
import { AuthDialog, Profile, ResetPassword, Settings } from './pages/Account';
import { AdminPage } from './pages/Admin';
import { SupportPage } from './pages/Support';
export default function App() {
  const { page, auth, toast, setToast, selectedGame, navigate } = useApp();
  const gamePage =
    selectedGame === 'sliding' || selectedGame === 'picture' ? (
      <PlayPage key={selectedGame} game={selectedGame} />
    ) : ARCADE_GAMES.includes(selectedGame as ArcadeGame) ? (
      <ArcadePage key={selectedGame} game={selectedGame as ArcadeGame} />
    ) : (
      <div className="empty-state">
        <h1>Game not found</h1>
        <p>Choose a game from the library to get started.</p>
        <button className="button primary" onClick={() => navigate('games')}>
          All games
        </button>
      </div>
    );
  const pages = {
    home: <Home />,
    games: <Games />,
    play: gamePage,
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
