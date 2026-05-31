'use strict'
/**
 * Fetches 700+ technology SVGs dynamically from multiple sources:
 * 1. Devicon CDN (generic tech, languages, databases)
 * 2. Iconify API (specific AWS, Azure, GCP, K8s, LLMs, Networking, Browsers, Payments)
 * 
 * Formats them into the custom Excalidraw square base style.
 */

const fs = require('fs')
const path = require('path')

const ICONS_DIR = path.resolve(__dirname, '..', 'techIcons')
fs.mkdirSync(ICONS_DIR, { recursive: true })

const base = (label, innerHtml, tx, ty, scale, accent = '#4c6ef5') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="100%" height="100%">` +
  `<rect width="96" height="96" rx="18" fill="#f8f9fa"/>` +
  `<rect x="8" y="8" width="80" height="80" rx="14" fill="#ffffff" stroke="#ced4da" stroke-width="2"/>` +
  `<g transform="translate(${tx}, ${ty}) scale(${scale})">` +
  innerHtml +
  `</g>` +
  `<text x="48" y="82" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="10" font-weight="700" fill="${accent}">${label}</text>` +
  `</svg>`

const EXTRA_ICONS = [
  // AWS Services
  { prefix: 'logos', name: 'aws', label: 'AWS', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-ec2', label: 'EC2', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-s3', label: 'S3', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-rds', label: 'RDS', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-lambda', label: 'Lambda', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-dynamodb', label: 'DynamoDB', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-api-gateway', label: 'API Gateway', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-sns', label: 'SNS', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-sqs', label: 'SQS', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-route53', label: 'Route53', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-iam', label: 'IAM', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-cloudformation', label: 'CloudFormation', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-fargate', label: 'Fargate', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-kms', label: 'KMS', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-glue', label: 'Glue', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-cognito', label: 'Cognito', category: 'Cloud' },
  { prefix: 'logos', name: 'aws-secrets-manager', label: 'Secrets Mgr', category: 'Cloud' },

  // Azure
  { prefix: 'logos', name: 'microsoft-azure', label: 'Azure', category: 'Cloud' },
  { prefix: 'logos', name: 'azure-active-directory', label: 'Azure AD', category: 'Cloud' },
  { prefix: 'logos', name: 'azure-devops', label: 'Azure DevOps', category: 'Cloud' },
  { prefix: 'logos', name: 'azure-functions', label: 'Functions', category: 'Cloud' },

  // GCP
  { prefix: 'logos', name: 'google-cloud', label: 'Google Cloud', category: 'Cloud' },
  { prefix: 'logos', name: 'google-cloud-run', label: 'Cloud Run', category: 'Cloud' },
  { prefix: 'logos', name: 'google-cloud-functions', label: 'Cloud Funcs', category: 'Cloud' },
  { prefix: 'logos', name: 'firebase', label: 'Firebase', category: 'Cloud' },

  // Kubernetes & Containers
  { prefix: 'logos', name: 'kubernetes', label: 'Kubernetes', category: 'Containers' },
  { prefix: 'logos', name: 'helm', label: 'Helm', category: 'Containers' },
  { prefix: 'logos', name: 'docker-icon', label: 'Docker', category: 'Containers' },
  { prefix: 'logos', name: 'argo-icon', label: 'ArgoCD', category: 'DevOps' },
  { prefix: 'logos', name: 'flux', label: 'Flux', category: 'DevOps' },
  { prefix: 'logos', name: 'cilium', label: 'Cilium', category: 'Networking' },
  { prefix: 'logos', name: 'istio', label: 'Istio', category: 'Networking' },
  { prefix: 'logos', name: 'containerd', label: 'Containerd', category: 'Containers' },

  // DevOps & CI/CD
  { prefix: 'logos', name: 'jenkins', label: 'Jenkins', category: 'DevOps' },
  { prefix: 'logos', name: 'gitlab', label: 'GitLab', category: 'DevOps' },
  { prefix: 'logos', name: 'github-actions', label: 'GH Actions', category: 'DevOps' },
  { prefix: 'logos', name: 'terraform-icon', label: 'Terraform', category: 'DevOps' },
  { prefix: 'logos', name: 'ansible', label: 'Ansible', category: 'DevOps' },
  { prefix: 'logos', name: 'puppet', label: 'Puppet', category: 'DevOps' },
  { prefix: 'logos', name: 'chef', label: 'Chef', category: 'DevOps' },
  { prefix: 'logos', name: 'prometheus', label: 'Prometheus', category: 'DevOps' },
  { prefix: 'logos', name: 'grafana', label: 'Grafana', category: 'DevOps' },
  { prefix: 'logos', name: 'datadog', label: 'Datadog', category: 'DevOps' },
  { prefix: 'logos', name: 'new-relic', label: 'New Relic', category: 'DevOps' },

  // Databases
  { prefix: 'logos', name: 'postgresql', label: 'PostgreSQL', category: 'Data' },
  { prefix: 'logos', name: 'mongodb-icon', label: 'MongoDB', category: 'Data' },
  { prefix: 'logos', name: 'elasticsearch', label: 'Elasticsearch', category: 'Data' },
  { prefix: 'logos', name: 'redis', label: 'Redis', category: 'Data' },
  { prefix: 'logos', name: 'mysql', label: 'MySQL', category: 'Data' },
  { prefix: 'logos', name: 'sqlite', label: 'SQLite', category: 'Data' },
  { prefix: 'logos', name: 'cassandra', label: 'Cassandra', category: 'Data' },
  { prefix: 'logos', name: 'mariadb-icon', label: 'MariaDB', category: 'Data' },
  { prefix: 'logos', name: 'couchbase', label: 'Couchbase', category: 'Data' },
  { prefix: 'logos', name: 'neo4j', label: 'Neo4j', category: 'Data' },
  { prefix: 'logos', name: 'influxdb', label: 'InfluxDB', category: 'Data' },
  { prefix: 'logos', name: 'supabase-icon', label: 'Supabase', category: 'Data' },
  { prefix: 'logos', name: 'kafka-icon', label: 'Kafka', category: 'Data' },
  { prefix: 'logos', name: 'rabbitmq-icon', label: 'RabbitMQ', category: 'Data' },

  // Languages & Tech Stacks
  { prefix: 'logos', name: 'c-plusplus', label: 'C++', category: 'Language' },
  { prefix: 'logos', name: 'c', label: 'C', category: 'Language' },
  { prefix: 'logos', name: 'go', label: 'Go', category: 'Language' },
  { prefix: 'logos', name: 'python', label: 'Python', category: 'Language' },
  { prefix: 'logos', name: 'javascript', label: 'JavaScript', category: 'Language' },
  { prefix: 'logos', name: 'rust', label: 'Rust', category: 'Language' },
  { prefix: 'logos', name: 'typescript-icon', label: 'TypeScript', category: 'Language' },
  { prefix: 'logos', name: 'java', label: 'Java', category: 'Language' },
  { prefix: 'logos', name: 'ruby', label: 'Ruby', category: 'Language' },
  { prefix: 'logos', name: 'php', label: 'PHP', category: 'Language' },
  { prefix: 'logos', name: 'swift', label: 'Swift', category: 'Language' },
  { prefix: 'logos', name: 'kotlin', label: 'Kotlin', category: 'Language' },
  { prefix: 'logos', name: 'react', label: 'React', category: 'Framework' },
  { prefix: 'logos', name: 'vue', label: 'Vue', category: 'Framework' },
  { prefix: 'logos', name: 'angular-icon', label: 'Angular', category: 'Framework' },
  { prefix: 'logos', name: 'nodejs-icon', label: 'Node.js', category: 'Framework' },
  { prefix: 'logos', name: 'nextjs-icon', label: 'Next.js', category: 'Framework' },

  // AI & LLMs
  { prefix: 'logos', name: 'openai-icon', label: 'OpenAI', category: 'AI' },
  { prefix: 'logos', name: 'chatgpt-icon', label: 'ChatGPT', category: 'AI' },
  { prefix: 'logos', name: 'google-gemini', label: 'Gemini', category: 'AI' },
  { prefix: 'logos', name: 'hugging-face', label: 'HuggingFace', category: 'AI' },
  { prefix: 'logos', name: 'tensorflow', label: 'TensorFlow', category: 'AI' },
  { prefix: 'logos', name: 'pytorch-icon', label: 'PyTorch', category: 'AI' },
  { prefix: 'logos', name: 'midjourney', label: 'Midjourney', category: 'AI' },

  // Mobile App Dev
  { prefix: 'logos', name: 'flutter', label: 'Flutter', category: 'Mobile' },
  { prefix: 'logos', name: 'apple', label: 'iOS', category: 'Mobile' },
  { prefix: 'logos', name: 'android-icon', label: 'Android', category: 'Mobile' },
  { prefix: 'logos', name: 'capacitorjs-icon', label: 'Capacitor', category: 'Mobile' },
  { prefix: 'logos', name: 'ionic-icon', label: 'Ionic', category: 'Mobile' },

  // Payment Systems
  { prefix: 'logos', name: 'stripe', label: 'Stripe', category: 'Payments' },
  { prefix: 'logos', name: 'paypal', label: 'PayPal', category: 'Payments' },
  { prefix: 'logos', name: 'visa', label: 'Visa', category: 'Payments' },
  { prefix: 'logos', name: 'mastercard', label: 'Mastercard', category: 'Payments' },
  { prefix: 'logos', name: 'apple-pay', label: 'Apple Pay', category: 'Payments' },
  { prefix: 'logos', name: 'google-pay', label: 'Google Pay', category: 'Payments' },

  // Networking, Users, Server, Browser, Monitoring (MDI icons)
  { prefix: 'mdi', name: 'server', label: 'Server', category: 'Infrastructure', fill: '#495057' },
  { prefix: 'mdi', name: 'server-network', label: 'Network Server', category: 'Infrastructure', fill: '#495057' },
  { prefix: 'mdi', name: 'router-network', label: 'Router', category: 'Networking', fill: '#495057' },
  { prefix: 'mdi', name: 'switch', label: 'Switch', category: 'Networking', fill: '#495057' },
  { prefix: 'mdi', name: 'firewall', label: 'Firewall', category: 'Networking', fill: '#e03131' },
  { prefix: 'mdi', name: 'shield-check', label: 'Security', category: 'Networking', fill: '#2b8a3e' },
  { prefix: 'mdi', name: 'account', label: 'User', category: 'Users', fill: '#1c7ed6' },
  { prefix: 'mdi', name: 'account-group', label: 'Users', category: 'Users', fill: '#1c7ed6' },
  { prefix: 'mdi', name: 'database', label: 'Database', category: 'Data', fill: '#495057' },
  { prefix: 'mdi', name: 'cloud', label: 'Cloud', category: 'Cloud', fill: '#1971c2' },
  { prefix: 'mdi', name: 'web', label: 'Web', category: 'Infrastructure', fill: '#495057' },
  { prefix: 'mdi', name: 'monitor-dashboard', label: 'Monitoring', category: 'DevOps', fill: '#495057' },
  { prefix: 'mdi', name: 'chart-line', label: 'Metrics', category: 'DevOps', fill: '#e67700' },
  { prefix: 'mdi', name: 'laptop', label: 'Client', category: 'Infrastructure', fill: '#495057' },
  { prefix: 'mdi', name: 'cellphone', label: 'Mobile Device', category: 'Infrastructure', fill: '#495057' },
  { prefix: 'mdi', name: 'google-chrome', label: 'Chrome', category: 'Browser', fill: '#495057' },
  { prefix: 'mdi', name: 'firefox', label: 'Firefox', category: 'Browser', fill: '#e67700' },
  { prefix: 'mdi', name: 'apple-safari', label: 'Safari', category: 'Browser', fill: '#1c7ed6' }
]

function processSvg(svgText, iconColor) {
  // Replace generic currentColor with the specific fill color
  if (iconColor) {
    svgText = svgText.replace(/currentColor/g, iconColor)
  }

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

async function main() {
  const metadataMap = {}
  let count = 0

  // 1. Fetch Devicon collection (~570 generic icons)
  console.log('Fetching Devicon generic collection...')
  try {
    const res = await fetch('https://raw.githubusercontent.com/devicons/devicon/master/devicon.json')
    const iconsMeta = await res.json()

    for (const meta of iconsMeta) {
      const name = meta.name
      const versions = meta.versions.svg
      if (!versions || versions.length === 0) continue

      let version = versions.includes('original') ? 'original' :
        versions.includes('plain') ? 'plain' : versions[0]

      const svgRes = await fetch(`https://raw.githubusercontent.com/devicons/devicon/master/icons/${name}/${name}-${version}.svg`)
      if (!svgRes.ok) continue

      const processed = processSvg(await svgRes.text(), null)
      if (!processed) continue

      let niceName = name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' ')
      if (niceName.length > 12) niceName = niceName.substring(0, 12)

      const finalSvg = base(niceName, processed.innerHtml, processed.tx, processed.ty, processed.scale, meta.color || '#495057')
      fs.writeFileSync(path.join(ICONS_DIR, `${name}.svg`), finalSvg, 'utf8')

      let category = 'Technology'
      const tags = meta.tags || []
      if (tags.includes('database')) category = 'Data'
      else if (tags.includes('language')) category = 'Language'
      else if (tags.includes('framework')) category = 'Framework'

      metadataMap[name] = { name: niceName, category, tags }
      count++
      process.stdout.write(`\r✅ Generated ${count} tech icons... `)
    }
  } catch (e) { }

  // 2. Fetch specific missing icons from Iconify API (AWS, Azure, Networking, LLMs, Payments)
  console.log('\nFetching specialized Cloud/Networking/LLM icons from Iconify...')
  for (const item of EXTRA_ICONS) {
    try {
      const svgRes = await fetch(`https://api.iconify.design/${item.prefix}/${item.name}.svg`)
      if (!svgRes.ok) continue

      const processed = processSvg(await svgRes.text(), item.fill)
      if (!processed) continue

      const accent = item.fill || '#495057'
      const finalSvg = base(item.label, processed.innerHtml, processed.tx, processed.ty, processed.scale, accent)
      fs.writeFileSync(path.join(ICONS_DIR, `${item.name}.svg`), finalSvg, 'utf8')

      metadataMap[item.name] = { name: item.label, category: item.category, tags: [item.category.toLowerCase(), item.name] }
      count++
      process.stdout.write(`\r✅ Generated ${count} tech icons... `)
    } catch (e) { }
  }

  fs.writeFileSync(path.join(ICONS_DIR, '_metadata.json'), JSON.stringify(metadataMap, null, 2), 'utf8')
  console.log(`\n\n🎉 Successfully gathered ${count} total icons from multiple sources!`)
}

main().catch(console.error)
