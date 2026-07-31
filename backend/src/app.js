'use strict'
const express = require('express')
const cors    = require('cors')
const helmet  = require('helmet')
const path    = require('path')
const cfg     = require('./config/env')
const logger  = require('./utils/logger')

const app = express()

// ── View engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// ── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
  origin:         '*',
  allowedHeaders: ['Content-Type', 'Authorization', 'x-ai-api-key'],
  exposedHeaders: ['x-ai-api-key'],
}))

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(logger)

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '4mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Static (admin JS) ─────────────────────────────────────────────────────────
app.use('/static', express.static(path.join(__dirname, 'static')))

// ── Desktop mode: serve SVG files from local filesystem ───────────────────────
if (process.env.DESKTOP_MODE === 'true') {
  const { storageRoot, setBaseUrl } = require('./config/localFs')
  const PORT = parseInt(process.env.PORT || '3001', 10)
  setBaseUrl(`http://localhost:${PORT}`)
  app.use('/icons-static', express.static(storageRoot, {
    setHeaders: (res) => {
      res.setHeader('Content-Type', 'image/svg+xml')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.setHeader('Access-Control-Allow-Origin', '*')
    },
  }))
}

// ── Admin UI (EJS page — not an API) ─────────────────────────────────────────
app.use('/admin', require('./modules/admin/admin.routes'))
app.get('/upload.html', (_req, res) => res.redirect(301, '/admin'))

// ── API routes (all modules) ──────────────────────────────────────────────────
app.use('/api', require('./routes'))


// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const Icon  = require('./modules/icons/icon.model')
  const count = await Icon.countDocuments().catch(() => -1)
  const storage = process.env.DESKTOP_MODE === 'true'
    ? 'local-fs'
    : (cfg.storage.useS3 ? 'aws-s3' : 'minio')
  res.json({ ok: true, icons: count, storage })
})

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

module.exports = app
