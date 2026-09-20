import {
  ArrowUpRight,
  Check,
  Clock3,
  Flame,
  Gamepad2,
  Lightbulb,
  LockKeyhole,
  Play,
  Puzzle,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { GameArt, PuzzleArt } from '../components/Art';
import { BadgeIcon, SectionTitle } from '../components/UI';
import { DIFFICULTIES, getStreak } from '../../shared/game';
import { dateLabel, time, today } from '../lib';
import type { GameDefinition } from '../types';
import { CommunityNews } from '../components/Announcements';
export function GameCard({ game }: { game: GameDefinition }) {
  const { navigate } = useApp();
  return (
    <article className={`game-card ${game.color}`}>
      <div className="game-card-visual">
        <GameArt type={game.id} />
        <span className={`game-label ${game.available ? 'available' : ''}`}>
          {game.available ? (
            <>
              <span /> READY TO PLAY
            </>
          ) : (
            <>
              <LockKeyhole size={10} /> COMING SOON
            </>
          )}
        </span>
      </div>
      <div className="game-card-body">
        <div className="game-card-top">
          <span className="category-tag">{game.tag}</span>
          {game.available && <span className="game-difficulties">4 difficulties</span>}
        </div>
        <h3>{game.name}</h3>
        <p>{game.description}</p>
        <div className="game-card-footer">
          {game.available ? (
            <>
              <span>
                <Puzzle size={13} /> Every move matters
              </span>
              <button
                className="round-button"
                aria-label={`Play ${game.name}`}
                onClick={() => navigate('play')}
              >
                <ArrowUpRight size={19} />
              </button>
            </>
          ) : (
            <span className="coming-soon-note">A new way to play. Coming soon.</span>
          )}
        </div>
      </div>
    </article>
  );
}
export function DailyCard() {
  const { navigate, history, dailyChallenge } = useApp();
  const dailyConfig = DIFFICULTIES[dailyChallenge?.difficulty || 'medium'];
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    function tick() {
      const now = new Date(),
        next = new Date(now);
      next.setUTCHours(24, 0, 0, 0);
      const seconds = Math.floor((+next - +now) / 1000);
      setRemaining(
        `${String(Math.floor(seconds / 3600)).padStart(2, '0')} : ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')} : ${String(seconds % 60).padStart(2, '0')}`,
      );
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);
  const done = history.some((g) => g.daily === today());
  return (
    <article className="daily-card">
      <div className="daily-top">
        <span className="daily-eyebrow">
          <Zap size={14} /> THE DAILY DROP
        </span>
        <span className="live-dot" />
      </div>
      <div className="daily-icon">
        <Zap size={30} fill="currentColor" />
        <span>✦</span>
      </div>
      <h2>
        One puzzle.
        <br />A fresh perspective.
      </h2>
      <p>
        A new challenge every day.
        <br />
        Same puzzle. A world of possibilities.
      </p>
      <div className="daily-details">
        <span>
          <GridIcon />
          {dailyConfig.size} × {dailyConfig.size} puzzle
        </span>
        <span className="daily-difficulty">{dailyConfig.label}</span>
      </div>
      <button className="button daily-button" onClick={() => navigate('daily')}>
        {done ? 'Challenge complete' : 'Take the challenge'}
        {done ? <Check size={17} /> : <ArrowUpRight size={17} />}
      </button>
      <div className="daily-countdown">
        <Clock3 size={12} />
        <span>Next puzzle in</span>
        <strong>{remaining}</strong>
      </div>
    </article>
  );
}
function GridIcon() {
  return <span className="tiny-grid">▦</span>;
}
export function Stats() {
  const { history, xp, level } = useApp();
  const streak = getStreak(history).current;
  const stats = [
    {
      label: 'Puzzles solved',
      value: history.length,
      unit: '',
      caption: 'One win at a time',
      Icon: Puzzle,
      color: 'green',
    },
    {
      label: 'Total points',
      value: history.reduce((n, g) => n + g.score, 0).toLocaleString(),
      unit: 'pts',
      caption: 'Make every move count',
      Icon: Trophy,
      color: 'purple',
    },
    {
      label: 'Current streak',
      value: streak,
      unit: streak === 1 ? 'day' : 'days',
      caption: streak ? 'Keep the good thing going' : 'A fresh start is a good start',
      Icon: Flame,
      color: 'orange',
    },
    {
      label: 'Your level',
      value: String(level.level).padStart(2, '0'),
      unit: '',
      caption: `${xp - level.start} / ${level.next - level.start} XP to level ${level.level + 1}`,
      Icon: Zap,
      color: 'blue',
    },
  ];
  return (
    <div className="stats-grid">
      {stats.map(({ label, value, unit, caption, Icon, color }, i) => (
        <div className="stat-card" key={label}>
          <span className={`stat-icon ${color}`}>
            <Icon size={20} />
          </span>
          <div className="stat-content">
            <span className="stat-label">{label}</span>
            <div className="stat-value">
              {value}
              <span>{unit}</span>
            </div>
            <span className="stat-caption">{caption}</span>
            {i === 3 && (
              <div className="xp-track">
                <span style={{ width: `${level.progress}%` }} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
export function Home() {
  const { navigate, player, setAuth, achievements, catalog, definitions } = useApp();
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">
          <span className="little-sun">✳</span> A LITTLE PLAY GOES A LONG WAY
        </div>
        <div className="intro-title-row">
          <div>
            <h1>
              {player ? `Good to see you, ${player.username}.` : 'Hello, curious mind.'}
              <span className="wave">✦</span>
            </h1>
            <p>Take a breath. Pick a puzzle. Make a little progress.</p>
          </div>
          <span className="today-label">
            <span />
            {new Date().toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
      <CommunityNews />
      <section className="hero-grid">
        <article className="hero-card">
          <div className="hero-copy">
            <span className="pill">
              <span /> YOUR MIND’S NEW HAPPY PLACE
            </span>
            <h2>
              A little challenge.
              <br />A <span>sharper mind.</span>
            </h2>
            <p>
              Make room for your next aha moment.
              <br />
              Play, find your flow, and surprise yourself.
            </p>
            <button className="button primary hero-button" onClick={() => navigate('play')}>
              <Play size={16} fill="currentColor" /> Let’s play <ArrowUpRight size={18} />
            </button>
            <div className="hero-bottom">
              <span className="tiny-avatars">
                <i>✿</i>
                <i>☺</i>
                <i>✦</i>
              </span>
              <span>A small daily habit. A brighter you.</span>
            </div>
          </div>
          <PuzzleArt />
        </article>
        <DailyCard />
      </section>
      <Stats />
      <section className="games-section">
        <SectionTitle
          title="Find your kind of challenge"
          subtitle="Different ways to play. One happy brain."
          action="Explore all games"
          onClick={() => navigate('games')}
        />
        <div className="game-grid">
          {catalog.slice(0, 3).map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>
      <div className="home-bottom-grid">
        <section className="milestone-panel panel">
          <SectionTitle
            title="Little wins, big feelings"
            action="All achievements"
            onClick={() => navigate('achievements')}
          />
          <p className="panel-subtitle">Every puzzle is a step toward something great.</p>
          <div className="milestones">
            {definitions.slice(0, 3).map((a, i) => (
              <div
                key={a.id}
                className={`milestone ${achievements.some((u) => u.id === a.id) ? 'unlocked' : ''}`}
              >
                <span className={`milestone-icon milestone-${i}`}>
                  <BadgeIcon name={a.icon} size={25} />
                  {!achievements.some((u) => u.id === a.id) && (
                    <LockKeyhole size={11} className="badge-lock" />
                  )}
                </span>
                <strong>{a.name}</strong>
                <span>
                  {i === 0 ? 'Your first puzzle' : i === 1 ? 'Under 60 seconds' : 'No hints needed'}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="mindset-panel">
          <span className="mindset-eyebrow">
            <Lightbulb size={15} /> A FRIENDLY REMINDER
          </span>
          <h3>
            Progress isn’t always
            <br />a straight line.
          </h3>
          <p>
            Sometimes, a step back is exactly
            <br />
            the move you need.
          </p>
          <div className="mindset-bottom">
            <span>Keep exploring. You’ve got this.</span>
            <span className="mindset-art">↗</span>
          </div>
        </section>
      </div>
      {!player && (
        <div className="signup-banner">
          <span className="signup-icon">
            <Users size={25} />
          </span>
          <div>
            <strong>Your progress deserves a place to call home.</strong>
            <p>Create a free account to save your wins and climb the leaderboard.</p>
          </div>
          <button className="button secondary" onClick={() => setAuth('register')}>
            Create an account <ArrowUpRight size={17} />
          </button>
        </div>
      )}
    </>
  );
}
export function Games() {
  const { query, setQuery, catalog } = useApp();
  const [filter, setFilter] = useState('all');
  const games = catalog.filter(
    (g) =>
      (filter === 'all' || g.available) &&
      `${g.name} ${g.tag}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">
          <Gamepad2 size={15} /> A WORLD OF AHA MOMENTS
        </div>
        <h1>Find your next obsession.</h1>
        <p>A little logic, a little focus, and a whole lot of possibility.</p>
      </div>
      <div className="library-toolbar">
        <div className="segmented-control">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            All games <span>{catalog.length}</span>
          </button>
          <button className={filter === 'play' ? 'active' : ''} onClick={() => setFilter('play')}>
            Ready to play <span>{catalog.filter((game) => game.available).length}</span>
          </button>
        </div>
        <input
          className="field library-search"
          aria-label="Filter games"
          placeholder="Search games…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="game-grid library-grid">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
      {!games.length && (
        <div className="empty-state">
          <h3>No puzzles found</h3>
          <p>Try a different search or explore all games.</p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="library-note">
        <Sparkles size={19} />
        <p>Good things take a little puzzling. More games are on their way.</p>
      </div>
    </>
  );
}
export function Dashboard() {
  const { player, navigate, history, achievements, level, xp, setAuth } = useApp();
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">
          <Target size={15} /> YOUR GROWTH, ONE MOVE AT A TIME
        </div>
        <h1>Your little victories.</h1>
        <p>
          {player
            ? `Here’s how far you’ve come, ${player.username}.`
            : 'Your guest progress is saved on this browser. Create an account to keep it with you.'}
        </p>
      </div>
      <Stats />
      <div className="dashboard-grid">
        <section className="panel progress-panel">
          <SectionTitle
            title={`Level ${level.level} · ${level.level < 3 ? 'Curious mind' : 'Puzzle explorer'}`}
            action="View profile"
            onClick={() => navigate('profile')}
          />
          <div className="large-level">
            <span>✳</span>
            <strong>{level.level}</strong>
            <div>
              <h3>Small steps. Real progress.</h3>
              <p>
                {xp} total XP · {level.next - xp} XP to your next level
              </p>
            </div>
          </div>
          <div className="xp-track large-track">
            <span style={{ width: `${level.progress}%` }} />
          </div>
          <div className="progress-footer">
            <span>{achievements.length} achievements unlocked</span>
            <button className="text-button" onClick={() => navigate('achievements')}>
              See your badges <ArrowUpRight size={15} />
            </button>
          </div>
        </section>
        <DailyCard />
      </div>
      <section className="panel history-panel">
        <SectionTitle title="Your recent games" subtitle="A record of every well-earned aha." />
        {history.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Difficulty</th>
                  <th>Time</th>
                  <th>Moves</th>
                  <th>Score</th>
                  <th>XP</th>
                  <th>Played</th>
                </tr>
              </thead>
              <tbody>
                {history.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <span className="table-game-icon">
                        <Puzzle size={17} />
                      </span>
                      {g.daily ? 'Daily challenge' : 'Sliding Puzzle'}
                    </td>
                    <td>
                      <span className={`difficulty-label ${g.difficulty}`}>{g.difficulty}</span>
                    </td>
                    <td>{time(g.seconds)}</td>
                    <td>{g.moves}</td>
                    <td className="score-cell">{g.score.toLocaleString()}</td>
                    <td>+{g.xp}</td>
                    <td>{dateLabel(g.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Puzzle size={36} />
            <h3>Your first win is waiting.</h3>
            <p>Complete a puzzle and we’ll save all the good stuff here.</p>
            <button className="button primary" onClick={() => navigate('play')}>
              Play your first puzzle <ArrowUpRight size={17} />
            </button>
          </div>
        )}
      </section>
      {!player && (
        <div className="signup-banner">
          <Users size={25} />
          <div>
            <strong>Keep your next wins in one place.</strong>
            <p>Guest history stays on this device. New account progress starts fresh.</p>
          </div>
          <button className="button secondary" onClick={() => setAuth('register')}>
            Create account <ArrowUpRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}
