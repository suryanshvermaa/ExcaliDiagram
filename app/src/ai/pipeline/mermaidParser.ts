// ── Mermaid → Excalidraw skeleton elements ────────────────────────────────────
// Parses a Mermaid flowchart string and produces convertToExcalidrawElements-
// compatible skeleton objects that are fully editable and hand-drawn styled.

import { convertToExcalidrawElements } from '@excalidraw/excalidraw'

type ConvertInput = Exclude<Parameters<typeof convertToExcalidrawElements>[0], null>

// ── Types ──────────────────────────────────────────────────────────────────────
interface MNode { id: string; label: string; shape: 'box'|'round'|'db'; color: string; subgraph?: string }
interface MEdge { from: string; to: string; label?: string; dashed: boolean }
interface MSubgraph { id: string; label: string; nodeIds: string[] }

// ── Colour palette by position in the diagram ─────────────────────────────────
const TIER_COLORS = [
  '#1971c2', // tier 0 – client (blue)
  '#f76707', // tier 1 – CDN / LB (orange)
  '#e67700', // tier 2 – gateway (amber)
  '#5f3dc4', // tier 3 – services (purple)
  '#862e9c', // tier 4 – workers (violet)
  '#d9480f', // tier 5 – queues (red-orange)
  '#c92a2a', // tier 6 – cache (red)
  '#1c7ed6', // tier 7 – databases (blue)
  '#2b8a3e', // tier 8 – storage (green)
  '#087f5b', // tier 9 – monitoring (teal)
]

function hexToRgba(hex: string, a: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16)
  return isNaN(r) ? `rgba(128,128,128,${a})` : `rgba(${r},${g},${b},${a})`
}

// ── Mermaid parser ─────────────────────────────────────────────────────────────
function parseMermaid(code: string): { nodes: MNode[]; edges: MEdge[]; subgraphs: MSubgraph[] } {
  const nodeMap  = new Map<string, MNode>()
  const edges: MEdge[]     = []
  const subgraphs: MSubgraph[] = []
  const sgStack: string[]  = []

  const lines = code.split('\n').map(l => l.trim())

  for (const line of lines) {
    if (!line || /^flowchart|^graph\s/i.test(line) || /^%%/.test(line) || /^style\s|^classDef|^class\s/i.test(line)) continue

    if (/^subgraph\s/i.test(line)) {
      const label = line.replace(/^subgraph\s*/i, '').replace(/['"]/g, '').trim()
      const id    = `sg_${subgraphs.length}`
      subgraphs.push({ id, label, nodeIds: [] })
      sgStack.push(id)
      continue
    }
    if (/^end$/i.test(line)) { sgStack.pop(); continue }

    // Edges: A --> B, A -.- B, A -.-> B, A -- label --> B
    const edgeRe = /^([\w]+)\s*(-->|--[^>]*->|-\.->|-\.-)\s*([\w]+)/
    const em = line.match(edgeRe)
    if (em) {
      const [, from,, to] = em
      const labelMatch = line.match(/--([^->]+)-->/)
      const dashed     = em[2].includes('.')
      edges.push({ from, to, label: labelMatch?.[1]?.trim(), dashed })
      const currentSg = sgStack[sgStack.length - 1]
      ;[from, to].forEach(id => {
        if (!nodeMap.has(id)) {
          nodeMap.set(id, { id, label: id, shape: 'box', color: '', subgraph: currentSg })
          if (currentSg) subgraphs.find(s => s.id === currentSg)?.nodeIds.push(id)
        }
      })
      continue
    }

    // Node definition: id[Label], id(Label), id[(Label)]
    const nodeRe = /^([\w]+)(?:\[\(([^\]]+)\)\]|\[([^\]]+)\]|\(([^)]+)\))/
    const nm = line.match(nodeRe)
    if (nm) {
      const [, id, cylLabel, boxLabel, roundLabel] = nm
      const label = cylLabel || boxLabel || roundLabel || id
      const shape: MNode['shape'] = cylLabel ? 'db' : roundLabel ? 'round' : 'box'
      const currentSg = sgStack[sgStack.length - 1]
      const existing  = nodeMap.get(id)
      if (existing) { existing.label = label; existing.shape = shape }
      else {
        nodeMap.set(id, { id, label, shape, color: '', subgraph: currentSg })
        if (currentSg) subgraphs.find(s => s.id === currentSg)?.nodeIds.push(id)
      }
    }
  }

  return { nodes: [...nodeMap.values()], edges, subgraphs }
}

// ── Layout (top-to-bottom tiers) ──────────────────────────────────────────────
const W = 160, H = 70, COL_GAP = 80, ROW_GAP = 110, OX = 140, OY = 120

