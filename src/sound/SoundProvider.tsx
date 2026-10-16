import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Position } from '../engine';
import { createSoundPlayer, type AudioContextLike, type SoundEffect } from './player';

interface Sound {
  muted: boolean;
  setMuted: (muted: boolean) => void;
  play: (effect: SoundEffect, delay?: number) => void;
}

// Outside a provider (component tests) sound is a silent no-op.
const SoundContext = createContext<Sound>({ muted: true, setMuted: () => {}, play: () => {} });

export function SoundProvider({
  initialMuted,
  onMutedChange,
  createContext: createAudio,
  children,
}: {
  initialMuted: boolean;
  onMutedChange?: (muted: boolean) => void;
  /** Audio backend factory (tests inject a fake); defaults to the browser's AudioContext. */
  createContext?: () => AudioContextLike | null;
  children: ReactNode;
}) {
  const [muted, setMutedState] = useState(initialMuted);
  const mutedRef = useRef(initialMuted);
  const player = useMemo(() => createSoundPlayer({ isMuted: () => mutedRef.current, createContext: createAudio }), [createAudio]);

  // The audio context may only be created/resumed inside a user gesture.
  useEffect(() => {
    const unlock = () => player.unlock();
    const events = ['pointerdown', 'keydown', 'touchend'] as const;
    for (const e of events) document.addEventListener(e, unlock, true);
    return () => {
      for (const e of events) document.removeEventListener(e, unlock, true);
    };
  }, [player]);

  const setMuted = useCallback(
    (next: boolean) => {
      mutedRef.current = next;
      setMutedState(next);
      onMutedChange?.(next);
      // Turning sound on is itself a tap, so the context can start now.
      if (!next) player.unlock();
    },
    [player, onMutedChange],
  );
  const value = useMemo<Sound>(() => ({ muted, setMuted, play: player.play }), [muted, setMuted, player]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSound(): Sound {
  return useContext(SoundContext);
}

/** 'capture' when the move lands on a piece in `before`, otherwise 'move'. */
// eslint-disable-next-line react-refresh/only-export-components
export function moveSound(before: Position, move: { to: number }): SoundEffect {
  return before.board[move.to] ? 'capture' : 'move';
}
