'use strict'
const mongoose = require('mongoose')
const cfg      = require('./env')

let isConnected = false

async function connectDB() {
  if (isConnected) return
  await mongoose.connect(cfg.mongo.uri, {
    serverSelectionTimeoutMS: 5000,
  })
  isConnected = true
  console.log(`✅  MongoDB connected  →  ${cfg.mongo.uri}`)
}

module.exports = { connectDB }
