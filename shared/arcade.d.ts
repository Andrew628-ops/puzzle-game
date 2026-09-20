export type ArcadeGame = 'memory' | 'sudoku' | 'pattern' | 'word';
export type ArcadePuzzle =
  | { kind: 'memory'; cards: number[] }
  | { kind: 'sudoku'; board: number[] }
  | {
      kind: 'pattern';
      rounds: { sequence: number[]; options: number[]; answer: number; rule: string }[];
    }
  | { kind: 'word'; rounds: { word: string; clue: string; letters: string[] }[] };
export interface ArcadeState {
  board: number[];
  selected: number[];
  matched: number[];
  round: number;
  moves: number;
  mistakes: number;
  feedback: string;
  complete: boolean;
}
export const ARCADE_GAMES: ArcadeGame[];
export const MEMORY_SYMBOLS: string[];
export function generateArcade(game: ArcadeGame, difficulty: string, seed: string): ArcadePuzzle;
export function initialArcadeState(puzzle: ArcadePuzzle): ArcadeState;
export function arcadeAction(
  puzzle: ArcadePuzzle,
  state: ArcadeState,
  action: number,
): ArcadeState | null;
export function replayArcade(puzzle: ArcadePuzzle, actions: number[]): ArcadeState | null;
export function sudokuConflicts(board: number[]): number[];
export function countSudokuSolutions(board: number[], limit?: number): number;
export function arcadeScore(difficulty: string, seconds: number, mistakes: number): number;
