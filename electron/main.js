'use strict'
/**
 * Electron main process — ExcaliDiagram desktop app.
 *
 * Responsibilities:
 *  1. Start the embedded Express backend on a free port
 *  2. Create the BrowserWindow and load the React frontend
 *  3. Inject the backend port into the renderer via a global variable
 *  4. Handle app lifecycle (quit on window close, etc.)
 *
 * Service replacements vs. the web stack:
 *  - MongoDB  →  NeDB (file-based, DESKTOP_MODE=true)
 *  - MinIO    →  Local filesystem under userData/icons/
 *  - Docker   →  Gone entirely
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path   = require('path')
const net    = require('net')
const http   = require('http')
const fs     = require('fs')

// ── Resolve paths ─────────────────────────────────────────────────────────────
const isDev       = process.env.NODE_ENV === 'development' || !app.isPackaged
const BACKEND_DIR = isDev
  ? path.join(__dirname, '..', 'backend')
  : path.join(process.resourcesPath, 'backend')
const RENDERER_DIR = isDev
  ? null   // dev: load from Vite dev server or pre-built dist
  : path.join(process.resourcesPath, 'renderer')

let backendPort = null
let mainWindow  = null

// ── Find a free TCP port ──────────────────────────────────────────────────────
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

// ── Wait until the Express server is accepting connections ────────────────────
function waitForServer(port, retries = 30, delayMs = 200) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    function tryConnect() {
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        attempts++
        if (attempts >= retries) return reject(new Error('Backend did not start in time'))
        setTimeout(tryConnect, delayMs)
      })
    }
    tryConnect()
  })
}

// ── Start the embedded Express backend ───────────────────────────────────────
async function startBackend() {
  backendPort = await findFreePort()

  // Set environment variables BEFORE requiring the backend modules
  // so that NeDB / localFs pick up the correct paths.
  const userData = app.getPath('userData')
  process.env.DESKTOP_MODE  = 'true'
  process.env.NODE_ENV      = process.env.NODE_ENV || 'production'
  process.env.PORT          = String(backendPort)
  process.env.USERDATA_PATH = userData

  // Ensure the userData icons directory exists
  const iconsDir = path.join(userData, 'icons', 'icons')
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })

  // Load dotenv for any optional config (e.g. AI API keys stored by the user)
  const dotenvPath = path.join(userData, '.env')
  if (fs.existsSync(dotenvPath)) {
    require('dotenv').config({ path: dotenvPath })
  }

  // Require the backend — this sets up Express but doesn't listen yet
  const backendApp = require(path.join(BACKEND_DIR, 'src', 'app'))
  const { connectDB }    = require(path.join(BACKEND_DIR, 'src', 'config', 'db'))
  const { ensureBucket } = require(path.join(BACKEND_DIR, 'src', 'modules', 'icons', 'icon.service'))

  await connectDB()
  await ensureBucket()

  return new Promise((resolve, reject) => {
    const server = backendApp.listen(backendPort, '127.0.0.1', () => {
      console.log(`✅  Backend  →  http://localhost:${backendPort}`)
      console.log(`📁  userData →  ${userData}`)
      resolve(server)
    })
    server.on('error', reject)
  })
}

// ── Create the BrowserWindow ──────────────────────────────────────────────────
async function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1400,
    height: 900,
    minWidth:  900,
    minHeight: 600,
    title: 'ExcaliDiagram',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload:         path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      // Allow loading local SVG files served by the backend
      webSecurity: true,
    },
  })

  // Inject the backend port as a global so the React app can pick it up
  // before any fetch() calls are made.
  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.executeJavaScript(
      `window.__ELECTRON_API_PORT__ = ${backendPort};`
    )
  })

  // Open external links in the system browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    // In dev mode: try the Vite dev server first, fall back to pre-built dist
    const devUrl = 'http://localhost:5173'
    try {
      await new Promise((res, rej) => {
        http.get(devUrl, r => { r.resume(); res() }).on('error', rej)
      })
      console.log('🌐  Loading from Vite dev server:', devUrl)
      await mainWindow.loadURL(devUrl)
    } catch {
      // Vite not running — load pre-built dist
      const distIndex = path.join(__dirname, '..', 'app', 'dist', 'index.html')
      console.log('📦  Loading from pre-built dist:', distIndex)
      await mainWindow.loadFile(distIndex)
    }
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    const indexPath = path.join(RENDERER_DIR, 'index.html')
    await mainWindow.loadFile(indexPath)
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('get-api-port',    () => backendPort)
ipcMain.handle('get-userdata-path', () => app.getPath('userData'))
ipcMain.handle('get-version',     () => app.getVersion())

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    await startBackend()
    await createWindow()
  } catch (err) {
    console.error('❌  Startup failed:', err)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow()
  }
})
