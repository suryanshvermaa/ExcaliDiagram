'use strict'
require('dotenv').config()

const app              = require('./src/app')
const { connectDB }    = require('./src/config/db')
const { ensureBucket } = require('./src/modules/icons/icon.service')
const cfg              = require('./src/config/env')

async function main() {
  await connectDB()
  await ensureBucket()

  app.listen(cfg.port, '0.0.0.0', () => {
    console.log(`\n🚀  Backend  →  http://localhost:${cfg.port}`)
    console.log(`📦  Storage  →  ${cfg.storage.useS3 ? 'AWS S3' : 'MinIO'} / bucket: ${cfg.storage.bucket}`)
    console.log(`🗄️   MongoDB  →  ${cfg.mongo.uri}`)
    console.log(`🎛️   Admin UI →  http://localhost:${cfg.port}/admin\n`)
  })
}

main().catch(err => {
  console.error('❌  Startup failed:', err)
  process.exit(1)
})
