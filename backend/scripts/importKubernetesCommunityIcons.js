'use strict'
/**
 * Import Kubernetes Community icon set (resources/control-plane/infra) into techIcons.
 *
 * Source: https://github.com/kubernetes/community/tree/main/icons
 * License: Apache-2.0 OR CC-BY-4.0 (see upstream README).
 *
 * We import *unlabeled* SVGs and wrap them in the same 96×96 Excalidraw tile.
 *
 * Usage:
 *   node scripts/importKubernetesCommunityIcons.js
 *   node scripts/importKubernetesCommunityIcons.js --force
 *   node scripts/importKubernetesCommunityIcons.js --dry-run
 */

const fs = require('fs')
const path = require('path')

const ICONS_DIR = path.resolve(__dirname, '..', 'techIcons')
fs.mkdirSync(ICONS_DIR, { recursive: true })

const META_PATH = path.join(ICONS_DIR, '_metadata.json')
const SOURCES_PATH = path.join(ICONS_DIR, '_sources.json')

const FORCE = process.argv.includes('--force')
const DRY_RUN = process.argv.includes('--dry-run')

function safeIdPart(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function humanize(s) {
  return String(s)
    .replace(/\.svg$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
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

function processSvg(svgText) {
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
  const r = await fetch(url, { headers: { 'User-Agent': 'techicons-importer' } })
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`)
  return r.json()
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'techicons-importer' } })
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`)
  return r.text()
}

const LABEL_OVERRIDES = {
  'svc': 'Service',
  'ing': 'Ingress',
  'deploy': 'Deploy',
  'ds': 'DaemonSet',
  'sts': 'Stateful',
  'rs': 'ReplicaSet',
  'cm': 'ConfigMap',
  'secret': 'Secret',
  'hpa': 'HPA',
  'pvc': 'PVC',
  'pv': 'PV',
  'sa': 'SvcAcct',
  'ns': 'Namespace',
  'pod': 'Pod',
  'job': 'Job',
  'cronjob': 'CronJob',
  'netpol': 'NetPol',
}

function labelForFileName(fileName) {
  const baseName = String(fileName).replace(/\.svg$/i, '')
  const key = baseName.toLowerCase()
  return LABEL_OVERRIDES[key] || shortLabel(baseName)
}

async function importDir(dirPath, groupIdPrefix, category, tags) {
  const apiUrl = `https://api.github.com/repos/kubernetes/community/contents/${dirPath}`
  const listing = await fetchJson(apiUrl)
  const files = Array.isArray(listing)
    ? listing.filter((x) => x && x.type === 'file' && typeof x.name === 'string' && x.name.endsWith('.svg'))
    : []

  let imported = 0
  let skipped = 0

  for (const f of files) {
    const fileName = f.name
    const iconKey = String(fileName).replace(/\.svg$/i, '')
    const id = `${safeIdPart(groupIdPrefix)}--${safeIdPart(iconKey)}`
    const outPath = path.join(ICONS_DIR, `${id}.svg`)

    if (!FORCE && fs.existsSync(outPath)) {
      skipped++
      continue
    }

    if (DRY_RUN) {
      imported++
      continue
    }

    const svgText = await fetchText(String(f.download_url))
    const processed = processSvg(svgText)
    if (!processed) continue

    const label = labelForFileName(fileName)
    const finalSvg = base(label, processed.innerHtml, processed.tx, processed.ty, processed.scale, '#495057')
    fs.writeFileSync(outPath, finalSvg, 'utf8')

    imported++
  }

  return { imported, skipped, total: files.length, dirPath, groupIdPrefix, category, tags }
}

async function main() {
  const metadataMap = loadJsonIfExists(META_PATH, {})
  const sourcesMap = loadJsonIfExists(SOURCES_PATH, {})

  const groups = [
    {
      dirPath: 'icons/svg/resources/unlabeled',
      idPrefix: 'k8s-res',
      category: 'Kubernetes',
      tags: ['kubernetes', 'resource'],
    },
    {
      // Control plane currently provides labeled only in upstream.
      dirPath: 'icons/svg/control_plane_components/labeled',
      idPrefix: 'k8s-cp',
      category: 'Kubernetes',
      tags: ['kubernetes', 'control-plane'],
    },
    {
      dirPath: 'icons/svg/infrastructure_components/unlabeled',
      idPrefix: 'k8s-infra',
      category: 'Kubernetes',
      tags: ['kubernetes', 'infrastructure'],
    },
  ]

  const results = []
  for (const g of groups) {
    console.log(`\n📦 Importing Kubernetes icon group: ${g.dirPath}`)
    try {
      results.push(await importDir(g.dirPath, g.idPrefix, g.category, g.tags))
    } catch (e) {
      console.warn(`⚠️  Skip group (failed to fetch): ${g.dirPath}`)
      console.warn(String(e && e.message ? e.message : e))
    }
  }

  let addedMeta = 0
  for (const r of results) {
    // Update metadata/sources based on files that now exist on disk
    const dirLabel = r.groupIdPrefix
    const dirFiles = fs
      .readdirSync(ICONS_DIR)
      .filter((n) => n.startsWith(`${safeIdPart(dirLabel)}--`) && n.endsWith('.svg'))

    for (const file of dirFiles) {
      const id = file.replace(/\.svg$/i, '')
      if (!metadataMap[id]) {
        const iconKey = id.split('--').slice(1).join('--')
        metadataMap[id] = {
          name: labelForFileName(iconKey),
          category: r.category,
          tags: Array.from(new Set([...r.tags, iconKey])),
        }
        addedMeta++
      }

      sourcesMap[id] = {
        source: 'github',
        repo: 'kubernetes/community',
        path: r.dirPath,
        license: {
          note: 'Upstream states Apache-2.0 OR CC-BY-4.0; see kubernetes/community/icons README',
          url: 'https://github.com/kubernetes/community/tree/main/icons#license',
        },
      }
    }
  }

  if (!DRY_RUN) {
    fs.writeFileSync(META_PATH, JSON.stringify(metadataMap, null, 2), 'utf8')
    fs.writeFileSync(SOURCES_PATH, JSON.stringify(sourcesMap, null, 2), 'utf8')
  }

  const svgFiles = fs.readdirSync(ICONS_DIR).filter((f) => f.endsWith('.svg'))
  const totalImported = results.reduce((a, x) => a + x.imported, 0)
  const totalSkipped = results.reduce((a, x) => a + x.skipped, 0)

  console.log('\n─────────────────────────────────────────')
  console.log(`Imported: ${totalImported} | Skipped: ${totalSkipped} | New metadata: ${addedMeta}`)
  console.log(`techIcons SVG count: ${svgFiles.length}`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
