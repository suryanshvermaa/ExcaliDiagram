// Converts source code into a VS Code–style SVG image element.

export type CodeTheme = 'dark' | 'light'
export type CodeLang = 'javascript' | 'html' | 'css' | 'cpp' | 'java' | 'text'

const THEMES = {
  dark:  { bg: '#1e1e1e', titleBg: '#2d2d2d', border: '#3e3e42', text: '#d4d4d4', lineNum: '#5a5a5a', kw: '#569cd6', str: '#ce9178', cmt: '#6a9955', num: '#b5cea8', fn: '#dcdcaa', ty: '#4ec9b0', op: '#d4d4d4', builtin: '#9cdcfe', dot: '#d4d4d4' },
  light: { bg: '#ffffff', titleBg: '#f3f3f3', border: '#e5e5e5', text: '#000000', lineNum: '#a0a0a0', kw: '#0000ff', str: '#a31515', cmt: '#008000', num: '#098658', fn: '#795e26', ty: '#267f99', op: '#000000', builtin: '#001080', dot: '#000000' },
}

const KW: Record<string, string[]> = {
  javascript: ['const','let','var','function','class','extends','return','if','else','for','while','do','switch','case','break','continue','import','export','default','from','async','await','try','catch','finally','throw','new','this','typeof','instanceof','in','of','delete','void','null','undefined','true','false'],
  typescript: ['const','let','var','function','class','extends','return','if','else','for','while','do','switch','case','break','continue','import','export','default','from','async','await','try','catch','finally','throw','new','this','typeof','instanceof','in','of','null','undefined','true','false','type','interface','enum','as','implements','abstract','readonly','public','private','protected','static'],
  python:     ['def','class','import','from','return','if','elif','else','for','while','try','except','finally','with','as','pass','break','continue','raise','lambda','and','or','not','in','is','None','True','False','async','await','yield','global','nonlocal','del','assert'],
  rust:       ['fn','let','mut','const','struct','enum','impl','trait','use','pub','mod','match','if','else','loop','while','for','in','return','break','continue','self','Self','super','crate','async','await','move','type','where','true','false','Some','None','Ok','Err','Box','Vec','String','Option','Result'],
  go:         ['func','var','const','type','struct','interface','map','chan','select','switch','case','if','else','for','range','return','break','continue','import','package','go','defer','nil','true','false','make','new','len','cap','append','delete','panic','recover','error'],
  bash:       ['if','then','else','elif','fi','for','do','done','while','case','esac','function','in','echo','export','source','local','return','exit','set','unset','readonly','shift','test'],
  json:       [],
  css:        ['var','calc','inherit','initial','unset','none','auto','normal','bold','italic'],
  html:       [],
  text:       [],
}

type TT = 'kw'|'str'|'cmt'|'num'|'fn'|'ty'|'builtin'|'op'|'text'
type Tok = { t: string; c: TT }

