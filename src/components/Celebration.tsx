import type { CSSProperties } from 'react';

const COLORS = ['#f59e0b', '#16a34a', '#dc2626', '#2563eb', '#9333ea', '#db2777'];
const PIECES = 18;

/**
 * A one-off confetti burst over the whole screen (decorative, never blocks taps).
 * Hidden under prefers-reduced-motion (see .confetti-piece in index.css).
 */
export function Celebration() {
  return (
    <div aria-hidden data-testid="celebration" className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {Array.from({ length: PIECES }, (_, i) => {
        const angle = (i / PIECES) * 2 * Math.PI;
        const dist = 110 + (i % 3) * 45;
        const style = {
          backgroundColor: COLORS[i % COLORS.length],
          '--cx': `${Math.round(Math.cos(angle) * dist)}px`,
          '--cy': `${Math.round(Math.sin(angle) * dist + 60)}px`,
          '--cr': `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
          animationDelay: `${(i % 4) * 40}ms`,
        } as CSSProperties;
        return <span key={i} className="confetti-piece" style={style} />;
      })}
    </div>
  );
}
