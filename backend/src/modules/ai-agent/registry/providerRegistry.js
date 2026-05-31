'use strict'

// ── Provider Registry (LangChain-powered) ─────────────────────────────────────
// Returns a configured LangChain BaseChatModel for any provider+model combo.
// All models share the same .invoke() / .stream() interface — zero per-provider branching.
//
// Supported providers:  openai | gemini | groq | ollama
// Adding a new provider = add one entry here.

const PROVIDER_META = {
  openai: {
    id:          'openai',
    name:        'OpenAI',
    requiresKey: true,
    defaultModel:'gpt-4.1',
  },
  gemini: {
    id:          'gemini',
    name:        'Google Gemini',
    requiresKey: true,
    defaultModel:'gemini-2.0-flash',
  },
  groq: {
    id:          'groq',
    name:        'Groq',
    requiresKey: true,
    defaultModel:'llama-3.3-70b-versatile',
  },
  ollama: {
    id:          'ollama',
    name:        'Ollama (Local)',
    requiresKey: false,
    defaultModel:'llama3.2',
  },
}

// ── Lazy model factory ─────────────────────────────────────────────────────────
// We import LangChain model classes lazily inside functions so the registry
// module loads without hard-failing if optional peer deps are absent.

async function buildModel(providerId, { apiKey, model, ollamaBaseUrl, streaming = false } = {}) {
  const meta = PROVIDER_META[providerId]
  if (!meta) throw new Error(`Unknown provider: ${providerId}`)
  if (meta.requiresKey && !apiKey) throw new Error(`${meta.name} requires an API key`)

  const chosenModel = model || meta.defaultModel

  switch (providerId) {
    case 'openai': {
      const { ChatOpenAI } = await import('@langchain/openai')
      return new ChatOpenAI({
        apiKey,                   // v1.x — was "openAIApiKey" in v0.x
        model:       chosenModel, // v1.x — was "modelName" in v0.x
        temperature: 0.7,
        streaming,
      })
    }
    case 'gemini': {
      const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai')
      return new ChatGoogleGenerativeAI({
        apiKey,
        model:       chosenModel,
        temperature: 0.7,
        streaming,
      })
    }
    case 'groq': {
      const { ChatGroq } = await import('@langchain/groq')
      return new ChatGroq({
        apiKey,
        model:       chosenModel,
        temperature: 0.7,
        streaming,
      })
    }
    case 'ollama': {
      const { ChatOllama } = await import('@langchain/ollama')
      return new ChatOllama({
        baseUrl:     ollamaBaseUrl || 'http://localhost:11434',
        model:       chosenModel,
        temperature: 0.7,
      })
    }
    default:
      throw new Error(`Unsupported provider: ${providerId}`)
  }
}


// ── Non-chat model patterns to exclude ────────────────────────────────────────
// Any model whose ID matches one of these prefixes/substrings is excluded.
// Add more as needed without touching the rest of the code.

const OPENAI_EXCLUDE = [
  'dall-e', 'whisper', 'tts', 'text-embedding', 'text-moderation',
  'text-search', 'text-similarity', 'code-search', 'babbage', 'davinci',
  'curie', 'ada', 'omni-moderation', 'omni-mini', 'realtime',
  '-transcribe', '-audio', '-translate', 'computer-use',
]

const GEMINI_EXCLUDE = [
  'embedding', 'aqa', 'vision', '-001', 'answer', 'attribute', 'legacy',
]

function isOpenAIChat(id) {
  const lower = id.toLowerCase()
  return !OPENAI_EXCLUDE.some(pat => lower.includes(pat))
}

function isGeminiChat(id, methods) {
  const lower = id.toLowerCase()
  const excluded = GEMINI_EXCLUDE.some(pat => lower.includes(pat))
  const hasChat  = methods?.includes('generateContent')
  return hasChat && !excluded && lower.startsWith('gemini-')
}

// ── Dynamic model listing with chat-only filtering ────────────────────────────

async function listModels(providerId, { apiKey, ollamaBaseUrl } = {}) {
  const meta = PROVIDER_META[providerId]
  if (!meta) throw new Error(`Unknown provider: ${providerId}`)

  // Bail early — no key, no request
  if (meta.requiresKey && !apiKey) return []

  switch (providerId) {
    case 'openai': {
      const { OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey })
      let data
      try {
        const res = await client.models.list()
        data = res.data
      } catch (err) {
        throw new Error(`OpenAI: ${err.message}`)
      }
      return data
        .filter(m => isOpenAIChat(m.id))
        .sort((a, b) => b.created - a.created)   // newest first
        .map(m => ({ id: m.id, name: m.id }))
    }

    case 'gemini': {
      let models
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
        const res  = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        models = json.models || []
      } catch (err) {
        throw new Error(`Gemini: ${err.message}`)
      }
      return models
        .filter(m => isGeminiChat(
          m.name.replace('models/', ''),
          m.supportedGenerationMethods,
        ))
        .map(m => ({
          id:   m.name.replace('models/', ''),
          name: m.displayName || m.name.replace('models/', ''),
        }))
        .sort((a, b) => b.id.localeCompare(a.id))   // newest first (lexicographic works for gemini-2 > gemini-1)
    }

    case 'groq': {
      let data
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        data = json.data || []
      } catch (err) {
        throw new Error(`Groq: ${err.message}`)
      }
      return data
        .filter(m => !m.id.toLowerCase().includes('whisper'))  // exclude STT models
        .sort((a, b) => b.created - a.created)   // newest first
        .map(m => ({ id: m.id, name: m.id }))
    }

    case 'ollama': {
      const base = ollamaBaseUrl || 'http://localhost:11434'
      let data
      try {
        const res = await fetch(`${base}/api/tags`)
        if (!res.ok) throw new Error(`Ollama not reachable (HTTP ${res.status})`)
        data = await res.json()
      } catch (err) {
        throw new Error(`Ollama: ${err.message}`)
      }
      return (data.models || [])
        .sort((a, b) => new Date(b.modified_at) - new Date(a.modified_at))
        .map(m => ({ id: m.name, name: m.name, size: m.size }))
    }

    default:
      throw new Error(`Unknown provider: ${providerId}`)
  }
}


// ── Health check ───────────────────────────────────────────────────────────────
async function healthCheck(providerId, { apiKey, ollamaBaseUrl } = {}) {
  try {
    const models = await listModels(providerId, { apiKey, ollamaBaseUrl })
    return {
      ok:      true,
      message: `${PROVIDER_META[providerId]?.name} connected — ${models.length} model${models.length !== 1 ? 's' : ''} available`,
      models,
    }
  } catch (err) {
    return { ok: false, message: err.message, models: [] }
  }
}

module.exports = {
  PROVIDER_META,
  buildModel,
  listModels,
  healthCheck,
  getAllProviders: () => Object.values(PROVIDER_META),
}
