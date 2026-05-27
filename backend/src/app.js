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
app.use(cors({ origin: '*' }))

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(logger)

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '4mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Static (admin JS) ─────────────────────────────────────────────────────────
app.use('/static', express.static(path.join(__dirname, 'static')))

// ── Admin UI (EJS page — not an API) ─────────────────────────────────────────
app.use('/admin', require('./modules/admin/admin.routes'))
app.get('/upload.html', (_req, res) => res.redirect(301, '/admin'))

// ── API routes (all modules) ──────────────────────────────────────────────────
app.use('/api', require('./routes'))


// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const Icon  = require('./modules/icons/icon.model')
  const count = await Icon.countDocuments().catch(() => -1)
  res.json({ ok: true, icons: count, storage: cfg.storage.useS3 ? 'aws-s3' : 'minio' })
})

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

module.exports = app
