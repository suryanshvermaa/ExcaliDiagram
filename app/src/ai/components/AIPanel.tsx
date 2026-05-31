import { useEffect, useRef, useState } from 'react'
import { useAISession } from '../hooks/useAISession'
import { ChatMessage }    from './ChatMessage'
import { ChatInput }      from './ChatInput'
import { SessionList }    from './SessionList'
import { AISettingsModal } from './AISettingsModal'

interface Props {
  /** Called when AI generates/modifies architecture — renders on Excalidraw canvas */
  onRenderArch:       (elements: any[], files: Record<string, any>) => void
  /** Returns current canvas context (for modify/explain). Now returns unknown — hook tracks Mermaid internally */
  getCurrentArchSpec: () => unknown
}

export function AIPanel({ onRenderArch, getCurrentArchSpec }: Props) {
  const {
    sessions, activeSession, activeId,
    settings, isLoading, streamingMsgId,
    searchQuery, setSearchQuery,
    setSettings, newChat, switchSession,
    removeSession, rename, sendMessage, cancelStream,
  } = useAISession(onRenderArch, getCurrentArchSpec)

  const [showSettings,   setShowSettings]   = useState(false)
  const [showHistory,    setShowHistory]     = useState(false)
  const messagesEndRef   = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages.length, streamingMsgId])

  const messages = activeSession?.messages ?? []
  const provider = settings.provider
  const model    = settings.model

  const providerLabel: Record<string, string> = {
    openai: '🟢 OpenAI',
    gemini: '💎 Gemini',
    groq:   '⚡ Groq',
    ollama: '🦙 Ollama',
  }

  return (
    <div className="aiPanel">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="aiPanelHeader">
        <div className="aiPanelHeaderLeft">
          <span className="aiPanelIcon">🤖</span>
          <div className="aiPanelTitleGroup">
            <span className="aiPanelTitle">AI Architect</span>
            <span className="aiPanelProvider">{providerLabel[provider]} · {model}</span>
          </div>
        </div>
        <div className="aiPanelHeaderRight">
          <button
            className={`aiHeaderBtn ${showHistory ? 'active' : ''}`}
            title="Chat history"
            onClick={() => setShowHistory(h => !h)}
          >
            📋
          </button>
          <button
            className="aiHeaderBtn"
            title="New chat"
            onClick={newChat}
          >
            ✏️
          </button>
          <button
            className="aiHeaderBtn"
            title="Settings"
            onClick={() => setShowSettings(true)}
          >
            ⚙️
          </button>
        </div>
      </div>

      <div className="aiPanelBody">
        {/* ── Session history drawer ────────────────────────────────────────── */}
        {showHistory && (
          <div className="aiHistoryDrawer">
            <SessionList
              sessions={sessions}
              activeId={activeId}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              onSelect={id => { switchSession(id); setShowHistory(false) }}
              onNew={() => { newChat(); setShowHistory(false) }}
              onRename={rename}
              onDelete={removeSession}
            />
          </div>
        )}

        {/* ── Messages area ─────────────────────────────────────────────────── */}
        <div className="aiMessages">
          {messages.length === 0 ? (
            <WelcomeScreen onSuggestion={sendMessage} />
          ) : (
            messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))
          )}

          {/* Loading indicator (non-streaming) */}
          {isLoading && !streamingMsgId && (
            <div className="aiThinkingIndicator">
              <span className="aiThinkingDot" />
              <span className="aiThinkingDot" />
              <span className="aiThinkingDot" />
              <span className="aiThinkingText">Thinking…</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input ────────────────────────────────────────────────────────── */}
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          isStreaming={!!streamingMsgId}
          onCancel={cancelStream}
        />
      </div>

      {/* ── Settings modal ─────────────────────────────────────────────────── */}
      {showSettings && (
        <AISettingsModal
          settings={settings}
          onSave={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

// ── Welcome screen shown when chat is empty ────────────────────────────────────
const WELCOME_SUGGESTIONS = [
  { icon: '🏗',  text: 'Create a scalable URL shortener architecture' },
  { icon: '☸',   text: 'Design a MERN app on Kubernetes' },
  { icon: '📡',  text: 'Create a Kafka event-driven microservices platform' },
  { icon: '🎬',  text: 'Design a Netflix-like streaming platform' },
  { icon: '💬',  text: 'Create a chat app with Redis & WebSockets' },
  { icon: '🚀',  text: 'Create a GitHub Actions CI/CD pipeline' },
]

function WelcomeScreen({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div className="aiWelcome">
      <div className="aiWelcomeLogo">🤖</div>
      <h3 className="aiWelcomeTitle">AI Architect</h3>
      <p className="aiWelcomeSubtitle">
        Describe an architecture and I'll generate it directly on the canvas.
        I can also modify, explain, or improve your existing diagrams.
      </p>
      <div className="aiWelcomeSuggestions">
        {WELCOME_SUGGESTIONS.map(s => (
          <button
            key={s.text}
            className="aiWelcomeSuggestion"
            onClick={() => onSuggestion(s.text)}
          >
            <span>{s.icon}</span>
            <span>{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
