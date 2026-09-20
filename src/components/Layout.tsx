import { useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Gamepad2,
  Grid2X2,
  House,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Megaphone,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context';
import { Logo } from './Art';
import { AnnouncementReader } from './Announcements';
import type { Page, Announcement } from '../types';
const nav: [Page, string, typeof House][] = [
  ['home', 'Overview', House],
  ['games', 'All games', Gamepad2],
  ['daily', 'Daily challenge', Zap],
  ['leaderboard', 'Leaderboard', Trophy],
  ['achievements', 'Achievements', Sparkles],
];
export function Layout({ children }: { children: ReactNode }) {
  const {
    page,
    navigate,
    player,
    level,
    preferences,
    updatePreferences,
    setAuth,
    query,
    setQuery,
    achievements,
    announcements,
    definitions,
  } = useApp();
  const [mobile, setMobile] = useState(false),
    [notifications, setNotifications] = useState(false),
    [selectedNews, setSelectedNews] = useState<Announcement | null>(null);
  const go = (to: Page) => {
    navigate(to);
    setMobile(false);
  };
  return (
    <div className="app-shell">
      {mobile && <div className="sidebar-backdrop" onClick={() => setMobile(false)} />}
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <button className="brand" onClick={() => go('home')}>
          <Logo />
          <span>
            Puzzle<span className="brand-light">Mind</span>
            <i />
          </span>
        </button>
        <button
          className="icon-button sidebar-close"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X />
        </button>
        <div className="nav-caption">LET’S PLAY</div>
        <nav aria-label="Main navigation">
          {nav.map(([to, label, Icon]) => (
            <button
              key={to}
              className={`nav-link ${page === to || (to === 'games' && page === 'play') ? 'active' : ''}`}
              onClick={() => go(to)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {to === 'daily' && <span className="nav-new">NEW</span>}
              {page === to && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="nav-caption personal-caption">YOUR SPACE</div>
        <nav aria-label="Player navigation">
          <button
            className={`nav-link ${page === 'dashboard' ? 'active' : ''}`}
            onClick={() => go('dashboard')}
          >
            <LayoutDashboard size={19} />
            <span>My dashboard</span>
          </button>
          <button
            className={`nav-link ${page === 'profile' ? 'active' : ''}`}
            onClick={() => go('profile')}
          >
            <UserRound size={19} />
            <span>My profile</span>
          </button>
          {player?.role === 'admin' && (
            <button
              className={`nav-link ${page === 'admin' ? 'active' : ''}`}
              onClick={() => go('admin')}
            >
              <ShieldCheck size={19} />
              <span>Admin studio</span>
            </button>
          )}
        </nav>
        <div className="sidebar-spacer" />
        <div className="mindful-card">
          <span className="mindful-icon">
            <BrainFlower />
          </span>
          <strong>A little better, every day.</strong>
          <p>
            Your next aha moment
            <br />
            is just one puzzle away.
          </p>
          <button onClick={() => go('play')}>
            Find your flow <ArrowUpRight size={15} />
          </button>
          <span className="mindful-spark">✧</span>
        </div>
        <button
          className={`nav-link settings-link ${page === 'settings' ? 'active' : ''}`}
          onClick={() => go('settings')}
        >
          <Settings size={19} />
          <span>Settings</span>
        </button>
        <button
          className={`nav-link support-link ${page === 'support' ? 'active' : ''}`}
          onClick={() => go('support')}
        >
          <MessageSquare size={19} />
          <span>Help & feedback</span>
        </button>
        <div
          className="sidebar-player"
          onClick={() => go('profile')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && go('profile')}
        >
          <span className="avatar">{player?.avatar || '🌱'}</span>
          <div>
            <strong>{player?.username || 'Hey, puzzle explorer'}</strong>
            <span>
              Level {level.level} · {player ? 'Growing your mind' : 'Your journey starts here'}
            </span>
          </div>
          <ChevronRight size={16} />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span className="header-label">A good day for a little brain training.</span>
          </div>
          <div className="topbar-actions">
            <form
              className="search"
              onSubmit={(e) => {
                e.preventDefault();
                go('games');
              }}
            >
              <Search size={17} />
              <input
                aria-label="Search games"
                placeholder="Find your next challenge"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <button
              className="icon-button sound-toggle"
              aria-label={preferences.sound ? 'Mute sound' : 'Enable sound'}
              title={preferences.sound ? 'Mute sound' : 'Enable sound'}
              onClick={() => updatePreferences({ sound: !preferences.sound })}
            >
              {preferences.sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
            <div className="notification-wrap">
              <button
                className={`icon-button ${notifications ? 'selected' : ''}`}
                aria-label="Notifications"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                {(achievements.length > 0 || announcements.length > 0) && (
                  <i className="notification-dot" />
                )}
              </button>
              {notifications && (
                <div className="notification-panel">
                  <strong>Your little wins</strong>
                  {announcements.map((item) => (
                    <button
                      className="notification-news"
                      key={item.id}
                      onClick={() => {
                        setSelectedNews(item);
                        setNotifications(false);
                      }}
                    >
                      <Megaphone size={15} />
                      <span>{item.title}</span>
                    </button>
                  ))}
                  {achievements.length ? (
                    achievements.slice(0, 3).map((a) => (
                      <p key={a.id}>
                        <Sparkles size={15} />
                        Achievement unlocked:{' '}
                        {definitions.find((badge) => badge.id === a.id)?.name || 'New badge'}
                      </p>
                    ))
                  ) : (
                    <p>
                      Your achievements and milestones will appear here. Let’s make the first one
                      happen.
                    </p>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      go('achievements');
                      setNotifications(false);
                    }}
                  >
                    View achievements <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className="topbar-divider" />
            {player ? (
              <button className="header-profile" onClick={() => go('profile')}>
                <span className="avatar small-avatar">{player.avatar}</span>
                <span>{player.username}</span>
                <ChevronDown size={14} />
              </button>
            ) : (
              <button className="button small-button login-button" onClick={() => setAuth('login')}>
                Log in <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </header>
        <main>{children}</main>
        <footer>
          <span>
            <Logo /> A little play. A lot of possibility.
          </span>
          <div>
            <span>Made for curious minds.</span>
            <span className="footer-dot" /> <span>© {new Date().getFullYear()} PuzzleMind</span>
          </div>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {[
          ['home', 'Home', House],
          ['games', 'Games', Grid2X2],
          ['daily', 'Daily', Zap],
          ['leaderboard', 'Ranks', Trophy],
          ['profile', 'You', UserRound],
        ].map(([to, label, Icon]) => {
          const I = Icon as typeof House;
          return (
            <button
              key={String(to)}
              className={page === to ? 'active' : ''}
              onClick={() => go(to as Page)}
            >
              <I size={20} />
              <span>{String(label)}</span>
            </button>
          );
        })}
      </nav>
      {selectedNews && (
        <AnnouncementReader announcement={selectedNews} onClose={() => setSelectedNews(null)} />
      )}
    </div>
  );
}
function BrainFlower() {
  return <BookOpen size={23} />;
}
