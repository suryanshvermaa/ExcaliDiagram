'use strict'
/**
 * Electron preload script.
 *
 * Runs in a sandboxed context BEFORE any page/renderer scripts.
 * We use contextBridge to expose a safe, synchronous API to the React app.
 *
 * Key job: read --api-port from process.argv (passed via additionalArguments)
 * and expose it as window.__ELECTRON_API_PORT__ BEFORE React modules load.
 * This means getApiBase() always gets the correct port on first call.
 */

const { contextBridge, ipcRenderer } = require('electron')

// Read the backend port from the additionalArguments injected by main.js.
// process.argv in the preload context includes the Electron app args.
const portArg = process.argv.find(a => a.startsWith('--api-port='))
const apiPort  = portArg ? Number(portArg.split('=')[1]) : null

// ── Expose to renderer (window.*) ─────────────────────────────────────────────

// Expose the port as a plain number — React's getApiBase() reads this synchronously
// before any fetch() call is made.
contextBridge.exposeInMainWorld('__ELECTRON_API_PORT__', apiPort)

// Expose a typed API object for IPC operations
contextBridge.exposeInMainWorld('electronAPI', {
  /** Port the embedded Express server is listening on (same as __ELECTRON_API_PORT__) */
  getApiPort: () => Promise.resolve(apiPort),

  /** OS userData directory path */
  getUserDataPath: () => ipcRenderer.invoke('get-userdata-path'),

  /** App version string */
  getVersion: () => ipcRenderer.invoke('get-version'),
})
