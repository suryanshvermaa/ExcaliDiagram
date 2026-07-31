/**
 * Electron preload script.
 *
 * Runs in a sandboxed context with access to Node.js APIs.
 * Exposes a minimal, safe bridge to the renderer (React app) via
 * contextBridge so the frontend can read the backend port without
 * having direct Node.js access.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  /** Returns the port that the embedded Express server is listening on. */
  getApiPort: () => ipcRenderer.invoke('get-api-port'),

  /** Returns the OS userData directory path. */
  getUserDataPath: () => ipcRenderer.invoke('get-userdata-path'),

  /** App version */
  getVersion: () => ipcRenderer.invoke('get-version'),
})
