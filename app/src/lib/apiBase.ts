/**
 * Resolves the backend API base URL dynamically.
 *
 * Priority:
 *  1. window.__ELECTRON_API_PORT__  — set by Electron main.js before React renders
 *  2. localStorage 'excelidrawApp:apiPort' — persisted from a prior session in Electron
 *  3. http://localhost:3001          — plain browser / dev fallback
 *
 * Call getApiBase() once at module load time; the value is cached for the
 * lifetime of the renderer process.
 */

declare global {
  interface Window {
    __ELECTRON_API_PORT__?: number
    electronAPI?: {
      getApiPort: () => Promise<number>
      getUserDataPath: () => Promise<string>
      getVersion: () => Promise<string>
    }
  }
}

function resolveApiBase(): string {
  // Electron injected the port synchronously before React rendered
  if (window.__ELECTRON_API_PORT__) {
    const p = window.__ELECTRON_API_PORT__
    try { localStorage.setItem('excelidrawApp:apiPort', String(p)) } catch { /* ignore */ }
    return `http://localhost:${p}`
  }

  // Electron is present but port came in after first paint — check localStorage cache
  if (window.electronAPI) {
    const cached = localStorage.getItem('excelidrawApp:apiPort')
    if (cached) return `http://localhost:${cached}`
    // will still fall through to :3001 on very first launch; 
    // a re-render triggered by the async port will fix subsequent fetches
    window.electronAPI.getApiPort().then(p => {
      if (p) {
        try { localStorage.setItem('excelidrawApp:apiPort', String(p)) } catch { /* ignore */ }
      }
    }).catch(() => {})
  }

  // Browser dev / web server mode
  return 'http://localhost:3001'
}

let _cachedBase: string | null = null

export function getApiBase(): string {
  if (!_cachedBase) _cachedBase = resolveApiBase()
  return _cachedBase
}

