// Page hooks of the S2.19 walkthrough, injected with Playwright's `addInitScript` before the app loads (test-only;
// the app has no test hooks of its own).
//
// 1. A seeded `Math.random`, so the session seed (choice shuffles, check / placement forms, partner seeds) is the same
//    on every run of the walkthrough.
// 2. Fault injection for a voided practical run (03 §5.6): `window.Worker` is wrapped so that, while
//    `window.__uiFault.active` is true, every answer of the analysis Worker is replaced by a
//    `not-checked` / `node-limit` outcome of the same request kind — exactly what a phone that runs out of node
//    budget produces. The app's client (src/analysis/client.ts) only uses `onmessage` / `onerror` /
//    `onmessageerror` / `postMessage` / `terminate`, which the wrapper forwards.
// 3. `__name`: tsx (esbuild `keepNames`) wraps the walkthrough's functions in `__name(…)`, also those passed to
//    `page.evaluate`; the page gets a no-op of it.

/** The script source for `page.addInitScript({ content })`. */
export function pageHooks(seed: number): string {
  return `(() => {
  window.__name = window.__name || ((f) => f);
  let s = ${seed >>> 0};
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const fault = { active: false, injected: 0 };
  window.__uiFault = fault;
  const RealWorker = window.Worker;
  if (!RealWorker) return;
  class FaultWorker {
    constructor(url, options) {
      this.real = new RealWorker(url, options);
      this.kinds = new Map();
      this.onmessage = null;
      this.onerror = null;
      this.onmessageerror = null;
      this.real.onmessage = (event) => {
        const data = event.data;
        let out = data;
        if (fault.active && data && data.id !== undefined) {
          fault.injected += 1;
          out = { id: data.id, outcome: { status: 'not-checked', kind: this.kinds.get(data.id) ?? (data.outcome && data.outcome.kind), reason: 'node-limit', nodes: 0, message: 'ui-check fault injection' } };
        }
        this.kinds.delete(data && data.id);
        if (this.onmessage) this.onmessage({ data: out });
      };
      this.real.onerror = (event) => this.onerror && this.onerror(event);
      this.real.onmessageerror = (event) => this.onmessageerror && this.onmessageerror(event);
    }
    postMessage(message) {
      if (message && message.request) this.kinds.set(message.id, message.request.kind);
      this.real.postMessage(message);
    }
    terminate() {
      this.real.terminate();
    }
  }
  window.Worker = FaultWorker;
})();`;
}
