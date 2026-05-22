'use strict'
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
