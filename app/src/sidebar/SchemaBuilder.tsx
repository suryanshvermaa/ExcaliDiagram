import { useCallback, useState } from 'react'
import type { ColType, SchemaColumn, SchemaTable } from './schemaToSvg'
import { schemaToSvg } from './schemaToSvg'

const COL_TYPES: ColType[] = [
  'INT','BIGINT','SMALLINT','FLOAT','DECIMAL','BOOLEAN',
  'VARCHAR','TEXT','CHAR',
  'DATE','TIMESTAMP','DATETIME',
  'UUID','JSON','JSONB',
]

const HAS_LENGTH: ColType[] = ['VARCHAR','CHAR','DECIMAL']

function makeCol(): SchemaColumn {
  return { id: crypto.randomUUID(), name: '', type: 'VARCHAR', length: 255, isPK: false, isFK: false, isNullable: true, isUnique: false }
}

interface Props {
  onInsert: (dataUrl: string, w: number, h: number) => void
}

export function SchemaBuilder({ onInsert }: Props) {
  const [tableName, setTableName] = useState('users')
  const [columns, setColumns]     = useState<SchemaColumn[]>([
    { id: crypto.randomUUID(), name: 'id',         type: 'INT',         isPK: true,  isFK: false, isNullable: false, isUnique: false },
    { id: crypto.randomUUID(), name: 'name',       type: 'VARCHAR',     length: 255, isPK: false, isFK: false, isNullable: true,  isUnique: false },
    { id: crypto.randomUUID(), name: 'email',      type: 'VARCHAR',     length: 255, isPK: false, isFK: false, isNullable: false, isUnique: true  },
    { id: crypto.randomUUID(), name: 'created_at', type: 'TIMESTAMP',               isPK: false, isFK: false, isNullable: true,  isUnique: false },
  ])

  const updateCol = useCallback((id: string, patch: Partial<SchemaColumn>) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }, [])

  const removeCol = useCallback((id: string) => {
    setColumns(prev => prev.filter(c => c.id !== id))
  }, [])

  const moveUp = useCallback((idx: number) => {
    if (idx === 0) return
    setColumns(prev => { const a = [...prev]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a })
  }, [])

  const moveDown = useCallback((idx: number) => {
    setColumns(prev => { if (idx >= prev.length - 1) return prev; const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a })
  }, [])

  const handleInsert = useCallback(() => {
    const table: SchemaTable = { tableName: tableName.trim() || 'table', columns }
    const svg = schemaToSvg(table)
    const wM  = svg.match(/width="([\d.]+)"/)
    const hM  = svg.match(/height="([\d.]+)"/)
    const w   = wM ? parseFloat(wM[1]) : 400
    const h   = hM ? parseFloat(hM[1]) : 200
    onInsert(`data:image/svg+xml,${encodeURIComponent(svg)}`, w, h)
  }, [tableName, columns, onInsert])

  return (
    <div className="schemaBuilder">
      {/* Table name */}
      <div className="schemaSection">
        <label className="schemaLabel">Table name</label>
        <input
          className="schemaInput"
          value={tableName}
          onChange={e => setTableName(e.target.value)}
          placeholder="users"
          spellCheck={false}
        />
      </div>

      {/* Column list */}
      <div className="schemaSection schemaColSection">
        <div className="schemaLabelRow">
          <span className="schemaLabel">Columns</span>
          <button className="schemaAddBtn" onClick={() => setColumns(p => [...p, makeCol()])}>+ Add</button>
        </div>

        <div className="schemaCols">
          {columns.map((col, idx) => (
            <div key={col.id} className="schemaCol">
              {/* Name */}
              <input
                className="schemaColInput schemaColName"
                value={col.name}
                onChange={e => updateCol(col.id, { name: e.target.value })}
                placeholder="column_name"
                spellCheck={false}
              />

              {/* Type */}
              <select
                className="schemaColInput schemaColType"
                value={col.type}
                onChange={e => {
                  const t = e.target.value as ColType
                  updateCol(col.id, { type: t, length: HAS_LENGTH.includes(t) ? (col.length ?? 255) : undefined })
                }}
              >
                {COL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              {/* Length (only for VARCHAR/CHAR/DECIMAL) */}
              {HAS_LENGTH.includes(col.type) && (
                <input
                  className="schemaColInput schemaColLen"
                  type="number"
                  value={col.length ?? ''}
                  min={1} max={65535}
                  onChange={e => updateCol(col.id, { length: parseInt(e.target.value) || 255 })}
                />
              )}

              {/* Constraint toggles */}
              <div className="schemaConstraints">
                {(['isPK','isFK','isUnique'] as const).map(flag => (
                  <button
                    key={flag}
                    className={`schemaFlag ${col[flag] ? 'on' : ''} ${flag}`}
                    onClick={() => updateCol(col.id, { [flag]: !col[flag] })}
                    title={flag === 'isPK' ? 'Primary Key' : flag === 'isFK' ? 'Foreign Key' : 'Unique'}
                  >
                    {flag === 'isPK' ? 'PK' : flag === 'isFK' ? 'FK' : 'UQ'}
                  </button>
                ))}
                <button
                  className={`schemaFlag ${col.isNullable ? '' : 'on'} nn`}
                  onClick={() => updateCol(col.id, { isNullable: !col.isNullable })}
                  title="Not Null"
                >NN</button>
              </div>

              {/* Reorder + delete */}
              <div className="schemaColActions">
                <button className="schemaRowBtn" onClick={() => moveUp(idx)}   title="Move up">↑</button>
                <button className="schemaRowBtn" onClick={() => moveDown(idx)} title="Move down">↓</button>
                <button className="schemaRowBtn del" onClick={() => removeCol(col.id)} title="Delete">×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview pill */}
      <div className="schemaPreviewHint">
        🗄 {tableName || 'table'} · {columns.length} col{columns.length !== 1 ? 's' : ''}
      </div>

      {/* Insert button */}
      <button
        className="schemaInsertBtn"
        onClick={handleInsert}
        disabled={!tableName.trim() || columns.length === 0}
      >
        Add Table to Canvas
      </button>
    </div>
  )
}
