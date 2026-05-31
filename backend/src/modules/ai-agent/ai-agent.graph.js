'use strict'

// ── AI Agent — generates/modifies Mermaid code, validates, refines if needed ──
const { StateGraph, Annotation, END } = require('@langchain/langgraph')
const { HumanMessage, SystemMessage }  = require('@langchain/core/messages')
const { GENERATE_SYSTEM_PROMPT }       = require('./prompts/generate.prompt')
const { MODIFY_SYSTEM_PROMPT }         = require('./prompts/modify.prompt')

// ── Helpers ────────────────────────────────────────────────────────────────────
function cleanMermaid(raw) {
  return raw
    .replace(/^```(?:mermaid)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim()
}

function validateMermaid(code) {
  const errors = []
  if (!code || code.trim().length < 10)
    errors.push('Output is empty or too short')
  if (!/^flowchart\s|^graph\s/im.test(code))
    errors.push('Must start with: flowchart LR  or  flowchart TD')
  if (/^style\s+\w+/im.test(code))
    errors.push('FORBIDDEN: inline style (style nodeId fill:...) — use classDef instead')
  if (/^linkStyle\s+/im.test(code))
    errors.push('FORBIDDEN: linkStyle — remove it entirely')
  if (/^click\s+/im.test(code))
    errors.push('FORBIDDEN: click events — remove them entirely')
  if (/^\s*subgraph\s+/im.test(code))
    errors.push('FORBIDDEN: subgraph blocks create Excalidraw frames that break direct editability — remove all subgraph...end blocks and use classDef for grouping instead')
  return { valid: errors.length === 0, errors }
}



// ── Graph State ────────────────────────────────────────────────────────────────
const GraphState = Annotation.Root({
  userPrompt:    Annotation({ reducer: (_, v) => v }),
  existingMermaid: Annotation({ reducer: (_, v) => v, default: () => '' }),
  mode:          Annotation({ reducer: (_, v) => v, default: () => 'generate' }),
  rawResponse:   Annotation({ reducer: (_, v) => v, default: () => '' }),
  mermaid:       Annotation({ reducer: (_, v) => v, default: () => '' }),
  retries:       Annotation({ reducer: (_, v) => v, default: () => 0 }),
  errors:        Annotation({ reducer: (_, v) => v, default: () => [] }),
  success:       Annotation({ reducer: (_, v) => v, default: () => false }),
  error:         Annotation({ reducer: (_, v) => v, default: () => null }),
})

// ── Nodes ──────────────────────────────────────────────────────────────────────
function makeGenerateNode(model) {
  return async (state) => {
    try {
      const isModify = state.mode === 'modify' && state.existingMermaid

      const systemPrompt = isModify ? MODIFY_SYSTEM_PROMPT : GENERATE_SYSTEM_PROMPT

      const humanContent = isModify
        ? `EXISTING FLOWCHART:\n${state.existingMermaid}\n\nINSTRUCTION: ${state.userPrompt}`
        : state.userPrompt

      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(humanContent),
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

async function validateNode(state) {
  if (state.error) return { success: false }
  const code = cleanMermaid(state.rawResponse)
  const { valid, errors } = validateMermaid(code)
  return { mermaid: code, errors, success: valid }
}

function makeRefineNode(model) {
  return async (state) => {
    const fixPrompt = `Your previous Mermaid output had issues:\n${state.errors.join('\n')}\n\nPrevious output:\n${state.rawResponse}\n\nFix ONLY these issues. Hard rules:\n- Start with: flowchart TD (for complex) or flowchart LR (for simple)\n- ONLY rectangle nodes: A[Label] — no circles, diamonds, cylinders, stadiums\n- ONLY solid arrows: A --> B — no -.->, no ==>, no --- \n- NEVER use subgraph...end blocks (they create Excalidraw frames)\n- Use classDef + class for colors — NEVER inline style statements\n- Arrows flow in ONE direction only — no back-arrows or cycles\n- Message brokers are HUBS: services --> Broker --> consumers (not individual topics)\n- NO markdown fences, NO explanation\n\nOutput ONLY the corrected Mermaid code.`
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

// ── Build & run ────────────────────────────────────────────────────────────────
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

async function runArchAgent(model, { userPrompt, existingMermaid = '', mode = 'generate' }) {
  const graph  = buildGraph(model)
  const result = await graph.invoke({ userPrompt, existingMermaid, mode })
  if (!result.success || !result.mermaid) {
    throw new Error(result.error || `Failed after ${result.retries} retries: ${result.errors.join(', ')}`)
  }
  return result.mermaid   // raw Mermaid code string
}

module.exports = { runArchAgent }
