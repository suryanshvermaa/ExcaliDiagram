'use strict'
/**
 * Generates individual .svg files in the /icons directory
 * from the hardcoded icon catalogue.
 *
 * Usage:  node scripts/generateSvgs.js
 */

const fs   = require('fs')
const path = require('path')

const ICONS_DIR = path.resolve(__dirname, '..', 'icons')
fs.mkdirSync(ICONS_DIR, { recursive: true })

const base = (label, body, accent = '#4c6ef5') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">` +
  `<rect width="96" height="96" rx="18" fill="#f8f9fa"/>` +
  `<rect x="8" y="8" width="80" height="80" rx="14" fill="#ffffff" stroke="#ced4da" stroke-width="2"/>` +
  body +
  `<text x="48" y="82" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="10" font-weight="700" fill="${accent}">${label}</text>` +
  `</svg>`

const ICONS = [
  // Containers
  { id: 'docker',     svg: base('Docker',   '<rect x="25" y="39" width="10" height="9" rx="2" fill="#228be6"/><rect x="37" y="39" width="10" height="9" rx="2" fill="#228be6"/><rect x="49" y="39" width="10" height="9" rx="2" fill="#228be6"/><rect x="31" y="28" width="10" height="9" rx="2" fill="#4dabf7"/><rect x="43" y="28" width="10" height="9" rx="2" fill="#4dabf7"/><path d="M20 51h52c-3 12-12 19-27 19-13 0-21-5-25-19Z" fill="#1864ab"/><path d="M69 43c6 0 8 4 8 8-5 0-8-2-10-6 1-1 1-2 2-2Z" fill="#74c0fc"/>', '#1864ab') },
  { id: 'kubernetes', svg: base('K8s',      '<polygon points="48,18 72,32 72,60 48,74 24,60 24,32" fill="#4263eb"/><circle cx="48" cy="46" r="16" fill="#edf2ff"/><circle cx="48" cy="46" r="5" fill="#4263eb"/><g stroke="#4263eb" stroke-width="3" stroke-linecap="round"><path d="M48 26v12"/><path d="M48 54v12"/><path d="M32 46h12"/><path d="M52 46h12"/><path d="M37 35l8 8"/><path d="M51 49l8 8"/><path d="M59 35l-8 8"/><path d="M45 49l-8 8"/></g>', '#4263eb') },
  { id: 'helm',       svg: base('Helm',     '<circle cx="48" cy="46" r="22" fill="#0f1689" opacity=".9"/><path d="M48 28v36M30 46h36M34 32l28 28M62 32L34 60" stroke="#fff" stroke-width="4" stroke-linecap="round"/>', '#0f1689') },
  { id: 'compose',    svg: base('Compose',  '<rect x="22" y="22" width="20" height="18" rx="4" fill="#4dabf7"/><rect x="22" y="46" width="20" height="18" rx="4" fill="#228be6"/><rect x="54" y="34" width="20" height="18" rx="4" fill="#1864ab"/><path d="M42 31h6l6 7M42 55h6l6-7" stroke="#adb5bd" stroke-width="2" stroke-linecap="round"/>', '#1864ab') },

  // Web
  { id: 'web-client',    svg: base('Web',     '<rect x="22" y="23" width="52" height="40" rx="5" fill="#e7f5ff" stroke="#1971c2" stroke-width="3"/><path d="M22 34h52" stroke="#1971c2" stroke-width="3"/><circle cx="30" cy="29" r="2" fill="#1971c2"/><circle cx="37" cy="29" r="2" fill="#1971c2"/><circle cx="44" cy="29" r="2" fill="#1971c2"/><path d="M34 51h28M39 44h18" stroke="#1971c2" stroke-width="3" stroke-linecap="round"/>', '#1971c2') },
  { id: 'cdn',           svg: base('CDN',     '<circle cx="48" cy="46" r="20" fill="#e7f5ff" stroke="#1971c2" stroke-width="3"/><path d="M28 46h40M48 26v40" stroke="#1971c2" stroke-width="2" stroke-dasharray="4 3"/><path d="M31 34a22 22 0 0 1 34 0M31 58a22 22 0 0 0 34 0" fill="none" stroke="#1971c2" stroke-width="2"/>', '#1971c2') },
  { id: 'nginx',         svg: base('Nginx',   '<polygon points="48,20 70,58 26,58" fill="#009900"/><text x="48" y="52" text-anchor="middle" font-size="14" font-weight="800" fill="#fff">N</text>', '#009900') },
  { id: 'load-balancer', svg: base('LB',      '<circle cx="48" cy="30" r="10" fill="#4dabf7" stroke="#1971c2" stroke-width="2"/><circle cx="28" cy="60" r="8" fill="#e7f5ff" stroke="#1971c2" stroke-width="2"/><circle cx="48" cy="60" r="8" fill="#e7f5ff" stroke="#1971c2" stroke-width="2"/><circle cx="68" cy="60" r="8" fill="#e7f5ff" stroke="#1971c2" stroke-width="2"/><path d="M48 40l-20 12M48 40v12M48 40l20 12" stroke="#1971c2" stroke-width="2"/>', '#1971c2') },
  { id: 'react',         svg: base('React',   '<circle cx="48" cy="46" r="6" fill="#61dafb"/><ellipse cx="48" cy="46" rx="24" ry="9" fill="none" stroke="#61dafb" stroke-width="3"/><ellipse cx="48" cy="46" rx="24" ry="9" fill="none" stroke="#61dafb" stroke-width="3" transform="rotate(60 48 46)"/><ellipse cx="48" cy="46" rx="24" ry="9" fill="none" stroke="#61dafb" stroke-width="3" transform="rotate(120 48 46)"/>', '#0ea5e9') },

  // Backend
  { id: 'api-service', svg: base('API',     '<rect x="23" y="25" width="50" height="44" rx="8" fill="#fff4e6" stroke="#f08c00" stroke-width="3"/><path d="M33 42h30M33 52h22" stroke="#e67700" stroke-width="4" stroke-linecap="round"/><circle cx="35" cy="32" r="3" fill="#f08c00"/>', '#e67700') },
  { id: 'grpc',        svg: base('gRPC',    '<rect x="22" y="30" width="52" height="32" rx="8" fill="#e8f5e9" stroke="#388e3c" stroke-width="3"/><text x="48" y="50" text-anchor="middle" font-size="13" font-weight="700" fill="#388e3c">gRPC</text>', '#388e3c') },
  { id: 'graphql',     svg: base('GraphQL', '<polygon points="48,20 68,32 68,56 48,68 28,56 28,32" fill="none" stroke="#e535ab" stroke-width="3"/><circle cx="48" cy="20" r="5" fill="#e535ab"/><circle cx="68" cy="32" r="5" fill="#e535ab"/><circle cx="68" cy="56" r="5" fill="#e535ab"/><circle cx="48" cy="68" r="5" fill="#e535ab"/><circle cx="28" cy="56" r="5" fill="#e535ab"/><circle cx="28" cy="32" r="5" fill="#e535ab"/><circle cx="48" cy="44" r="7" fill="#e535ab"/>', '#e535ab') },
  { id: 'gateway',     svg: base('Gateway', '<rect x="20" y="35" width="56" height="26" rx="6" fill="#fff0f6" stroke="#c2255c" stroke-width="3"/><path d="M32 48h32M56 42l8 6-8 6" stroke="#c2255c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>', '#c2255c') },
  { id: 'nodejs',      svg: base('Node',    '<path d="M48 20l20 11v22L48 64 28 53V31z" fill="#3c873a"/><text x="48" y="50" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">Node</text>', '#3c873a') },

  // Data
  { id: 'database',      svg: base('DB',    '<ellipse cx="48" cy="29" rx="23" ry="10" fill="#d0ebff" stroke="#1c7ed6" stroke-width="3"/><path d="M25 29v29c0 6 10 10 23 10s23-4 23-10V29" fill="#e7f5ff" stroke="#1c7ed6" stroke-width="3"/><path d="M25 43c0 6 10 10 23 10s23-4 23-10M25 56c0 6 10 10 23 10s23-4 23-10" fill="none" stroke="#1c7ed6" stroke-width="3"/>', '#1c7ed6') },
  { id: 'redis',         svg: base('Redis', '<path d="M48 20 72 32 48 44 24 32 48 20Z" fill="#ffc9c9" stroke="#c92a2a" stroke-width="3"/><path d="M24 43 48 55 72 43M24 54 48 66 72 54" fill="none" stroke="#c92a2a" stroke-width="4" stroke-linejoin="round"/><circle cx="48" cy="32" r="5" fill="#c92a2a"/>', '#c92a2a') },
  { id: 'mongodb',       svg: base('Mongo', '<path d="M48 20c0 0-16 12-16 26 0 9 7 16 16 18 9-2 16-9 16-18 0-14-16-26-16-26z" fill="#00ed64" stroke="#116149" stroke-width="2"/><path d="M48 56v10" stroke="#116149" stroke-width="3" stroke-linecap="round"/>', '#116149') },
  { id: 'elasticsearch', svg: base('ES',    '<circle cx="48" cy="38" r="16" fill="#f9d34a" stroke="#f9d34a"/><circle cx="48" cy="38" r="8" fill="#fff"/><path d="M28 56h40" stroke="#f9d34a" stroke-width="6" stroke-linecap="round"/>', '#dd4141') },
  { id: 's3',            svg: base('S3',    '<rect x="24" y="32" width="48" height="36" rx="6" fill="#fff3bf" stroke="#e67700" stroke-width="3"/><circle cx="36" cy="40" r="5" fill="#e67700"/><circle cx="48" cy="40" r="5" fill="#e67700"/><circle cx="60" cy="40" r="5" fill="#e67700"/><path d="M28 52h40M28 60h28" stroke="#e67700" stroke-width="3" stroke-linecap="round"/>', '#e67700') },

  // Messaging
  { id: 'kafka',     svg: base('Kafka', '<circle cx="30" cy="34" r="9" fill="#e5dbff" stroke="#5f3dc4" stroke-width="3"/><circle cx="66" cy="34" r="9" fill="#e5dbff" stroke="#5f3dc4" stroke-width="3"/><circle cx="48" cy="60" r="9" fill="#e5dbff" stroke="#5f3dc4" stroke-width="3"/><path d="M39 34h18M35 42l8 11M61 42l-8 11" stroke="#5f3dc4" stroke-width="4" stroke-linecap="round"/>', '#5f3dc4') },
  { id: 'rabbitmq',  svg: base('AMQP',  '<rect x="24" y="30" width="48" height="32" rx="6" fill="#fff0b2" stroke="#e67e00" stroke-width="3"/><path d="M35 46l8-8 8 8 8-8" stroke="#e67e00" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', '#e67e00') },
  { id: 'websocket', svg: base('WS',    '<path d="M28 36c0 0 8-14 20-8s4 20 16 14 8-14 20-8" fill="none" stroke="#0ca678" stroke-width="4" stroke-linecap="round"/><path d="M28 54c0 0 8-14 20-8s4 20 16 14 8-14 20-8" fill="none" stroke="#0ca678" stroke-width="4" stroke-linecap="round"/>', '#0ca678') },

  // Cloud
  { id: 'cloud',  svg: base('Cloud',  '<path d="M33 63h31c8 0 14-5 14-13s-6-13-14-13h-1c-3-9-11-15-21-15-12 0-21 9-22 21-7 1-12 5-12 11 0 5 5 9 25 9Z" fill="#e7f5ff" stroke="#228be6" stroke-width="4" stroke-linejoin="round"/>', '#228be6') },
  { id: 'lambda', svg: base('λ',      '<rect x="20" y="24" width="56" height="44" rx="8" fill="#fff3cd" stroke="#fd7e14" stroke-width="3"/><text x="48" y="54" text-anchor="middle" font-size="28" font-weight="700" fill="#fd7e14">λ</text>', '#fd7e14') },
  { id: 'vm',     svg: base('VM',     '<rect x="22" y="26" width="52" height="38" rx="6" fill="#f3f0ff" stroke="#7048e8" stroke-width="3"/><rect x="30" y="34" width="36" height="22" rx="4" fill="#e5dbff"/><path d="M40 42h16M40 50h10" stroke="#7048e8" stroke-width="2.5" stroke-linecap="round"/>', '#7048e8') },
  { id: 'dns',    svg: base('DNS',    '<circle cx="48" cy="46" r="22" fill="none" stroke="#1971c2" stroke-width="3"/><path d="M26 46h44M48 24v44" stroke="#1971c2" stroke-width="2"/><path d="M30 36a22 22 0 0 1 36 0M30 56a22 22 0 0 0 36 0" fill="none" stroke="#1971c2" stroke-width="2"/>', '#1971c2') },

  // DevOps
  { id: 'github',    svg: base('GitHub',  '<circle cx="48" cy="44" r="20" fill="#24292f"/><path d="M48 28a20 20 0 0 0-6.3 39c1 .2 1.3-.4 1.3-1v-4c-5.6 1.2-6.8-2.4-6.8-2.4-.9-2.3-2.2-2.9-2.2-2.9-1.8-1.2.1-1.2.1-1.2 2 .1 3.1 2.1 3.1 2.1 1.8 3 4.7 2.1 5.8 1.6.2-1.3.7-2.1 1.3-2.6-4.5-.5-9.2-2.2-9.2-9.9a7.8 7.8 0 0 1 2-5.4c-.2-.5-.9-2.6.2-5.4 0 0 1.7-.5 5.5 2a18.7 18.7 0 0 1 10 0c3.8-2.5 5.5-2 5.5-2 1.1 2.8.4 4.9.2 5.4a7.8 7.8 0 0 1 2 5.4c0 7.7-4.7 9.4-9.2 9.9.7.6 1.4 1.9 1.4 3.7v5.5c0 .6.3 1.2 1.3 1A20 20 0 0 0 48 28z" fill="#fff"/>', '#24292f') },
  { id: 'cicd',      svg: base('CI/CD',   '<circle cx="24" cy="46" r="8" fill="#2f9e44" stroke="#2f9e44"/><circle cx="48" cy="46" r="8" fill="#1971c2" stroke="#1971c2"/><circle cx="72" cy="46" r="8" fill="#e67700" stroke="#e67700"/><path d="M32 46h8M56 46h8" stroke="#868e96" stroke-width="3" stroke-linecap="round"/>', '#2f9e44') },
  { id: 'terraform', svg: base('TF',      '<path d="M38 26v28l12-7V19z" fill="#7b42bc"/><path d="M52 33v28l12-7V26z" fill="#5c4ee5"/><path d="M24 52v14l12-7V45z" fill="#4040b2"/>', '#5c4ee5') },
  { id: 'monitor',   svg: base('Monitor', '<rect x="20" y="26" width="56" height="36" rx="6" fill="#fff9db" stroke="#f59f00" stroke-width="3"/><path d="M28 52l10-12 10 8 10-16 8 10" fill="none" stroke="#f59f00" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>', '#f59f00') },

  // Security
  { id: 'auth',     svg: base('Auth', '<rect x="32" y="20" width="32" height="24" rx="8" fill="none" stroke="#e03131" stroke-width="3"/><rect x="24" y="40" width="48" height="32" rx="6" fill="#fff5f5" stroke="#e03131" stroke-width="3"/><circle cx="48" cy="54" r="5" fill="#e03131"/><path d="M48 59v6" stroke="#e03131" stroke-width="3" stroke-linecap="round"/>', '#e03131') },
  { id: 'firewall', svg: base('WAF',  '<path d="M48 20l20 8v16c0 12-8 20-20 24-12-4-20-12-20-24V28z" fill="#fff0f6" stroke="#c2255c" stroke-width="3"/><path d="M40 46l6 6 12-12" stroke="#c2255c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>', '#c2255c') },
]

let written = 0
for (const icon of ICONS) {
  const outPath = path.join(ICONS_DIR, `${icon.id}.svg`)
  fs.writeFileSync(outPath, icon.svg, 'utf8')
  written++
  console.log(`  ✓ ${icon.id}.svg`)
}