function x(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function tokenizeLine(line: string, lang: CodeLang, inBlock: boolean): { tokens: Tok[]; inBlock: boolean } {
  const tokens: Tok[] = []
  const keywords = KW[lang] ?? []
  let i = 0

  // Handle end of block comment
  const text = line

  if (lang === 'json') {
    // Simple JSON tokenizer
    const m = line.match(/^(\s*"[^"]*"\s*:\s*)(.*)$/)
    if (m) {
      tokens.push({ t: m[1], c: 'builtin' })
      const val = m[2].trim()
      if (val.startsWith('"')) tokens.push({ t: m[2], c: 'str' })
      else if (/^-?\d/.test(val)) tokens.push({ t: m[2], c: 'num' })
      else if (val === 'true' || val === 'false' || val === 'null') tokens.push({ t: m[2], c: 'kw' })
      else tokens.push({ t: m[2], c: 'text' })
    } else {
      tokens.push({ t: line, c: 'text' })
    }
    return { tokens, inBlock }
  }

  while (i < text.length) {
    // Block comment end
    if (inBlock) {
      const end = text.indexOf('*/', i)
      if (end === -1) { tokens.push({ t: text.slice(i), c: 'cmt' }); i = text.length; continue }
      tokens.push({ t: text.slice(i, end + 2), c: 'cmt' }); i = end + 2; inBlock = false; continue
    }
    // Block comment start
    if (text[i] === '/' && text[i+1] === '*') {
      const end = text.indexOf('*/', i + 2)
      if (end === -1) { tokens.push({ t: text.slice(i), c: 'cmt' }); i = text.length; inBlock = true; continue }
      tokens.push({ t: text.slice(i, end + 2), c: 'cmt' }); i = end + 2; continue
    }
    // Single-line comment
    if ((lang === 'bash' || lang === 'python') && text[i] === '#') { tokens.push({ t: text.slice(i), c: 'cmt' }); break }
    if (text[i] === '/' && text[i+1] === '/') { tokens.push({ t: text.slice(i), c: 'cmt' }); break }
    if (lang === 'css' && text.slice(i,i+2) === '/*') { tokens.push({ t: text.slice(i), c: 'cmt' }); break }
    // Strings
    if (text[i] === '"' || text[i] === "'" || text[i] === '`') {
      const q = text[i]; let j = i + 1
      while (j < text.length && (text[j] !== q || text[j-1] === '\\')) j++
      if (j < text.length) j++
      tokens.push({ t: text.slice(i, j), c: 'str' }); i = j; continue
    }
    // Number
    if (/\d/.test(text[i]) && (i === 0 || /\W/.test(text[i-1]))) {
      let j = i
      while (j < text.length && /[\d._xboBEe]/.test(text[j])) j++
      tokens.push({ t: text.slice(i, j), c: 'num' }); i = j; continue
    }
    // Identifier / keyword / function
    if (/[a-zA-Z_$]/.test(text[i])) {
      let j = i
      while (j < text.length && /[\w$]/.test(text[j])) j++
      const word = text.slice(i, j)
      const isFn = text[j] === '('
      if (keywords.includes(word)) tokens.push({ t: word, c: 'kw' })
      else if (isFn) tokens.push({ t: word, c: 'fn' })
      else if (/^[A-Z]/.test(word)) tokens.push({ t: word, c: 'ty' })
      else tokens.push({ t: word, c: 'builtin' })
      i = j; continue
    }
    // Operator / punctuation
    if (/[+\-*/%=<>!&|^~?:;,[\]{}().]/.test(text[i])) {
      tokens.push({ t: text[i], c: 'op' }); i++; continue
    }
    tokens.push({ t: text[i], c: 'text' }); i++
  }
  return { tokens, inBlock }
}

export function codeToSvg(code: string, opts: { lang: CodeLang; theme: CodeTheme; filename?: string }): string {
  const th = THEMES[opts.theme]
  const lines = code.split('\n')
  // Trim trailing empty lines
  while (lines.length > 1 && lines[lines.length-1].trim() === '') lines.pop()

  const CHAR_W = 7.8
  const LINE_H = 20
  const TITLE_H = 36
  const GUTTER = 44
  const PAD_L = 12
  const PAD_R = 24
  const PAD_V = 14
  const FONT = `font-family="'Cascadia Code','Fira Code','Consolas',monospace" font-size="13"`

  const maxLen = Math.max(...lines.map(l => l.length), 30)
  const W = Math.max(480, GUTTER + PAD_L + maxLen * CHAR_W + PAD_R)
  const H = TITLE_H + PAD_V + lines.length * LINE_H + PAD_V

  // Tokenize all lines
  let inBlock = false
  const tokenizedLines = lines.map(line => {
    const res = tokenizeLine(line, opts.lang, inBlock)
    inBlock = res.inBlock
    return res.tokens
  })

  const colorMap: Record<TT, string> = {
    kw: th.kw, str: th.str, cmt: th.cmt, num: th.num,
    fn: th.fn, ty: th.ty, builtin: th.builtin, op: th.op, text: th.text,
  }

  // Build code SVG rows
  const rows = tokenizedLines.map((tokens, idx) => {
    const y = TITLE_H + PAD_V + idx * LINE_H + LINE_H - 4
    const lineNum = `<text x="${GUTTER - 6}" y="${y}" text-anchor="end" ${FONT} fill="${th.lineNum}" opacity="0.7">${idx+1}</text>`
    let cx = GUTTER + PAD_L
    const spans = tokens.map(tok => {
      const tx = cx
      cx += tok.t.length * CHAR_W
      return `<text x="${tx}" y="${y}" ${FONT} fill="${colorMap[tok.c]}">${x(tok.t)}</text>`
    }).join('')
    return lineNum + spans
  }).join('\n')

  const lang = opts.lang === 'cpp' ? 'C++' : opts.lang.charAt(0).toUpperCase() + opts.lang.slice(1)
  const extMap: Record<string, string> = { javascript: 'js', html: 'html', css: 'css', cpp: 'cpp', java: 'java', text: 'txt' }
  const filename = opts.filename || `snippet.${extMap[opts.lang] ?? opts.lang}`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- Window -->
  <rect width="${W}" height="${H}" rx="10" fill="${th.border}"/>
  <rect x="1" y="1" width="${W-2}" height="${H-2}" rx="9" fill="${th.bg}"/>
  <!-- Title bar -->
  <rect width="${W}" height="${TITLE_H}" rx="9" fill="${th.titleBg}"/>
  <rect y="${TITLE_H-8}" width="${W}" height="8" fill="${th.titleBg}"/>
  <!-- Traffic lights -->
  <circle cx="18" cy="18" r="6" fill="#ff5f57"/>
  <circle cx="36" cy="18" r="6" fill="#febc2e"/>
  <circle cx="54" cy="18" r="6" fill="#28c840"/>
  <!-- Filename -->
  <text x="${W/2}" y="23" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="${opts.theme==='dark'?'#cccccc':'#555555'}">${x(filename)}</text>
  <!-- Language badge -->
  <rect x="${W-72}" y="9" width="64" height="18" rx="4" fill="${opts.theme==='dark'?'#3c3c3c':'#e8e8e8'}"/>
  <text x="${W-40}" y="22" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="600" fill="${th.kw}">${lang}</text>
  <!-- Gutter -->
  <rect x="0" y="${TITLE_H}" width="${GUTTER}" height="${H-TITLE_H}" fill="${opts.theme==='dark'?'#252526':'#f5f5f5'}"/>
  <!-- Code -->
  ${rows}
</svg>`
}
