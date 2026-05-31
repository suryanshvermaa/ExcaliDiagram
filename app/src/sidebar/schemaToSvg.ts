// Generates a VS Code Dark–style SVG card for a database table schema.

export type ColType =
  | 'INT' | 'BIGINT' | 'SMALLINT' | 'FLOAT' | 'DECIMAL' | 'BOOLEAN'
  | 'VARCHAR' | 'TEXT' | 'CHAR'
  | 'DATE' | 'TIMESTAMP' | 'DATETIME'
  | 'UUID' | 'JSON' | 'JSONB'

export interface SchemaColumn {
  id:         string
  name:       string
  type:       ColType
  length?:    number   // e.g. 255 for VARCHAR(255)
  isPK:       boolean
  isFK:       boolean
  isNullable: boolean
  isUnique:   boolean
}

export interface SchemaTable {
  tableName: string
  columns:   SchemaColumn[]
}

// ── colour palette ────────────────────────────────────────────────────────────
const C = {
  bg:        '#1e1e1e',
  headerBg:  '#252526',
  rowAlt:    '#232323',
  border:    '#3e3e42',
  text:      '#d4d4d4',
  dim:       '#858585',
  pk:        '#fbbf24',   // amber  — PK
  fk:        '#60a5fa',   // blue   — FK
  typeBg:    '#0e639c',
  typeText:  '#9cdcfe',
  uqBg:      '#2d4a2d',
  uqText:    '#4ec9b0',
  nullBg:    '#3a3a1a',
  nullText:  '#dcdcaa',
}

function xe(s: string | number) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

export function schemaToSvg(table: SchemaTable): string {
  const W       = 400
  const HDR_H   = 46
  const ROW_H   = 32
  const PAD     = 14
  const cols    = table.columns
  const H       = HDR_H + cols.length * ROW_H + 2

  const rows = cols.map((col, i) => {
    const y     = HDR_H + i * ROW_H
    const bg    = i % 2 === 0 ? C.bg : C.rowAlt
    const textY = y + ROW_H / 2 + 5  // baseline

    // constraint badge
    let badge = ''
    if (col.isPK) {
      badge = `<rect x="${PAD}" y="${y + 8}" width="24" height="16" rx="3" fill="${C.pk}20"/>
               <text x="${PAD + 12}" y="${textY - 1}" text-anchor="middle" font-family="system-ui" font-size="9" font-weight="700" fill="${C.pk}">PK</text>`
    } else if (col.isFK) {
      badge = `<rect x="${PAD}" y="${y + 8}" width="24" height="16" rx="3" fill="${C.fk}20"/>
               <text x="${PAD + 12}" y="${textY - 1}" text-anchor="middle" font-family="system-ui" font-size="9" font-weight="700" fill="${C.fk}">FK</text>`
    }

    // column name
    const nameX = PAD + 30
    const name  = `<text x="${nameX}" y="${textY}" font-family="'Cascadia Code','Consolas',monospace" font-size="12" fill="${col.isPK ? C.pk : col.isFK ? C.fk : C.text}">${xe(col.name)}</text>`

    // type pill
    const typeStr = col.length ? `${col.type}(${col.length})` : col.type
    const typePillW = typeStr.length * 7 + 12
    const typePillX = W - PAD - typePillW - (col.isUnique ? 32 : 0) - (col.isNullable ? 0 : 28)
    const typePill  = `<rect x="${typePillX}" y="${y + 8}" width="${typePillW}" height="16" rx="3" fill="${C.typeBg}"/>
                       <text x="${typePillX + typePillW / 2}" y="${textY - 1}" text-anchor="middle" font-family="'Cascadia Code','Consolas',monospace" font-size="9" fill="${C.typeText}">${xe(typeStr)}</text>`

    // nullable/unique badges
    let extras = ''
    let extraX = W - PAD
    if (!col.isNullable) {
      extraX -= 26
      extras += `<rect x="${extraX}" y="${y + 8}" width="24" height="16" rx="3" fill="${C.nullBg}"/>
                 <text x="${extraX + 12}" y="${textY - 1}" text-anchor="middle" font-family="system-ui" font-size="9" font-weight="600" fill="${C.nullText}">NN</text>`
    }
    if (col.isUnique) {
      extraX -= 28
      extras += `<rect x="${extraX}" y="${y + 8}" width="24" height="16" rx="3" fill="${C.uqBg}"/>
                 <text x="${extraX + 12}" y="${textY - 1}" text-anchor="middle" font-family="system-ui" font-size="9" font-weight="600" fill="${C.uqText}">UQ</text>`
    }

    return `<rect x="0" y="${y}" width="${W}" height="${ROW_H}" fill="${bg}"/>
            <line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${C.border}" stroke-width="0.5"/>
            ${badge}${name}${typePill}${extras}`
  }).join('\n')

  const tableLabel = `${xe(table.tableName)}`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- Card border -->
  <rect width="${W}" height="${H}" rx="8" fill="${C.border}"/>
  <rect x="1" y="1" width="${W-2}" height="${H-2}" rx="7" fill="${C.bg}"/>

  <!-- Header -->
  <rect x="1" y="1" width="${W-2}" height="${HDR_H-1}" rx="7" fill="${C.headerBg}"/>
  <rect x="1" y="${HDR_H-8}" width="${W-2}" height="8" fill="${C.headerBg}"/>

  <!-- Header: DB icon -->
  <text x="${PAD}" y="30" font-family="system-ui" font-size="16">🗄</text>

  <!-- Header: table name -->
  <text x="${PAD+24}" y="29" font-family="'Cascadia Code','Consolas',monospace" font-size="14" font-weight="700" fill="#ffffff">${tableLabel}</text>

  <!-- Header: TABLE label -->
  <rect x="${W-60}" y="13" width="46" height="18" rx="3" fill="#2d2d2d"/>
  <text x="${W-37}" y="26" text-anchor="middle" font-family="system-ui" font-size="10" font-weight="600" fill="${C.dim}">TABLE</text>

  <!-- Rows -->
  ${rows}
</svg>`
}
