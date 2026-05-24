'use strict'
const morgan  = require('morgan')
const cfg     = require('../config/env')

/**
 * HTTP request logger middleware (morgan).
 * Use as:  app.use(logger)
 */
const logger = morgan(cfg.nodeEnv === 'production' ? 'combined' : 'dev')

module.exports = logger
