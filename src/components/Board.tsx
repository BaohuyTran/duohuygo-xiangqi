import type { CSSProperties } from 'react';
import { fileOf, rankOf, squareName, type Piece, type Position, type Square } from '../engine';
import { useI18n } from '../i18n/I18nProvider';

const CELL = 10;
const MARGIN = 5.5;
const WIDTH = CELL * 8 + MARGIN * 2;
const HEIGHT = CELL * 9 + MARGIN * 2;

const LABELS: Record<Piece['color'], Record<Piece['type'], string>> = {
  red: { general: '帥', advisor: '仕', elephant: '相', horse: '傌', chariot: '俥', cannon: '炮', soldier: '兵' },
  black: { general: '將', advisor: '士', elephant: '象', horse: '馬', chariot: '車', cannon: '砲', soldier: '卒' },
};

/**
 * zone: a highlighted area · target: a point to move to · pick: chosen by the user ·
 * good: correct · missed: should have been chosen · wrong: should not have been chosen ·
 * hint: a piece or point revealed by a hint.
 */
export type MarkTone = 'zone' | 'target' | 'pick' | 'good' | 'missed' | 'wrong' | 'hint';

export interface BoardProps {
  position: Position;
  selected?: Square | null;
  /** Legal-move dots (rings on occupied points). */
  dots?: readonly Square[];
  marks?: ReadonlyMap<Square, MarkTone>;
  lastMove?: { from: Square; to: Square } | null;
  checkedGeneral?: Square | null;
  /** Slide the piece now standing on `to` in from `from`. */
  animateMove?: { from: Square; to: Square } | null;
  /** A piece just captured on `at`: drawn once, fading out under the arriving piece. */
  captured?: { at: Square; piece: Piece } | null;
  onSquareClick?: (sq: Square) => void;
}

