import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { api, readLocal, saveLocal, music } from './lib';
import { ACHIEVEMENTS, achievementProgress, levelInfo } from '../shared/game';
import { GAME_CATALOG } from '../shared/catalog';
import type {
  GameResult,
  Player,
  Preferences,
  Page,
  GameDefinition,
  AchievementDefinition,
  Announcement,
  DailyChallenge,
} from './types';
const getPage = (): Page => (location.hash.replace('#', '').split('?')[0] || 'home') as Page;
const getGame = () =>
  new URLSearchParams(location.hash.split('?')[1] || '').get('game') || 'sliding';
function useAppState() {
  const [page, setPage] = useState<Page>(getPage),
    [selectedGame, setSelectedGame] = useState(getGame),
    [player, setPlayer] = useState<Player | null>(null),
    [loaded, setLoaded] = useState(false),
    [guestHistory, setGuestHistory] = useState<GameResult[]>(() => readLocal('pm-history', [])),
    [toast, setToast] = useState(''),
    [auth, setAuth] = useState<'login' | 'register' | 'forgot' | null>(null),
    [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<GameDefinition[]>(GAME_CATALOG);
  const [definitions, setDefinitions] = useState<AchievementDefinition[]>(ACHIEVEMENTS);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
  const catalogRequest = useRef(0);
  const refreshCatalog = useCallback(async () => {
    const request = ++catalogRequest.current;
    const [gameData, badgeData, newsData, dailyData] = await Promise.all([
      api<GameDefinition[]>('/games'),
      api<AchievementDefinition[]>('/achievements'),
      api<Announcement[]>('/announcements'),
      api<DailyChallenge>('/daily-challenge'),
    ]);
    if (request !== catalogRequest.current) return;
    setCatalog(gameData);
    setDefinitions(badgeData);
    setAnnouncements(newsData);
    setDailyChallenge(dailyData);
  }, []);
  useEffect(() => {
    const refresh = () => {
      void refreshCatalog().catch(() => {});
    };
    refresh();
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('focus', refresh);
      clearInterval(timer);
    };
  }, [refreshCatalog, page]);
  const [preferences, setPreferences] = useState<Preferences>(() =>
    readLocal('pm-preferences', {
      sound: true,
      music: false,
      dark: true,
      animations: true,
      notifications: true,
      difficulty: 'easy',
      theme: 'classic',
    }),
  );
  useEffect(() => {
    let active = true,
      request = 0;
    const refresh = () => {
      const current = ++request;
      api<Player | null>('/auth/me')
        .then((account) => {
          if (active && current === request) setPlayer(account);
        })
        .catch((error) => {
          if (active && current === request) {
            setPlayer(null);
            setToast(error.message);
          }
        })
        .finally(() => {
          if (active && current === request) setLoaded(true);
        });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
    };
  }, [page]);
  useEffect(() => {
    const navigate = () => {
      setPage(getPage());
      setSelectedGame(getGame());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => {
    saveLocal('pm-preferences', preferences);
    document.documentElement.dataset.mode = preferences.dark ? 'dark' : 'light';
    document.documentElement.dataset.motion = preferences.animations ? 'full' : 'reduced';
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences]);
  useEffect(() => {
    if (!preferences.music) {
      music(false);
      return;
    }
    const startMusic = () => music(true);
    document.addEventListener('pointerdown', startMusic, { once: true });
    return () => document.removeEventListener('pointerdown', startMusic);
  }, [preferences.music]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const history = player?.history || guestHistory,
    xp = history.reduce((sum, g) => sum + g.xp, 0),
    level = levelInfo(xp);
  const achievements = useMemo(() => {
    if (player) return player.achievements;
    const earned: { id: string; date: string }[] = [];
    const played: GameResult[] = [];
    let earnedXp = 0;
    for (const game of [...guestHistory].reverse()) {
      played.push(game);
      earnedXp += game.xp;
      for (const achievement of definitions) {
        if (
          !earned.some((item) => item.id === achievement.id) &&
          achievementProgress(achievement.metric || achievement.id, played, earnedXp) >=
            achievement.goal
        ) {
          earned.push({ id: achievement.id, date: game.date });
        }
      }
    }
    return earned;
  }, [player, guestHistory, definitions]);
  function navigate(next: Page, game = 'sliding') {
    location.hash =
      next === 'play' && game !== 'sliding' ? `play?game=${encodeURIComponent(game)}` : next;
    setPage(next);
    setSelectedGame(game);
  }
  function updatePreferences(update: Partial<Preferences>) {
    setPreferences((prev) => ({ ...prev, ...update }));
    if (update.music !== undefined) music(update.music);
  }
  function record(result: GameResult, account: Player | null, duplicate = false) {
    if (account) setPlayer(account);
    else if (!duplicate) {
      setGuestHistory((previous) => {
        if (result.daily && previous.some((g) => g.daily === result.daily)) return previous;
        const next = [result, ...previous];
        saveLocal('pm-history', next);
        return next;
      });
    }
    if (preferences.notifications && !duplicate) {
      const unlocked = definitions.filter(
        (a) =>
          !achievements.some((u) => u.id === a.id) &&
          achievementProgress(a.metric || a.id, [result, ...history], xp + result.xp) >= a.goal,
      );
      if (unlocked.length)
        setToast(`Achievement unlocked: ${unlocked.map((a) => a.name).join(' & ')}!`);
    }
  }
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      setPlayer(null);
      navigate('home');
      setToast('You’re signed out. See you for your next puzzle!');
    } catch (error) {
      setToast((error as Error).message);
    }
  }
  return {
    page,
    selectedGame,
    navigate,
    player,
    setPlayer,
    loaded,
    history,
    xp,
    level,
    achievements,
    preferences,
    updatePreferences,
    toast,
    setToast,
    auth,
    setAuth,
    query,
    setQuery,
    record,
    logout,
    catalog,
    definitions,
    announcements,
    dailyChallenge,
    refreshCatalog,
  };
}
const AppContext = createContext<ReturnType<typeof useAppState> | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const value = useAppState();
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() {
  return useContext(AppContext)!;
}
