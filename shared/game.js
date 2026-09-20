export const DIFFICULTIES = {
  easy: { label: 'Easy', size: 3, base: 500, xp: 20, hints: 5, steps: 22 },
  medium: { label: 'Medium', size: 4, base: 1000, xp: 40, hints: 4, steps: 45 },
  hard: { label: 'Hard', size: 5, base: 2000, xp: 80, hints: 3, steps: 80 },
  expert: { label: 'Expert', size: 6, base: 4000, xp: 150, hints: 2, steps: 130 },
};
export function adjacent(index, size) {
  return [
    index - size,
    index + size,
    ...(index % size ? [index - 1] : []),
    ...(index % size < size - 1 ? [index + 1] : []),
  ].filter((i) => i >= 0 && i < size * size);
}
export function isSolved(board) {
  return board.every((n, i) => n === (i + 1) % board.length);
}
export function moveTile(board, tile) {
  const from = board.indexOf(tile),
    blank = board.indexOf(0),
    size = Math.sqrt(board.length);
  if (!tile || !adjacent(blank, size).includes(from)) return null;
  const next = [...board];
  [next[from], next[blank]] = [next[blank], next[from]];
  return next;
}
export function seededRandom(seed) {
  let state = 2166136261;
  for (const c of String(seed)) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function generatePuzzle(difficulty = 'easy', seed = Math.random().toString()) {
  const { size, steps } = DIFFICULTIES[difficulty];
  const random = seededRandom(seed);
  let board = Array.from({ length: size * size }, (_, i) => (i + 1) % (size * size));
  let blank = board.length - 1,
    previous = -1;
  const solution = [];
  for (let i = 0; i < steps || isSolved(board); i++) {
    const options = adjacent(blank, size).filter((n) => n !== previous);
    const next = options[Math.floor(random() * options.length)];
    solution.unshift(board[next]);
    [board[blank], board[next]] = [board[next], board[blank]];
    previous = blank;
    blank = next;
  }
  return { board, solution };
}
export function calculateScore(difficulty, seconds, moves, hints) {
  const d = DIFFICULTIES[difficulty];
  return Math.max(
    0,
    d.base - Math.max(0, moves - d.steps) * 3 - Math.floor(seconds / 3) - hints * 50,
  );
}
export function levelInfo(xp) {
  const thresholds = [0, 100, 250, 500, 900];
  while (thresholds[thresholds.length - 1] <= xp)
    thresholds.push(thresholds[thresholds.length - 1] + (thresholds.length - 2) * 250);
  const index = thresholds.findIndex((n) => n > xp) - 1;
  return {
    level: index + 1,
    start: thresholds[index],
    next: thresholds[index + 1],
    progress: ((xp - thresholds[index]) / (thresholds[index + 1] - thresholds[index])) * 100,
  };
}
export const ACHIEVEMENTS = [
  {
    id: 'first',
    name: 'First Steps',
    description: 'Complete your first puzzle.',
    icon: 'footprints',
    goal: 1,
  },
  {
    id: 'speed',
    name: 'Speed Solver',
    description: 'Solve a puzzle in under 60 seconds.',
    icon: 'zap',
    goal: 1,
  },
  {
    id: 'perfect',
    name: 'Perfect Solver',
    description: 'Solve a puzzle without any hints.',
    icon: 'target',
    goal: 1,
  },
  { id: 'hard', name: 'Hard Mode', description: 'Complete a Hard puzzle.', icon: 'flame', goal: 1 },
  {
    id: 'expert',
    name: 'Expert Mind',
    description: 'Complete an Expert puzzle.',
    icon: 'brain',
    goal: 1,
  },
  {
    id: 'daily',
    name: 'Daily Player',
    description: 'Complete 7 daily challenges.',
    icon: 'calendar',
    goal: 7,
  },
  {
    id: 'master',
    name: 'Puzzle Master',
    description: 'Complete 100 puzzles.',
    icon: 'trophy',
    goal: 100,
  },
  {
    id: 'legend',
    name: 'Puzzle Legend',
    description: 'Reach player level 20.',
    icon: 'crown',
    goal: 20,
  },
];
export function achievementProgress(id, history, xp) {
  return (
    {
      first: history.length,
      speed: history.filter((g) => g.seconds < 60).length,
      perfect: history.filter((g) => !g.hints).length,
      hard: history.filter((g) => g.difficulty === 'hard').length,
      expert: history.filter((g) => g.difficulty === 'expert').length,
      daily: new Set(history.filter((g) => g.daily).map((g) => g.daily)).size,
      master: history.length,
      legend: levelInfo(xp).level,
    }[id] || 0
  );
}
export function getStreak(history) {
  const days = [...new Set(history.map((g) => g.date.slice(0, 10)))].sort().reverse();
  if (!days.length) return { current: 0, longest: 0 };
  const today = new Date().toISOString().slice(0, 10),
    yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let current = 1,
    longest = 1,
    run = 1;
  for (let i = 1; i < days.length; i++) {
    if ((Date.parse(days[i - 1]) - Date.parse(days[i])) / 86400000 === 1) run++;
    else run = 1;
    longest = Math.max(longest, run);
    if (run === i + 1) current = run;
  }
  return { current: [today, yesterday].includes(days[0]) ? current : 0, longest };
}
