'use strict'
/**
 * Seed script — uploads all SVGs from /icons to S3/MinIO and saves
 * metadata to MongoDB.
 *
 * Usage:
 *   node scripts/seed.js            # full run
 *   node scripts/seed.js --dry-run  # validate only, no uploads
 *   node scripts/seed.js --force    # re-upload even if icon already exists
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })

const fs   = require('fs')
const path = require('path')

const ICONS_DIR = path.resolve(__dirname, '..', 'icons')
const DRY_RUN   = process.argv.includes('--dry-run')
const FORCE     = process.argv.includes('--force')

// Icon metadata: id → { name, category, tags }
const META = {
  'docker':        { name: 'Docker',           category: 'Containers', tags: ['docker','container','service'] },
  'kubernetes':    { name: 'Kubernetes',        category: 'Containers', tags: ['k8s','cluster','orchestration'] },
  'helm':          { name: 'Helm Chart',        category: 'Containers', tags: ['helm','chart','k8s'] },
  'compose':       { name: 'Docker Compose',    category: 'Containers', tags: ['compose','multi','service'] },
  'web-client':    { name: 'Web Client',        category: 'Web',        tags: ['browser','frontend','client'] },
  'cdn':           { name: 'CDN',               category: 'Web',        tags: ['cdn','cache','edge'] },
  'nginx':         { name: 'Nginx',             category: 'Web',        tags: ['nginx','proxy','web-server'] },
  'load-balancer': { name: 'Load Balancer',     category: 'Web',        tags: ['lb','haproxy','traffic'] },
  'react':         { name: 'React',             category: 'Web',        tags: ['react','frontend','spa'] },
  'api-service':   { name: 'API Service',       category: 'Backend',    tags: ['api','rest','backend'] },
  'grpc':          { name: 'gRPC',              category: 'Backend',    tags: ['grpc','protobuf','rpc'] },
  'graphql':       { name: 'GraphQL',           category: 'Backend',    tags: ['graphql','api','query'] },
  'gateway':       { name: 'API Gateway',       category: 'Backend',    tags: ['gateway','ingress','api'] },
  'nodejs':        { name: 'Node.js',           category: 'Backend',    tags: ['node','js','server'] },
  'database':      { name: 'Database',          category: 'Data',       tags: ['db','sql','postgres'] },
  'redis':         { name: 'Redis',             category: 'Data',       tags: ['redis','cache','memory'] },
  'mongodb':       { name: 'MongoDB',           category: 'Data',       tags: ['mongo','nosql','document'] },
  'elasticsearch': { name: 'Elasticsearch',     category: 'Data',       tags: ['elastic','search','logs'] },
  's3':            { name: 'Object Storage',    category: 'Data',       tags: ['s3','blob','storage'] },
  'kafka':         { name: 'Kafka',             category: 'Messaging',  tags: ['kafka','queue','event'] },
  'rabbitmq':      { name: 'RabbitMQ',          category: 'Messaging',  tags: ['rabbit','amqp','queue'] },
  'websocket':     { name: 'WebSocket',         category: 'Messaging',  tags: ['ws','realtime','socket'] },
  'cloud':         { name: 'Cloud',             category: 'Cloud',      tags: ['cloud','aws','azure','gcp'] },
  'lambda':        { name: 'Lambda / FaaS',     category: 'Cloud',      tags: ['lambda','serverless','function'] },
  'vm':            { name: 'Virtual Machine',   category: 'Cloud',      tags: ['vm','ec2','compute'] },
  'dns':           { name: 'DNS',               category: 'Cloud',      tags: ['dns','domain','network'] },
  'github':        { name: 'GitHub',            category: 'DevOps',     tags: ['git','vcs','ci'] },
  'cicd':          { name: 'CI/CD Pipeline',    category: 'DevOps',     tags: ['ci','cd','pipeline','deploy'] },
  'terraform':     { name: 'Terraform',         category: 'DevOps',     tags: ['terraform','iac','infra'] },
  'monitor':       { name: 'Monitoring',        category: 'DevOps',     tags: ['grafana','prometheus','metrics'] },
  'auth':          { name: 'Auth / IAM',        category: 'Security',   tags: ['auth','oauth','jwt','login'] },
  'firewall':      { name: 'Firewall / WAF',    category: 'Security',   tags: ['firewall','waf','security'] },
}

async function main() {
  // Check icons directory
  if (!fs.existsSync(ICONS_DIR)) {
    console.error(`❌  icons/ directory not found: ${ICONS_DIR}`)
    console.error('   Run:  node scripts/generateSvgs.js  first')
    process.exit(1)
  }

  const svgFiles = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.svg'))
  console.log(`\n📂  Found ${svgFiles.length} SVG files in ${ICONS_DIR}`)
  if (DRY_RUN) console.log('🔍  DRY RUN — no changes will be made\n')

  if (!DRY_RUN) {
    const { connectDB }    = require('../src/config/db')
    const { ensureBucket } = require('../src/modules/icons/icon.service')
    await connectDB()
    await ensureBucket()
  }

  const s3    = DRY_RUN ? null : require('../src/modules/icons/icon.service')
  const Icon  = DRY_RUN ? null : require('../src/modules/icons/icon.model')
  const cfg   = require('../src/config/env')

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
    const key     = `icons/${id}.svg`

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
      const now        = Date.now()
      const svgUrl     = await s3.getPresignedUrl(key)
      const svgExpiry  = new Date(now + cfg.storage.signedUrlExpiry * 1000)

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
