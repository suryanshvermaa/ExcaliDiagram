'use strict'
// OpenAI provider — thin wrapper around providerRegistry.
// All actual model logic lives in providerRegistry.js via @langchain/openai.
// Latest models: gpt-4.1, gpt-4o, gpt-4o-mini, o3, o4-mini
const registry = require('../registry/providerRegistry')

module.exports = {
  id:           registry.PROVIDER_META.openai.id,
  name:         registry.PROVIDER_META.openai.name,
  defaultModel: registry.PROVIDER_META.openai.defaultModel,
  requiresKey:  registry.PROVIDER_META.openai.requiresKey,
  buildModel:   (opts) => registry.buildModel('openai', opts),
  listModels:   (opts) => registry.listModels('openai', opts),
  healthCheck:  (opts) => registry.healthCheck('openai', opts),
}
