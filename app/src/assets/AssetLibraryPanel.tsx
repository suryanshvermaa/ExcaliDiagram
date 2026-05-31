import { useCallback, useEffect, useRef, useState } from 'react'
import { builtinAssets, type BuiltinAsset } from './assetCatalog'
import { dragState } from '../editor/dragState'

export type { BuiltinAsset }

const ICON_SERVER = 'http://localhost:3001'
const PAGE_SIZE   = 12

// Server icon shape returned by new API (svgUrl instead of inline svg)
interface ServerIcon {
  id:           string
  name:         string
  category:     string
  tags:         string[]
  svgUrl:       string   // presigned S3/MinIO URL
  svgUrlExpiry: string
}

interface PagedResult {
  icons:   ServerIcon[]
  total:   number
  page:    number
  pages:   number
  perPage: number
}

interface Props { onInsertAsset: (asset: BuiltinAsset) => void }

type Mode = 'server' | 'local'

// Convert server icon to BuiltinAsset (svg field is empty — we fetch on demand)
function toBuiltinAsset(si: ServerIcon): BuiltinAsset & { svgUrl?: string } {
  return {
    id:       si.id,
    name:     si.name,
    category: si.category,
    tags:     si.tags,
    svg:      '',         // will be fetched via svgUrl when inserting
    svgUrl:   si.svgUrl,
  }
}

// Fetch SVG text from a URL (for canvas insertion)
async function fetchSvgText(url: string): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) throw new Error('Failed to fetch SVG')
  return r.text()
}

