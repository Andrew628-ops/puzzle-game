import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Clock3,
  HelpCircle,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  Target,
  Trophy,
  Undo2,
  Zap,
} from 'lucide-react';
import { useApp } from '../context';
import { Modal } from '../components/UI';
import { api, time, tone } from '../lib';
import { DIFFICULTIES } from '../../shared/game';
import {
  arcadeAction,
  arcadeScore,
  initialArcadeState,
  MEMORY_SYMBOLS,
  sudokuConflicts,
} from '../../shared/arcade';
import type { ArcadeGame, ArcadePuzzle, ArcadeState } from '../../shared/arcade';
import type { Difficulty, GameResult, Player } from '../types';
import '../arcade.css';

const GUIDES: Record<
  ArcadeGame,
  { intro: string; steps: string[]; labels: string[]; metric: string }
> = {
  memory: {
    intro: 'A little attention. A perfect pair.',
    steps: [
      'Turn over two cards and remember their symbols.',
      'Matching cards stay face up. Other cards turn back over.',
      'Find every pair to finish the game.',
    ],
    labels: ['6 pairs', '8 pairs', '10 pairs', '12 pairs'],
    metric: 'TURNS',
  },
  sudoku: {
    intro: 'Make room for a little number magic.',
    steps: [
      'Fill every empty cell with a number from 1 to 9.',
      'Each row, column, and 3 × 3 box must contain each number once.',
      'Select a cell, then use the number pad or your keyboard. Repeated numbers are highlighted.',
    ],
    labels: ['More clues', 'Balanced', 'Fewer clues', 'Fewest clues'],
    metric: 'ENTRIES',
  },
  pattern: {
    intro: 'Find the rhythm behind the numbers.',
    steps: [
      'Look at the sequence and work out its rule.',
      'Choose the number that comes next. A wrong answer lets you try again.',
      'Complete every round. Higher difficulties introduce more kinds of sequences.',
    ],
    labels: ['5 rounds', '7 rounds', '9 rounds', '12 rounds'],
    metric: 'ANSWERS',
  },
  word: {
    intro: 'A handful of letters. A fresh perspective.',
    steps: [
      'Read the clue, then tap the scrambled letters in order.',
      'Use Undo or Clear to rearrange your answer. You can also type letters and use Backspace.',
      'Check your word to move on. Solve every word to finish.',
    ],
    labels: ['3 short words', '4 words', '5 words', '6 long words'],
    metric: 'GUESSES',
  },
};
interface Session {
  id: string;
  difficulty: Difficulty;
  puzzle: ArcadePuzzle;
}

