import { Brain, Sparkles, Puzzle, Flower2, Heart, Moon, Star, Diamond } from 'lucide-react';
export function Logo() {
  return (
    <span className="brand-icon">
      <span />
      <span />
      <span />
      <Puzzle size={13} strokeWidth={3} />
    </span>
  );
}
export function PuzzleArt({ small = false }: { small?: boolean }) {
  return (
    <div className={`puzzle-art ${small ? 'small' : ''}`} aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <span className="art-spark spark-one">✦</span>
      <span className="art-spark spark-two">✦</span>
      <span className="art-dot" />
      <div className="floating-chip chip-brain">
        <Brain size={22} />
      </div>
      <div className="floating-chip chip-spark">
        <Sparkles size={21} />
      </div>
      <div className="art-board">
        {[1, 2, 3, 4, 5, 6, 7, 8, 0].map((n) => (
          <span key={n} className={`art-tile tile-${n}`}>
            {n || <Puzzle size={29} />}
          </span>
        ))}
      </div>
      <div className="art-tag">
        <span /> Small moves. Big brain energy.
      </div>
    </div>
  );
}
export function GameArt({ type }: { type: string }) {
  if (type === 'sliding')
    return (
      <div className="game-art sliding-art">
        <div className="mini-board">
          {[1, 2, 3, 4, 5, 6, 7, 8, 0].map((n) => (
            <span key={n}>{n || <Puzzle size={18} />}</span>
          ))}
        </div>
        <span className="game-art-spark">✦</span>
        <span className="art-ring" />
      </div>
    );
  if (type === 'memory')
    return (
      <div className="game-art memory-art">
        <div className="memory-card back">
          <Flower2 />
        </div>
        <div className="memory-card front">
          <Flower2 />
        </div>
        <span className="mini-star">✧</span>
      </div>
    );
  if (type === 'sudoku')
    return (
      <div className="game-art sudoku-art">
        <div className="sudoku-board">
          {['3', '', '7', '', '2', '', '8', '', '5'].map((n, i) => (
            <span key={i}>{n}</span>
          ))}
        </div>
        <span className="mini-star">✦</span>
      </div>
    );
  if (type === 'pattern')
    return (
      <div className="game-art pattern-art">
        <Diamond />
        <Star />
        <Diamond />
        <span>?</span>
      </div>
    );
  if (type === 'word')
    return (
      <div className="game-art word-art">
        {'MIND'.split('').map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    );
  return (
    <div className="game-art picture-art">
      <Moon />
      <div />
      <Heart />
    </div>
  );
}
