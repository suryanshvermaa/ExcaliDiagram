'use strict'
const Icon = require('./icon.model')
const s3   = require('./icon.service')
const cfg  = require('../../config/env')

async function uploadIcon(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    if (!req.file.mimetype.includes('svg') && !req.file.originalname.endsWith('.svg'))
      return res.status(400).json({ error: 'Only SVG files are accepted' })
    const { name, category, tags = '' } = req.body
    if (!name)     return res.status(400).json({ error: '`name` is required' })
    if (!category) return res.status(400).json({ error: '`category` is required' })
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (await Icon.findOne({ id }))
      return res.status(409).json({ error: `Icon "${id}" already exists` })
    const key    = s3.iconKey(id)
    await s3.uploadSvg(key, req.file.buffer)
    const now       = Date.now()
    const svgUrl    = await s3.getPresignedUrl(key)
    const svgExpiry = new Date(now + cfg.storage.signedUrlExpiry * 1000)
    const icon = await Icon.create({ id, name, category, tags: tags.split(',').map(t => t.trim()).filter(Boolean), s3Key: key, s3Bucket: cfg.storage.bucket, svgUrl, svgUrlExpiry: svgExpiry })
    res.status(201).json({ ok: true, icon: { id: icon.id, name: icon.name, category: icon.category, tags: icon.tags, svgUrl: icon.svgUrl } })
  } catch (err) { console.error(err); res.status(500).json({ error: err.message || 'Upload failed' }) }
}

async function uploadIconFromString(req, res) {
  try {
    const { id, name, category, tags = [], svg } = req.body
    if (!id || !name || !svg) return res.status(400).json({ error: '`id`, `name`, `svg` are required' })
    if (await Icon.findOne({ id })) return res.status(409).json({ error: `Icon "${id}" already exists` })
    const key    = s3.iconKey(id)
    await s3.uploadSvg(key, svg)
    const now       = Date.now()
    const svgUrl    = await s3.getPresignedUrl(key)
    const svgExpiry = new Date(now + cfg.storage.signedUrlExpiry * 1000)
    const icon = await Icon.create({ id, name, category, tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean), s3Key: key, s3Bucket: cfg.storage.bucket, svgUrl, svgUrlExpiry: svgExpiry })
    res.status(201).json({ ok: true, icon })
  } catch (err) { console.error(err); res.status(500).json({ error: err.message || 'Upload failed' }) }
}

module.exports = { uploadIcon, uploadIconFromString }
