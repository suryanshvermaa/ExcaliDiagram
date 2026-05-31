# ExcaliDiagram

Built on top of the Excalidraw canvas library, ExcaliDiagram is a full-stack diagramming app with a custom icon server, resizable sidebar, drag-and-drop asset library, code block modal, and database schema builder. The backend is a Node.js Express server that manages an S3-compatible object store (MinIO for development, AWS S3 for production) to serve SVG icons through a REST API. The frontend is a React app that integrates with Excalidraw to provide an infinite canvas workspace, a sidebar for browsing and inserting icons, and a Monaco Editor–powered modal for rendering syntax-highlighted code snippets as SVG cards on the canvas. LocalStorage autosave ensures your work persists across sessions.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Folder Structure](#folder-structure)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [API Documentation](#api-documentation)
- [Database Design](#database-design)
- [Deployment](#deployment)
- [Security](#security)
- [Future Improvements](#future-improvements)

---

## Project Overview

ExcelidrawApp wraps the open-source [Excalidraw](https://excalidraw.com/) canvas library and extends it with:

- A **local icon server** (Node.js + Express) that stores 32 custom system-design SVG icons in an S3-compatible object store (MinIO for development, AWS S3 for production) and serves them through a REST API.
- A **resizable sidebar panel** with an asset library that auto-detects the backend and falls back to 8 built-in local icons when the server is offline.
- **Drag-and-drop** from the sidebar directly onto the infinite canvas with pixel-accurate drop positioning.
- A **code block modal** powered by Monaco Editor that renders syntax-highlighted snippets as crisp VS Code–style SVG cards on the canvas — completely offline.
- A **database schema builder** that generates entity-table SVG diagrams and inserts them into the canvas.
- **LocalStorage autosave** so the canvas state survives page refreshes.
- A **server-side admin panel** (EJS + vanilla JS) for managing the icon library — drag-and-drop file upload, JSON payload upload, search, category filter, pagination, and delete.

---

## Features

### Frontend (React App)

| Feature | Description |
|---|---|
| Excalidraw infinite canvas | Full Excalidraw editor as the primary workspace |
| Resizable sidebar drawer | Collapsible panel, draggable resize handle (200–600 px) |
| Asset library — server mode | Fetches paginated icons from the local backend; auto-detects with 1.5 s health probe |
| Asset library — local fallback | Uses 8 built-in SVG assets when the server is offline |
| Category filter pills | Filter icons by category (Containers, Web, Backend, Data, Messaging, Cloud, DevOps, Security) |
| Search with debounce | 300 ms debounced search across icon name and tags |
| Drag-and-drop to canvas | Drag any icon tile to the canvas; placed at exact cursor position |
| Click-to-insert | Single click inserts icon at an offset from the current scroll position |
| Code block modal | Monaco Editor (JS / HTML / CSS / C++ / Java) → VS Code–style SVG card on canvas |
| Dark & light code themes | Toggle between VS Dark and VS Light themes for code cards |
| Schema builder tab | Visual database table designer → inserts as SVG entity diagram |
| LocalStorage autosave | Scene saved every 5 s (debounced); restored on next visit |
| No-select insert | Inserted elements skip selection so the properties toolbar doesn't pop up |

### Backend (Node.js Icon Server)

| Feature | Description |
|---|---|
| RESTful icon API | Full CRUD with pagination, full-text search, and category filter |
| S3-compatible storage | `@aws-sdk/client-s3`; switches between MinIO and AWS S3 via env var |
| Presigned URL caching | URLs cached in MongoDB; auto-refreshed 5 min before expiry |
| SVG proxy endpoint | `/api/icons/:id/svg` streams raw SVG to avoid CORS issues with presigned URLs |
| Admin panel (EJS) | Server-rendered UI at `/admin` for full icon lifecycle management |
| File upload (Multer) | Accepts `.svg` files up to 2 MB; streams buffer directly to S3 |
| JSON upload endpoint | Upload icons as inline SVG string via JSON body |
| SVG generator script | Generates all 32 SVG files programmatically from hardcoded definitions |
| Seed script | Bulk-uploads the `icons/` directory to S3/MinIO and saves metadata to MongoDB |
| Health check endpoint | `/health` returns icon count and active storage backend name |
| Morgan HTTP logging | `dev` format in development, `combined` in production |
| Helmet security headers | Applied globally; CSP and CORP tuned for SVG delivery |

---

## Tech Stack

### Frontend

| Layer | Technology | Version |
|---|---|---|
| UI Framework | React | 18.3.x |
| Language | TypeScript | ~6.0 |
| Build Tool | Vite | 8.x |
| Canvas Library | `@excalidraw/excalidraw` | ^0.18.1 |
| Code Editor | `@monaco-editor/react` | ^4.7.0 |
| Package Manager | pnpm | — |

### Backend

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 22 (Alpine) |
| Framework | Express | ^4.19 |
| Database ODM | Mongoose | ^8.4 |
| Object Storage SDK | `@aws-sdk/client-s3` | ^3.600 |
| Presigned URLs | `@aws-sdk/s3-request-presigner` | ^3.600 |
| Template Engine | EJS | ^6.0 |
| File Upload | Multer (memory storage) | ^1.4.5-lts |
| Security | Helmet | ^7.1 |
| CORS | `cors` | ^2.8 |
| HTTP Logging | Morgan | ^1.10 |
| Slug generation | Slugify | ^1.6 |
| Dev server | Nodemon | ^3.1 |

### Infrastructure

| Component | Technology |
|---|---|
| Local object storage | MinIO (Docker) |
| Production object storage | AWS S3 |
| Database | MongoDB 7 (Docker) |
| Container orchestration | Docker Compose (infrastructure services) |
| Frontend container | Nginx Alpine (multi-stage Docker build) |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      Browser (React App)                        │
│                                                                  │
│  ┌──────────────┐   ┌─────────────────────────────────────┐    │
│  │  Sidebar     │   │         ExcalidrawHost               │    │
│  │  Panel       │   │  ┌───────────────────────────────┐  │    │
│  │              │   │  │   Excalidraw Infinite Canvas   │  │    │
│  │ ┌──────────┐ │   │  │   (drag-drop target)          │  │    │
│  │ │ Assets   │─┼───┼──┤── insertSvgToCanvas() ────────┤  │    │
│  │ │ Library  │ │   │  └───────────────────────────────┘  │    │
│  │ └──────────┘ │   └─────────────────────────────────────┘    │
│  │ ┌──────────┐ │                                               │
│  │ │  Code    │─┼── CodeBlockModal (Monaco → SVG card)          │
│  │ │  Block   │ │                                               │
│  │ └──────────┘ │                                               │
│  │ ┌──────────┐ │                                               │
│  │ │ Schema   │─┼── SchemaBuilder (table designer → SVG)        │
│  │ │ Builder  │ │                                               │
│  │ └──────────┘ │                                               │
│  └──────────────┘                                               │
│         │  HTTP (fetch)           │  localStorage               │
└─────────┼─────────────────────────┼─────────────────────────────┘
          ▼                         ▼
┌──────────────────────┐   ┌──────────────────────┐
│  Backend (Node.js)   │   │  Browser Storage      │
│  Express + Mongoose  │   │  devScene (autosave)  │
│                      │   └──────────────────────┘
│  /api/icons  (CRUD)  │
│  /api/categories     │
│  /admin      (EJS)   │
│  /health             │
└──────────┬───────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
┌─────────┐  ┌──────────┐
│ MongoDB │  │  MinIO   │
│ icons-db│  │  (icons  │
│ (meta)  │  │  bucket) │
└─────────┘  └──────────┘
```

### Data Flow — Icon Drag & Drop
1. `AssetLibraryPanel` probes `/health` on mount (1.5 s timeout).
2. If server reachable → **server mode**: fetches paginated icons from `/api/icons`.
3. If server unreachable → **local mode**: uses `builtinAssets` from `assetCatalog.ts`.
4. User drags an icon tile; `dragState` module stores the asset reference synchronously.
5. `ExcalidrawHost` receives the `drop` event, fetches the SVG via `/api/icons/:id/svg` proxy, then calls `insertSvgToCanvas()` which adds a binary file via `api.addFiles()` and appends an `image` element at the drop coordinates via `api.updateScene()`.

### Data Flow — Code Block
1. User opens the Code tab → clicks **Open Code Editor**.
2. `CodeBlockModal` mounts Monaco Editor with language tabs and theme toggle.
3. On **Insert to Canvas**: `codeToSvg()` tokenises the code (hand-rolled tokenizer supporting JS, HTML, CSS, C++, Java, JSON, Python, Rust, Go, Bash) and produces a VS Code–style SVG with traffic-light dots, title bar, language badge, and syntax-coloured tokens.
4. The SVG is URL-encoded and inserted as an image element on the canvas.

---

## Folder Structure

```
excelidrawApp/
├── docker-compose.infra.yml        # MongoDB 7 + MinIO + bucket-init services
├── .gitignore
│
├── app/                            # React frontend
│   ├── Dockerfile                  # Multi-stage: Node build → Nginx serve
│   ├── .dockerignore
│   ├── index.html
│   ├── vite.config.ts              # Vite: host 0.0.0.0, port 5173, optimizeDeps for excalidraw
│   ├── eslint.config.js
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── package.json
│   └── src/
│       ├── main.tsx                # React entry — StrictMode, imports excalidraw CSS
│       ├── App.tsx                 # Root component — renders ExcalidrawHost
│       ├── App.css                 # All component styles (single file, ~573 lines)
│       ├── index.css               # Body reset
│       │
│       ├── editor/
│       │   ├── ExcalidrawHost.tsx  # Editor wrapper: sidebar, DnD, autosave wiring
│       │   ├── CodeBlockModal.tsx  # Monaco editor modal → SVG code card
│       │   ├── codeToSvg.ts        # Offline code → VS Code SVG renderer (no deps)
│       │   └── dragState.ts        # Module-scoped drag state (avoids prop drilling)
│       │
│       ├── sidebar/
│       │   ├── SidebarPanel.tsx    # Tab bar: 🗂 Assets | </> Code
│       │   ├── SchemaBuilder.tsx   # DB table designer → SVG entity diagram
│       │   └── schemaToSvg.ts      # Schema → SVG renderer
│       │
│       ├── assets/
│       │   ├── AssetLibraryPanel.tsx  # Server/local icon browser + DnD + pagination
│       │   └── assetCatalog.ts        # 8 built-in fallback icons (inline SVG)
│       │
│       └── storage/
│           └── devSceneStorage.ts     # localStorage autosave (5 s debounce)
│
├── backend/                        # Node.js icon server
│   ├── Dockerfile                  # node:22-alpine3.23, non-root nodejs user
│   ├── .dockerignore
│   ├── server.js                   # Entry: connectDB → ensureBucket → listen
│   ├── package.json
│   ├── .env                        # Local dev env vars (git-ignored)
│   ├── .env.example                # Template with all variable documentation
│   │
│   ├── icons/                      # 32 generated SVG files
│   │
│   ├── scripts/
│   │   ├── generateSvgs.js         # Generates icons/ SVG files from hardcoded catalog
│   │   └── seed.js                 # Uploads icons/ to S3/MinIO + saves to MongoDB
│   │
│   └── src/
│       ├── app.js                  # Express app: middleware, routes, error handlers
│       ├── config/
│       │   ├── db.js               # Mongoose connection (singleton guard)
│       │   ├── env.js              # Centralised env config object
│       │   └── s3.js               # S3Client factory (MinIO ↔ AWS S3)
│       ├── middleware/
│       │   └── upload.middleware.js  # Multer: memory storage, 2 MB limit, SVG only
│       ├── modules/
│       │   ├── icons/
│       │   │   ├── icon.model.js         # Mongoose Icon schema + indexes
│       │   │   ├── icon.service.js       # S3 ops: upload, presign, stream, delete
│       │   │   ├── icon.controller.js    # API handlers: list, get, svg, categories, delete, refresh
│       │   │   ├── icon.routes.js        # Router: /api/icons/*
│       │   │   └── upload.controller.js  # File upload + JSON upload handlers
│       │   └── admin/
│       │       ├── admin.controller.js   # Renders admin EJS page (paginated, with URL refresh)
│       │       └── admin.routes.js       # GET /admin
│       ├── routes/
│       │   └── index.js            # API router: /api → icon routes + /api/categories shortcut
│       ├── static/
│       │   └── admin.js            # Vanilla JS client for admin panel (200 lines)
│       ├── utils/
│       │   └── logger.js           # Morgan logger middleware
│       └── views/
│           └── admin.ejs           # Admin panel HTML template (dark theme, EJS)
```

---

## Setup Instructions

### Prerequisites

| Tool | Minimum Version |
|---|---|
| Node.js | 22 |
| npm | bundled with Node |
| pnpm | any |
| Docker + Docker Compose | any recent version |

### 1. Clone the repository

```bash
git clone <repo-url>
cd excelidrawApp
```

### 2. Start infrastructure (MongoDB + MinIO)

```bash
docker compose -f docker-compose.infra.yml up -d
```

This starts:
- **MongoDB 7** on `localhost:27017` (database: `icons-db`)
- **MinIO** on `localhost:9000` (S3 API) and `localhost:9001` (web console)
- **minio-init** — a one-shot container that creates the `icons` bucket and sets it to public-download mode

### 3. Install and configure the backend

```bash
cd backend
npm install
cp .env.example .env        # defaults work out-of-the-box for local MinIO
```

### 4. Generate SVG files and seed the database

```bash
# Generate the 32 SVG files into backend/icons/
npm run generate-svgs

# Dry-run to validate (no writes)
npm run seed:dry

# Upload SVGs to MinIO + save metadata to MongoDB
npm run seed
```

### 5. Install frontend dependencies

```bash
cd ../app
pnpm install
```

---

## Environment Variables

All backend configuration is in `backend/.env`. Copy `backend/.env.example` to start.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port for the Express server |
| `NODE_ENV` | `development` | Switches Morgan log format and other behaviour |
| `MONGO_URI` | `mongodb://localhost:27017/icons-db` | MongoDB connection string |
| `USE_S3` | `false` | `true` → use real AWS S3; `false` → use MinIO |
| `S3_BUCKET` | `icons` | Bucket name for SVG storage |
| `S3_REGION` | `us-east-1` | AWS region (MinIO ignores this) |
| `SIGNED_URL_EXPIRY` | `3600` | Presigned URL lifetime in seconds |
| `MINIO_ENDPOINT` | `http://localhost:9000` | MinIO S3 API endpoint |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `MINIO_PUBLIC_URL` | `http://localhost:9000` | Public base URL the browser uses to reach MinIO |
| `AWS_ACCESS_KEY_ID` | _(unset)_ | AWS access key (only when `USE_S3=true`) |
| `AWS_SECRET_ACCESS_KEY` | _(unset)_ | AWS secret key (only when `USE_S3=true`) |
| `AWS_REGION` | `us-east-1` | AWS region (only when `USE_S3=true`) |

> **Note for Docker:** Set `MINIO_PUBLIC_URL=http://host.docker.internal:9000` so the container browser can resolve MinIO.

---

## Running Locally

### Backend

```bash
cd backend
npm run dev        # nodemon — restarts on file changes
```

URLs:
- API: `http://localhost:3001`
- Admin panel: `http://localhost:3001/admin`
- Health check: `http://localhost:3001/health`

### Frontend

```bash
cd app
pnpm dev           # Vite dev server
# → http://localhost:5173
```

Both services must run simultaneously for full functionality. The frontend auto-detects the backend and switches between server mode and local-fallback mode transparently.

---

## API Documentation

Base URL: `http://localhost:3001`

### Health

| Method | Path | Response |
|---|---|---|
| `GET` | `/health` | `{ ok: true, icons: <count>, storage: "minio" \| "aws-s3" }` |

### Icons

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/icons` | List icons — paginated, searchable, filterable by category |
| `GET` | `/api/categories` | List all distinct categories (`["All", "Backend", ...]`) |
| `GET` | `/api/icons/:id` | Get a single icon (refreshes presigned URL if expiring) |
| `GET` | `/api/icons/:id/svg` | Stream raw SVG content (avoids CORS issues with presigned URLs) |
| `GET` | `/api/icons/:id/signed-url` | Force-refresh the presigned URL for an icon |
| `DELETE` | `/api/icons/:id` | Delete icon from S3/MinIO and MongoDB |
| `POST` | `/api/icons/upload` | Upload an SVG file via `multipart/form-data` |
| `POST` | `/api/icons/upload/svg-string` | Upload an SVG as inline string via JSON body |

#### `GET /api/icons` — Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | `""` | Search query (matches `name` and `tags`, case-insensitive regex) |
| `category` | string | `"All"` | Filter by category; `"All"` returns all |
| `page` | number | `1` | Page number (1-indexed) |
| `limit` | number | `12` | Icons per page (clamped 1–50) |

#### `GET /api/icons` — Response Shape

```json
{
  "icons": [
    {
      "id": "docker",
      "name": "Docker",
      "category": "Containers",
      "tags": ["docker", "container", "service"],
      "svgUrl": "https://...",
      "svgUrlExpiry": "2026-05-31T08:00:00.000Z",
      "createdAt": "2026-05-30T10:00:00.000Z",
      "updatedAt": "2026-05-30T10:00:00.000Z"
    }
  ],
  "total": 32,
  "page": 1,
  "pages": 3,
  "perPage": 12
}
```

#### `POST /api/icons/upload` — Form Fields

| Field | Required | Description |
|---|---|---|
| `file` | ✓ | SVG file (multipart, max 2 MB) |
| `name` | ✓ | Display name |
| `category` | ✓ | Category string |
| `tags` | ✗ | Comma-separated tags |

#### `POST /api/icons/upload/svg-string` — JSON Body

```json
{
  "id": "my-icon",
  "name": "My Icon",
  "category": "Custom",
  "tags": ["custom"],
  "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
}
```

### Admin UI

| Path | Description |
|---|---|
| `GET /admin` | Server-rendered admin panel (query: `q`, `category`, `page`) |
| `GET /upload.html` | 301 redirect → `/admin` |

---

## Database Design

### Collection: `icons`

MongoDB database: `icons-db`. Managed by Mongoose.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | String | ✓ | Unique slug (e.g. `"docker"`, `"load-balancer"`) |
| `name` | String | ✓ | Display name (e.g. `"Docker"`) |
| `category` | String | ✓ | Category group (e.g. `"Containers"`) |
| `tags` | [String] | — | Search tags (default `[]`) |
| `s3Key` | String | ✓ | Object key in the bucket (e.g. `"icons/docker.svg"`) |
| `s3Bucket` | String | ✓ | Bucket name at time of upload |
| `svgUrl` | String | — | Cached presigned URL (nullable) |
| `svgUrlExpiry` | Date | — | Expiry timestamp for the cached URL |
| `createdAt` | Date | — | Auto-managed by Mongoose `timestamps` |
| `updatedAt` | Date | — | Auto-managed by Mongoose `timestamps` |

#### Indexes

```js
iconSchema.index({ category: 1 })
iconSchema.index({ tags: 1 })
iconSchema.index({ name: 'text', tags: 'text' })   // full-text search
```

#### Presigned URL Cache Strategy

On any `GET` that returns icon data, if `svgUrlExpiry` is within **5 minutes** of expiry (or is missing), the server:
1. Calls `getSignedUrl()` to generate a fresh URL.
2. Updates `svgUrl` and `svgUrlExpiry` in MongoDB.
3. Returns the fresh URL in the response.

This prevents clients from receiving stale URLs without needing a background cron job.

---

## Deployment

### Local Development

```bash
# Start MongoDB + MinIO
docker compose -f docker-compose.infra.yml up -d

# Backend (dev mode)
cd backend && npm run dev

# Frontend (dev mode)
cd app && pnpm dev
```

### Production (AWS S3)

1. Set `USE_S3=true` in the backend environment.
2. Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`.
3. Remove `MINIO_*` variables.
4. Run `npm run seed` once to populate the S3 bucket.

### Containerised Backend

```bash
cd backend
docker build -t excelidraw-backend .
docker run -p 3001:3001 --env-file .env excelidraw-backend
```

The Dockerfile uses `node:22-alpine3.23`, installs production deps only, creates a non-root `nodejs` user (UID 1001), and runs `npm start`.

### Containerised Frontend

```bash
cd app
docker build -t excelidraw-app .
docker run -p 80:80 excelidraw-app
```

Multi-stage build:
1. **Stage 1 (build):** `node:22-alpine3.23` — `npm install` + `npm run build` → produces `dist/`.
2. **Stage 2 (serve):** `nginx:alpine` — copies `dist/` to `/usr/share/nginx/html`.

### MinIO Web Console (Local Dev)

`http://localhost:9001` — credentials: `minioadmin / minioadmin`

---

## Security

| Control | Implementation |
|---|---|
| HTTP security headers | `helmet` globally applied; `contentSecurityPolicy: false` to allow SVG inline rendering; `crossOriginResourcePolicy: { policy: 'cross-origin' }` for cross-origin SVG fetching |
| CORS | `cors({ origin: '*' })` — restrict to specific origins in production |
| SVG validation | Multer rejects non-SVG MIME types and non-`.svg` filenames; file size capped at 2 MB |
| Non-root container | Backend Docker image drops privileges to `nodejs` user (UID 1001) before `CMD` |
| Presigned URL expiry | All SVG URLs expire in `SIGNED_URL_EXPIRY` seconds; cached URLs auto-refreshed by the server |
| No client-side secrets | All S3 operations are proxied through the backend; AWS/MinIO credentials never reach the browser |
| Duplicate ID protection | `id` field has `unique: true` index; duplicate uploads return `409 Conflict` |
| Regex input sanitisation | Search query is escaped before use in MongoDB regex (`replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`) |

---

## Future Improvements

- **Admin authentication** — The admin panel currently has no access control; add basic auth or a bearer token check for production.
- **Vite proxy for backend** — Replace the hardcoded `http://localhost:3001` in `AssetLibraryPanel.tsx` with a Vite dev-server proxy to eliminate CORS configuration.
- **Icon update endpoint** — Allow patching `name`, `category`, and `tags` without re-uploading the SVG.
- **More code languages** — Extend `codeToSvg.ts` tokenizer to support TypeScript, Python, SQL, YAML, Bash in the Monaco modal.
- **Schema builder — multi-table** — Let users add multiple tables and draw FK relationship lines between them.
- **Canvas export** — Wire up Excalidraw's built-in PNG/SVG/JSON export actions to a toolbar button.
- **Icon pack hot-reload** — Watch the `icons/` directory for changes and re-seed automatically in dev.
- **Pagination ellipsis** — Add `…` for large page counts in both the admin panel and asset library.
