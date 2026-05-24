'use strict'
const { Router } = require('express')

const router = Router()

// ── Icon API ──────────────────────────────────────────────────────────────────
router.use('/icons', require('../modules/icons/icon.routes'))
router.get('/categories', require('../modules/icons/icon.controller').listCategories)

module.exports = router
