'use strict'

// ── AI Agent — LangGraph: generate → validate → refine ────────────────────────
// The AI now outputs Excalidraw skeleton JSON directly (not ArchSpec).
// Validation checks that the output has a valid "elements" array.

const { StateGraph, Annotation, END } = require('@langchain/langgraph')
const { HumanMessage, SystemMessage }  = require('@langchain/core/messages')
const { GENERATE_SYSTEM_PROMPT }       = require('./prompts/generate.prompt')

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractJson(raw) {
  // Strip markdown code fences if present
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  try {
    return JSON.parse(stripped)
  } catch {
    // Try extracting the first {...} block
    const match = stripped.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Response is not valid JSON')
  }
}

function validateDiagram(parsed) {
  const errors = []
  if (!parsed || typeof parsed !== 'object') errors.push('Root must be a JSON object')
  if (!Array.isArray(parsed?.elements))        errors.push('"elements" array is missing')
  if ((parsed?.elements?.length ?? 0) === 0)   errors.push('"elements" array is empty')
  return { valid: errors.length === 0, errors }
}

// ── Graph State ────────────────────────────────────────────────────────────────
const GraphState = Annotation.Root({
  userPrompt:  Annotation({ reducer: (_, v) => v }),
  rawResponse: Annotation({ reducer: (_, v) => v, default: () => '' }),
  retries:     Annotation({ reducer: (_, v) => v, default: () => 0 }),
  diagram:     Annotation({ reducer: (_, v) => v, default: () => null }),
  errors:      Annotation({ reducer: (_, v) => v, default: () => [] }),
  success:     Annotation({ reducer: (_, v) => v, default: () => false }),
  error:       Annotation({ reducer: (_, v) => v, default: () => null }),
})

// ── Node: generate ────────────────────────────────────────────────────────────
function makeGenerateNode(model) {
  return async (state) => {
    try {
      const response = await model.invoke([
        new SystemMessage(GENERATE_SYSTEM_PROMPT),
        new HumanMessage(state.userPrompt),
      ])
      const content = typeof response.content === 'string'
        ? response.content
        : response.content.map(c => c.text || '').join('')
      return { rawResponse: content, error: null }
    } catch (err) {
      return { error: err.message, success: false }
    }
  }
}

// ── Node: validate ────────────────────────────────────────────────────────────
async function validateNode(state) {
  if (state.error) return { success: false }
  try {
    const parsed = extractJson(state.rawResponse)
    const { valid, errors } = validateDiagram(parsed)
    return { diagram: parsed, errors, success: valid }
  } catch (err) {
    return { diagram: null, errors: [`Parse error: ${err.message}`], success: false }
  }
}

// ── Node: refine ──────────────────────────────────────────────────────────────
function makeRefineNode(model) {
  return async (state) => {
    const fixPrompt = `Your previous response had issues:\n${state.errors.join('\n')}\n\nPrevious response:\n${state.rawResponse}\n\nFix these issues and return ONLY valid JSON with an "elements" array. No markdown.`
    try {
      const response = await model.invoke([
        new SystemMessage(GENERATE_SYSTEM_PROMPT),
        new HumanMessage(fixPrompt),
      ])
      const content = typeof response.content === 'string'
        ? response.content
        : response.content.map(c => c.text || '').join('')
      return { rawResponse: content, retries: state.retries + 1 }
    } catch (err) {
      return { error: err.message, success: false }
    }
  }
}

function shouldRetry(state) {
  if (state.success || state.error) return 'end'
  if (state.retries >= 2)           return 'end'
  return 'refine'
}

// ── Build & run ───────────────────────────────────────────────────────────────
function buildGraph(model) {
  return new StateGraph(GraphState)
    .addNode('generate', makeGenerateNode(model))
    .addNode('validate', validateNode)
    .addNode('refine',   makeRefineNode(model))
    .addEdge('__start__', 'generate')
    .addEdge('generate',  'validate')
    .addConditionalEdges('validate', shouldRetry, { refine: 'refine', end: END })
    .addEdge('refine', 'validate')
    .compile()
}

async function runArchAgent(model, { userPrompt }) {
  const graph  = buildGraph(model)
  const result = await graph.invoke({ userPrompt })
  if (!result.success || !result.diagram) {
    throw new Error(result.error || `Failed after ${result.retries} attempts: ${result.errors.join(', ')}`)
  }
  return result.diagram   // { title, description, elements[] }
}

module.exports = { runArchAgent }
