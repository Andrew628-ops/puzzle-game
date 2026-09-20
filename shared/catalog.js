// A catalog entry becomes playable only after an engine is registered here.
export const GAME_ENGINES = ['sliding'];
export const GAME_CATALOG = [
  {
    id: 'sliding',
    name: 'Sliding Puzzle',
    description: 'Small moves. A satisfying solution.',
    tag: 'LOGIC',
    color: 'green',
    available: true,
  },
  {
    id: 'memory',
    name: 'Memory Match',
    description: 'Stay sharp. Find your perfect match.',
    tag: 'MEMORY',
    color: 'purple',
    available: false,
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    description: 'Find your flow, one number at a time.',
    tag: 'NUMBERS',
    color: 'orange',
    available: false,
  },
  {
    id: 'pattern',
    name: 'Pattern Puzzle',
    description: 'Spot the rhythm. Crack the pattern.',
    tag: 'PATTERNS',
    color: 'blue',
    available: false,
  },
  {
    id: 'word',
    name: 'Word Puzzle',
    description: 'Give your vocabulary a little workout.',
    tag: 'WORDS',
    color: 'pink',
    available: false,
  },
  {
    id: 'picture',
    name: 'Picture Puzzle',
    description: 'Put a whole new perspective together.',
    tag: 'VISUAL',
    color: 'teal',
    available: false,
  },
];
export const ACHIEVEMENT_METRICS = [
  { id: 'first', label: 'Puzzles completed' },
  { id: 'speed', label: 'Solves under 60 seconds' },
  { id: 'perfect', label: 'Solves without hints' },
  { id: 'hard', label: 'Hard puzzles completed' },
  { id: 'expert', label: 'Expert puzzles completed' },
  { id: 'daily', label: 'Distinct daily challenges' },
  { id: 'legend', label: 'Player level' },
];
