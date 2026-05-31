import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  onSend:      (content: string) => void
  isLoading:   boolean
  isStreaming:  boolean
  onCancel?:   () => void
  disabled?:   boolean
}

const SUGGESTIONS = [
  'Create a scalable URL shortener architecture',
  'Design a MERN app deployed on Kubernetes',
  'Create a Kafka event-driven microservices platform',
  'Design a Netflix-like streaming architecture',
  'Create a chat app with Redis and WebSockets',
  'Add Redis cache to the current architecture',
  'Add monitoring with Prometheus and Grafana',
  'Explain this architecture',
  'Find bottlenecks and scalability issues',
  'Make this architecture highly available',
]

export function ChatInput({ onSend, isLoading, isStreaming, onCancel, disabled }: Props) {
  const [value,       setValue]       = useState('')
  const [showHints,   setShowHints]   = useState(false)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [value])

  const submit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isLoading || disabled) return
    onSend(trimmed)
    setValue('')
    setShowHints(false)
  }, [value, isLoading, disabled, onSend])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const pickSuggestion = (s: string) => {
    setValue(s)
    setShowHints(false)
    textareaRef.current?.focus()
  }

  return (
    <div className="aiChatInputWrap">
      {showHints && (
        <div className="aiSuggestions">
          <div className="aiSuggestionsTitle">✨ Suggestions</div>
          {SUGGESTIONS.map(s => (
            <button key={s} className="aiSuggestionItem" onClick={() => pickSuggestion(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="aiInputRow">
        <button
          className="aiInputSuggestBtn"
          title="Show suggestions"
          onClick={() => setShowHints(h => !h)}
          type="button"
        >
          ✨
        </button>

        <textarea
          ref={textareaRef}
          className="aiInputTextarea"
          placeholder="Describe an architecture, ask to modify, or explain the diagram…"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
        />

        {isStreaming ? (
          <button
            className="aiInputSendBtn cancel"
            onClick={onCancel}
            type="button"
            title="Stop generation"
          >
            ⏹
          </button>
        ) : (
          <button
            className={`aiInputSendBtn ${!value.trim() || isLoading ? 'disabled' : ''}`}
            onClick={submit}
            disabled={!value.trim() || isLoading || !!disabled}
            type="button"
            title="Send (Enter)"
          >
            {isLoading ? <span className="aiInputSpinner" /> : '↑'}
          </button>
        )}
      </div>

      <div className="aiInputHint">
        Enter to send · Shift+Enter for newline · <kbd>✨</kbd> for suggestions
      </div>
    </div>
  )
}
