'use strict'
/**
 * Import many icons from Iconify collections into backend/techIcons.
 *
 * Goals:
 * - Grow the techIcons library to 2000+ icons.
 * - Keep the existing Excalidraw 96x96 square-tile style.
 * - Avoid id collisions by prefixing ids as `${prefix}--${icon}`.
 * - Be resumable: skips existing svg files unless --force.
 * - Preserve existing techIcons/_metadata.json entries.
 *
 * Sources:
 * - Iconify API
 *   - Collections index: https://api.iconify.design/collections
 *   - Collection icon list: https://api.iconify.design/collection?prefix=<prefix>
 *   - SVG endpoint: https://api.iconify.design/<prefix>/<icon>.svg
 *
 * Usage examples:
 *   node scripts/importIconifyPacks.js --prefix gcp --category Cloud
 *   node scripts/importIconifyPacks.js --prefix gcp --prefix carbon --limit 800
 *   node scripts/importIconifyPacks.js --config scripts/iconify.packs.json
 *
 * Options:
 *   --prefix <name>       Repeatable. Iconify collection prefix.
 *   --category <name>     Default category to apply to imported icons.
 *   --limit <n>           Max icons per prefix (default: all).
 *   --include <regex>     Only import icons whose name matches.
 *   --exclude <regex>     Skip icons whose name matches.
 *   --force               Overwrite existing SVG files.
 *   --dry-run             Do not download/write SVGs; only prints what would happen.
 *   --concurrency <n>     Parallel downloads (default: 12).
 *   --config <path>       JSON config file to import multiple packs.
 */

const fs = require('fs')
const path = require('path')

const ICONS_DIR = path.resolve(__dirname, '..', 'techIcons')
fs.mkdirSync(ICONS_DIR, { recursive: true })

const META_PATH = path.join(ICONS_DIR, '_metadata.json')
const SOURCES_PATH = path.join(ICONS_DIR, '_sources.json')

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function parseArgv(argv) {
  const out = {
    prefixes: [],
    category: null,
    limit: null,
    include: null,
    exclude: null,
    force: false,
    dryRun: false,
    concurrency: 12,
    config: null,
  }

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--prefix') out.prefixes.push(String(argv[++i] || ''))
    else if (a === '--category') out.category = String(argv[++i] || '')
    else if (a === '--limit') out.limit = Number.parseInt(String(argv[++i] || ''), 10)
    else if (a === '--include') out.include = String(argv[++i] || '')
    else if (a === '--exclude') out.exclude = String(argv[++i] || '')
    else if (a === '--force') out.force = true
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--concurrency') out.concurrency = Number.parseInt(String(argv[++i] || ''), 10)
    else if (a === '--config') out.config = String(argv[++i] || '')
  }

  out.prefixes = out.prefixes.filter(Boolean)
  out.concurrency = clamp(Number.isFinite(out.concurrency) ? out.concurrency : 12, 1, 32)
  if (!Number.isFinite(out.limit)) out.limit = null
  return out
}

function safeIdPart(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function humanize(name) {
  const s = String(name)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
  return s
}

function shortLabel(name, maxLen = 12) {
  const h = humanize(name)
  return h.length > maxLen ? h.slice(0, maxLen) : h
}

function loadJsonIfExists(p, fallback) {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    // ignore
  }
  return fallback
}

