import { DIFFICULTIES, seededRandom } from './game.js';

export const ARCADE_GAMES = ['memory', 'sudoku', 'pattern', 'word'];
export const MEMORY_SYMBOLS = [
  '🌿',
  '🍋',
  '🌸',
  '🍄',
  '🦋',
  '🍒',
  '🌙',
  '🐚',
  '🌻',
  '🍇',
  '🐝',
  '⭐',
];
const difficulties = ['easy', 'medium', 'hard', 'expert'];
function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function sudokuConflicts(board) {
  const conflicts = new Set();
  for (let a = 0; a < 81; a++) {
    if (!board[a]) continue;
    for (let b = a + 1; b < 81; b++) {
      if (board[a] !== board[b]) continue;
      if (
        Math.floor(a / 9) === Math.floor(b / 9) ||
        a % 9 === b % 9 ||
        (Math.floor(a / 27) === Math.floor(b / 27) &&
          Math.floor((a % 9) / 3) === Math.floor((b % 9) / 3))
      ) {
        conflicts.add(a);
        conflicts.add(b);
      }
    }
  }
  return [...conflicts];
}

// Stop at two solutions: clue removal must preserve a unique answer.
export function countSudokuSolutions(input, limit = 2) {
  if (input.length !== 81 || sudokuConflicts(input).length) return 0;
  const board = [...input];
  let count = 0;
  function search() {
    let best = -1,
      options = [];
    for (let i = 0; i < 81; i++) {
      if (board[i]) continue;
      const used = new Set();
      const row = Math.floor(i / 9),
        col = i % 9;
      for (let j = 0; j < 9; j++) {
        used.add(board[row * 9 + j]);
        used.add(board[j * 9 + col]);
        used.add(
          board[
            (Math.floor(row / 3) * 3 + Math.floor(j / 3)) * 9 + Math.floor(col / 3) * 3 + (j % 3)
          ],
        );
      }
      const candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !used.has(n));
      if (!candidates.length) return;
      if (best === -1 || candidates.length < options.length) {
        best = i;
        options = candidates;
      }
      if (options.length === 1) break;
    }
    if (best === -1) {
      count++;
      return;
    }
    for (const value of options) {
      board[best] = value;
      search();
      if (count >= limit) break;
    }
    board[best] = 0;
  }
  search();
  return count;
}

const WORDS = [
  [
    ['LEAF', 'A tree grows these to catch sunlight.'],
    ['MOON', 'Earth’s natural satellite.'],
    ['BIRD', 'A feathered animal with wings.'],
    ['WAVE', 'A moving ridge on the ocean.'],
    ['STAR', 'A bright ball of gas in the night sky.'],
    ['RAIN', 'Water falling from clouds.'],
    ['FROG', 'An amphibian that hops and croaks.'],
    ['MINT', 'A fragrant herb with a cool taste.'],
    ['KITE', 'A toy that flies on a string.'],
    ['PEAR', 'A sweet fruit with a narrow top.'],
  ],
  [
    ['GARDEN', 'A place for growing flowers and vegetables.'],
    ['FOREST', 'A large area covered with trees.'],
    ['BREEZE', 'A gentle wind.'],
    ['PLANET', 'A large world orbiting a star.'],
    ['FLOWER', 'The colorful bloom of a plant.'],
    ['ISLAND', 'Land surrounded by water.'],
    ['RABBIT', 'A small animal with long ears.'],
    ['SUNSET', 'The moment the sun dips below the horizon.'],
    ['MEADOW', 'A field full of grass and wildflowers.'],
    ['PUZZLE', 'A problem or game that tests your thinking.'],
  ],
  [
    ['RAINBOW', 'An arc of colors after rain.'],
    ['CRYSTAL', 'A solid with a repeating, ordered structure.'],
    ['JOURNEY', 'Travel from one place to another.'],
    ['HARMONY', 'Musical notes sounding pleasant together.'],
    ['LANTERN', 'A portable light inside a protective case.'],
    ['FEATHER', 'A lightweight part of a bird’s covering.'],
    ['DOLPHIN', 'An intelligent marine mammal with a curved fin.'],
    ['BLOSSOM', 'A flower on a fruit tree.'],
    ['ORIGAMI', 'The art of folding paper.'],
    ['COMPASS', 'An instrument that points north.'],
  ],
  [
    ['BUTTERFLY', 'An insect with large, colorful wings.'],
    ['ADVENTURE', 'An exciting and unusual experience.'],
    ['SUNFLOWER', 'A tall plant with a large yellow flower head.'],
    ['WATERFALL', 'A stream plunging over a cliff.'],
    ['TELESCOPE', 'An instrument for viewing distant stars.'],
    ['CHAMELEON', 'A lizard known for changing color.'],
    ['LIGHTHOUSE', 'A coastal tower that guides ships with a beam.'],
    ['KALEIDOSCOPE', 'An optical toy making changing, mirrored patterns.'],
    ['CONSTELLATION', 'A named pattern of stars.'],
    ['OBSERVATORY', 'A building equipped for watching the sky.'],
  ],
];

