'use strict'
const express = require('express')
const cors    = require('cors')
const helmet  = require('helmet')
const logger  = require('./utils/logger')

const app = express()

app.use(helmet())
app.use(cors())
app.use(logger)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api', require('./routes'))

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

module.exports = app
