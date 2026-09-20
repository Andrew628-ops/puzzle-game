import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Crown,
  Globe2,
  LockKeyhole,
  Medal,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { useApp } from '../context';
import { BadgeIcon, EmptyState } from '../components/UI';
import { achievementProgress } from '../../shared/game';
import { api, dateLabel, time } from '../lib';
import type { Leader } from '../types';
export function Achievements() {
  const { achievements, history, xp, navigate, definitions } = useApp();
  const [filter, setFilter] = useState('all');
  const list = definitions.filter(
    (a) =>
      filter === 'all' ||
      (filter === 'unlocked'
        ? achievements.some((u) => u.id === a.id)
        : !achievements.some((u) => u.id === a.id)),
  );
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">
          <Sparkles size={15} /> SMALL WINS WORTH CELEBRATING
        </div>
        <h1>Look what your mind can do.</h1>
        <p>Keep showing up. Collect little reminders of how far you’ve come.</p>
      </div>
      <div className="achievement-summary">
        <div className="summary-medal">
          <Trophy size={37} />
        </div>
        <div>
          <h2>
            {achievements.length} <span>of {definitions.length} achievements</span>
          </h2>
          <p>
            {achievements.length
              ? 'Every badge has a story. Keep writing yours.'
              : 'Your collection starts with one little puzzle.'}
          </p>
          <div className="xp-track">
            <span style={{ width: `${(achievements.length / definitions.length) * 100}%` }} />
          </div>
        </div>
        <button className="button primary" onClick={() => navigate('play')}>
          Make your next move <ArrowUpRight size={17} />
        </button>
      </div>
      <div className="segmented-control achievement-filters">
        {['all', 'unlocked', 'locked'].map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All achievements' : f === 'unlocked' ? 'Unlocked' : 'To discover'}
          </button>
        ))}
      </div>
      <div className="achievement-grid">
        {list.map((a, i) => {
          const unlock = achievements.find((u) => u.id === a.id),
            progress = Math.min(a.goal, achievementProgress(a.metric || a.id, history, xp));
          return (
            <article className={`achievement-card ${unlock ? 'unlocked' : ''}`} key={a.id}>
              <span className={`achievement-emblem emblem-${i % 4}`}>
                <BadgeIcon name={a.icon} size={34} />
              </span>
              <span className="achievement-state">
                {unlock ? <Check size={15} /> : <LockKeyhole size={14} />}
              </span>
              <h3>{a.name}</h3>
              <p>{a.description}</p>
              {unlock ? (
                <span className="unlock-date">
                  <Check size={13} />
                  Unlocked {dateLabel(unlock.date)}
                </span>
              ) : (
                <>
                  <div className="xp-track">
                    <span style={{ width: `${(progress / a.goal) * 100}%` }} />
                  </div>
                  <span className="achievement-progress">
                    {progress} / {a.goal}
                  </span>
                </>
              )}
            </article>
          );
        })}
      </div>
      {!list.length && (
        <EmptyState
          icon={<Sparkles size={32} />}
          title="Your first badge is waiting."
          description="Complete a puzzle and turn a small win into your first achievement."
          action="Let’s play"
          onClick={() => navigate('play')}
        />
      )}
    </>
  );
}
export function Leaderboard() {
  const { player, navigate, setAuth } = useApp();
  const [category, setCategory] = useState(() =>
      new URLSearchParams(location.hash.split('?')[1]).get('category') === 'daily'
        ? 'daily'
        : 'score',
    ),
    [leaders, setLeaders] = useState<Leader[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<Leader[]>(`/leaderboard?category=${category}`)
      .then((data) => {
        if (active) setLeaders(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, retry]);
  const categories = [
    ['score', 'Global score'],
    ['daily', 'Daily challenge'],
    ['time', 'Fastest time'],
    ['moves', 'Fewest moves'],
    ['level', 'Highest level'],
  ];
  const value = (p: Leader) =>
    category === 'time'
      ? time(p.fastest)
      : category === 'moves'
        ? `${p.fewest} moves`
        : category === 'level'
          ? `Level ${p.level}`
          : p.score.toLocaleString();
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">
          <Globe2 size={15} /> CURIOUS MINDS. FRIENDLY COMPETITION.
        </div>
        <h1>A little healthy competition.</h1>
        <p>Find your place among the thinkers, tinkerers, and one-more-try-ers.</p>
      </div>
      <section className="leaderboard-hero">
        <span className="leader-hero-trophy">
          <Trophy size={61} />
          <i>✧</i>
          <b>✦</b>
        </span>
        <div>
          <span className="eyebrow">THE PUZZLEMIND HALL OF FAME</span>
          <h2>Great minds make great moves.</h2>
          <p>Every puzzle is another chance to move up.</p>
        </div>
        <button className="button primary" onClick={() => navigate('play')}>
          Play your way up <ArrowUpRight size={17} />
        </button>
      </section>
      <div className="leaderboard-tabs segmented-control">
        {categories.map(([key, label]) => (
          <button
            className={category === key ? 'active' : ''}
            key={key}
            onClick={() => setCategory(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="panel leaderboard-panel">
        <div className="leader-table-heading">
          <h2>{categories.find((c) => c[0] === category)?.[1]}</h2>
          <span>
            <span className="status-dot" />
            {category === 'daily' ? 'Today · resets at 00:00 UTC' : 'All time'}
          </span>
        </div>
        {error ? (
          <EmptyState
            icon={<RefreshCw />}
            title="We couldn’t load the leaderboard."
            description={error}
            action="Try again"
            onClick={() => setRetry((n) => n + 1)}
          />
        ) : loading ? (
          <div className="empty-state">
            <span className="loading-dots">Loading the latest scores…</span>
          </div>
        ) : leaders.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Level</th>
                  <th>
                    {category === 'time'
                      ? 'Best time'
                      : category === 'moves'
                        ? 'Best moves'
                        : category === 'level'
                          ? 'Player level'
                          : 'Score'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((p) => (
                  <tr key={p.id} className={p.id === player?.id ? 'your-row' : ''}>
                    <td>
                      <span className={`rank rank-${p.rank}`}>
                        {p.rank <= 3 ? <Medal size={20} /> : String(p.rank).padStart(2, '0')}
                      </span>
                    </td>
                    <td>
                      <span className="avatar table-avatar">{p.avatar}</span>
                      <strong>{p.username}</strong>
                      {p.id === player?.id && <span className="you-label">YOU</span>}
                    </td>
                    <td>Level {p.level}</td>
                    <td className="score-cell">{value(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Crown size={36} />}
            title="The first spot has your name on it."
            description={
              category === 'daily'
                ? 'Complete today’s daily challenge with an account to set the first score.'
                : 'Complete a puzzle with an account to make your mark on the leaderboard.'
            }
            action={player ? 'Set your first score' : 'Create your player account'}
            onClick={() =>
              player ? navigate(category === 'daily' ? 'daily' : 'play') : setAuth('register')
            }
          />
        )}
      </section>
      <p className="leaderboard-note">
        <Users size={16} />
        Real players. Real puzzles. A new personal best is always a win.
      </p>
    </>
  );
}