const base = (label, innerHtml, tx, ty, scale, accent = '#495057') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="100%" height="100%">` +
  `<rect width="96" height="96" rx="18" fill="#f8f9fa"/>` +
  `<rect x="8" y="8" width="80" height="80" rx="14" fill="#ffffff" stroke="#ced4da" stroke-width="2"/>` +
  `<g transform="translate(${tx}, ${ty}) scale(${scale})">` +
  innerHtml +
  `</g>` +
  `<text x="48" y="82" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="10" font-weight="700" fill="${accent}">${label}</text>` +
  `</svg>`

function processSvg(svgText, iconColor) {
  if (iconColor) svgText = svgText.replace(/currentColor/g, iconColor)

  const match = svgText.match(/viewBox="([^"]+)"/i)
  let vbW = 128, vbH = 128
  if (match) {
    const parts = match[1].trim().split(/[\s,]+/)
    if (parts.length >= 4) {
      vbW = parseFloat(parts[2])
      vbH = parseFloat(parts[3])
    }
  }

  const targetSize = 52
  const scaleX = targetSize / vbW
  const scaleY = targetSize / vbH
  const scale = Math.min(scaleX, scaleY)

  const actualW = vbW * scale
  const actualH = vbH * scale

  const tx = 48 - (actualW / 2)
  const ty = 42 - (actualH / 2)

  const innerHtmlMatch = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
  if (!innerHtmlMatch) return null
  const innerHtml = innerHtmlMatch[1]

  return { tx, ty, scale, innerHtml }
}

async function fetchJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`)
  return r.json()
}

async function fetchText(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`)
  return r.text()
}

function extractIconNames(collectionJson) {
  if (!collectionJson || typeof collectionJson !== 'object') return []
  const out = []

  if (Array.isArray(collectionJson.uncategorized)) {
    out.push(...collectionJson.uncategorized)
  }

  const categories = collectionJson.categories
  if (categories && typeof categories === 'object') {
    for (const v of Object.values(categories)) {
      if (Array.isArray(v)) out.push(...v)
    }
  }

  // De-dupe while preserving order
  const seen = new Set()
  const unique = []
  for (const name of out) {
    const s = String(name)
    if (!s || seen.has(s)) continue
    seen.add(s)
    unique.push(s)
  }
  return unique
}

async function pool(items, concurrency, worker) {
  const queue = items.slice()
  let active = 0
  let done = 0
  let errors = 0

  return new Promise((resolve) => {
    const next = () => {
      while (active < concurrency && queue.length > 0) {
        const item = queue.shift()
        active++
        Promise.resolve()
          .then(() => worker(item))
          .catch(() => {
            errors++
          })
          .finally(() => {
            active--
            done++
            if (done >= items.length) resolve({ done, errors })
            else next()
          })
      }
    }
    if (items.length === 0) resolve({ done: 0, errors: 0 })
    else next()
  })
}

async function importPrefix({
  prefix,
  category,
  limit,
  include,
  exclude,
  force,
  dryRun,
  concurrency,
  collectionsIndex,
  metadataMap,
  sourcesMap,
}) {
  const prefixKey = String(prefix).trim()
  if (!prefixKey) return { imported: 0, skipped: 0, errors: 0 }

  const packInfo = collectionsIndex[prefixKey]
  if (!packInfo) {
    console.warn(`⚠️  Unknown Iconify prefix: ${prefixKey} (not found in collections index)`)
    return { imported: 0, skipped: 0, errors: 1 }
  }

  const includeRe = include ? new RegExp(include, 'i') : null
  const excludeRe = exclude ? new RegExp(exclude, 'i') : null

  const col = await fetchJson(`https://api.iconify.design/collection?prefix=${encodeURIComponent(prefixKey)}`)
  const icons = extractIconNames(col)

  let list = icons
  if (includeRe) list = list.filter((n) => includeRe.test(n))
  if (excludeRe) list = list.filter((n) => !excludeRe.test(n))
  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) list = list.slice(0, limit)

  console.log(`\n📦  ${prefixKey}: importing ${list.length}/${icons.length} icons (${packInfo.name || 'unknown'})`)

  let imported = 0
  let skipped = 0
  let errors = 0

  const jobs = list.map((iconName) => ({ iconName }))

  await pool(jobs, concurrency, async ({ iconName }) => {
    const id = `${safeIdPart(prefixKey)}--${safeIdPart(iconName)}`
    const outPath = path.join(ICONS_DIR, `${id}.svg`)

    if (!force && fs.existsSync(outPath)) {
      skipped++
      return
    }

    if (dryRun) {
      imported++
      return
    }

    const svg = await fetchText(`https://api.iconify.design/${encodeURIComponent(prefixKey)}/${encodeURIComponent(iconName)}.svg`)
    const processed = processSvg(svg, null)
    if (!processed) {
      errors++
      return
    }

    const label = shortLabel(iconName)
    const accent = '#495057'
    const finalSvg = base(label, processed.innerHtml, processed.tx, processed.ty, processed.scale, accent)
    fs.writeFileSync(outPath, finalSvg, 'utf8')

    if (!metadataMap[id]) {
      metadataMap[id] = {
        name: label,
        category: category || packInfo.category || 'Technology',
        tags: Array.from(
          new Set([
            String(category || packInfo.category || 'technology').toLowerCase(),
            safeIdPart(prefixKey),
            safeIdPart(iconName),
          ])
        ),
      }
    }

    sourcesMap[id] = {
      source: 'iconify',
      prefix: prefixKey,
      icon: iconName,
      pack: {
        name: packInfo.name,
        author: packInfo.author,
        license: packInfo.license,
        url: packInfo.url,
      },
    }

    imported++
    if ((imported + skipped + errors) % 50 === 0) {
      process.stdout.write(`\r   progress: ${imported} imported, ${skipped} skipped, ${errors} errors...`)
    }
  })

  console.log(`\n✅  ${prefixKey} done: ${imported} imported, ${skipped} skipped, ${errors} errors`)
  return { imported, skipped, errors }
}