export function generateArcade(game, difficulty, seed) {
  const level = difficulties.indexOf(difficulty);
  if (!ARCADE_GAMES.includes(game) || level < 0) throw new Error('Unknown game or difficulty.');
  const random = seededRandom(seed);
  if (game === 'memory') {
    const symbols = shuffle(
      MEMORY_SYMBOLS.map((_, i) => i),
      random,
    ).slice(0, [6, 8, 10, 12][level]);
    return { kind: game, cards: shuffle([...symbols, ...symbols], random) };
  }
  if (game === 'sudoku') {
    const groups = () =>
      shuffle([0, 1, 2], random).flatMap((g) => shuffle([0, 1, 2], random).map((n) => g * 3 + n));
    const rows = groups(),
      cols = groups(),
      digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
    const solution = rows.flatMap((r) =>
      cols.map((c) => digits[(r * 3 + Math.floor(r / 3) + c) % 9]),
    );
    const board = [...solution];
    let removed = 0;
    for (const i of shuffle(
      Array.from({ length: 81 }, (_, i) => i),
      random,
    )) {
      const value = board[i];
      board[i] = 0;
      if (countSudokuSolutions(board) !== 1) board[i] = value;
      else removed++;
      if (removed === [32, 42, 49, 54][level]) break;
    }
    return { kind: game, board };
  }
  if (game === 'pattern') {
    const rounds = Array.from({ length: [5, 7, 9, 12][level] }, () => {
      const start = 1 + Math.floor(random() * 9),
        step = 2 + Math.floor(random() * 6);
      const type = Math.floor(random() * (level + 1));
      let values, rule;
      if (type === 0) {
        values = Array.from({ length: 6 }, (_, i) => start + i * step);
        rule = `Add ${step} each time.`;
      } else if (type === 1) {
        const second = step + 2;
        values = [start];
        for (let i = 0; i < 5; i++) values.push(values.at(-1) + (i % 2 ? second : step));
        rule = `Alternate adding ${step} and ${second}.`;
      } else if (type === 2) {
        values = Array.from({ length: 6 }, (_, i) => (start + i) ** 2);
        rule = 'Square consecutive whole numbers.';
      } else {
        values = Array.from({ length: 6 }, (_, i) => start * 2 ** i);
        rule = 'Double the previous number.';
      }
      const answer = values.pop();
      const options = shuffle([answer, answer + step, answer - 1, answer + step + 3], random);
      return { sequence: values, options, answer: options.indexOf(answer), rule };
    });
    return { kind: game, rounds };
  }
  const rounds = shuffle(WORDS[level], random)
    .slice(0, [3, 4, 5, 6][level])
    .map(([word, clue]) => {
      let letters = shuffle([...word], random);
      if (letters.join('') === word) letters = [...letters.slice(1), letters[0]];
      return { word, clue, letters };
    });
  return { kind: game, rounds };
}

