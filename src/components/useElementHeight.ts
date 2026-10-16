import { useCallback, useLayoutEffect, useState } from 'react';

/**
 * Tracks an element's layout height (used for the fixed footers, so the page can reserve exactly
 * that much room below the board). Returns a callback ref and the current height (0 when unmounted).
 */
export function useElementHeight<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [height, setHeight] = useState(0);
  const ref = useCallback((node: T | null) => setEl(node), []);

  useLayoutEffect(() => {
    if (!el) {
      setHeight(0);
      return;
    }
    const measure = () => setHeight(Math.ceil(el.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);

  return [ref, height];
}
