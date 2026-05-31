'use strict'

const { buildModel, listModels, healthCheck, getAllProviders } = require('./registry/providerRegistry')
const { runArchAgent }     = require('./ai-agent.graph')
const { EXPLAIN_SYSTEM_PROMPT } = require('./prompts/explain.prompt')
const { HumanMessage, SystemMessage, AIMessage } = require('@langchain/core/messages')

// ── Extract connection options from request ───────────────────────────────────
function getOpts(req) {
  return {
    apiKey:        req.headers['x-ai-api-key'] || req.body?.apiKey,
    model:         req.body?.model,
    ollamaBaseUrl: req.body?.ollamaBaseUrl,
    streaming:     false,
  }
}

// ── POST /api/ai-agent/generate ───────────────────────────────────────────────
async function generateArchitecture(req, res) {
  try {
    const { provider = 'openai', prompt, canvasContext } = req.body
    if (!prompt) return res.status(400).json({ error: '"prompt" is required' })

    const opts  = getOpts(req)
    const model = await buildModel(provider, opts)

    const enrichedPrompt = canvasContext
      ? `${prompt}\n\nNote: The current canvas already contains: ${canvasContext}`
      : prompt

    // Returns raw Mermaid code — frontend converts via @excalidraw/mermaid-to-excalidraw
    const mermaid = await runArchAgent(model, { userPrompt: enrichedPrompt })
    res.json({ ok: true, mermaid })
  } catch (err) {
    console.error('[ai-agent] generate error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ── POST /api/ai-agent/modify ─────────────────────────────────────────────────
async function modifyArchitecture(req, res) {
  try {
    const { provider = 'openai', prompt, existingMermaid } = req.body
    if (!prompt)         return res.status(400).json({ error: '"prompt" is required' })
    if (!existingMermaid) return res.status(400).json({ error: '"existingMermaid" is required' })

    const opts  = getOpts(req)
    const model = await buildModel(provider, opts)

    // Returns raw Mermaid code — frontend converts via parseMermaidToExcalidraw
    const mermaid = await runArchAgent(model, {
      userPrompt:      prompt,
      existingMermaid, // pass current diagram as context
      mode:            'modify',
    })
    res.json({ ok: true, mermaid })
  } catch (err) {
    console.error('[ai-agent] modify error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ── POST /api/ai-agent/explain ────────────────────────────────────────────────
async function explainArchitecture(req, res) {
  try {
    const { provider = 'openai', question, archSpec } = req.body
    if (!question) return res.status(400).json({ error: '"question" is required' })

    const opts  = getOpts(req)
    const model = await buildModel(provider, opts)

    const contextMsg = archSpec
      ? `\n\nCurrent architecture:\n${JSON.stringify(archSpec, null, 2)}`
      : ''

    const response = await model.invoke([
      new SystemMessage(EXPLAIN_SYSTEM_PROMPT),
      new HumanMessage(`${question}${contextMsg}`),
    ])

    const answer = typeof response.content === 'string'
      ? response.content
      : response.content.map(c => c.text || '').join('')

    res.json({ ok: true, answer })
  } catch (err) {
    console.error('[ai-agent] explain error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ── POST /api/ai-agent/improve ────────────────────────────────────────────────
async function improveArchitecture(req, res) {
  try {
    const { provider = 'openai', archSpec, focus } = req.body
    if (!archSpec) return res.status(400).json({ error: '"archSpec" is required' })

    const opts  = getOpts(req)
    const model = await buildModel(provider, opts)

    const question = focus
      ? `Suggest concrete improvements for this architecture with a focus on: ${focus}`
      : 'Analyze this architecture and suggest concrete improvements for reliability, scalability, security, and cost-efficiency.'

    const response = await model.invoke([
      new SystemMessage(EXPLAIN_SYSTEM_PROMPT),
      new HumanMessage(`${question}\n\nArchitecture:\n${JSON.stringify(archSpec, null, 2)}`),
    ])

    const answer = typeof response.content === 'string'
      ? response.content
      : response.content.map(c => c.text || '').join('')

    res.json({ ok: true, answer })
  } catch (err) {
    console.error('[ai-agent] improve error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ── POST /api/ai-agent/chat ───────────────────────────────────────────────────
// General conversational endpoint — SSE streaming
async function chat(req, res) {
  try {
    const { provider = 'openai', model: modelId, messages, systemPrompt } = req.body
    if (!messages?.length) return res.status(400).json({ error: '"messages" array is required' })

    const opts  = getOpts(req)
    const model = await buildModel(provider, { ...opts, model: modelId, streaming: true })

    const langMessages = []
    if (systemPrompt) langMessages.push(new SystemMessage(systemPrompt))
    for (const m of messages) {
      if      (m.role === 'user')      langMessages.push(new HumanMessage(m.content))
      else if (m.role === 'assistant') langMessages.push(new AIMessage(m.content))
      else if (m.role === 'system')    langMessages.push(new SystemMessage(m.content))
    }

    // SSE streaming
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection',    'keep-alive')

    const stream = await model.stream(langMessages)
    for await (const chunk of stream) {
      const text = typeof chunk.content === 'string'
        ? chunk.content
        : (chunk.content[0]?.text || '')
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('[ai-agent] chat error:', err.message)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
}


// ── GET /api/ai-agent/models?provider=openai ──────────────────────────────────
async function getModels(req, res) {
  try {
    const { provider } = req.query
    if (!provider) {
      // Return all providers metadata
      return res.json({ ok: true, providers: getAllProviders() })
    }
    const apiKey       = req.headers['x-ai-api-key']
    const ollamaBaseUrl= req.query.ollamaBaseUrl
    const models = await listModels(provider, { apiKey, ollamaBaseUrl })
    res.json({ ok: true, models })
  } catch (err) {
    console.error('[ai-agent] models error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ── POST /api/ai-agent/health ─────────────────────────────────────────────────
async function testHealth(req, res) {
  try {
    const { provider = 'openai', ollamaBaseUrl } = req.body
    const apiKey  = req.headers['x-ai-api-key'] || req.body?.apiKey
    const result  = await healthCheck(provider, { apiKey, ollamaBaseUrl })
    res.json({ ok: result.ok, message: result.message, models: result.models })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

module.exports = {
  generateArchitecture,
  modifyArchitecture,
  explainArchitecture,
  improveArchitecture,
  chat,
  getModels,
  testHealth,
}
