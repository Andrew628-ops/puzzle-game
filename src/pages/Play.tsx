import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  HelpCircle,
  Lightbulb,
  LoaderCircle,
  Pause,
  Play as PlayIcon,
  RotateCcw,
  Share2,
  Shuffle,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { useApp } from '../context';
import { Modal } from '../components/UI';
import {
  DIFFICULTIES,
  adjacent,
  calculateScore,
  getStreak,
  isSolved,
  moveTile,
} from '../../shared/game';
import { api, time, today, tone } from '../lib';
import type { Difficulty, GameResult, Leader, Player } from '../types';
interface Session {
  id: string;
  board: number[];
  solution: number[];
  difficulty: Difficulty;
  daily: string | null;
}
function DailyStanding() {
  const { player, history } = useApp();
  const [rank, setRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const result = history.find((game) => game.daily === today());
  useEffect(() => {
    let active = true;
    api<Leader[]>('/leaderboard?category=daily')
      .then((rows) => {
        if (active) setRank(rows.find((row) => row.id === player?.id)?.rank || null);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [player?.id, result?.id]);
  return (
    <div className="panel session-card daily-standing">
      <span className="eyebrow">
        <Zap size={15} />
        TODAY’S LITTLE VICTORY
      </span>
      <strong>
        {loading ? '…' : rank ? `#${rank}` : failed ? '—' : result ? '✓' : '—'}
        <span>
          {rank
            ? 'daily rank'
            : failed
              ? 'Rank unavailable'
              : result
                ? 'challenge complete'
                : 'Your first score awaits'}
        </span>
      </strong>
      <div>
        <Flame size={15} />
        <span>Current streak</span>
        <b>{getStreak(history).current} days</b>
      </div>
      <div>
        <Trophy size={15} />
        <span>Today’s score</span>
        <b>{result ? result.score.toLocaleString() : 'Ready when you are'}</b>
      </div>
      <button
        className="text-button"
        style={{ marginTop: 14 }}
        onClick={() => {
          location.hash = 'leaderboard?category=daily';
        }}
      >
        View leaderboard <ArrowUpRight size={14} />
      </button>
    </div>
  );
}
export function PlayPage({
  daily = false,
  game = 'sliding',
}: {
  daily?: boolean;
  game?: 'sliding' | 'picture';
}) {
  const { preferences, history, navigate, record, setToast, player, setAuth, catalog } = useApp();
  const picture = game === 'picture';
  const gameName = catalog.find((item) => item.id === game)?.name || 'Sliding Puzzle';
  const [difficulty, setDifficulty] = useState<Difficulty>(
      daily ? 'medium' : preferences.difficulty,
    ),
    [session, setSession] = useState<Session | null>(null),
    [board, setBoard] = useState<number[]>([]),
    [moves, setMoves] = useState<number[]>([]),
    [seconds, setSeconds] = useState(0),
    [hints, setHints] = useState(0),
    [highlight, setHighlight] = useState(0),
    [paused, setPaused] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [result, setResult] = useState<GameResult | null>(null),
    [showWin, setShowWin] = useState(false),
    [help, setHelp] = useState(false),
    [saving, setSaving] = useState(false),
    [duplicate, setDuplicate] = useState(false);
  const path = useRef<number[]>([]),
    elapsed = useRef(0),
    request = useRef(0),
    hintTimer = useRef<ReturnType<typeof setTimeout>>();
  const config = DIFFICULTIES[difficulty];
  const newGame = useCallback(
    async (next: Difficulty = difficulty) => {
      const id = ++request.current;
      setLoading(true);
      setError('');
      setResult(null);
      setShowWin(false);
      setPaused(false);
      setMoves([]);
      setSeconds(0);
      setHints(0);
      setHighlight(0);
      elapsed.current = 0;
      try {
        const data = await api<Session>('/games/session', {
          method: 'POST',
          body: JSON.stringify({ difficulty: next, daily, game }),
        });
        if (id !== request.current) return;
        setSession(data);
        setBoard(data.board);
        path.current = [...data.solution];
        setDifficulty(data.difficulty);
      } catch (e) {
        if (id === request.current) setError((e as Error).message);
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [daily, difficulty, game],
  );
  useEffect(() => {
    void newGame();
    return () => {
      request.current++;
      clearTimeout(hintTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!moves.length || paused || result || loading || saving) return;
    let last = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      elapsed.current += now - last;
      last = now;
      setSeconds(Math.floor(elapsed.current / 1000));
    }, 150);
    return () => {
      clearInterval(interval);
      elapsed.current += performance.now() - last;
    };
  }, [!!moves.length, paused, result, loading, saving]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && moves.length && !result) setPaused(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [moves.length, result]);
  async function saveResult(allMoves: number[], finalSeconds: number) {
    if (!session) return;
    setSaving(true);
    try {
      const data = await api<{ result: GameResult; player: Player | null; duplicate: boolean }>(
        '/games/session/complete',
        {
          method: 'POST',
          body: JSON.stringify({ id: session.id, moves: allMoves, seconds: finalSeconds, hints }),
        },
      );
      const alreadyDone =
        data.duplicate || !!(daily && history.some((g) => g.daily === session.daily));
      setDuplicate(alreadyDone);
      setResult(data.result);
      record(data.result, data.player, alreadyDone);
      setShowWin(true);
      if (preferences.sound) tone('win');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function move(tile: number) {
    if (paused || loading || result || saving || isSolved(board) || help) return;
    const next = moveTile(board, tile);
    if (!next) return;
    const allMoves = [...moves, tile];
    setBoard(next);
    setMoves(allMoves);
    setHighlight(0);
    path.current = path.current[0] === tile ? path.current.slice(1) : [tile, ...path.current];
    if (preferences.sound) tone('move');
    if (isSolved(next)) void saveResult(allMoves, seconds);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.matches('input,textarea,select') ||
        (target.closest('button') && !target.closest('.puzzle-tile')) ||
        showWin ||
        help
      )
        return;
      const blank = board.indexOf(0);
      const indexes: Record<string, number> = {
        ArrowUp: blank + config.size,
        ArrowDown: blank - config.size,
        ArrowLeft: blank + 1,
        ArrowRight: blank - 1,
      };
      if (e.key in indexes) {
        e.preventDefault();
        if (adjacent(blank, config.size).includes(indexes[e.key])) move(board[indexes[e.key]]);
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!result && !loading) setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  function restart() {
    if (!session) return;
    setBoard([...session.board]);
    path.current = [...session.solution];
    setMoves([]);
    setSeconds(0);
    elapsed.current = 0;
    setHints(0);
    setHighlight(0);
    setPaused(false);
    setError('');
    setToast('A fresh start, with the same puzzle. You’ve got this.');
  }
  function hint() {
    if (hints >= config.hints || paused || result || loading) return;
    const tile = path.current[0];
    if (tile) {
      setHints((n) => n + 1);
      setHighlight(tile);
      setToast(`Try moving tile ${tile}. A hint uses 50 points.`);
      clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setHighlight(0), 4000);
    }
  }
  const best = history.filter((g) => g.difficulty === difficulty && (g.game || 'sliding') === game),
    bestScore = best.length ? Math.max(...best.map((g) => g.score)) : 0;
  const dailyDone = daily && history.some((g) => g.daily === today());
  return (
    <>
      <div className="game-breadcrumb">
        <button onClick={() => navigate('games')}>All games</button>
        <ChevronRight size={14} />
        <span>{daily ? 'Daily challenge' : gameName}</span>
      </div>
      <div className="page-intro play-intro">
        <div>
          <div className="eyebrow">
            {daily ? (
              <>
                <Zap size={15} /> THE DAILY DROP ·{' '}
                {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
              </>
            ) : (
              <>
                <span className="status-dot" /> LITTLE MOVES. BIG AHA MOMENTS.
              </>
            )}
          </div>
          <h1>
            {daily
              ? 'A fresh challenge awaits.'
              : picture
                ? 'A little piece of the bigger picture.'
                : 'Everything in its right place.'}
          </h1>
          <p>
            {daily
              ? 'One puzzle for everyone. How will you find your way?'
              : picture
                ? 'Rebuild a quiet mountain escape, one tile at a time.'
                : 'Slide, think, and let the pieces fall into place.'}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            setHelp(true);
            if (moves.length) setPaused(true);
          }}
        >
          <HelpCircle size={17} />
          How to play
        </button>
      </div>
      {dailyDone && (
        <div className="info-banner">
          <Check size={18} />
          You’ve completed today’s challenge. You can play again for practice; your first result
          stays on the leaderboard.
        </div>
      )}
      <div className="play-layout">
        <section className="puzzle-panel panel">
          <div className="puzzle-heading">
            <span className="puzzle-heading-icon">
              <Target size={21} />
            </span>
            <div>
              <h2>{daily ? 'Today’s Sliding Puzzle' : gameName}</h2>
              <span>
                {config.size} × {config.size} board · Find your flow
              </span>
            </div>
            <span className="xp-reward">
              <Zap size={13} />+{config.xp} XP
            </span>
          </div>
          {!daily && (
            <div className="difficulty-tabs" aria-label="Choose difficulty">
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  className={difficulty === d ? 'active' : ''}
                  disabled={loading || saving}
                  onClick={() => {
                    if (d !== difficulty) void newGame(d);
                  }}
                >
                  {DIFFICULTIES[d].label}
                  <span>
                    {DIFFICULTIES[d].size} × {DIFFICULTIES[d].size}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="game-metrics">
            <div>
              <span>
                <Target size={13} />
                MOVES
              </span>
              <strong>{String(moves.length).padStart(2, '0')}</strong>
            </div>
            <div>
              <span>
                <Clock3 size={13} />
                TIME
              </span>
              <strong>{time(seconds)}</strong>
            </div>
            <div>
              <span>
                <Sparkles size={13} />
                SCORE
              </span>
              <strong>
                {calculateScore(difficulty, seconds, moves.length, hints).toLocaleString()}
              </strong>
            </div>
          </div>
          <div className="board-wrap">
            <div
              className={`puzzle-board ${picture ? 'picture-board' : ''} ${paused ? 'is-paused' : ''}`}
              style={{
                gridTemplateColumns: `repeat(${config.size},1fr)`,
                gridTemplateRows: `repeat(${config.size},1fr)`,
              }}
              aria-label={`${config.size} by ${config.size} ${picture ? 'picture' : 'sliding'} puzzle`}
              role="group"
            >
              {board.map((tile, index) =>
                tile ? (
                  <button
                    key={tile}
                    onClick={() => move(tile)}
                    disabled={paused || loading || !!result || saving}
                    className={`puzzle-tile ${picture ? 'picture-tile' : ''} ${adjacent(board.indexOf(0), config.size).includes(index) ? 'movable' : ''} ${tile === index + 1 ? 'correct' : ''} ${highlight === tile ? 'hinted' : ''}`}
                    style={
                      picture
                        ? {
                            backgroundSize: `${config.size * 100}% ${config.size * 100}%`,
                            backgroundPosition: `${(((tile - 1) % config.size) * 100) / (config.size - 1)}% ${(Math.floor((tile - 1) / config.size) * 100) / (config.size - 1)}%`,
                          }
                        : undefined
                    }
                    aria-label={`Move tile ${tile}`}
                  >
                    {picture ? <span>{tile}</span> : tile}
                  </button>
                ) : (
                  <div key="blank" className="blank-tile" aria-label="Empty space">
                    <span>✳</span>
                  </div>
                ),
              )}
            </div>
            {paused && (
              <div className="board-overlay">
                <span className="pause-symbol">
                  <Pause size={30} />
                </span>
                <h3>Take a little breather.</h3>
                <p>Your puzzle will be right here.</p>
                <button className="button primary" onClick={() => setPaused(false)}>
                  <PlayIcon size={15} />
                  Let’s keep going
                </button>
              </div>
            )}
            {loading && (
              <div className="board-overlay loading-overlay">
                <LoaderCircle className="spinner" size={32} />
                <p>Finding your next aha…</p>
              </div>
            )}
            {saving && (
              <div className="board-overlay">
                <LoaderCircle className="spinner" />
                <p>Saving your little victory…</p>
              </div>
            )}
          </div>
          {error && (
            <div className="error-message" role="alert">
              {error}
              <button
                onClick={() =>
                  isSolved(board) && moves.length ? void saveResult(moves, seconds) : void newGame()
                }
              >
                Try again
              </button>
            </div>
          )}
          <div className="board-tip">
            <span className="status-dot" />
            {result
              ? 'Nicely done. Every piece found its place.'
              : moves.length
                ? 'One thoughtful move at a time.'
                : 'Tap a tile next to the empty space to start.'}
          </div>
          <div className="game-controls">
            <button
              onClick={() => void newGame()}
              disabled={loading || saving}
              className="button primary"
            >
              <Shuffle size={16} />
              New game
            </button>
            <button
              onClick={restart}
              aria-label="Restart"
              disabled={loading || !!result || saving}
              className="button control-button"
              title="Restore the original board"
            >
              <RotateCcw size={17} />
              <span>Restart</span>
            </button>
            <button
              onClick={hint}
              aria-label={`Hint ${config.hints - hints}`}
              disabled={loading || paused || !!result || saving || hints >= config.hints}
              className="button control-button"
            >
              <Lightbulb size={17} />
              <span>Hint</span>
              <small>{config.hints - hints}</small>
            </button>
            <button
              onClick={() => setPaused(!paused)}
              aria-label={paused ? 'Resume' : 'Pause'}
              disabled={loading || !!result || saving}
              className="button control-button"
            >
              {paused ? <PlayIcon size={17} /> : <Pause size={17} />}
              <span>{paused ? 'Resume' : 'Pause'}</span>
            </button>
          </div>
          <div className="keyboard-tip">
            Make your move with a tap, a click, or your <kbd>←</kbd>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <kbd>→</kbd> keys.
          </div>
          {result && (
            <button className="text-button view-result" onClick={() => setShowWin(true)}>
              See your result <Trophy size={16} />
            </button>
          )}
        </section>
        <aside className="play-sidebar">
          {daily && <DailyStanding />}
          <div className="panel session-card">
            <span className="eyebrow">
              <Trophy size={15} /> YOUR PERSONAL BEST
            </span>
            <strong>
              {bestScore ? bestScore.toLocaleString() : '—'}
              <span>points</span>
            </strong>
            <div>
              <Clock3 size={15} />
              <span>Fastest solve</span>
              <b>
                {best.length ? time(Math.min(...best.map((g) => g.seconds))) : 'Set your first'}
              </b>
            </div>
            <div>
              <Target size={15} />
              <span>Puzzles solved</span>
              <b>{best.length}</b>
            </div>
            <p>A little practice goes a long way.</p>
          </div>
          <div className="howto-card">
            <span className="howto-icon">
              <Lightbulb size={24} />
            </span>
            <h3>Find your flow.</h3>
            <ol>
              <li>
                <span>01</span>Move a tile into the empty space.
              </li>
              <li>
                <span>02</span>
                {picture
                  ? 'Rebuild the landscape using the reference picture.'
                  : 'Arrange the numbers from left to right.'}
              </li>
              <li>
                <span>03</span>Leave the empty space at the bottom right.
              </li>
            </ol>
            {picture ? (
              <img
                className="picture-reference"
                src="/picture-landscape.svg"
                alt="Reference: a mountain lake at sunset with trees and a sailboat"
              />
            ) : (
              <div className="goal-preview">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i}>{i < 8 ? i + 1 : '✳'}</span>
                ))}
              </div>
            )}
            <p>
              Start with a corner. Build a row.
              <br />
              The rest will follow.
            </p>
          </div>
          <div className="score-note">
            <Sparkles size={19} />
            <p>
              Fewer moves. Less time. More points.
              <br />
              Each hint uses 50 points.
            </p>
          </div>
          {!player && (
            <button className="save-progress-card" onClick={() => setAuth('register')}>
              <span>
                <strong>Give your wins a home.</strong>
                <small>Create an account to join the ranks.</small>
              </span>
              <ArrowUpRight size={19} />
            </button>
          )}
        </aside>
      </div>
      {help && (
        <Modal onClose={() => setHelp(false)} label="How to play">
          <span className="modal-feature-icon">
            <Lightbulb size={30} />
          </span>
          <h2>Little moves. Big possibilities.</h2>
          <p>
            {picture
              ? 'Slide a picture tile beside the empty space to move it. Rebuild the landscape shown in the reference picture. Small numbers help you find each tile’s position. Leave the empty space in the bottom-right corner.'
              : 'Click a numbered tile directly beside the empty space to slide it. Arrange all numbers in order, left to right and top to bottom, with the empty space in the bottom-right corner.'}
          </p>
          <div className="help-details">
            <p>
              <strong>Your timer</strong> starts on your first move. Pause hides the puzzle and
              stops the clock.
            </p>
            <p>
              <strong>Hints</strong> highlight a legal move along a path to the solution. Each uses
              50 points.
            </p>
            <p>
              <strong>Restart</strong> restores your original board. New game shuffles a fresh,
              solvable puzzle.
            </p>
            <p>
              <strong>Keyboard:</strong> arrow keys move a tile in that direction. Space pauses or
              resumes.
            </p>
          </div>
          <button
            className="button primary full-width"
            onClick={() => {
              setHelp(false);
              setPaused(false);
            }}
          >
            Got it. Let’s play <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {showWin && result && (
        <Modal onClose={() => setShowWin(false)} label="Puzzle complete">
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <i
                key={i}
                style={{
                  left: `${i * 5.7}%`,
                  animationDelay: `${i * 0.06}s`,
                  background: ['#c3f578', '#ba9ef5', '#efb67b'][i % 3],
                  transform: `rotate(${i * 27}deg)`,
                }}
              />
            ))}
          </div>
          <div className="win-medal">
            <Trophy size={40} />
          </div>
          <div className="win-heading">
            <span className="eyebrow">THAT’S YOUR AHA MOMENT.</span>
            <h2>Puzzle complete!</h2>
            <p>A little focus. A very satisfying finish.</p>
          </div>
          <div className="win-score">
            {result.score.toLocaleString()}
            <span>POINTS</span>
          </div>
          <div className="win-stats">
            <div>
              <Clock3 size={18} />
              <strong>{time(result.seconds)}</strong>
              <span>Time</span>
            </div>
            <div>
              <Target size={18} />
              <strong>{result.moves}</strong>
              <span>Moves</span>
            </div>
            <div>
              <Zap size={18} />
              <strong>+{duplicate ? 0 : result.xp}</strong>
              <span>XP earned</span>
            </div>
          </div>
          <p className="win-best">
            {duplicate
              ? 'Practice complete. Your first daily result is already saved.'
              : `Personal best time: ${time(Math.min(result.seconds, ...best.map((g) => g.seconds)))}`}
          </p>
          <button className="button primary full-width" onClick={() => void newGame()}>
            Play again <ArrowRight size={17} />
          </button>
          {!daily && difficulty !== 'expert' && (
            <button
              className="button secondary full-width"
              onClick={() =>
                void newGame(
                  (Object.keys(DIFFICULTIES) as Difficulty[])[
                    Object.keys(DIFFICULTIES).indexOf(difficulty) + 1
                  ],
                )
              }
            >
              Try the next difficulty <Zap size={16} />
            </button>
          )}
          <div className="win-bottom">
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `I solved PuzzleMind’s ${difficulty} puzzle in ${time(result.seconds)} with ${result.moves} moves and ${result.score} points! ${location.origin}`,
                  );
                  setToast('Score copied. Share your little victory!');
                } catch {
                  setToast(
                    'Clipboard unavailable. Your score: ' +
                      result.score +
                      ' points in ' +
                      time(result.seconds) +
                      '.',
                  );
                }
              }}
            >
              <Share2 size={15} />
              Share score
            </button>
            <button className="text-button" onClick={() => navigate('dashboard')}>
              My dashboard <ArrowUpRight size={15} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
