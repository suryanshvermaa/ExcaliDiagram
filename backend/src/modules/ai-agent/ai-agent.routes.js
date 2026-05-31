'use strict'
const { Router } = require('express')
const ctrl = require('./ai-agent.controller')

const router = Router()

// ── Architecture operations (via LangGraph agent) ─────────────────────────────
router.post('/generate', ctrl.generateArchitecture)   // prompt → ArchSpec
router.post('/modify',   ctrl.modifyArchitecture)     // existing ArchSpec + instruction → updated ArchSpec
router.post('/explain',  ctrl.explainArchitecture)    // question + ArchSpec → markdown explanation
router.post('/improve',  ctrl.improveArchitecture)    // ArchSpec + focus → improvement suggestions

// ── General chat (SSE streaming) ──────────────────────────────────────────────
router.post('/chat',     ctrl.chat)

// ── Provider utilities ────────────────────────────────────────────────────────
router.get ('/models',   ctrl.getModels)    // ?provider=openai  (header: x-ai-api-key)
router.post('/health',   ctrl.testHealth)   // { provider, ollamaBaseUrl } + x-ai-api-key header

module.exports = router
