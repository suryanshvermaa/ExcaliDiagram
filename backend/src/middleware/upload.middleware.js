'use strict'
const multer = require('multer')

// Store in memory (buffer) — we stream directly to S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 }, // 2 MB max
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'image/svg+xml' || file.originalname.toLowerCase().endsWith('.svg')) {
      cb(null, true)
    } else {
      cb(new Error('Only SVG files are accepted'), false)
    }
  },
})

module.exports = upload
