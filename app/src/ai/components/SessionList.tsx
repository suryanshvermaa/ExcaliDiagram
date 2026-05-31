import { useState } from 'react'
import type { AISession } from '../types/ai.types'

interface Props {
  sessions:       AISession[]
  activeId:       string | null
  searchQuery:    string
  onSearch:       (q: string) => void
  onSelect:       (id: string) => void
  onNew:          () => void
  onRename:       (id: string, title: string) => void
  onDelete:       (id: string) => void
}

export function SessionList({
  sessions, activeId, searchQuery,
  onSearch, onSelect, onNew, onRename, onDelete,
}: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal,  setRenameVal]  = useState('')

  function startRename(s: AISession) {
    setRenamingId(s.id)
    setRenameVal(s.title)
  }

  function commitRename(id: string) {
    if (renameVal.trim()) onRename(id, renameVal.trim())
    setRenamingId(null)
  }

  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)   return 'just now'
    if (mins < 60)  return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs  < 24)  return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="aiSessionList">
      {/* Search */}
      <div className="aiSessionSearch">
        <span className="aiSessionSearchIcon">🔍</span>
        <input
          className="aiSessionSearchInput"
          placeholder="Search chats…"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
        />
        {searchQuery && (
          <button className="aiSessionSearchClear" onClick={() => onSearch('')}>×</button>
        )}
      </div>

      {/* New chat button */}
      <button className="aiNewChatBtn" onClick={onNew}>
        <span>✏️</span> New Chat
      </button>

      {/* Session list */}
      <div className="aiSessionItems">
        {sessions.length === 0 && (
          <div className="aiSessionEmpty">
            {searchQuery ? 'No chats match your search.' : 'Start a new chat to begin.'}
          </div>
        )}

        {sessions.map(s => (
          <div
            key={s.id}
            className={`aiSessionItem ${s.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(s.id)}
          >
            <div className="aiSessionItemMain">
              {renamingId === s.id ? (
                <input
                  className="aiSessionRenameInput"
                  value={renameVal}
                  autoFocus
                  onChange={e => setRenameVal(e.target.value)}
                  onBlur={() => commitRename(s.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(s.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="aiSessionTitle">{s.title}</span>
              )}
              <span className="aiSessionTime">{relativeTime(s.updatedAt)}</span>
            </div>

            <div className="aiSessionActions" onClick={e => e.stopPropagation()}>
              <button
                className="aiSessionAction"
                title="Rename"
                onClick={() => startRename(s)}
              >✏</button>
              <button
                className="aiSessionAction danger"
                title="Delete"
                onClick={() => onDelete(s.id)}
              >🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
