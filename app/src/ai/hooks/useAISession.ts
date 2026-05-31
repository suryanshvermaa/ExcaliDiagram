// ── useAISession hook ─────────────────────────────────────────────────────────
// Central state management for the AI sidebar.
// Handles: session CRUD, message sending, streaming, arch generation.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AISession, AIMessage, AISettings, ArchSpec, ProviderID } from '../types/ai.types'
import {
  loadSessions, upsertSession, deleteSession, renameSession,
  createSession, getActiveSessionId, setActiveSessionId,
  loadSettings, saveSettings,
} from '../storage/aiSessionStorage'
import {
  generateArchitecture, modifyArchitecture, explainArchitecture,
  improveArchitecture, streamChat,
} from '../api/aiAgentClient'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'

function newId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function autoTitle(content: string): string {
  return content.slice(0, 48).replace(/\n/g, ' ').trim() + (content.length > 48 ? '…' : '')
}

// Intent detection: determine what the user wants to do
type Intent = 'generate' | 'modify' | 'explain' | 'improve' | 'chat'

function detectIntent(content: string, hasCanvas: boolean): Intent {
  const lower = content.toLowerCase()
  const GENERATE_KW = ['create', 'design', 'generate', 'build', 'make', 'architecture for', 'draw']
  const MODIFY_KW   = ['add', 'remove', 'replace', 'convert', 'make it', 'update', 'change', 'improve the architecture', 'scale']
  const EXPLAIN_KW  = ['explain', 'what is', 'describe', 'how does', 'why', 'request flow', 'bottleneck', 'security issue', 'scalability']
  const IMPROVE_KW  = ['suggest', 'improvement', 'optimise', 'optimize', 'best practice', 'better']

  if (EXPLAIN_KW.some(kw => lower.includes(kw))) return 'explain'
  if (IMPROVE_KW.some(kw => lower.includes(kw))) return 'improve'
  if (hasCanvas && MODIFY_KW.some(kw => lower.includes(kw))) return 'modify'
  if (GENERATE_KW.some(kw => lower.includes(kw))) return 'generate'
  return 'chat'
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAISession(
  onRenderArch?: (
    elements: any[],
    files: Record<string, any>
  ) => void,
  getCurrentArchSpec?: () => ArchSpec | null,
) {
  const [sessions,       setSessions]       = useState<AISession[]>(() => loadSessions())
  const [activeId,       setActiveId]       = useState<string | null>(() => getActiveSessionId())
  const [settings,       setSettings]       = useState<AISettings>(() => loadSettings())
  const [isLoading,      setIsLoading]      = useState(false)
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null)
  const [searchQuery,    setSearchQuery]    = useState('')
  const cancelStreamRef  = useRef<(() => void) | null>(null)

  // Derive active session
  const activeSession = sessions.find(s => s.id === activeId) ?? null

  // ── Sync to localStorage ───────────────────────────────────────────────────
  const syncSession = useCallback((session: AISession) => {
    upsertSession(session)
    setSessions(loadSessions())
  }, [])

  useEffect(() => {
    setActiveSessionId(activeId)
  }, [activeId])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // ── Session management ─────────────────────────────────────────────────────
  const newChat = useCallback(() => {
    const session = createSession(settings.provider, settings.model)
    upsertSession(session)
    setSessions(loadSessions())
    setActiveId(session.id)
  }, [settings])

  const switchSession = useCallback((id: string) => {
    setActiveId(id)
  }, [])

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

  // ── Append a message to the active session ─────────────────────────────────
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
      id:        newId(),
      role:      'user',
      content,
      timestamp: new Date().toISOString(),
      type:      'chat',
    }
    appendMessage(userMsg, sessId)
    setIsLoading(true)

    const currentSpec = getCurrentArchSpec?.() ?? null
    const intent      = detectIntent(content, currentSpec !== null)

    try {
      if (intent === 'generate') {
        // ── Architecture generation via LangGraph ───────────────────────────
        const aiMsgId = newId()
        appendMessage({
          id: aiMsgId, role: 'assistant', content: '⏳ Generating architecture…',
          timestamp: new Date().toISOString(), type: 'arch-generate',
        }, sessId)

        const diagram = await generateArchitecture(content, settings)
        // Elements come directly from AI as Excalidraw skeleton JSON
        const elements = convertToExcalidrawElements(diagram.elements as any[])

        updateMessage(aiMsgId, {
          content:  `✅ **${diagram.title}** generated — ${diagram.elements.length} elements.\n\n${diagram.description}`,
          isStreaming: false,
        }, sessId)

        onRenderArch?.(elements as any, {})

      } else if (intent === 'modify' && currentSpec) {
        // ── Architecture modification ───────────────────────────────────────
        const aiMsgId = newId()
        appendMessage({
          id: aiMsgId, role: 'assistant', content: '⏳ Modifying architecture…',
          timestamp: new Date().toISOString(), type: 'arch-modify',
        }, sessId)

        const archSpec = await modifyArchitecture(content, currentSpec, settings)
        const { elements, files } = await archSpecToExcalidrawElements(archSpec)

        updateMessage(aiMsgId, {
          content:  `✅ Architecture updated — ${archSpec.nodes.length} components.\n\n${archSpec.description}`,
          archSpec,
          isStreaming: false,
        }, sessId)

        onRenderArch?.(elements as any, files)

      } else if (intent === 'explain' || intent === 'improve') {
        // ── Explain / improve (text response, no diagram change) ────────────
        const aiMsgId = newId()
        appendMessage({
          id: aiMsgId, role: 'assistant', content: '⏳ Analyzing architecture…',
          timestamp: new Date().toISOString(), type: intent === 'explain' ? 'arch-explain' : 'arch-improve',
        }, sessId)

        const answer = intent === 'explain'
          ? await explainArchitecture(content, currentSpec, settings)
          : await improveArchitecture(currentSpec!, content, settings)

        updateMessage(aiMsgId, { content: answer, isStreaming: false }, sessId)

      } else {
        // ── General streaming chat ──────────────────────────────────────────
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
          .slice(-20) // last 20 messages for context
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
              content: `❌ Error: ${err}`,
              type: 'error',
              isStreaming: false,
            }, sessId)
            setStreamingMsgId(null)
          },
        )
        cancelStreamRef.current = cancel
      }
    } catch (err: any) {
      const errMsg: AIMessage = {
        id:        newId(),
        role:      'assistant',
        content:   `❌ **Error:** ${err.message}`,
        timestamp: new Date().toISOString(),
        type:      'error',
      }
      appendMessage(errMsg, sessId)
    } finally {
      setIsLoading(false)
    }
  }, [activeId, isLoading, settings, appendMessage, updateMessage, onRenderArch, getCurrentArchSpec])

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
    sessions:        filteredSessions,
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
