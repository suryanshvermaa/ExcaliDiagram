import { useState } from 'react'
import { AssetLibraryPanel } from '../assets/AssetLibraryPanel'
import type { BuiltinAsset } from '../assets/assetCatalog'
import { CodeBlockModal } from '../editor/CodeBlockModal'

type Tab = 'assets' | 'code'

interface Props {
  onInsertAsset: (asset: BuiltinAsset) => void
  onInsertSvg:  (dataUrl: string, w: number, h: number) => void
}

export function SidebarPanel({ onInsertAsset, onInsertSvg }: Props) {
  const [tab, setTab]            = useState<Tab>('assets')
  const [codeModalOpen, setCode] = useState(false)

  return (
    <>
      <div className="sidebarPanel">

        {/* ── Tab bar ── */}
        <div className="sidebarTabBar">
          <button
            className={`sidebarTab ${tab === 'assets' ? 'active' : ''}`}
            onClick={() => setTab('assets')}
          >
            🗂 Assets
          </button>
          <button
            className={`sidebarTab ${tab === 'code' ? 'active' : ''}`}
            onClick={() => setTab('code')}
          >
            &lt;/&gt; Code
          </button>
        </div>

        {/* ── Content ── */}
        <div className="sidebarContent">

          {tab === 'assets' && (
            <AssetLibraryPanel onInsertAsset={onInsertAsset} />
          )}

          {tab === 'code' && (
            <div className="sidebarCodeTab">
              <div className="sidebarCodeIcon">{'</>'}</div>
              <p className="sidebarCodeDesc">
                Insert a syntax-highlighted VS Code–style code block onto the canvas.
                Supports JavaScript, HTML, CSS, C++ and Java with full Monaco IntelliSense.
              </p>
              <button className="sidebarCodeBtn" onClick={() => setCode(true)}>
                Open Code Editor
              </button>
              <ul className="sidebarCodeFeatures">
                <li>✓ Autocomplete &amp; IntelliSense</li>
                <li>✓ Bracket pair colorization</li>
                <li>✓ Dark &amp; Light themes</li>
                <li>✓ Renders as crisp SVG on canvas</li>
              </ul>
            </div>
          )}

        </div>
      </div>

      {codeModalOpen && (
        <CodeBlockModal
          onInsert={onInsertSvg}
          onClose={() => setCode(false)}
        />
      )}
    </>
  )
}
