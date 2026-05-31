// ── Frontend API client for the AI Agent backend ──────────────────────────────
// Handles all calls to /api/ai-agent/* and SSE streaming for chat.

import type { ArchSpec, ProviderID, AIMessage, AISettings } from '../types/ai.types'

const AI_API = 'http://localhost:3001/api/ai-agent'

function authHeaders(settings: AISettings): HeadersInit {
  const key = settings.apiKeys[settings.provider]
  return key ? { 'x-ai-api-key': key } : {}
}

// ── Architecture generation ───────────────────────────────────────────────────
export async function generateArchitecture(
  prompt: string,
  settings: AISettings,
  canvasContext?: string,
): Promise<{ title: string; description: string; elements: any[] }> {
  const res = await fetch(`${AI_API}/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(settings) },
    body:    JSON.stringify({
      provider:      settings.provider,
      model:         settings.model,
      prompt,
      canvasContext,
      ollamaBaseUrl: settings.ollamaUrl,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `Generation failed (${res.status})`)
  }
  const data = await res.json()
  // Returns { title, description, elements[] } — Excalidraw skeleton JSON
  return { title: data.title ?? 'Diagram', description: data.description ?? '', elements: data.elements ?? [] }
}

// ── Architecture modification ─────────────────────────────────────────────────
export async function modifyArchitecture(
  prompt: string,
  existingSpec: ArchSpec,
  settings: AISettings,
): Promise<ArchSpec> {
  const res = await fetch(`${AI_API}/modify`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(settings) },
    body:    JSON.stringify({
      provider:      settings.provider,
      model:         settings.model,
      prompt,
      existingSpec,
      ollamaBaseUrl: settings.ollamaUrl,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `Modification failed (${res.status})`)
  }
  const data = await res.json()
  return data.archSpec as ArchSpec
}

// ── Architecture explanation ──────────────────────────────────────────────────
export async function explainArchitecture(
  question: string,
  archSpec: ArchSpec | null,
  settings: AISettings,
): Promise<string> {
  const res = await fetch(`${AI_API}/explain`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(settings) },
    body:    JSON.stringify({
      provider:      settings.provider,
      model:         settings.model,
      question,
      archSpec,
      ollamaBaseUrl: settings.ollamaUrl,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `Explanation failed (${res.status})`)
  }
  const data = await res.json()
  return data.answer as string
}

// ── Architecture improvement ──────────────────────────────────────────────────
export async function improveArchitecture(
  archSpec: ArchSpec,
  focus: string,
  settings: AISettings,
): Promise<string> {
  const res = await fetch(`${AI_API}/improve`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(settings) },
    body:    JSON.stringify({
      provider:      settings.provider,
      model:         settings.model,
      archSpec,
      focus,
      ollamaBaseUrl: settings.ollamaUrl,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `Improvement failed (${res.status})`)
  }
  const data = await res.json()
  return data.answer as string
}

// ── Streaming chat (SSE) ──────────────────────────────────────────────────────
export function streamChat(
  messages: Pick<AIMessage, 'role' | 'content'>[],
  settings: AISettings,
  onToken: (token: string) => void,
  onDone:  () => void,
  onError: (err: string) => void,
): () => void {
  const controller = new AbortController()

  const key = settings.apiKeys[settings.provider]

  fetch(`${AI_API}/chat`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'x-ai-api-key': key } : {}),
    },
    body:    JSON.stringify({
      provider:      settings.provider,
      model:         settings.model,
      messages,
      ollamaBaseUrl: settings.ollamaUrl,
    }),
    signal: controller.signal,
  }).then(async res => {
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      onError(err.error || 'Stream failed'); return
    }
    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let   buffer  = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer      = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') { onDone(); return }
        try { onToken(JSON.parse(data).text || '') } catch { /* skip */ }
      }
    }
    onDone()
  }).catch(err => {
    if (err.name !== 'AbortError') onError(err.message)
  })

  return () => controller.abort()
}

// ── Models ────────────────────────────────────────────────────────────────────
export async function fetchModels(provider: ProviderID, settings: AISettings) {
  const key = settings.apiKeys[provider]
  const params = new URLSearchParams({ provider })
  if (settings.ollamaUrl) params.set('ollamaBaseUrl', settings.ollamaUrl)

  const res = await fetch(`${AI_API}/models?${params}`, {
    headers: key ? { 'x-ai-api-key': key } : {},
  })
  if (!res.ok) throw new Error(`Failed to fetch models (${res.status})`)
  const data = await res.json()
  return data.models
}

// ── Health check ──────────────────────────────────────────────────────────────
export async function testProviderHealth(provider: ProviderID, settings: AISettings) {
  const key = settings.apiKeys[provider]
  const res = await fetch(`${AI_API}/health`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'x-ai-api-key': key } : {}),
    },
    body: JSON.stringify({ provider, ollamaBaseUrl: settings.ollamaUrl }),
  })
  return res.json()
}
