import { useMemo, useState } from 'react';
import { Board } from './components/Board';
import {
  findGeneral,
  gameStatus,
  legalMovesFrom,
  makeMove,
  parseFen,
  START_FEN,
  toFen,
  type Move,
  type Position,
  type Square,
} from './engine';

interface HistoryEntry {
  position: Position;
  lastMove: Move | null;
}

const initialHistory = (fen: string): HistoryEntry[] => [{ position: parseFen(fen), lastMove: null }];

export default function App() {
  const [history, setHistory] = useState<HistoryEntry[]>(() => initialHistory(START_FEN));
  const [selected, setSelected] = useState<Square | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [fenInput, setFenInput] = useState('');
  const [fenError, setFenError] = useState<string | null>(null);

  const { position, lastMove } = history[history.length - 1];
  const status = useMemo(() => gameStatus(position), [position]);
  const targets = useMemo(() => (selected === null ? [] : legalMovesFrom(position, selected)), [position, selected]);
  const gameOver = status.kind === 'checkmate' || status.kind === 'stalemate';

  const handleSquareClick = (sq: Square) => {
    if (gameOver) return;
    if (selected !== null && targets.includes(sq)) {
      const move = { from: selected, to: sq };
      setHistory((h) => [...h, { position: makeMove(position, move), lastMove: move }]);
      setSelected(null);
      return;
    }
    const p = position.board[sq];
    setSelected(p && p.color === position.turn && sq !== selected ? sq : null);
  };

  const reset = (fen: string) => {
    setHistory(initialHistory(fen));
    setSelected(null);
  };

  const loadFen = () => {
    try {
      reset(fenInput.trim());
      setFenError(null);
    } catch (e) {
      setFenError(e instanceof Error ? e.message : String(e));
    }
  };

  const turnLabel = position.turn === 'red' ? 'Red' : 'Black';
  const statusText = (() => {
    switch (status.kind) {
      case 'checkmate':
        return `Checkmate — ${status.winner === 'red' ? 'Red' : 'Black'} wins`;
      case 'stalemate':
        return `${turnLabel} has no moves — ${status.winner === 'red' ? 'Red' : 'Black'} wins`;
      case 'check':
        return `${turnLabel} to move — check!`;
      default:
        return `${turnLabel} to move`;
    }
  })();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-red-700">DuoHuyGo Xiangqi</h1>
        <span className="text-xs text-stone-500">Rules sandbox</span>
      </header>

      <p
        role="status"
        aria-live="polite"
        className={`rounded-lg px-3 py-2 text-center text-sm font-semibold ${
          gameOver ? 'bg-red-700 text-white' : status.kind === 'check' ? 'bg-amber-200 text-amber-900' : 'bg-white/70 text-stone-700'
        }`}
      >
        <span
          aria-hidden
          className={`mr-2 inline-block h-3 w-3 rounded-full align-middle ${position.turn === 'red' ? 'bg-red-700' : 'bg-stone-900'}`}
        />
        {statusText}
      </p>

      <div className="overflow-hidden rounded-xl shadow-md">
        <Board
          position={position}
          selected={selected}
          targets={targets}
          lastMove={lastMove}
          checkedGeneral={status.kind === 'check' || status.kind === 'checkmate' ? findGeneral(position.board, position.turn) : null}
          flipped={flipped}
          onSquareClick={handleSquareClick}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => {
            setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
            setSelected(null);
          }}
          disabled={history.length <= 1}
          className="rounded-lg bg-stone-800 px-3 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="rounded-lg bg-stone-200 px-3 py-3 text-sm font-semibold text-stone-800"
        >
          Flip
        </button>
        <button
          type="button"
          onClick={() => reset(START_FEN)}
          className="rounded-lg bg-red-700 px-3 py-3 text-sm font-semibold text-white"
        >
          New game
        </button>
      </div>

      <details className="rounded-lg bg-white/60 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-semibold text-stone-700">Position (FEN)</summary>
        <p className="mt-2 font-mono text-xs break-all text-stone-600">{toFen(position)}</p>
        <div className="mt-2 flex gap-2">
          <input
            value={fenInput}
            onChange={(e) => setFenInput(e.target.value)}
            placeholder="Paste a FEN to load"
            aria-label="FEN to load"
            className="min-w-0 flex-1 rounded border border-stone-300 bg-white px-2 py-2 font-mono text-base sm:text-xs"
          />
          <button type="button" onClick={loadFen} className="rounded bg-stone-800 px-3 text-white">
            Load
          </button>
        </div>
        {fenError && <p className="mt-1 text-xs text-red-700">{fenError}</p>}
      </details>
    </main>
  );
}