export function AssetLibraryPanel({ onInsertAsset }: Props) {
  const [mode,       setMode]       = useState<Mode>('local')
  const [categories, setCategories] = useState<string[]>(['All'])
  const [category,   setCategory]   = useState('All')
  const [query,      setQuery]      = useState('')
  const [icons,      setIcons]      = useState<Array<BuiltinAsset & { svgUrl?: string }>>([])
  const [page,       setPage]       = useState(1)
  const [pages,      setPages]      = useState(1)
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(false)

  const searchTimer = useRef<number | null>(null)

  // ── Probe server on mount ────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${ICON_SERVER}/health`, { signal: AbortSignal.timeout(1500) })
      .then(() => {
        setMode('server')
        return fetch(`${ICON_SERVER}/api/categories`)
      })
      .then(r => r.json())
      .then((cats: string[]) => setCategories(cats))
      .catch(() => {
        const cats = ['All', ...Array.from(new Set(builtinAssets.map(a => a.category)))]
        setCategories(cats)
        loadLocal('All', '', 1)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Reload when mode/category/page changes ───────────────────────────────────
  useEffect(() => {
    if (mode !== 'server') return
    loadServer(category, query, page)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, category, page])

  // ── Data loading ─────────────────────────────────────────────────────────────
  function loadServer(cat: string, q: string, pg: number) {
    setLoading(true)
    const params = new URLSearchParams({ category: cat, q, page: String(pg), limit: String(PAGE_SIZE) })
    fetch(`${ICON_SERVER}/api/icons?${params}`)
      .then(r => r.json())
      .then((data: PagedResult) => {
        setIcons(data.icons.map(toBuiltinAsset))
        setPages(data.pages)
        setTotal(data.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  function loadLocal(cat: string, q: string, pg: number) {
    let filtered = builtinAssets
    if (cat !== 'All') filtered = filtered.filter(a => a.category === cat)
    if (q) {
      const lq = q.toLowerCase()
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(lq) || a.tags.some(t => t.includes(lq))
      )
    }
    const totalLocal = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalLocal / PAGE_SIZE))
    const start = (pg - 1) * PAGE_SIZE
    setIcons(filtered.slice(start, start + PAGE_SIZE))
    setPages(totalPages)
    setTotal(totalLocal)
    setLoading(false)
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCategory = useCallback((cat: string) => {
    setCategory(cat); setPage(1)
    if (mode === 'local') loadLocal(cat, query, 1)
    else loadServer(cat, query, 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, query])

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    if (searchTimer.current) window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => {
      setPage(1)
      if (mode === 'local') loadLocal(category, q, 1)
      else loadServer(category, q, 1)
    }, 300)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, category])

  const handlePage = useCallback((pg: number) => {
    setPage(pg)
    if (mode === 'local') loadLocal(category, query, pg)
    else loadServer(category, query, pg)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, category, query])

  // ── Insert handler — fetch SVG text for server icons ─────────────────────────
  const handleInsert = useCallback(async (asset: BuiltinAsset & { svgUrl?: string }) => {
    if (asset.svgUrl && !asset.svg) {
      try {
        // Fetch via the /api/icons/:id/svg proxy to avoid CORS issues with signed URLs
        const proxyUrl = `${ICON_SERVER}/api/icons/${asset.id}/svg`
        const svg = await fetchSvgText(proxyUrl)
        onInsertAsset({ ...asset, svg })
      } catch {
        // Fallback: try direct signed URL
        try {
          const svg = await fetchSvgText(asset.svgUrl)
          onInsertAsset({ ...asset, svg })
        } catch {
          console.error('Failed to fetch SVG for', asset.id)
        }
      }
    } else {
      onInsertAsset(asset)
    }
  }, [onInsertAsset])

  const start = (page - 1) * PAGE_SIZE + 1
  const end   = Math.min(page * PAGE_SIZE, total)

  return (
    <aside className="assetPanel" aria-label="Asset library">
      {/* Header */}
      <div className="assetPanelHeader">
        <strong>Assets</strong>
        <span
          className={`assetSource ${mode}`}
          title={mode === 'server' ? `${total} icons from server` : 'Using local icons'}
        >
          {mode === 'server' ? '🟢 Server' : '⚪ Local'}
        </span>
      </div>

      {/* Search */}
      <input
        className="assetSearch"
        placeholder="Search icons…"
        value={query}
        onChange={e => handleSearch(e.target.value)}
        aria-label="Search icons"
      />

      {/* Category pills */}
      <div className="assetCategories" aria-label="Categories">
        {categories.map(cat => (
          <button
            key={cat}
            className={cat === category ? 'assetCategory active' : 'assetCategory'}
            onClick={() => handleCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Icon grid */}
      <div className="assetGrid" aria-busy={loading}>
        {loading ? (
          <div className="assetGridLoading"><div className="assetSpinner" /></div>
        ) : icons.length === 0 ? (
          <div className="assetEmpty">No icons found</div>
        ) : (
          icons.map(asset => (
            <button
              key={asset.id}
              className="assetTile"
              title="Click to insert · drag to canvas"
              draggable
              onClick={() => handleInsert(asset)}
              onDragStart={e => {
                dragState.set(asset)
                e.dataTransfer.effectAllowed = 'copy'
                const ghost = document.createElement('div')
                if (asset.svgUrl) {
                  // Use <img> for ghost when we have a URL
                  const img = document.createElement('img')
                  img.src = asset.svgUrl
                  img.style.cssText = 'width:96px;height:96px;'
                  ghost.appendChild(img)
                } else {
                  ghost.innerHTML = asset.svg
                }
                ghost.style.cssText = 'position:fixed;top:-200px;left:-200px;width:96px;height:96px;pointer-events:none;'
                document.body.appendChild(ghost)
                e.dataTransfer.setDragImage(ghost, 48, 48)
                setTimeout(() => ghost.remove(), 0)
              }}
              onDragEnd={() => dragState.set(null)}
            >
              {/* Display: use <img> for server icons (signed URL), inline SVG for local */}
              {asset.svgUrl ? (
                <span className="assetPreview" aria-hidden="true">
                  <img
                    src={asset.svgUrl}
                    alt={asset.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    loading="lazy"
                  />
                </span>
              ) : (
                <span className="assetPreview" aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: asset.svg }}
                />
              )}
              <span>{asset.name}</span>
            </button>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="assetPagination">
          <span className="assetPagInfo">{start}–{end} of {total}</span>
          <div className="assetPagBtns">
            <button className="assetPagBtn" disabled={page <= 1} onClick={() => handlePage(page - 1)} aria-label="Previous">‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map(pg => (
              <button key={pg} className={`assetPagBtn ${pg === page ? 'active' : ''}`} onClick={() => handlePage(pg)}>{pg}</button>
            ))}
            <button className="assetPagBtn" disabled={page >= pages} onClick={() => handlePage(page + 1)} aria-label="Next">›</button>
          </div>
        </div>
      )}
    </aside>
  )
}