async function main() {
  const args = parseArgv(process.argv)

  const config = args.config
    ? loadJsonIfExists(path.resolve(__dirname, '..', args.config), null) ||
      loadJsonIfExists(path.resolve(__dirname, args.config), null)
    : null

  const jobs = []
  if (config && Array.isArray(config.packs)) {
    for (const p of config.packs) {
      if (!p || typeof p !== 'object') continue
      jobs.push({
        prefix: p.prefix,
        category: p.category ?? null,
        limit: typeof p.limit === 'number' ? p.limit : null,
        include: p.include ?? null,
        exclude: p.exclude ?? null,
      })
    }
  }

  if (args.prefixes.length > 0) {
    for (const prefix of args.prefixes) {
      jobs.push({
        prefix,
        category: args.category,
        limit: args.limit,
        include: args.include,
        exclude: args.exclude,
      })
    }
  }

  if (jobs.length === 0) {
    console.log('No packs specified. Use --prefix <name> or --config <file>.')
    process.exit(1)
  }

  const collectionsIndex = await fetchJson('https://api.iconify.design/collections')

  const metadataMap = loadJsonIfExists(META_PATH, {})
  const sourcesMap = loadJsonIfExists(SOURCES_PATH, {})

  let totals = { imported: 0, skipped: 0, errors: 0 }

  for (const job of jobs) {
    const res = await importPrefix({
      prefix: job.prefix,
      category: job.category,
      limit: job.limit,
      include: job.include,
      exclude: job.exclude,
      force: args.force,
      dryRun: args.dryRun,
      concurrency: args.concurrency,
      collectionsIndex,
      metadataMap,
      sourcesMap,
    })

    totals.imported += res.imported
    totals.skipped += res.skipped
    totals.errors += res.errors
  }

  if (!args.dryRun) {
    fs.writeFileSync(META_PATH, JSON.stringify(metadataMap, null, 2), 'utf8')
    fs.writeFileSync(SOURCES_PATH, JSON.stringify(sourcesMap, null, 2), 'utf8')
  }

  const svgFiles = fs.readdirSync(ICONS_DIR).filter((f) => f.endsWith('.svg'))
  console.log('\n─────────────────────────────────────────')
  console.log(`Imported: ${totals.imported} | Skipped: ${totals.skipped} | Errors: ${totals.errors}`)
  console.log(`techIcons SVG count: ${svgFiles.length}`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
