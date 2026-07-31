# ExcaliDiagram Desktop

A self-contained desktop app — no Docker, no MongoDB, no MinIO required.

## Quick Start

```bash
# 1. Install backend deps (one-time)
cd backend && npm install

# 2. Install Electron (one-time)
cd electron && npm install

# 3. Build the React frontend (required before first launch or after UI changes)
cd app && pnpm run build

# 4. Launch the desktop app
cd electron && npm start
```

## Development Mode (with hot-reload UI)

In one terminal, start the Vite dev server:
```bash
cd app && pnpm run dev
```

In another terminal, launch Electron:
```bash
cd electron && npm start
```

Electron will detect the Vite dev server and load from it automatically.
DevTools open automatically in dev mode.

## Where Data Lives

All data is stored in your OS user data directory:

| OS      | Path |
|---------|------|
| Linux   | `~/.config/ExcaliDiagram/` |
| macOS   | `~/Library/Application Support/ExcaliDiagram/` |
| Windows | `%APPDATA%\ExcaliDiagram\` |

- **Icons** (SVG files): `<userData>/icons/icons/*.svg`
- **Database** (icon metadata): `<userData>/db/icons.db`
- **Scene** (Excalidraw canvas): `localStorage` in the app's Chromium profile

## Import Icons

Use the Admin UI to import icons (available while the app is running):
```
http://localhost:<PORT>/admin
```

Or use the backend seed scripts:
```bash
cd backend

# Import tech icons from Iconify packs
npm run import:techicons

# Seed the database from imported icons
npm run seed:techicons
```

## AI Agent

The AI agent works with any configured provider. Add your API keys in the AI panel inside the app, or set them in a `.env` file at `<userData>/.env`:

```env
# Optional — only needed for cloud AI providers
OPENAI_API_KEY=sk-...
GROQ_API_KEY=...
GOOGLE_API_KEY=...
```

Ollama (local AI) works automatically if installed on your machine.

## Architecture

```
Electron Main Process
├── Express backend (embedded, random port)
│   ├── NeDB (replaces MongoDB — file-based, no server)
│   └── Local FS (replaces MinIO — SVGs stored in userData)
└── BrowserWindow
    └── React + Vite (Excalidraw, icon sidebar, AI panel)
```
