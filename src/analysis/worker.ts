// Web Worker entry of the analysis layer (design/04-architecture.md §4). Built by Vite as its own
// chunk from `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` in client.ts;
// the PWA precaches it with the other JS (vite.config.ts `globPatterns`), so it works offline.
//
// Protocol: WorkerRequestMessage { id, request } in, WorkerResponseMessage { id, outcome } out, one
// answer per message, in order. There is no time limit in here: the client's wall-clock safety net
// terminates this Worker (the only way to stop the engine's exhaustive mate search) and starts a new one.
//
// `self` is the Worker's global scope; this is the only analysis module that touches it.
import { executeRequest, type WorkerRequestMessage, type WorkerResponseMessage } from './requests';

interface WorkerScope {
  onmessage: ((event: { readonly data: WorkerRequestMessage }) => void) | null;
  postMessage(message: WorkerResponseMessage): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { id, request } = event.data;
  scope.postMessage({ id, outcome: executeRequest(request) });
};
