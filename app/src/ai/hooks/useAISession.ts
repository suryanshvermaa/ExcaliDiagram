// ── useAISession hook ─────────────────────────────────────────────────────────
// Central state management for the AI sidebar.
// Handles: session CRUD, message sending, streaming, arch generation.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AISession, AIMessage, AISettings, ProviderID } from '../types/ai.types'
import {
  loadSessions, upsertSession, deleteSession, renameSession,
  createSession, getActiveSessionId, setActiveSessionId,
  loadSettings, saveSettings,
} from '../storage/aiSessionStorage'
import {
  generateArchitecture, modifyArchitecture, explainArchitecture,
  improveArchitecture, streamChat,
} from '../api/aiAgentClient'
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'

function newId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// ── Mermaid sanitizer ──────────────────────────────────────────────────────────
// Final safety net: enforces all rules even if the AI drifts.
// KEY: strips subgraph...end blocks — they become Excalidraw frames which
// require double-click to enter. Flat diagram = all elements directly editable.
function sanitizeMermaid(code: string): string {
  let out = code
    // Strip markdown fences
    .replace(/^```(?:mermaid)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim()

  // ── Strip entire subgraph blocks (they create non-editable frames) ────────
  // Remove from "subgraph ..." to the next "end" line
  out = out.replace(/^\s*subgraph\b[^\n]*\n/gim, '')
  out = out.replace(/^\s*end\s*$/gim, '')

  out = out
    .split('\n')
    .map(line => {
      const t = line.trim()

      // ── Drop forbidden lines ──────────────────────────────────────────────
      if (/^style\s+/i.test(t))     return ''   // inline style
      if (/^linkStyle\s+/i.test(t)) return ''   // link styling
      if (/^click\s+/i.test(t))     return ''   // click events
      if (/^%%/.test(t))            return ''   // comments / directives
      // classDef and class are KEPT — needed for node colors

      // ── Arrow fixes ───────────────────────────────────────────────────────
      let l = line
        .replace(/\s*-\.->\s*/g, ' --> ')   // dashed → solid
        .replace(/\s*==>\s*/g, ' --> ')      // thick → solid
        .replace(/\s*---\s*>/g, ' --> ')     // invisible → solid
        .replace(/-->\s*\|[^|]*\|\s*/g, '--> ')   // strip arrow labels: -->|x|
        .replace(/--\s+[^-\n]+\s+-->/g, '-->')    // strip inline labels: -- x -->

      // ── Shape fixes: all non-rectangles → rectangles ──────────────────────
      l = l
        .replace(/(\w+)\(\(\(([^)]+)\)\)\)/g, '$1[$2]')  // (((triple)))
        .replace(/(\w+)\(\(([^)]+)\)\)/g,     '$1[$2]')  // ((circle))
        .replace(/(\w+)\[\(([^\]]+)\)\]/g,    '$1[$2]')  // [(cylinder)]
        .replace(/(\w+)\(\[([^\]]+)\]\)/g,    '$1[$2]')  // ([stadium])
        .replace(/(\w+)\{\{([^}]+)\}\}/g,     '$1[$2]')  // {{rhombus}}
        .replace(/(\w+)\[\/([^\]]+)\/\]/g,    '$1[$2]')  // [/trapezoid/]
        .replace(/(\w+)\[\\([^\]]+)\\\]/g,    '$1[$2]')  // [\trapezoid\]

      // Remove parens inside square-bracket labels: A[Foo (Bar)] → A[Foo Bar]
      l = l.replace(/\[([^\]]*)\]/g, (_, inner) =>
        `[${inner.replace(/[()]/g, '').trim()}]`
      )

      return l
    })
    .filter(l => l !== null)
    .join('\n')

  return out
}


// ── Mermaid → Excalidraw pipeline ─────────────────────────────────────────
// Exact pipeline that excalidraw.com uses for its Mermaid import dialog:
//   parseMermaidToExcalidraw  →  skeleton elements with correct layout
//   convertToExcalidrawElements  →  full Excalidraw elements
// Frames are kept intact. In Excalidraw, elements inside a frame are fully
// editable — click directly on a box/arrow to select it individually.
async function mermaidToElements(mermaidCode: string) {
  const { elements: skelElements, files } =
    await parseMermaidToExcalidraw(mermaidCode)

  // Convert skeleton → full ExcalidrawElements, regenerating all IDs so
  // consecutive generations never clash.
  const elements = convertToExcalidrawElements(
    skelElements as any,
    { regenerateIds: true } as any,
  )

  return { elements, files: (files ?? {}) as any }
}

function autoTitle(content: string): string {
  return content.slice(0, 48).replace(/\n/g, ' ').trim() + (content.length > 48 ? '…' : '')
}

// Intent detection: determine what the user wants to do
type Intent = 'generate' | 'modify' | 'explain' | 'improve' | 'chat'

function detectIntent(content: string, hasMermaid: boolean): Intent {
  const lower = content.toLowerCase()
  const GENERATE_KW = ['create', 'design', 'generate', 'build', 'make', 'architecture for', 'draw']
  const MODIFY_KW   = ['add', 'remove', 'replace', 'convert', 'make it', 'update', 'change', 'improve the architecture', 'scale']
  const EXPLAIN_KW  = ['explain', 'what is', 'describe', 'how does', 'why', 'request flow', 'bottleneck', 'security issue', 'scalability']
  const IMPROVE_KW  = ['suggest', 'improvement', 'optimise', 'optimize', 'best practice', 'better']

  if (EXPLAIN_KW.some(kw => lower.includes(kw))) return 'explain'
  if (IMPROVE_KW.some(kw => lower.includes(kw))) return 'improve'
  if (hasMermaid && MODIFY_KW.some(kw => lower.includes(kw))) return 'modify'
  if (GENERATE_KW.some(kw => lower.includes(kw))) return 'generate'
  return 'chat'
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAISession(
  onRenderArch?: (elements: any[], files: Record<string, any>) => void,
  // getCurrentArchSpec is kept for backward-compat but we now track raw Mermaid
  _getCurrentArchSpec?: () => unknown,
) {
  const [sessions, setSessions] = useState<AISession[]>(() => loadSessions())
  const [activeId, setActiveId] = useState<string | null>(() => getActiveSessionId())
  const [settings, setSettings] = useState<AISettings>(() => loadSettings())
  const [isLoading, setIsLoading] = useState(false)
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const cancelStreamRef  = useRef<(() => void) | null>(null)
  // Track the last Mermaid code we rendered so 'modify' can reference it
  const lastMermaidRef   = useRef<string>('')

  // Derive active session
  const activeSession = sessions.find(s => s.id === activeId) ?? null

  // ── Sync to localStorage ───────────────────────────────────────────────────
  useEffect(() => { setActiveSessionId(activeId) }, [activeId])
  useEffect(() => { saveSettings(settings)       }, [settings])

  // ── Session management ─────────────────────────────────────────────────────
  const newChat = useCallback(() => {
    const session = createSession(settings.provider, settings.model)
    upsertSession(session)
    setSessions(loadSessions())
    setActiveId(session.id)
  }, [settings])

  const switchSession = useCallback((id: string) => { setActiveId(id) }, [])

  const removeSession = useCallback((id: string) => {
    deleteSession(id)
    setSessions(loadSessions())
    if (activeId === id) {
      const remaining = loadSessions()
      setActiveId(remaining[0]?.id ?? null)
    }
  }, [activeId])

  const rename = useCallback((id: string, title: string) => {
    renameSession(id, title)
    setSessions(loadSessions())
  }, [])

  // ── Append / update messages ───────────────────────────────────────────────
  const appendMessage = useCallback((msg: AIMessage, sessionId: string) => {
    const sessions = loadSessions()
    const session  = sessions.find(s => s.id === sessionId)
    if (!session) return
    session.messages.push(msg)
    session.updatedAt = new Date().toISOString()
    if (session.messages.length === 1) session.title = autoTitle(msg.content)
    upsertSession(session)
    setSessions(loadSessions())
  }, [])

  const updateMessage = useCallback((msgId: string, update: Partial<AIMessage>, sessionId: string) => {
    const sessions = loadSessions()
    const session  = sessions.find(s => s.id === sessionId)
    if (!session) return
    const msg = session.messages.find(m => m.id === msgId)
    if (!msg) return
    Object.assign(msg, update)
    upsertSession(session)
    setSessions(loadSessions())
  }, [])

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    // Ensure we have an active session
    let sessId = activeId
    if (!sessId) {
      const session = createSession(settings.provider, settings.model)
      upsertSession(session)
      setSessions(loadSessions())
      setActiveId(session.id)
      sessId = session.id
    }

    const userMsg: AIMessage = {
      id: newId(), role: 'user', content,
      timestamp: new Date().toISOString(), type: 'chat',
    }
    appendMessage(userMsg, sessId)
    setIsLoading(true)

    const hasMermaid = lastMermaidRef.current.length > 0
    const intent     = detectIntent(content, hasMermaid)

    try {
      if (intent === 'generate') {
        // ── Architecture generation via LangGraph ─────────────────────────────
        const aiMsgId = newId()
        appendMessage({
          id: aiMsgId, role: 'assistant',
          content: '⏳ Generating architecture…',
          timestamp: new Date().toISOString(), type: 'arch-generate',
        }, sessId)

        const mermaidCode = await generateArchitecture(content, settings)
        const cleanCode   = sanitizeMermaid(mermaidCode)
        lastMermaidRef.current = cleanCode

        const { elements, files } = await mermaidToElements(cleanCode)

        updateMessage(aiMsgId, {
          content:    `✅ Architecture generated!\n\`\`\`mermaid\n${cleanCode}\n\`\`\``,
          isStreaming: false,
        }, sessId)

        onRenderArch?.(elements as any, files)

      } else if (intent === 'modify' && hasMermaid) {
        // ── Architecture modification (Mermaid-in, Mermaid-out) ───────────────
        const aiMsgId = newId()
        appendMessage({
          id: aiMsgId, role: 'assistant',
          content: '⏳ Modifying architecture…',
          timestamp: new Date().toISOString(), type: 'arch-modify',
        }, sessId)

        const updatedMermaid = await modifyArchitecture(
          content,
          lastMermaidRef.current,  // pass current diagram as context
          settings,
        )
        const cleanCode = sanitizeMermaid(updatedMermaid)
        lastMermaidRef.current = cleanCode

        const { elements, files } = await mermaidToElements(cleanCode)

        updateMessage(aiMsgId, {
          content:    `✅ Architecture updated!\n\`\`\`mermaid\n${cleanCode}\n\`\`\``,
          isStreaming: false,
        }, sessId)

        onRenderArch?.(elements as any, files)

      } else if (intent === 'explain' || intent === 'improve') {
        // ── Explain / improve (text response, no diagram change) ──────────────
        const aiMsgId = newId()
        appendMessage({
          id: aiMsgId, role: 'assistant',
          content: '⏳ Analyzing architecture…',
          timestamp: new Date().toISOString(),
          type: intent === 'explain' ? 'arch-explain' : 'arch-improve',
        }, sessId)

        // Pass current mermaid code as string context (not ArchSpec JSON)
        const mermaidContext = hasMermaid ? lastMermaidRef.current : null

        const answer = intent === 'explain'
          ? await explainArchitecture(content, mermaidContext, settings)
          : await improveArchitecture(mermaidContext, content, settings)

        updateMessage(aiMsgId, { content: answer, isStreaming: false }, sessId)

      } else {
        // ── General streaming chat ────────────────────────────────────────────
        const aiMsgId = newId()
        const aiMsg: AIMessage = {
          id: aiMsgId, role: 'assistant', content: '',
          timestamp: new Date().toISOString(), type: 'chat', isStreaming: true,
        }
        appendMessage(aiMsg, sessId)
        setStreamingMsgId(aiMsgId)

        // Build message history for context
        const session = loadSessions().find(s => s.id === sessId)
        const history = (session?.messages || [])
          .slice(-20)
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

        let accumulated = ''
        const cancel = streamChat(
          history,
          settings,
          (token) => {
            accumulated += token
            updateMessage(aiMsgId, { content: accumulated }, sessId)
          },
          () => {
            updateMessage(aiMsgId, { isStreaming: false }, sessId)
            setStreamingMsgId(null)
          },
          (err) => {
            updateMessage(aiMsgId, {
              content:    `❌ Error: ${err}`,
              type:       'error',
              isStreaming: false,
            }, sessId)
            setStreamingMsgId(null)
          },
        )
        cancelStreamRef.current = cancel
      }
    } catch (err: any) {
      const errMsg: AIMessage = {
        id: newId(), role: 'assistant',
        content:   `❌ **Error:** ${err.message}`,
        timestamp: new Date().toISOString(),
        type:      'error',
      }
      appendMessage(errMsg, sessId)
    } finally {
      setIsLoading(false)
    }
  }, [activeId, isLoading, settings, appendMessage, updateMessage, onRenderArch])

  const cancelStream = useCallback(() => {
    cancelStreamRef.current?.()
    cancelStreamRef.current = null
    setStreamingMsgId(null)
  }, [])

  // ── Filtered sessions for search ───────────────────────────────────────────
  const filteredSessions = searchQuery
    ? sessions.filter(s =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    : sessions

  return {
    sessions: filteredSessions,
    activeSession,
    activeId,
    settings,
    isLoading,
    streamingMsgId,
    searchQuery,
    setSearchQuery,
    setSettings,
    newChat,
    switchSession,
    removeSession,
    rename,
    sendMessage,
    cancelStream,
  }
}
