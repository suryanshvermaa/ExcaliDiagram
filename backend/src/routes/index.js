'use strict'
const { Router } = require('express')

const router = Router()

// ── Icon API ──────────────────────────────────────────────────────────────────
router.use('/icons',    require('../modules/icons/icon.routes'))
router.get('/categories', require('../modules/icons/icon.controller').listCategories)

// ── AI Agent API ──────────────────────────────────────────────────────────────
router.use('/ai-agent', require('../modules/ai-agent/ai-agent.routes'))

module.exports = router