export function initialArcadeState(puzzle) {
  return {
    board: puzzle.kind === 'sudoku' ? [...puzzle.board] : [],
    selected: [],
    matched: [],
    round: 0,
    moves: 0,
    mistakes: 0,
    feedback: '',
    complete: false,
  };
}

// Every action is replayed on the server before a result earns points or XP.
// Memory: card index, -1 hides a mismatch. Sudoku: cell * 10 + digit (0 erases).
// Pattern: option index. Word: letter index, -1 undoes, -2 submits, -3 clears.
export function arcadeAction(puzzle, state, action) {
  if (!Number.isInteger(action) || state.complete) return null;
  const next = { ...state, feedback: '' };
  if (puzzle.kind === 'memory') {
    if (action === -1 && state.selected.length === 2) return { ...next, selected: [] };
    if (
      action < 0 ||
      action >= puzzle.cards.length ||
      state.selected.length === 2 ||
      state.selected.includes(action) ||
      state.matched.includes(action)
    )
      return null;
    next.selected = [...state.selected, action];
    if (next.selected.length === 2) {
      next.moves++;
      if (puzzle.cards[next.selected[0]] === puzzle.cards[action]) {
        next.matched = [...state.matched, ...next.selected];
        next.selected = [];
        next.feedback = 'A perfect pair!';
        next.complete = next.matched.length === puzzle.cards.length;
      } else {
        next.mistakes++;
        next.feedback = 'Take a look, then try another pair.';
      }
    }
  } else if (puzzle.kind === 'sudoku') {
    const cell = Math.floor(action / 10),
      digit = action % 10;
    if (cell < 0 || cell >= 81 || puzzle.board[cell] || state.board[cell] === digit) return null;
    next.board = [...state.board];
    next.board[cell] = digit;
    next.moves++;
    const conflicts = sudokuConflicts(next.board);
    if (digit && conflicts.includes(cell)) next.mistakes++;
    next.feedback = conflicts.length ? 'Highlighted numbers repeat in a row, column, or box.' : '';
    next.complete = next.board.every(Boolean) && conflicts.length === 0;
  } else if (puzzle.kind === 'pattern') {
    const round = puzzle.rounds[state.round];
    if (action < 0 || action >= round.options.length) return null;
    next.moves++;
    if (action === round.answer) {
      next.round++;
      next.feedback = `Correct! ${round.rule}`;
      next.complete = next.round === puzzle.rounds.length;
    } else {
      next.mistakes++;
      next.feedback = 'Not quite. Look at how each number changes and try again.';
    }
  } else if (puzzle.kind === 'word') {
    const round = puzzle.rounds[state.round];
    if (action === -1 && state.selected.length) next.selected = state.selected.slice(0, -1);
    else if (action === -3 && state.selected.length) next.selected = [];
    else if (action === -2 && state.selected.length === round.letters.length) {
      next.moves++;
      if (state.selected.map((i) => round.letters[i]).join('') === round.word) {
        next.round++;
        next.selected = [];
        next.feedback = `You found ${round.word}!`;
        next.complete = next.round === puzzle.rounds.length;
      } else {
        next.mistakes++;
        next.feedback = 'Not that word yet. Use the clue and rearrange your letters.';
      }
    } else if (action >= 0 && action < round.letters.length && !state.selected.includes(action))
      next.selected = [...state.selected, action];
    else return null;
  } else return null;
  return next;
}

export function replayArcade(puzzle, actions) {
  let state = initialArcadeState(puzzle);
  for (const action of actions) {
    state = arcadeAction(puzzle, state, action);
    if (!state) return null;
  }
  return state;
}

export function arcadeScore(difficulty, seconds, mistakes) {
  return Math.max(0, DIFFICULTIES[difficulty].base - Math.floor(seconds / 3) - mistakes * 35);
}
