'use strict'
/**
 * Local filesystem storage — replaces MinIO / AWS S3 for the desktop build.
 *
 * SVG files are stored in:
 *   <USERDATA_PATH>/icons/<key>
 *
 * Instead of presigned URLs we serve files directly via Express static:
 *   GET /icons-static/<key>  →  the SVG file
 *
 * The `getPresignedUrl` shim returns that local URL so all existing
 * controller code that calls s3.getPresignedUrl() works unchanged.
 */

const fs   = require('fs')
const path = require('path')

// Root directory for all stored SVG files.
// Set by Electron main process via USERDATA_PATH env var.
const storageRoot = process.env.USERDATA_PATH
  ? path.join(process.env.USERDATA_PATH, 'icons')
  : path.join(__dirname, '..', '..', '..', '.local-icons')

// Express static-serve base URL — backend sets this after it knows its port.
let _baseUrl = `http://localhost:${process.env.PORT || 3001}`

function setBaseUrl(url) {
  _baseUrl = url.replace(/\/$/, '')
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// ── API surface (mirrors icon.service.js expectations) ────────────────────────

async function ensureBucket() {
  ensureDir(storageRoot)
  console.log(`📁  Local storage  →  ${storageRoot}`)
}

async function uploadSvg(key, svgContent) {
  const dest = path.join(storageRoot, key)
  ensureDir(path.dirname(dest))
  const buf = Buffer.isBuffer(svgContent) ? svgContent : Buffer.from(svgContent, 'utf8')
  fs.writeFileSync(dest, buf)
  return key
}

/**
 * Returns a permanent local HTTP URL instead of a time-limited presigned URL.
 * The URL never expires so svgUrlExpiry is set far in the future.
 */
async function getPresignedUrl(key) {
  return `${_baseUrl}/icons-static/${key}`
}

async function getSvgContent(key) {
  const src = path.join(storageRoot, key)
  return fs.readFileSync(src, 'utf8')
}

async function deleteObject(key) {
  const src = path.join(storageRoot, key)
  if (fs.existsSync(src)) fs.unlinkSync(src)
}

async function objectExists(key) {
  return fs.existsSync(path.join(storageRoot, key))
}

function iconKey(id) {
  return `icons/${id}.svg`
}

module.exports = {
  storageRoot,
  setBaseUrl,
  ensureBucket,
  uploadSvg,
  getPresignedUrl,
  getSvgContent,
  deleteObject,
  objectExists,
  iconKey,
}
