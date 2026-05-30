import Editor, { type OnMount } from '@monaco-editor/react'
import { useCallback, useRef, useState } from 'react'
import type { CodeLang, CodeTheme } from './codeToSvg'
import { codeToSvg } from './codeToSvg'

// Monaco language IDs for each option
const LANGS: { value: CodeLang; label: string; monaco: string; sample: string }[] = [
  {
    value: 'javascript', label: 'JavaScript', monaco: 'javascript',
    sample: `// JavaScript example\nconst greet = (name) => {\n  console.log(\`Hello, \${name}!\`)\n}\n\ngreet('World')`,
  },
  {
    value: 'html', label: 'HTML', monaco: 'html',
    sample: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <title>My Page</title>\n  </head>\n  <body>\n    <h1>Hello World</h1>\n  </body>\n</html>`,
  },
  {
    value: 'css', label: 'CSS', monaco: 'css',
    sample: `.container {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background-color: #1e1e1e;\n  padding: 16px;\n}`,
  },
  {
    value: 'cpp', label: 'C++', monaco: 'cpp',
    sample: `#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    vector<int> nums = {1, 2, 3, 4, 5};\n    for (int n : nums) {\n        cout << n << endl;\n    }\n    return 0;\n}`,
  },
  {
    value: 'java', label: 'Java', monaco: 'java',
    sample: `import java.util.ArrayList;\n\npublic class Main {\n    public static void main(String[] args) {\n        ArrayList<String> list = new ArrayList<>();\n        list.add("Hello");\n        list.add("World");\n        for (String s : list) {\n            System.out.println(s);\n        }\n    }\n}`,
  },
]

interface Props {
  onInsert: (svgDataUrl: string, width: number, height: number) => void
  onClose:  () => void
}

export function CodeBlockModal({ onInsert, onClose }: Props) {
  const [langIdx,   setLangIdx]   = useState(0)
  const [theme,     setTheme]     = useState<CodeTheme>('dark')
  const [filename,  setFilename]  = useState('')
  const [code,      setCode]      = useState(LANGS[0].sample)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)

  const currentLang = LANGS[langIdx]

  const handleLangChange = useCallback((idx: number) => {
    setLangIdx(idx)
    setCode(LANGS[idx].sample)
    setFilename('')
  }, [])

  const handleInsert = useCallback(() => {
    const src = editorRef.current ? editorRef.current.getValue() : code
    if (!src.trim()) return
    const svg = codeToSvg(src, {
      lang: currentLang.value,
      theme,
      filename: filename.trim() || undefined,
    })
    const wMatch = svg.match(/width="([\d.]+)"/)
    const hMatch = svg.match(/height="([\d.]+)"/)
    const w = wMatch ? parseFloat(wMatch[1]) : 600
    const h = hMatch ? parseFloat(hMatch[1]) : 300
    onInsert(`data:image/svg+xml,${encodeURIComponent(svg)}`, w, h)
    onClose()
  }, [code, currentLang, theme, filename, onInsert, onClose])

  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs'
  const lineCount   = code.split('\n').length

  return (
    <div className="cbOverlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cbModal">
        {/* ── Header ── */}
        <div className="cbHeader">
          <div className="cbHeaderTitle">
            <span className="cbHeaderIcon">{'</>'}</span>
            <span>Insert Code Block</span>
          </div>
          <button className="cbClose" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* ── Controls ── */}
        <div className="cbControls">
          {/* Language tabs */}
          <div className="cbLangTabs" role="tablist" aria-label="Language">
            {LANGS.map((l, i) => (
              <button
                key={l.value}
                role="tab"
                aria-selected={i === langIdx}
                className={`cbLangTab ${i === langIdx ? 'active' : ''}`}
                onClick={() => handleLangChange(i)}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="cbControlsRight">
            {/* Filename */}
            <label className="cbField">
              <span>Filename</span>
              <input
                type="text"
                placeholder={`snippet.${currentLang.monaco === 'cpp' ? 'cpp' : currentLang.monaco}`}
                value={filename}
                onChange={e => setFilename(e.target.value)}
              />
            </label>

            {/* Theme toggle */}
            <div className="cbThemeToggle">
              <span>Theme</span>
              <div className="cbThemeBtns">
                <button className={theme === 'dark'  ? 'active' : ''} onClick={() => setTheme('dark')}>Dark</button>
                <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Light</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Monaco Editor ── */}
        <div className="cbEditorWrap" data-theme={theme}>
          <Editor
            height="100%"
            language={currentLang.monaco}
            theme={monacoTheme}
            value={code}
            onChange={v => setCode(v ?? '')}
            onMount={editor => { editorRef.current = editor }}
            options={{
              fontSize: 13,
              fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
              fontLigatures: true,
              lineHeight: 20,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              renderLineHighlight: 'all',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              tabSize: 2,
              wordWrap: 'on',
              padding: { top: 14, bottom: 14 },
              // Autocomplete / IntelliSense
              quickSuggestions: { other: true, comments: true, strings: true },
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: 'on',
              tabCompletion: 'on',
              parameterHints: { enabled: true },
              inlineSuggest: { enabled: true },
              snippetSuggestions: 'top',
              formatOnType: true,
              formatOnPaste: true,
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              autoIndent: 'full',
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>

        {/* ── Footer ── */}
        <div className="cbFooter">
          <span className="cbHint">
            {lineCount} line{lineCount !== 1 ? 's' : ''} · Monaco Editor · renders as SVG on canvas
          </span>
          <div className="cbActions">
            <button className="cbBtn secondary" onClick={onClose}>Cancel</button>
            <button className="cbBtn primary" onClick={handleInsert} disabled={!code.trim()}>
              Insert to Canvas
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
