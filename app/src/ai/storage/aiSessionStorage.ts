// ── AI Session localStorage persistence ───────────────────────────────────────
// Mirrors the pattern in devSceneStorage.ts — plain localStorage JSON.

import type { AISession, AISettings, ProviderID } from '../types/ai.types'

const SESSIONS_KEY       = 'excaliDiagram:ai:sessions'
const ACTIVE_SESSION_KEY = 'excaliDiagram:ai:activeSession'
const SETTINGS_KEY       = 'excaliDiagram:ai:settings'

// ── Helpers ───────────────────────────────────────────────────────────────────
function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export function loadSessions(): AISession[] {
  return readJson<AISession[]>(SESSIONS_KEY, [])
}

export function saveSessions(sessions: AISession[]): void {
  writeJson(SESSIONS_KEY, sessions)
}

export function getSession(id: string): AISession | null {
  return loadSessions().find(s => s.id === id) ?? null
}

export function upsertSession(session: AISession): void {
  const sessions = loadSessions()
  const idx      = sessions.findIndex(s => s.id === session.id)
  if (idx >= 0) sessions[idx] = session
  else          sessions.unshift(session)
  saveSessions(sessions)
}

export function deleteSession(id: string): void {
  saveSessions(loadSessions().filter(s => s.id !== id))
}

export function renameSession(id: string, title: string): void {
  const sessions = loadSessions()
  const s        = sessions.find(s => s.id === id)
  if (s) { s.title = title; saveSessions(sessions) }
}

export function createSession(provider: ProviderID, model: string): AISession {
  const now = new Date().toISOString()
  return {
    id:        `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title:     'New Chat',
    createdAt: now,
    updatedAt: now,
    messages:  [],
    provider,
    model,
  }
}

// ── Active session ────────────────────────────────────────────────────────────
export function getActiveSessionId(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY)
}

export function setActiveSessionId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_SESSION_KEY, id)
  else    localStorage.removeItem(ACTIVE_SESSION_KEY)
}

// ── Settings ──────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: AISettings = {
  provider:  'openai',
  model:     'gpt-4o-mini',
  apiKeys:   {},
  ollamaUrl: 'http://localhost:11434',
}

export function loadSettings(): AISettings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<AISettings>>(SETTINGS_KEY, {}) }
}

export function saveSettings(settings: AISettings): void {
  writeJson(SETTINGS_KEY, settings)
}
