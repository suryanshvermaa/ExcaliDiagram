// ── Layout Engine — top-to-bottom row layout ──────────────────────────────────
import type { ArchSpec, ArchNode, LayoutNode, LayoutResult } from '../types/ai.types'
import { nodeTypeColor } from './excalidrawRenderer'

const NODE_W  = 160
const NODE_H  = 70
const COL_GAP = 80
const ROW_GAP = 100
const ORIGIN  = { x: 140, y: 120 }

const ROW_TIER: Record<string, number> = {
  client:     0,
  cdn:        1,
  lb:         1,
  gateway:    2,
  service:    3,
  worker:     4,
  scheduler:  4,
  queue:      5,
  cache:      5,
  database:   6,
  storage:    6,
  monitoring: 7,
}

export function layoutArchSpec(spec: ArchSpec): LayoutResult {
  const nodes = spec.nodes ?? []
  if (nodes.length === 0) return { nodes: [], spec }

  // Assign rows
  const rowGroups = new Map<number, ArchNode[]>()
  nodes.forEach(n => {
    const r = ROW_TIER[n.type] ?? 3
    if (!rowGroups.has(r)) rowGroups.set(r, [])
    rowGroups.get(r)!.push(n)
  })

  const sortedRows = [...rowGroups.keys()].sort((a, b) => a - b)
  const maxCount   = Math.max(...sortedRows.map(r => rowGroups.get(r)!.length))
  const totalW     = maxCount * NODE_W + (maxCount - 1) * COL_GAP

  const layoutNodes: LayoutNode[] = []

  sortedRows.forEach((tier, rowIdx) => {
    const group  = rowGroups.get(tier)!
    const rowW   = group.length * NODE_W + (group.length - 1) * COL_GAP
    const startX = ORIGIN.x + (totalW - rowW) / 2   // centre each row
    const y      = ORIGIN.y + rowIdx * (NODE_H + ROW_GAP)

    group.forEach((node, i) => {
      layoutNodes.push({
        ...node,
        x:      startX + i * (NODE_W + COL_GAP),
        y,
        width:  NODE_W,
        height: NODE_H,
        color:  nodeTypeColor(node.type),
      })
    })
  })

  return { nodes: layoutNodes, spec }
}
