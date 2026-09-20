// Independent backtracking solver used to exercise Sudoku through the public API/UI.
export function solveSudoku(input) {
  const board = [...input];
  function solve() {
    let best = -1,
      choices = [];
    for (let i = 0; i < 81; i++) {
      if (board[i]) continue;
      const row = Math.floor(i / 9),
        col = i % 9;
      const options = Array.from({ length: 9 }, (_, n) => n + 1).filter(
        (value) =>
          !board.some(
            (other, j) =>
              other === value &&
              (Math.floor(j / 9) === row ||
                j % 9 === col ||
                (Math.floor(j / 27) === Math.floor(row / 3) &&
                  Math.floor((j % 9) / 3) === Math.floor(col / 3))),
          ),
      );
      if (!options.length) return false;
      if (best === -1 || options.length < choices.length) {
        best = i;
        choices = options;
      }
    }
    if (best === -1) return true;
    for (const value of choices) {
      board[best] = value;
      if (solve()) return true;
    }
    board[best] = 0;
    return false;
  }
  if (!solve()) throw new Error('Sudoku has no solution');
  return board;
}

export function solutionActions(puzzle) {
  if (puzzle.kind === 'memory') {
    return [...new Set(puzzle.cards)].flatMap((symbol) =>
      puzzle.cards.flatMap((value, i) => (value === symbol ? [i] : [])),
    );
  }
  if (puzzle.kind === 'sudoku') {
    return solveSudoku(puzzle.board).flatMap((value, i) =>
      puzzle.board[i] ? [] : [i * 10 + value],
    );
  }
  if (puzzle.kind === 'pattern') return puzzle.rounds.map((round) => round.answer);
  return puzzle.rounds.flatMap((round) => {
    const used = [];
    for (const letter of round.word)
      used.push(round.letters.findIndex((value, i) => value === letter && !used.includes(i)));
    return [...used, -2];
  });
}
