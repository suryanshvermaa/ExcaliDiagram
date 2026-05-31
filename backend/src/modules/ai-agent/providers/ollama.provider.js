'use strict'
// Ollama provider — thin wrapper around providerRegistry.
// All actual model logic lives in providerRegistry.js via @langchain/ollama.
// Models are dynamically fetched from the local Ollama instance (no API key required).
const registry = require('../registry/providerRegistry')

module.exports = {
  id:           registry.PROVIDER_META.ollama.id,
  name:         registry.PROVIDER_META.ollama.name,
  defaultModel: registry.PROVIDER_META.ollama.defaultModel,
  requiresKey:  registry.PROVIDER_META.ollama.requiresKey,
  buildModel:   (opts) => registry.buildModel('ollama', opts),
  listModels:   (opts) => registry.listModels('ollama', opts),
  healthCheck:  (opts) => registry.healthCheck('ollama', opts),
}
