'use strict'
const Icon = require('./icon.model')
const s3   = require('./icon.service')
const cfg  = require('../../config/env')

const PAGE_SIZE = 12

async function freshenUrl(icon) {
  const now    = Date.now()
  const expiry = icon.svgUrlExpiry ? new Date(icon.svgUrlExpiry).getTime() : 0
  if (!icon.svgUrl || expiry - now < 5 * 60 * 1000) {
    icon.svgUrl       = await s3.getPresignedUrl(icon.s3Key)
    icon.svgUrlExpiry = new Date(now + cfg.storage.signedUrlExpiry * 1000)
    await icon.save()
  }
  return icon
}

async function listIcons(req, res) {
  try {
    const { q = '', category = 'All', page = '1', limit = String(PAGE_SIZE) } = req.query
    const perPage     = Math.max(1, Math.min(50, parseInt(limit) || PAGE_SIZE))
    const currentPage = Math.max(1, parseInt(page) || 1)
    const skip        = (currentPage - 1) * perPage
    const query = {}
    if (category !== 'All') query.category = category
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.$or = [{ name: { $regex: safe, $options: 'i' } }, { tags: { $regex: safe, $options: 'i' } }]
    }
    const [icons, total] = await Promise.all([
      Icon.find(query).sort({ name: 1 }).skip(skip).limit(perPage).lean(),
      Icon.countDocuments(query),
    ])
    const refreshed = await Promise.all(icons.map(async icon => {
      const now    = Date.now()
      const expiry = icon.svgUrlExpiry ? new Date(icon.svgUrlExpiry).getTime() : 0
      if (!icon.svgUrl || expiry - now < 5 * 60 * 1000) {
        const freshUrl = await s3.getPresignedUrl(icon.s3Key)
        const freshExp = new Date(now + cfg.storage.signedUrlExpiry * 1000)
        Icon.updateOne({ _id: icon._id }, { svgUrl: freshUrl, svgUrlExpiry: freshExp }).exec()
        return { ...icon, svgUrl: freshUrl }
      }
      return icon
    }))
    res.json({ icons: refreshed.map(serialize), total, page: currentPage, pages: Math.max(1, Math.ceil(total / perPage)), perPage })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to list icons' }) }
}

async function getIcon(req, res) {
  try {
    const icon = await Icon.findOne({ id: req.params.id })
    if (!icon) return res.status(404).json({ error: 'Not found' })
    await freshenUrl(icon)
    res.json(serialize(icon.toObject()))
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to get icon' }) }
}

async function getIconSvg(req, res) {
  try {
    const icon = await Icon.findOne({ id: req.params.id })
    if (!icon) return res.status(404).json({ error: 'Not found' })
    const svg = await s3.getSvgContent(icon.s3Key)
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(svg)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to get SVG' }) }
}

async function listCategories(_req, res) {
  try {
    const cats = await Icon.distinct('category')
    res.json(['All', ...cats.sort()])
  } catch { res.status(500).json({ error: 'Failed to list categories' }) }
}

async function deleteIcon(req, res) {
  try {
    const icon = await Icon.findOne({ id: req.params.id })
    if (!icon) return res.status(404).json({ error: 'Not found' })
    await s3.deleteObject(icon.s3Key)
    await icon.deleteOne()
    res.json({ ok: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to delete icon' }) }
}

async function refreshSignedUrl(req, res) {
  try {
    const icon = await Icon.findOne({ id: req.params.id })
    if (!icon) return res.status(404).json({ error: 'Not found' })
    icon.svgUrl = null; icon.svgUrlExpiry = null
    await freshenUrl(icon)
    res.json({ svgUrl: icon.svgUrl, svgUrlExpiry: icon.svgUrlExpiry })
  } catch { res.status(500).json({ error: 'Failed to refresh URL' }) }
}

function serialize(icon) {
  return { id: icon.id, name: icon.name, category: icon.category, tags: icon.tags, svgUrl: icon.svgUrl, svgUrlExpiry: icon.svgUrlExpiry, createdAt: icon.createdAt, updatedAt: icon.updatedAt }
}

module.exports = { listIcons, getIcon, getIconSvg, listCategories, deleteIcon, refreshSignedUrl }