function layoutNodes(nodes: MNode[], edges: MEdge[]) {
  // Simple BFS tier assignment from source nodes (no in-edges)
  const inCount = new Map(nodes.map(n => [n.id, 0]))
  edges.forEach(e => inCount.set(e.to, (inCount.get(e.to) ?? 0) + 1))

  const tier   = new Map<string, number>()
  const queue  = nodes.filter(n => !inCount.get(n.id)).map(n => n.id)
  queue.forEach(id => tier.set(id, 0))

  while (queue.length) {
    const id = queue.shift()!
    const t  = tier.get(id) ?? 0
    edges.filter(e => e.from === id).forEach(e => {
      const next = Math.max(tier.get(e.to) ?? 0, t + 1)
      tier.set(e.to, next)
      queue.push(e.to)
    })
  }
  // Fallback for unvisited nodes
  nodes.forEach(n => { if (!tier.has(n.id)) tier.set(n.id, 0) })

  // Group by tier
  const rows = new Map<number, MNode[]>()
  nodes.forEach(n => {
    const t = tier.get(n.id) ?? 0
    if (!rows.has(t)) rows.set(t, [])
    rows.get(t)!.push(n)
  })

  const sortedTiers = [...rows.keys()].sort((a, b) => a - b)
  const maxCols     = Math.max(...sortedTiers.map(t => rows.get(t)!.length))
  const totalW      = maxCols * W + (maxCols - 1) * COL_GAP

  const positioned = new Map<string, { x: number; y: number; color: string }>()

  sortedTiers.forEach((t, rowIdx) => {
    const group  = rows.get(t)!
    const rowW   = group.length * W + (group.length - 1) * COL_GAP
    const startX = OX + (totalW - rowW) / 2
    const y      = OY + rowIdx * (H + ROW_GAP)
    const color  = TIER_COLORS[rowIdx % TIER_COLORS.length]
    group.forEach((n, i) => {
      positioned.set(n.id, { x: startX + i * (W + COL_GAP), y, color })
      n.color = color
    })
  })

  return { positioned, sortedTiers, rows }
}

// ── Renderer → skeleton elements ──────────────────────────────────────────────
export function mermaidToSkeletonElements(code: string) {
  const { nodes, edges, subgraphs } = parseMermaid(code)
  if (nodes.length === 0) return []

  const { positioned } = layoutNodes(nodes, edges)
  const raw: unknown[] = []

  // 1. Subgraph boundaries
  subgraphs.forEach((sg, i) => {
    const members = sg.nodeIds
      .map(id => positioned.get(id))
      .filter(Boolean) as { x: number; y: number; color: string }[]
    if (!members.length) return

    const pad = 28
    const x1  = Math.min(...members.map(p => p.x)) - pad
    const y1  = Math.min(...members.map(p => p.y)) - 48
    const x2  = Math.max(...members.map(p => p.x + W)) + pad
    const y2  = Math.max(...members.map(p => p.y + H)) + pad
    const sc  = TIER_COLORS[(i + 3) % TIER_COLORS.length]

    raw.push({
      type: 'rectangle', x: x1, y: y1, width: x2 - x1, height: y2 - y1,
      strokeColor: sc, backgroundColor: hexToRgba(sc, 0.06),
      strokeWidth: 1.5, strokeStyle: 'dashed', roughness: 1,
      roundness: { type: 3, value: 12 }, fillStyle: 'solid',
      label: { text: sg.label, fontSize: 12, fontFamily: 3, strokeColor: sc, textAlign: 'left' as const },
    })
  })

  // 2. Nodes — hand-drawn rectangles with label
  nodes.forEach(n => {
    const pos = positioned.get(n.id)
    if (!pos) return
    const sc   = pos.color
    const fill = hexToRgba(sc, 0.10)

    raw.push({
      type: 'rectangle', x: pos.x, y: pos.y, width: W, height: H,
      strokeColor: sc, backgroundColor: fill,
      strokeWidth: 2,
      roughness: 1,           // ← hand-drawn feel
      roundness: n.shape === 'box' ? { type: 3, value: 8 } : null,
      fillStyle: 'solid',
      label: {
        text: n.label,
        fontSize: 14,
        fontFamily: 1,        // ← Virgil (Excalidraw handwriting font)
        strokeColor: sc,
        textAlign: 'center' as const,
      },
    })
  })

  // 3. Arrows
  nodes.forEach(n => {
    const pos = positioned.get(n.id)
    if (!pos) return
    edges.filter(e => e.from === n.id).forEach(e => {
      const tp = positioned.get(e.to)
      if (!tp) return
      const fx = pos.x + W / 2, fy = pos.y + H / 2
      const tx = tp.x  + W / 2, ty = tp.y  + H / 2
      raw.push({
        type: 'arrow', x: fx, y: fy,
        points: [[0, 0], [tx - fx, ty - fy]],
        strokeColor: '#868e96', strokeWidth: 1.5,
        strokeStyle: e.dashed ? 'dashed' : 'solid',
        roughness: 1,           // ← hand-drawn arrows
        endArrowhead: 'arrow', startArrowhead: null,
        ...(e.label ? {
          label: { text: e.label, fontSize: 11, fontFamily: 1, strokeColor: '#adb5bd', textAlign: 'center' as const }
        } : {}),
      })
    })
  })

  return convertToExcalidrawElements(raw as ConvertInput)
}
