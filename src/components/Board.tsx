import { fileOf, rankOf, type Piece, type Position, type Square } from '../engine';

const CELL = 10;
const MARGIN = 6;
const WIDTH = CELL * 8 + MARGIN * 2;
const HEIGHT = CELL * 9 + MARGIN * 2;

const LABELS: Record<Piece['color'], Record<Piece['type'], string>> = {
  red: { general: '帥', advisor: '仕', elephant: '相', horse: '傌', chariot: '俥', cannon: '炮', soldier: '兵' },
  black: { general: '將', advisor: '士', elephant: '象', horse: '馬', chariot: '車', cannon: '砲', soldier: '卒' },
};

const NAMES: Record<Piece['type'], string> = {
  general: 'general',
  advisor: 'advisor',
  elephant: 'elephant',
  horse: 'horse',
  chariot: 'chariot',
  cannon: 'cannon',
  soldier: 'soldier',
};

interface BoardProps {
  position: Position;
  selected: Square | null;
  targets: readonly Square[];
  lastMove?: { from: Square; to: Square } | null;
  checkedGeneral?: Square | null;
  /** When true Black is drawn at the bottom. */
  flipped?: boolean;
  onSquareClick: (sq: Square) => void;
}

export function Board({ position, selected, targets, lastMove, checkedGeneral, flipped = false, onSquareClick }: BoardProps) {
  // Screen coordinates of a board point. Red is at the bottom unless flipped.
  const point = (file: number, rank: number) => ({
    x: MARGIN + (flipped ? 8 - file : file) * CELL,
    y: MARGIN + (flipped ? rank : 9 - rank) * CELL,
  });
  const at = (sq: Square) => point(fileOf(sq), rankOf(sq));
  const line = (f1: number, r1: number, f2: number, r2: number, key: string) => {
    const a = point(f1, r1);
    const b = point(f2, r2);
    return <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  };

  const gridLines = [
    ...Array.from({ length: 10 }, (_, r) => line(0, r, 8, r, `h${r}`)),
    // Outer files run the full length; inner files stop at the river.
    line(0, 0, 0, 9, 'v0'),
    line(8, 0, 8, 9, 'v8'),
    ...Array.from({ length: 7 }, (_, i) => [line(i + 1, 0, i + 1, 4, `vb${i}`), line(i + 1, 5, i + 1, 9, `vt${i}`)]).flat(),
    // Palace diagonals.
    line(3, 0, 5, 2, 'p1'),
    line(5, 0, 3, 2, 'p2'),
    line(3, 7, 5, 9, 'p3'),
    line(5, 7, 3, 9, 'p4'),
  ];

  const targetSet = new Set(targets);
  const riverY = MARGIN + 4.5 * CELL;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="block h-auto w-full select-none touch-manipulation"
      role="grid"
      aria-label="Xiangqi board"
    >
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="2" fill="#e8c38a" />
      <g stroke="#5b3a1a" strokeWidth="0.35" strokeLinecap="square">
        {gridLines}
      </g>
      <g fill="#5b3a1a" fontSize="4.2" fontFamily="'Noto Serif SC', 'Songti SC', serif" dominantBaseline="central" opacity="0.75">
        <text x={MARGIN + 1.5 * CELL} y={riverY} textAnchor="middle">
          楚 河
        </text>
        <text x={MARGIN + 6.5 * CELL} y={riverY} textAnchor="middle">
          漢 界
        </text>
      </g>

      {lastMove &&
        [lastMove.from, lastMove.to].map((sq) => {
          const { x, y } = at(sq);
          return <rect key={`lm${sq}`} x={x - 4.8} y={y - 4.8} width="9.6" height="9.6" rx="1.5" fill="#2563eb" opacity="0.18" />;
        })}

      {Array.from({ length: 90 }, (_, sq) => {
        const p = position.board[sq];
        const { x, y } = at(sq);
        const isTarget = targetSet.has(sq);
        const isSelected = sq === selected;
        const label = p ? `${p.color} ${NAMES[p.type]}` : 'empty point';
        return (
          <g
            key={sq}
            role="gridcell"
            aria-label={`${label}${isTarget ? ', legal move' : ''}`}
            aria-selected={isSelected}
            onClick={() => onSquareClick(sq)}
            className="cursor-pointer"
          >
            {/* Generous invisible hit area so taps work on small phone screens. */}
            <rect x={x - CELL / 2} y={y - CELL / 2} width={CELL} height={CELL} fill="transparent" />
            {p && (
              <>
                {sq === checkedGeneral && <circle cx={x} cy={y} r="5" fill="#dc2626" opacity="0.55" />}
                <circle
                  cx={x}
                  cy={y}
                  r="4.4"
                  fill="#fdf6e3"
                  stroke={p.color === 'red' ? '#b91c1c' : '#1c1917'}
                  strokeWidth={isSelected ? 0.9 : 0.5}
                />
                <circle cx={x} cy={y} r="3.6" fill="none" stroke={p.color === 'red' ? '#b91c1c' : '#1c1917'} strokeWidth="0.2" />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="4.6"
                  fontFamily="'Noto Serif SC', 'Songti SC', 'SimSun', serif"
                  fontWeight="700"
                  fill={p.color === 'red' ? '#b91c1c' : '#1c1917'}
                >
                  {LABELS[p.color][p.type]}
                </text>
                {isSelected && <circle cx={x} cy={y} r="4.9" fill="none" stroke="#2563eb" strokeWidth="0.7" />}
              </>
            )}
            {isTarget &&
              (p ? (
                <circle cx={x} cy={y} r="4.9" fill="none" stroke="#16a34a" strokeWidth="0.8" strokeDasharray="1.4 0.8" />
              ) : (
                <circle cx={x} cy={y} r="1.4" fill="#16a34a" opacity="0.85" />
              ))}
          </g>
        );
      })}
    </svg>
  );
}