export function ArcadePage({ game }: { game: ArcadeGame }) {
  const { preferences, catalog, history, record, navigate, player, loaded } = useApp();
  const definition = catalog.find((item) => item.id === game);
  const guide = GUIDES[game];
  const [difficulty, setDifficulty] = useState<Difficulty>(preferences.difficulty);
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<ArcadeState | null>(null);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const [paused, setPaused] = useState(false),
    [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(''),
    [result, setResult] = useState<GameResult | null>(null);
  const [showWin, setShowWin] = useState(false),
    [help, setHelp] = useState(false);
  const [selectedCell, setSelectedCell] = useState(0);
  const actions = useRef<number[]>([]),
    currentState = useRef<ArcadeState | null>(null);
  const request = useRef(0),
    elapsed = useRef(0),
    started = useRef<number | null>(null);
  const busy = useRef(false);
  const currentSeconds = () =>
    Math.floor(
      (elapsed.current + (started.current === null ? 0 : performance.now() - started.current)) /
        1000,
    );

  async function newGame(next = difficulty) {
    const requestId = ++request.current;
    busy.current = true;
    setLoading(true);
    setSaving(false);
    setError('');
    setResult(null);
    setShowWin(false);
    setPaused(false);
    setSession(null);
    setState(null);
    currentState.current = null;
    actions.current = [];
    elapsed.current = 0;
    started.current = null;
    setSeconds(0);
    try {
      const data = await api<Session>('/games/session', {
        method: 'POST',
        body: JSON.stringify({ game, difficulty: next }),
      });
      if (requestId !== request.current) return;
      const initial = initialArcadeState(data.puzzle);
      setSession(data);
      setState(initial);
      currentState.current = initial;
      setDifficulty(data.difficulty);
      setSelectedCell(data.puzzle.kind === 'sudoku' ? data.puzzle.board.indexOf(0) : 0);
    } catch (e) {
      if (requestId === request.current) setError((e as Error).message);
    } finally {
      if (requestId === request.current) {
        setLoading(false);
        busy.current = false;
      }
    }
  }
  useEffect(() => {
    if (loaded) void newGame();
    return () => {
      request.current++;
    };
  }, [game, loaded, player?.id]);

  const running = !!actions.current.length && !paused && !state?.complete && !loading && !saving;
  useEffect(() => {
    if (!running) return;
    started.current = performance.now();
    const timer = setInterval(() => setSeconds(currentSeconds()), 200);
    return () => {
      if (started.current !== null) elapsed.current += performance.now() - started.current;
      started.current = null;
      clearInterval(timer);
    };
  }, [running]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden && running) setPaused(true);
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [running]);

  async function saveResult(finalSeconds: number) {
    if (!session || busy.current) return;
    const requestId = request.current;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      const data = await api<{ result: GameResult; player: Player | null }>(
        '/games/session/complete',
        {
          method: 'POST',
          body: JSON.stringify({
            id: session.id,
            moves: actions.current,
            seconds: finalSeconds,
            hints: 0,
          }),
        },
      );
      if (requestId !== request.current) return;
      setResult(data.result);
      setShowWin(true);
      record(data.result, data.player);
      if (preferences.sound) tone('win');
    } catch (e) {
      if (requestId === request.current) setError((e as Error).message);
    } finally {
      if (requestId === request.current) {
        busy.current = false;
        setSaving(false);
      }
    }
  }
  function act(action: number) {
    if (!session || !currentState.current || paused || help || busy.current) return;
    const next = arcadeAction(session.puzzle, currentState.current, action);
    if (!next) return;
    actions.current = [...actions.current, action];
    currentState.current = next;
    setState(next);
    if (preferences.sound && action >= 0) tone('move');
    if (next.complete) {
      const finalSeconds = currentSeconds();
      setSeconds(finalSeconds);
      void saveResult(finalSeconds);
    }
  }
  useEffect(() => {
    if (game !== 'memory' || state?.selected.length !== 2 || paused || help) return;
    const timer = setTimeout(() => act(-1), 900);
    return () => clearTimeout(timer);
  }, [state, paused, help]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !session ||
        !state ||
        paused ||
        help ||
        loading ||
        saving ||
        state.complete ||
        (event.target as HTMLElement).closest('input,textarea,select,[role="dialog"]')
      )
        return;
      if (session.puzzle.kind === 'sudoku') {
        if (/^[1-9]$/.test(event.key)) {
          event.preventDefault();
          act(selectedCell * 10 + Number(event.key));
        }
        if (['Backspace', 'Delete', '0'].includes(event.key)) {
          event.preventDefault();
          act(selectedCell * 10);
        }
        const offsets: Record<string, number> = {
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: -9,
          ArrowDown: 9,
        };
        if (event.key in offsets) {
          event.preventDefault();
          const next = Math.max(0, Math.min(80, selectedCell + offsets[event.key]));
          setSelectedCell(next);
          document.getElementById(`sudoku-cell-${next}`)?.focus();
        }
      } else if (session.puzzle.kind === 'word') {
        const round = session.puzzle.rounds[state.round];
        if (/^[a-z]$/i.test(event.key)) {
          const index = round.letters.findIndex(
            (letter, i) => letter === event.key.toUpperCase() && !state.selected.includes(i),
          );
          if (index >= 0) {
            event.preventDefault();
            act(index);
          }
        }
        if (event.key === 'Backspace') {
          event.preventDefault();
          act(-1);
        }
        if (event.key === 'Enter' && !(event.target as HTMLElement).closest('button')) {
          event.preventDefault();
          act(-2);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function restart() {
    if (!session || busy.current || result) return;
    const initial = initialArcadeState(session.puzzle);
    actions.current = [];
    currentState.current = initial;
    setState(initial);
    elapsed.current = 0;
    started.current = null;
    setSeconds(0);
    setPaused(false);
    setError('');
  }
  const best = history.filter((item) => item.game === game && item.difficulty === difficulty);
  const config = DIFFICULTIES[difficulty];
  const puzzle = session?.puzzle;
  const conflicts = new Set(puzzle?.kind === 'sudoku' && state ? sudokuConflicts(state.board) : []);
  const progress =
    !puzzle || !state
      ? ''
      : puzzle.kind === 'memory'
        ? `${state.matched.length / 2} / ${puzzle.cards.length / 2} pairs found`
        : puzzle.kind === 'sudoku'
          ? `${state.board.filter(Boolean).length} / 81 cells filled`
          : `${state.round} / ${puzzle.rounds.length} rounds complete`;
  return (
    <>
      <div className="game-breadcrumb">
        <button onClick={() => navigate('games')}>All games</button>
        <ChevronRight size={14} />
        <span>{definition?.name}</span>
      </div>
      <div className="page-intro play-intro">
        <div>
          <div className="eyebrow">
            <span className="status-dot" /> A FRESH WAY TO FIND YOUR FLOW
          </div>
          <h1>{definition?.name}</h1>
          <p>{guide.intro}</p>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            setHelp(true);
            setPaused(true);
          }}
        >
          <HelpCircle size={17} />
          How to play
        </button>
      </div>
      <div className="play-layout">
        <section className={`puzzle-panel panel arcade-panel arcade-${game}`}>
          <div className="puzzle-heading">
            <span className="puzzle-heading-icon">
              <Target size={21} />
            </span>
            <div>
              <h2>{definition?.name}</h2>
              <span>{progress || 'Your next little challenge'}</span>
            </div>
            <span className="xp-reward">
              <Zap size={13} />+{config.xp} XP
            </span>
          </div>
          <div className="difficulty-tabs" aria-label="Choose difficulty">
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((value, i) => (
              <button
                key={value}
                className={difficulty === value ? 'active' : ''}
                aria-pressed={difficulty === value}
                disabled={loading || saving}
                onClick={() => {
                  if (difficulty !== value) void newGame(value);
                }}
              >
                {DIFFICULTIES[value].label}
                <span>{guide.labels[i]}</span>
              </button>
            ))}
          </div>
          <div className="game-metrics">
            <div>
              <span>
                <Target size={13} />
                {guide.metric}
              </span>
              <strong>{String(state?.moves || 0).padStart(2, '0')}</strong>
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
                {(
                  result?.score ?? arcadeScore(difficulty, seconds, state?.mistakes || 0)
                ).toLocaleString()}
              </strong>
            </div>
          </div>
          <div className="arcade-board-wrap">
            {puzzle && state && (
              <fieldset
                className={`arcade-board ${paused ? 'is-paused' : ''}`}
                disabled={paused || loading || saving || state.complete}
                aria-label={`${definition?.name} board`}
              >
                {puzzle.kind === 'memory' && (
                  <div className="memory-board">
                    {puzzle.cards.map((symbol, index) => {
                      const matched = state.matched.includes(index),
                        open = matched || state.selected.includes(index);
                      return (
                        <button
                          key={index}
                          className={`match-card ${open ? 'flipped' : ''} ${matched ? 'matched' : ''}`}
                          disabled={open || state.selected.length === 2}
                          aria-label={
                            open
                              ? `${matched ? 'Matched card' : 'Card'} ${index + 1}: ${MEMORY_SYMBOLS[symbol]}`
                              : `Flip card ${index + 1}`
                          }
                          onClick={() => act(index)}
                        >
                          <span>{open ? MEMORY_SYMBOLS[symbol] : '✧'}</span>
                          {matched && <small>✓</small>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {puzzle.kind === 'sudoku' && (
                  <>
                    <div className="sudoku-grid" role="group" aria-label="Sudoku grid">
                      {state.board.map((value, index) => {
                        const row = Math.floor(index / 9),
                          col = index % 9;
                        const related =
                          row === Math.floor(selectedCell / 9) || col === selectedCell % 9;
                        return (
                          <button
                            id={`sudoku-cell-${index}`}
                            key={index}
                            className={`sudoku-cell ${puzzle.board[index] ? 'given' : ''} ${index === selectedCell ? 'selected' : related ? 'related' : ''} ${conflicts.has(index) ? 'conflict' : ''}`}
                            style={{
                              borderRightWidth: col === 2 || col === 5 ? 2 : 1,
                              borderBottomWidth: row === 2 || row === 5 ? 2 : 1,
                            }}
                            aria-label={`Row ${row + 1}, column ${col + 1}, ${value || 'empty'}${puzzle.board[index] ? ', given' : ''}`}
                            aria-pressed={index === selectedCell}
                            aria-invalid={conflicts.has(index)}
                            onClick={() => setSelectedCell(index)}
                          >
                            {value || ''}
                          </button>
                        );
                      })}
                    </div>
                    <div className="sudoku-keypad">
                      {Array.from({ length: 9 }, (_, i) => (
                        <button
                          key={i}
                          aria-label={`Enter ${i + 1}`}
                          disabled={!!puzzle.board[selectedCell]}
                          onClick={() => act(selectedCell * 10 + i + 1)}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <button
                      className="text-button arcade-erase"
                      disabled={!!puzzle.board[selectedCell] || !state.board[selectedCell]}
                      onClick={() => act(selectedCell * 10)}
                    >
                      <Undo2 size={15} />
                      Erase cell
                    </button>
                  </>
                )}
                {puzzle.kind === 'pattern' &&
                  (() => {
                    const round = puzzle.rounds[Math.min(state.round, puzzle.rounds.length - 1)];
                    return (
                      <div className="pattern-board">
                        <span className="eyebrow">
                          ROUND {Math.min(state.round + 1, puzzle.rounds.length)} OF{' '}
                          {puzzle.rounds.length}
                        </span>
                        <h3>What comes next?</h3>
                        <div className="pattern-sequence">
                          {round.sequence.map((value, i) => (
                            <span key={i}>{value}</span>
                          ))}
                          <span className="pattern-missing">?</span>
                        </div>
                        <p>Choose the number that continues the pattern.</p>
                        <div className="pattern-options">
                          {round.options.map((value, i) => (
                            <button key={`${state.round}-${i}`} onClick={() => act(i)}>
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                {puzzle.kind === 'word' &&
                  (() => {
                    const round = puzzle.rounds[Math.min(state.round, puzzle.rounds.length - 1)];
                    return (
                      <div className="word-board">
                        <span className="eyebrow">
                          WORD {Math.min(state.round + 1, puzzle.rounds.length)} OF{' '}
                          {puzzle.rounds.length}
                        </span>
                        <h3>{round.clue}</h3>
                        <div className="word-answer" aria-label="Your answer" aria-live="polite">
                          {round.letters.map((_, i) => (
                            <span key={i}>
                              {state.selected[i] === undefined
                                ? ''
                                : round.letters[state.selected[i]]}
                            </span>
                          ))}
                        </div>
                        <div className="letter-rack">
                          {round.letters.map((letter, i) => (
                            <button
                              key={`${state.round}-${i}`}
                              disabled={state.selected.includes(i)}
                              aria-label={`Letter ${letter}, tile ${i + 1}`}
                              onClick={() => act(i)}
                            >
                              {letter}
                            </button>
                          ))}
                        </div>
                        <div className="word-actions">
                          <button
                            className="button control-button"
                            disabled={!state.selected.length}
                            onClick={() => act(-1)}
                          >
                            <Undo2 size={15} />
                            Undo
                          </button>
                          <button
                            className="button control-button"
                            disabled={!state.selected.length}
                            onClick={() => act(-3)}
                          >
                            Clear
                          </button>
                          <button
                            className="button primary"
                            disabled={state.selected.length !== round.letters.length}
                            onClick={() => act(-2)}
                          >
                            Check word
                            <ArrowRight size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })()}
              </fieldset>
            )}
            {paused && !loading && (
              <div className="board-overlay">
                <span className="pause-symbol">
                  <Pause size={30} />
                </span>
                <h3>Take a little breather.</h3>
                <p>Your game is right here.</p>
                <button className="button primary" onClick={() => setPaused(false)}>
                  <Play size={16} />
                  Let’s keep going
                </button>
              </div>
            )}
            {(loading || saving) && (
              <div className="board-overlay loading-overlay">
                <LoaderCircle className="spinner" size={32} />
                <p>{saving ? 'Saving your little victory…' : 'Finding your next challenge…'}</p>
              </div>
            )}
          </div>
          <p className="arcade-feedback" role="status">
            {paused
              ? 'The clock is paused.'
              : state?.complete
                ? 'Nicely done. Your puzzle is complete!'
                : state?.feedback ||
                  (game === 'sudoku'
                    ? 'Select an empty cell to begin.'
                    : 'Take your time. You’ve got this.')}
          </p>
          {error && (
            <div className="error-message" role="alert">
              {error}
              <button onClick={() => (state?.complete ? void saveResult(seconds) : void newGame())}>
                Try again
              </button>
            </div>
          )}
          <div className="game-controls">
            <button
              className="button primary"
              disabled={loading || saving}
              onClick={() => void newGame()}
            >
              <Shuffle size={16} />
              New game
            </button>
            <button
              className="button control-button"
              disabled={loading || saving || !!result || !session || !!state?.complete}
              onClick={restart}
            >
              <RotateCcw size={16} />
              Restart
            </button>
            <button
              className="button control-button"
              disabled={loading || saving || !session || !!state?.complete}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
              {paused ? 'Resume' : 'Pause'}
            </button>
          </div>
          {result && (
            <button className="text-button view-result" onClick={() => setShowWin(true)}>
              See your result
              <Trophy size={16} />
            </button>
          )}
        </section>
        <aside className="play-sidebar">
          <div className="panel session-card">
            <span className="eyebrow">
              <Trophy size={15} />
              YOUR PERSONAL BEST
            </span>
            <strong>
              {best.length ? Math.max(...best.map((item) => item.score)).toLocaleString() : '—'}
              <span>points</span>
            </strong>
            <div>
              <Clock3 size={15} />
              <span>Fastest solve</span>
              <b>
                {best.length
                  ? time(Math.min(...best.map((item) => item.seconds)))
                  : 'Set your first'}
              </b>
            </div>
            <div>
              <Target size={15} />
              <span>Games completed</span>
              <b>{best.length}</b>
            </div>
            <p>
              {config.label} · {definition?.name}
            </p>
          </div>
          <div className="howto-card">
            <span className="howto-icon">
              <HelpCircle size={24} />
            </span>
            <h3>How to play</h3>
            <ol>
              {guide.steps.map((step, i) => (
                <li key={step}>
                  <span>0{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="score-note">
            <Sparkles size={19} />
            <p>
              The timer starts with your first move.
              <br />
              Each mistake uses 35 points. Every completed game earns XP.
            </p>
          </div>
        </aside>
      </div>
      {help && (
        <Modal label="How to play" onClose={() => setHelp(false)}>
          <span className="modal-feature-icon">
            <HelpCircle size={30} />
          </span>
          <h2>{definition?.name}</h2>
          <div className="help-details">
            {guide.steps.map((step) => (
              <p key={step}>{step}</p>
            ))}
            <p>
              Pause hides the board and stops the clock. Restart restores the original puzzle; New
              game creates a fresh one.
            </p>
          </div>
          <button
            className="button primary full-width"
            onClick={() => {
              setHelp(false);
              setPaused(false);
            }}
          >
            Got it. Let’s play
            <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {showWin && result && (
        <Modal label="Puzzle complete" onClose={() => setShowWin(false)}>
          <div className="win-medal">
            <Trophy size={40} />
          </div>
          <div className="win-heading">
            <span className="eyebrow">THAT’S YOUR AHA MOMENT.</span>
            <h2>Puzzle complete!</h2>
            <p>
              {definition?.name} · {config.label}
            </p>
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
              <span>{guide.metric.toLowerCase()}</span>
            </div>
            <div>
              <Zap size={18} />
              <strong>+{result.xp}</strong>
              <span>XP earned</span>
            </div>
          </div>
          <p className="win-best">
            Your result has been saved{player ? ' to your account' : ' on this browser'}.
          </p>
          <button className="button primary full-width" onClick={() => void newGame()}>
            Play again
            <ArrowRight size={17} />
          </button>
          <button className="button secondary full-width" onClick={() => navigate('games')}>
            Explore all games
          </button>
          <button className="text-button view-result" onClick={() => navigate('dashboard')}>
            My dashboard
            <ArrowRight size={16} />
          </button>
        </Modal>
      )}
    </>
  );
}
