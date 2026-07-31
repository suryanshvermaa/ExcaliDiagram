'use strict'

async function connectDB() {
  if (process.env.DESKTOP_MODE === 'true') {
    // NeDB is file-based and auto-loads — no explicit connect step needed.
    const { getIconsDb } = require('./nedb')
    getIconsDb()  // triggers autoload
    console.log('🗄️   NeDB (embedded) →  ready')
    return
  }

  // Standard Mongoose connection (web/server mode)
  const mongoose = require('mongoose')
  const cfg      = require('./env')
  await mongoose.connect(cfg.mongo.uri, {
    serverSelectionTimeoutMS: 5000,
  })
  console.log(`🗄️   MongoDB  →  ${cfg.mongo.uri}`)
}

module.exports = { connectDB }
