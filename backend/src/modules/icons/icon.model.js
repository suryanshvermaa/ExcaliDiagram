'use strict'
/**
 * Icon model — auto-switches between NeDB (desktop) and Mongoose (web/server).
 *
 * Set  DESKTOP_MODE=true  in the environment to use the embedded NeDB backend.
 * Without it, the original Mongoose model is used (no behaviour change for the
 * existing server/Docker workflow).
 */

if (process.env.DESKTOP_MODE === 'true') {
  module.exports = require('./icon.model.nedb')
} else {
  const mongoose = require('mongoose')

  const iconSchema = new mongoose.Schema(
    {
      id:       { type: String, required: true, unique: true, trim: true },
      name:     { type: String, required: true, trim: true },
      category: { type: String, required: true, trim: true },
      tags:     { type: [String], default: [] },

      // S3 / MinIO storage
      s3Key:   { type: String, required: true }, // e.g. "icons/docker.svg"
      s3Bucket:{ type: String, required: true },

      // Signed URL cache (refreshed on GET when expired)
      svgUrl:        { type: String, default: null },
      svgUrlExpiry:  { type: Date,   default: null },
    },
    {
      timestamps: true,       // createdAt + updatedAt
      versionKey: false,
    }
  )

  // Indexes for search + filter
  iconSchema.index({ category: 1 })
  iconSchema.index({ tags:     1 })
  iconSchema.index({ name: 'text', tags: 'text' })

  module.exports = mongoose.model('Icon', iconSchema)
}
