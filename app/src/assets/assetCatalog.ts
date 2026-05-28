export type BuiltinAsset = {
  id: string
  name: string
  category: string
  tags: string[]
  svg: string
}

const baseSvg = (label: string, body: string, accent = '#4c6ef5') => `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="18" fill="#f8f9fa"/>
  <rect x="8" y="8" width="80" height="80" rx="14" fill="#ffffff" stroke="#ced4da" stroke-width="2"/>
  ${body}
  <text x="48" y="82" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="700" fill="${accent}">${label}</text>
</svg>`.trim()

export const builtinAssets: BuiltinAsset[] = [
  {
    id: 'container-docker',
    name: 'Docker / Container',
    category: 'Containers',
    tags: ['docker', 'container', 'service'],
    svg: baseSvg(
      'Docker',
      '<rect x="25" y="39" width="10" height="9" rx="2" fill="#228be6"/><rect x="37" y="39" width="10" height="9" rx="2" fill="#228be6"/><rect x="49" y="39" width="10" height="9" rx="2" fill="#228be6"/><rect x="31" y="28" width="10" height="9" rx="2" fill="#4dabf7"/><rect x="43" y="28" width="10" height="9" rx="2" fill="#4dabf7"/><path d="M20 51h52c-3 12-12 19-27 19-13 0-21-5-25-19Z" fill="#1864ab"/><path d="M69 43c6 0 8 4 8 8-5 0-8-2-10-6 1-1 1-2 2-2Z" fill="#74c0fc"/>',
      '#1864ab',
    ),
  },
  {
    id: 'kubernetes-cluster',
    name: 'Kubernetes Cluster',
    category: 'Containers',
    tags: ['kubernetes', 'k8s', 'cluster'],
    svg: baseSvg(
      'K8s',
      '<polygon points="48,18 72,32 72,60 48,74 24,60 24,32" fill="#4263eb"/><circle cx="48" cy="46" r="16" fill="#edf2ff"/><circle cx="48" cy="46" r="5" fill="#4263eb"/><g stroke="#4263eb" stroke-width="3" stroke-linecap="round"><path d="M48 26v12"/><path d="M48 54v12"/><path d="M32 46h12"/><path d="M52 46h12"/><path d="M37 35l8 8"/><path d="M51 49l8 8"/><path d="M59 35l-8 8"/><path d="M45 49l-8 8"/></g>',
      '#4263eb',
    ),
  },
  {
    id: 'web-client',
    name: 'Web Client',
    category: 'Web',
    tags: ['web', 'browser', 'frontend', 'client'],
    svg: baseSvg(
      'Web',
      '<rect x="22" y="23" width="52" height="40" rx="5" fill="#e7f5ff" stroke="#1971c2" stroke-width="3"/><path d="M22 34h52" stroke="#1971c2" stroke-width="3"/><circle cx="30" cy="29" r="2" fill="#1971c2"/><circle cx="37" cy="29" r="2" fill="#1971c2"/><circle cx="44" cy="29" r="2" fill="#1971c2"/><path d="M34 51h28M39 44h18" stroke="#1971c2" stroke-width="3" stroke-linecap="round"/>',
      '#1971c2',
    ),
  },
  {
    id: 'api-service',
    name: 'API Service',
    category: 'Backend',
    tags: ['api', 'backend', 'service', 'server'],
    svg: baseSvg(
      'API',
      '<rect x="23" y="25" width="50" height="44" rx="8" fill="#fff4e6" stroke="#f08c00" stroke-width="3"/><path d="M33 42h30M33 52h22" stroke="#e67700" stroke-width="4" stroke-linecap="round"/><circle cx="35" cy="32" r="3" fill="#f08c00"/><circle cx="61" cy="63" r="8" fill="#ffd8a8" stroke="#e67700" stroke-width="3"/><path d="M61 58v10M56 63h10" stroke="#e67700" stroke-width="2"/>',
      '#e67700',
    ),
  },
  {
    id: 'database-postgres',
    name: 'Database',
    category: 'Data',
    tags: ['database', 'postgres', 'mysql', 'storage'],
    svg: baseSvg(
      'DB',
      '<ellipse cx="48" cy="29" rx="23" ry="10" fill="#d0ebff" stroke="#1c7ed6" stroke-width="3"/><path d="M25 29v29c0 6 10 10 23 10s23-4 23-10V29" fill="#e7f5ff" stroke="#1c7ed6" stroke-width="3"/><path d="M25 43c0 6 10 10 23 10s23-4 23-10M25 56c0 6 10 10 23 10s23-4 23-10" fill="none" stroke="#1c7ed6" stroke-width="3"/>',
      '#1c7ed6',
    ),
  },
  {
    id: 'cache-redis',
    name: 'Redis / Cache',
    category: 'Data',
    tags: ['redis', 'cache', 'memory'],
    svg: baseSvg(
      'Cache',
      '<path d="M48 20 72 32 48 44 24 32 48 20Z" fill="#ffc9c9" stroke="#c92a2a" stroke-width="3"/><path d="M24 43 48 55 72 43M24 54 48 66 72 54" fill="none" stroke="#c92a2a" stroke-width="4" stroke-linejoin="round"/><circle cx="48" cy="32" r="5" fill="#c92a2a"/>',
      '#c92a2a',
    ),
  },
  {
    id: 'queue-kafka',
    name: 'Kafka / Queue',
    category: 'Messaging',
    tags: ['kafka', 'queue', 'event', 'messaging'],
    svg: baseSvg(
      'Queue',
      '<circle cx="30" cy="34" r="9" fill="#e5dbff" stroke="#5f3dc4" stroke-width="3"/><circle cx="66" cy="34" r="9" fill="#e5dbff" stroke="#5f3dc4" stroke-width="3"/><circle cx="48" cy="60" r="9" fill="#e5dbff" stroke="#5f3dc4" stroke-width="3"/><path d="M39 34h18M35 42l8 11M61 42l-8 11" stroke="#5f3dc4" stroke-width="4" stroke-linecap="round"/>',
      '#5f3dc4',
    ),
  },
  {
    id: 'cloud',
    name: 'Cloud',
    category: 'Cloud',
    tags: ['cloud', 'aws', 'azure', 'gcp'],
    svg: baseSvg(
      'Cloud',
      '<path d="M33 63h31c8 0 14-5 14-13s-6-13-14-13h-1c-3-9-11-15-21-15-12 0-21 9-22 21-7 1-12 5-12 11 0 5 5 9 25 9Z" fill="#e7f5ff" stroke="#228be6" stroke-width="4" stroke-linejoin="round"/>',
      '#228be6',
    ),
  },
]
