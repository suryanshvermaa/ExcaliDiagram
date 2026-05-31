import { memo, useState } from 'react'
import type { AIMessage } from '../types/ai.types'

interface Props { message: AIMessage }

// Simple markdown renderer (no dep needed for basic subset)
function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,  '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,      '<em>$1</em>')
    .replace(/`([^`]+)`/g,      '<code>$1</code>')
    .replace(/^- (.+)$/gm,      '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    .replace(/\n\n/g,           '<br/><br/>')
    .replace(/\n/g,             '<br/>')
}

const TYPE_LABELS: Record<string, string> = {
  'arch-generate': '🏗 Architecture generated',
  'arch-modify':   '✏️ Architecture modified',
  'arch-explain':  '💡 Analysis',
  'arch-improve':  '📈 Improvement suggestions',
  'error':         '❌ Error',
}

export const ChatMessage = memo(function ChatMessage({ message }: Props) {
  const [copied, setCopied] = useState(false)
  const isUser  = message.role === 'user'
  const isError = message.type === 'error'

  const copy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className={`aiMessage ${message.role} ${isError ? 'error' : ''}`}>
      {/* Avatar */}
      <div className="aiMessageAvatar">
        {isUser ? '👤' : '🤖'}
      </div>

      <div className="aiMessageBody">
        {/* Type badge for AI arch messages */}
        {!isUser && message.type !== 'chat' && (
          <div className="aiMessageBadge">
            {TYPE_LABELS[message.type] ?? message.type}
          </div>
        )}

        {/* Content */}
        <div
          className={`aiMessageContent ${message.isStreaming ? 'streaming' : ''}`}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
        />

        {/* Streaming cursor */}
        {message.isStreaming && <span className="aiStreamCursor" />}

        {/* Footer */}
        <div className="aiMessageFooter">
          <span className="aiMessageTime">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && !message.isStreaming && (
            <button className="aiMessageCopy" onClick={copy} title="Copy">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
