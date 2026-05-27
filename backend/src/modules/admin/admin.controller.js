'use strict'
const Icon = require('../icons/icon.model')
const s3   = require('../icons/icon.service')
const cfg  = require('../../config/env')

const PAGE_SIZE = 24

async function maybeRefreshUrl(icon) {
  const now    = Date.now()
  const expiry = icon.svgUrlExpiry ? new Date(icon.svgUrlExpiry).getTime() : 0
  if (!icon.svgUrl || expiry - now < 5 * 60 * 1000) {
    const freshUrl = await s3.getPresignedUrl(icon.s3Key)
    const freshExp = new Date(now + cfg.storage.signedUrlExpiry * 1000)
    await Icon.updateOne({ _id: icon._id }, { svgUrl: freshUrl, svgUrlExpiry: freshExp })
    return { ...icon, svgUrl: freshUrl, svgUrlExpiry: freshExp }
  }
  return icon
}

async function renderAdmin(req, res) {
  try {
    const page     = Math.max(1, parseInt(req.query.page || '1', 10))
    const q        = (req.query.q || '').trim()
    const category = req.query.category || 'All'
    const cats     = await Icon.distinct('category').catch(() => [])
    const categories = ['All', ...cats.sort()]
    const query = {}
    if (category !== 'All') query.category = category
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.$or = [{ name: { $regex: safe, $options: 'i' } }, { tags: { $regex: safe, $options: 'i' } }]
    }
    const [rawIcons, total] = await Promise.all([
      Icon.find(query).sort({ name: 1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      Icon.countDocuments(query),
    ])
    const icons = await Promise.all(rawIcons.map(maybeRefreshUrl))
    res.render('admin', { categories, icons, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), q, category, storage: cfg.storage.useS3 ? 'AWS S3' : 'MinIO (local)', pageSize: PAGE_SIZE })
  } catch (err) {
    console.error('[admin]', err)
    res.status(500).render('admin', { categories: ['All'], icons: [], total: 0, page: 1, pages: 1, q: '', category: 'All', storage: 'unavailable', pageSize: PAGE_SIZE, error: err.message })
  }
}

module.exports = { renderAdmin }
