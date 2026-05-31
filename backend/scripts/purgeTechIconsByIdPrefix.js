'use strict'
/**
 * Purge generated techIcons by id prefix.
 *
 * This removes:
 * - SVG files in backend/techIcons matching `${prefix}*.svg`
 * - corresponding entries in techIcons/_metadata.json and techIcons/_sources.json
 *
 * Usage:
 *   node scripts/purgeTechIconsByIdPrefix.js --prefix carbon--
 *   node scripts/purgeTechIconsByIdPrefix.js --prefix carbon-- --dry-run
 */

const fs = require('fs')
const path = require('path')

const ICONS_DIR = path.resolve(__dirname, '..', 'techIcons')
const META_PATH = path.join(ICONS_DIR, '_metadata.json')
const SOURCES_PATH = path.join(ICONS_DIR, '_sources.json')

const DRY_RUN = process.argv.includes('--dry-run')

function getArg(name) {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return null
  const v = process.argv[idx + 1]
  return v ? String(v) : null
}

function loadJson(p) {
  if (!fs.existsSync(p)) return {}
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function saveJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8')
}

async function main() {
  const prefix = getArg('--prefix')
  if (!prefix) {
    console.error('Missing --prefix <idPrefix>')
    process.exit(1)
  }

  if (!fs.existsSync(ICONS_DIR)) {
    console.error(`techIcons dir not found: ${ICONS_DIR}`)
    process.exit(1)
  }

  const svgFiles = fs.readdirSync(ICONS_DIR).filter((f) => f.endsWith('.svg'))
  const toDelete = svgFiles.filter((f) => f.startsWith(prefix))

  const meta = loadJson(META_PATH)
  const sources = loadJson(SOURCES_PATH)

  const metaKeys = Object.keys(meta).filter((k) => k.startsWith(prefix.replace(/\.svg$/i, '')))
  const sourceKeys = Object.keys(sources).filter((k) => k.startsWith(prefix.replace(/\.svg$/i, '')))

  console.log(`Found ${toDelete.length} SVGs to delete with prefix '${prefix}'`)
  console.log(`Found ${metaKeys.length} metadata entries to delete`)
  console.log(`Found ${sourceKeys.length} source entries to delete`)

  if (DRY_RUN) {
    console.log('DRY RUN: no changes made.')
    return
  }

  for (const f of toDelete) {
    fs.unlinkSync(path.join(ICONS_DIR, f))
  }

  for (const k of metaKeys) delete meta[k]
  for (const k of sourceKeys) delete sources[k]

  saveJson(META_PATH, meta)
  saveJson(SOURCES_PATH, sources)

  const left = fs.readdirSync(ICONS_DIR).filter((f) => f.endsWith('.svg')).length
  console.log(`Done. Remaining SVG count: ${left}`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
