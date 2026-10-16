import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createLocalStore } from './storage'
import { appUrl, readSyncConfig } from './sync/config'
import { createAccountService } from './sync/service'

// Optional account sync: only when both Supabase variables are set at build time. The inline
// `import.meta.env` check is folded away by the bundler when they are missing, so that build has no
// account code path and no Supabase chunk at all. With them, Supabase is still a separate lazy chunk.
const syncConfig =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? readSyncConfig({
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
      })
    : null
const account =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY && syncConfig
    ? createAccountService({
        store: createLocalStore(),
        loadBackend: () => import('./sync/supabase').then((m) => m.createSupabaseBackend(syncConfig)),
        redirectTo: appUrl(window.location.href, import.meta.env.BASE_URL),
      })
    : undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App account={account} />
  </StrictMode>,
)