export function Board({
  position,
  selected = null,
  dots = [],
  marks,
  lastMove,
  checkedGeneral,
  animateMove,
  captured,
  onSquareClick,
}: BoardProps) {
  const { t } = useI18n();
  // Red is always at the bottom.
  const point = (file: number, rank: number) => ({ x: MARGIN + file * CELL, y: MARGIN + (9 - rank) * CELL });
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
    line(3, 0, 5, 2, 'p1'),
    line(5, 0, 3, 2, 'p2'),
    line(3, 7, 5, 9, 'p3'),
    line(5, 7, 3, 9, 'p4'),
  ];

  const dotSet = new Set(dots);
  const riverY = MARGIN + 4.5 * CELL;
  const interactive = Boolean(onSquareClick);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="block h-auto w-full touch-manipulation select-none"
      role="grid"
      aria-label={t('board.label')}
    >
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="2" fill="#e8c38a" />

      {/* Area highlights sit under the grid lines. */}
      {marks &&
        [...marks].map(([sq, tone]) => {
          if (tone !== 'zone') return null;
          const { x, y } = at(sq);
          return <rect key={`z${sq}`} x={x - 4.6} y={y - 4.6} width="9.2" height="9.2" rx="2" fill="#f59e0b" opacity="0.35" />;
        })}
      {lastMove &&
        [lastMove.from, lastMove.to].map((sq) => {
          const { x, y } = at(sq);
          return <rect key={`lm${sq}`} x={x - 4.8} y={y - 4.8} width="9.6" height="9.6" rx="1.5" fill="#2563eb" opacity="0.18" />;
        })}

      <g stroke="#5b3a1a" strokeWidth="0.35" strokeLinecap="square">
        {gridLines}
      </g>
      <g fill="#5b3a1a" fontSize="4.2" fontFamily="'Noto Serif SC', 'Songti SC', serif" dominantBaseline="central" opacity="0.7">
        <text x={MARGIN + 1.5 * CELL} y={riverY} textAnchor="middle">
          楚 河
        </text>
        <text x={MARGIN + 6.5 * CELL} y={riverY} textAnchor="middle">
          漢 界
        </text>
      </g>

      {Array.from({ length: 90 }, (_, sq) => {
        const p = position.board[sq];
        const { x, y } = at(sq);
        const tone = marks?.get(sq);
        const isDot = dotSet.has(sq);
        const isSelected = sq === selected;
        const color = p?.color === 'red' ? '#b91c1c' : '#1c1917';
        const description = [
          squareName(sq),
          p ? `${t(`color.${p.color}`)} ${t(`piece.${p.type}`)}` : t('board.empty'),
          isDot && t('board.legal'),
          (isSelected || tone === 'pick') && t('board.picked'),
          tone === 'target' && t('board.target'),
          tone === 'hint' && t('board.hint'),
        ]
          .filter(Boolean)
          .join(', ');
        return (
          <g
            key={sq}
            role="gridcell"
            aria-label={description}
            aria-selected={isSelected || tone === 'pick'}
            onClick={onSquareClick ? () => onSquareClick(sq) : undefined}
            className={interactive ? 'cursor-pointer' : undefined}
          >
            {/* Full-cell invisible hit area so taps land even between lines. */}
            <rect x={x - CELL / 2} y={y - CELL / 2} width={CELL} height={CELL} fill="transparent" />
            {tone === 'target' && (
              <circle cx={x} cy={y} r="4.6" fill="#fbbf24" fillOpacity="0.35" stroke="#d97706" strokeWidth="0.6" strokeDasharray="1.2 0.8" />
            )}
            {tone === 'hint' && (
              <circle className="motion-safe:animate-pulse" cx={x} cy={y} r="5" fill="#a855f7" fillOpacity="0.3" stroke="#9333ea" strokeWidth="0.8" />
            )}
            {captured?.at === sq && (
              <g key={`captured-${captured.piece.color}-${captured.piece.type}`} className="piece-captured" aria-hidden>
                <circle cx={x} cy={y} r="4.4" fill="#fdf6e3" stroke={captured.piece.color === 'red' ? '#b91c1c' : '#1c1917'} strokeWidth="0.5" />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="4.6"
                  fontFamily="'Noto Serif SC', 'Songti SC', 'SimSun', serif"
                  fontWeight="700"
                  fill={captured.piece.color === 'red' ? '#b91c1c' : '#1c1917'}
                >
                  {LABELS[captured.piece.color][captured.piece.type]}
                </text>
              </g>
            )}
            {p && (
              <g
                key={animateMove?.to === sq ? `${animateMove.from}-${sq}` : 'still'}
                className={animateMove?.to === sq ? 'piece-slide' : undefined}
                style={
                  animateMove?.to === sq
                    ? ({ '--dx': `${at(animateMove.from).x - x}px`, '--dy': `${at(animateMove.from).y - y}px` } as CSSProperties)
                    : undefined
                }
              >
                {sq === checkedGeneral && <circle cx={x} cy={y} r="5" fill="#dc2626" opacity="0.55" />}
                <circle cx={x} cy={y} r="4.4" fill="#fdf6e3" stroke={color} strokeWidth="0.5" />
                <circle cx={x} cy={y} r="3.6" fill="none" stroke={color} strokeWidth="0.2" />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="4.6"
                  fontFamily="'Noto Serif SC', 'Songti SC', 'SimSun', serif"
                  fontWeight="700"
                  fill={color}
                >
                  {LABELS[p.color][p.type]}
                </text>
              </g>
            )}
            {isSelected && <circle cx={x} cy={y} r="4.9" fill="none" stroke="#2563eb" strokeWidth="0.8" />}
            {isDot &&
              (p ? (
                <circle cx={x} cy={y} r="4.9" fill="none" stroke="#16a34a" strokeWidth="0.8" strokeDasharray="1.4 0.8" />
              ) : (
                <circle cx={x} cy={y} r="1.5" fill="#16a34a" opacity="0.85" />
              ))}
            {tone === 'pick' &&
              (p ? (
                <circle cx={x} cy={y} r="4.9" fill="none" stroke="#2563eb" strokeWidth="0.9" />
              ) : (
                <circle cx={x} cy={y} r="2.4" fill="#2563eb" opacity="0.9" />
              ))}
            {tone === 'good' && <circle cx={x} cy={y} r="4.6" fill="#16a34a" fillOpacity={p ? 0 : 0.5} stroke="#16a34a" strokeWidth="0.9" />}
            {tone === 'missed' && (
              <circle cx={x} cy={y} r="4.4" fill="none" stroke="#16a34a" strokeWidth="0.9" strokeDasharray="1.5 0.9" />
            )}
            {tone === 'wrong' && (
              <g stroke="#dc2626" strokeWidth="0.9" strokeLinecap="round">
                <line x1={x - 2.4} y1={y - 2.4} x2={x + 2.4} y2={y + 2.4} />
                <line x1={x - 2.4} y1={y + 2.4} x2={x + 2.4} y2={y - 2.4} />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
