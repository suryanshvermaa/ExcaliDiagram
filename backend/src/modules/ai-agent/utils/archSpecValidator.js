'use strict'

// ── ArchSpec validator ────────────────────────────────────────────────────────
// Validates and normalises the JSON output from the AI before sending to frontend.

function validateArchSpec(raw) {
  const errors = []

  if (!raw || typeof raw !== 'object') return { valid: false, errors: ['Response is not a JSON object'] }

  if (!raw.title || typeof raw.title !== 'string') {
    errors.push('Missing or invalid "title"')
    raw.title = 'Architecture Diagram'
  }
  if (!raw.description || typeof raw.description !== 'string') {
    raw.description = ''
  }

  // ── nodes ──────────────────────────────────────────────────────────────────
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) {
    errors.push('Missing or empty "nodes" array')
  } else {
    const VALID_TYPES = new Set([
      'service', 'database', 'cache', 'queue', 'lb', 'cdn',
      'gateway', 'client', 'worker', 'scheduler', 'storage', 'monitoring',
    ])
    const nodeIds = new Set()
    raw.nodes = raw.nodes.map((n, i) => {
      if (!n.id) n.id = `node_${i}`
      if (!n.label) n.label = n.id
      if (!n.technology) n.technology = n.type || 'service'
      if (!VALID_TYPES.has(n.type)) n.type = 'service'
      if (nodeIds.has(n.id)) {
        n.id = `${n.id}_${i}`
        errors.push(`Duplicate node id fixed → ${n.id}`)
      }
      nodeIds.add(n.id)
      return n
    })
  }

  // ── connections ────────────────────────────────────────────────────────────
  if (!Array.isArray(raw.connections)) {
    raw.connections = []
  } else {
    const nodeIds = new Set(raw.nodes.map(n => n.id))
    const VALID_STYLES = new Set(['solid', 'dashed', 'dotted'])
    const VALID_DIRS   = new Set(['forward', 'backward', 'bidirectional'])
    raw.connections = raw.connections.filter(c => {
      if (!nodeIds.has(c.from)) { errors.push(`Connection from unknown node: ${c.from}`); return false }
      if (!nodeIds.has(c.to))   { errors.push(`Connection to unknown node: ${c.to}`);   return false }
      return true
    }).map(c => ({
      ...c,
      style:     VALID_STYLES.has(c.style) ? c.style : 'solid',
      direction: VALID_DIRS.has(c.direction) ? c.direction : 'forward',
    }))
  }

  // ── boundaries ─────────────────────────────────────────────────────────────
  if (!Array.isArray(raw.boundaries)) {
    raw.boundaries = []
  } else {
    const nodeIds   = new Set(raw.nodes.map(n => n.id))
    const VALID_BND = new Set(['kubernetes', 'cloud', 'network', 'service-group', 'vpc', 'region'])
    raw.boundaries = raw.boundaries.map(b => ({
      ...b,
      type:    VALID_BND.has(b.type) ? b.type : 'service-group',
      nodeIds: (b.nodeIds || []).filter(id => nodeIds.has(id)),
    })).filter(b => b.nodeIds.length > 0)
  }

  return {
    valid:  errors.length === 0,
    errors,
    spec:   raw,
  }
}

// ── Extract JSON from an LLM response that might have markdown fences ─────────
function extractJson(text) {
  // Strip ```json ... ``` or ``` ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonText = fenced ? fenced[1].trim() : text.trim()

  // Find the outermost { … }
  const start = jsonText.indexOf('{')
  const end   = jsonText.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in response')

  return JSON.parse(jsonText.slice(start, end + 1))
}

module.exports = { validateArchSpec, extractJson }
