/**
 * Resolves the backend API base URL.
 *
 * In Electron, the port is injected synchronously by preload.js (via
 * contextBridge.exposeInMainWorld) BEFORE any React module runs.
 * So window.__ELECTRON_API_PORT__ is always set when this file is evaluated.
 *
 * In plain browser / web-server mode, falls back to localhost:3001.
 */

declare global {
  interface Window {
    __ELECTRON_API_PORT__?: number | null
    electronAPI?: {
      getApiPort: () => Promise<number | null>
      getUserDataPath: () => Promise<string>
      getVersion: () => Promise<string>
    }
  }
}

export function getApiBase(): string {
  const port = window.__ELECTRON_API_PORT__
  if (port) return `http://localhost:${port}`
  return 'http://localhost:3001'
}
