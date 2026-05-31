'use strict'
/**
 * Seed script — uploads all SVGs from /techIcons to S3/MinIO and saves
 * metadata to MongoDB.
 *
 * Usage:
 *   node scripts/seedTechIcons.js             # upload new icons only
 *   node scripts/seedTechIcons.js --dry-run   # validate only, no uploads
 *   node scripts/seedTechIcons.js --force     # re-upload even if icon already exists
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })

const fs   = require('fs')
const path = require('path')

const ICONS_DIR = path.resolve(__dirname, '..', 'techIcons')
const DRY_RUN   = process.argv.includes('--dry-run')
const FORCE     = process.argv.includes('--force')

async function main() {
  if (!fs.existsSync(ICONS_DIR)) {
    console.error(`❌  techIcons/ directory not found: ${ICONS_DIR}`)
    console.error('   Run:  node scripts/generateTechIcons.js  first')
    process.exit(1)
  }

  const metaPath = path.join(ICONS_DIR, '_metadata.json')
  if (!fs.existsSync(metaPath)) {
    console.error(`❌  _metadata.json not found in techIcons/`)
    console.error('   Run:  node scripts/generateTechIcons.js  first')
    process.exit(1)
  }

  const META     = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
  const svgFiles = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.svg'))

  console.log(`\n📂  Found ${svgFiles.length} SVG files in ${ICONS_DIR}`)
  if (DRY_RUN) console.log('🔍  DRY RUN — no changes will be made\n')

  if (!DRY_RUN) {
    const { connectDB }    = require('../src/config/db')
    const { ensureBucket } = require('../src/modules/icons/icon.service')
    await connectDB()
    await ensureBucket()
  }

  const s3   = DRY_RUN ? null : require('../src/modules/icons/icon.service')
  const Icon = DRY_RUN ? null : require('../src/modules/icons/icon.model')
  const cfg  = require('../src/config/env')

  let created = 0, skipped = 0, errors = 0

  for (const file of svgFiles) {
    const id   = path.basename(file, '.svg')
    const meta = META[id]

    if (!meta) {
      console.warn(`  ⚠️  No metadata for ${id} — skipping`)
      skipped++
      continue
    }

    const svgPath = path.join(ICONS_DIR, file)
    const svg     = fs.readFileSync(svgPath, 'utf8')
    const key     = `techIcons/${id}.svg`

    if (DRY_RUN) {
      console.log(`  ✓ [dry] ${id}  →  ${key}`)
      created++
      continue
    }

    try {
      const existing = await Icon.findOne({ id })
      if (existing && !FORCE) {
        console.log(`  ↩  skip  ${id}  (already exists, use --force to overwrite)`)
        skipped++
        continue
      }
      if (existing && FORCE) await existing.deleteOne()

      // Upload to S3/MinIO
      await s3.uploadSvg(key, svg)

      // Generate signed URL
      const now       = Date.now()
      const svgUrl    = await s3.getPresignedUrl(key)
      const svgExpiry = new Date(now + cfg.storage.signedUrlExpiry * 1000)

      await Icon.create({
        id,
        ...meta,
        s3Key:        key,
        s3Bucket:     cfg.storage.bucket,
        svgUrl,
        svgUrlExpiry: svgExpiry,
      })

      console.log(`  ✅  ${id}  →  ${key}`)
      created++
    } catch (err) {
      console.error(`  ❌  ${id}  →  ${err.message}`)
      errors++
    }
  }

  console.log(`\n─────────────────────────────────────────`)
  console.log(`  Created: ${created}  |  Skipped: ${skipped}  |  Errors: ${errors}`)
  if (!DRY_RUN) process.exit(errors > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
