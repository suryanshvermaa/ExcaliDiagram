'use strict'
// Gemini provider — thin wrapper around providerRegistry.
// All actual model logic lives in providerRegistry.js via @langchain/google-genai.
// Latest models: gemini-2.5-pro-preview, gemini-2.0-flash, gemini-1.5-pro
const registry = require('../registry/providerRegistry')

module.exports = {
  id:           registry.PROVIDER_META.gemini.id,
  name:         registry.PROVIDER_META.gemini.name,
  defaultModel: registry.PROVIDER_META.gemini.defaultModel,
  requiresKey:  registry.PROVIDER_META.gemini.requiresKey,
  buildModel:   (opts) => registry.buildModel('gemini', opts),
  listModels:   (opts) => registry.listModels('gemini', opts),
  healthCheck:  (opts) => registry.healthCheck('gemini', opts),
}
