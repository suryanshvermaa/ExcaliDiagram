'use strict'
// Groq provider — thin wrapper around providerRegistry.
// All actual model logic lives in providerRegistry.js via @langchain/groq.
// Latest models: llama-3.3-70b-versatile, llama-3.1-8b-instant, deepseek-r1-distill-llama-70b
const registry = require('../registry/providerRegistry')

module.exports = {
  id:           registry.PROVIDER_META.groq.id,
  name:         registry.PROVIDER_META.groq.name,
  defaultModel: registry.PROVIDER_META.groq.defaultModel,
  requiresKey:  registry.PROVIDER_META.groq.requiresKey,
  buildModel:   (opts) => registry.buildModel('groq', opts),
  listModels:   (opts) => registry.listModels('groq', opts),
  healthCheck:  (opts) => registry.healthCheck('groq', opts),
}
