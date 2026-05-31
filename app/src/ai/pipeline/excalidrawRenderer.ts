// ── Excalidraw Renderer — pure native shapes, text bound via label property ───
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { ArchSpec } from '../types/ai.types'
import type { NodeType } from '../types/ai.types'
import { layoutArchSpec } from './layoutEngine'

export function nodeTypeColor(type: NodeType | string): string {
  switch (type) {
    case 'client':     return '#1971c2'
    case 'cdn':        return '#0ca678'
    case 'lb':         return '#f76707'
    case 'gateway':    return '#e67700'
    case 'service':    return '#5f3dc4'
    case 'worker':     return '#862e9c'
    case 'scheduler':  return '#a61e4d'
    case 'queue':      return '#d9480f'
    case 'cache':      return '#c92a2a'
    case 'database':   return '#1c7ed6'
    case 'storage':    return '#2b8a3e'
    case 'monitoring': return '#087f5b'
    default:           return '#495057'
  }
}

function hexToRgba(hex: string, a: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16)
  return (isNaN(r)||isNaN(g)||isNaN(b)) ? `rgba(128,128,128,${a})` : `rgba(${r},${g},${b},${a})`
}

function boundaryColor(type: string) {
  const map: Record<string,string> = {
    kubernetes:'#4263eb', cloud:'#1971c2', vpc:'#1971c2',
    region:'#1971c2', network:'#f08c00', 'service-group':'#7048e8',
  }
  return map[type] ?? '#868e96'
}

export async function archSpecToExcalidrawElements(
  spec: ArchSpec,
): Promise<{ elements: ReturnType<typeof convertToExcalidrawElements>; files: Record<string, never> }> {
  const layout = layoutArchSpec(spec)
  const raw: Array<Record<string, unknown>> = []

  // 1. Boundary dashed rectangles
  for (const b of spec.boundaries ?? []) {
    const members = layout.nodes.filter(n => b.nodeIds.includes(n.id))
    if (!members.length) continue
    const pad = 30
    const x1 = Math.min(...members.map(n => n.x)) - pad
    const y1 = Math.min(...members.map(n => n.y)) - 48
    const x2 = Math.max(...members.map(n => n.x + n.width))  + pad
    const y2 = Math.max(...members.map(n => n.y + n.height)) + pad
    const sc = b.color ?? boundaryColor(b.type)
    raw.push({
      type: 'rectangle', x: x1, y: y1, width: x2-x1, height: y2-y1,
      strokeColor: sc, backgroundColor: hexToRgba(sc, 0.05),
      strokeWidth: 2, strokeStyle: 'dashed', roughness: 0,
      roundness: { type: 3, value: 16 }, fillStyle: 'solid',
      // boundary label via label prop (top-left inside)
      label: { text: b.label, fontSize: 12, fontFamily: 3, strokeColor: sc, textAlign: 'left' as const },
    })
  }

  // 2. Node boxes — use `label` property so text is auto-centred inside shape
  for (const node of layout.nodes) {
    const sc   = node.color
    const fill = hexToRgba(sc, 0.08)
    const tech = node.technology ? `\n${node.technology}` : ''
    raw.push({
      type: 'rectangle',
      x: node.x, y: node.y, width: node.width, height: node.height,
      strokeColor: sc, backgroundColor: fill,
      strokeWidth: 2, roughness: 0,
      roundness: { type: 3, value: 8 }, fillStyle: 'solid',
      label: {
        text: `${node.label}${tech}`,
        fontSize: 13,
        fontFamily: 1,
        strokeColor: sc,
        textAlign: 'center' as const,
      },
    })
  }

  // 3. Arrows
  const byId = new Map(layout.nodes.map(n => [n.id, n]))
  for (const conn of spec.connections ?? []) {
    const from = byId.get(conn.from), to = byId.get(conn.to)
    if (!from || !to) continue
    const fx = from.x + from.width/2,  fy = from.y + from.height/2
    const tx = to.x   + to.width/2,    ty = to.y   + to.height/2
    raw.push({
      type: 'arrow', x: fx, y: fy,
      points: [[0,0],[tx-fx,ty-fy]],
      strokeColor: '#868e96', strokeWidth: 1.5,
      strokeStyle: conn.style === 'dashed' ? 'dashed' : conn.style === 'dotted' ? 'dotted' : 'solid',
      roughness: 0, endArrowhead: 'arrow',
      startArrowhead: conn.direction === 'bidirectional' ? 'arrow' : null,
      ...(conn.label ? { label: { text: conn.label, fontSize: 10, fontFamily: 1, strokeColor: '#adb5bd', textAlign: 'center' as const } } : {}),
    })
  }

  return { elements: convertToExcalidrawElements(raw as unknown as Parameters<typeof convertToExcalidrawElements>[0]), files: {} }
}
