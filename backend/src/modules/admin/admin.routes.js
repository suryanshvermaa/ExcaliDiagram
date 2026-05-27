'use strict'
const { Router } = require('express')
const ctrl       = require('./admin.controller')

const router = Router()
router.get('/', ctrl.renderAdmin)

module.exports = router
