import { useCallback, useEffect, useState } from 'react'
import type { AISettings, ProviderID, ModelInfo } from '../types/ai.types'
import { fetchModels, testProviderHealth } from '../api/aiAgentClient'

interface Props {
  settings:    AISettings
  onSave:      (settings: AISettings) => void
  onClose:     () => void
}

const PROVIDERS: Array<{ id: ProviderID; name: string; requiresKey: boolean; keyPlaceholder?: string }> = [
  { id: 'openai', name: 'OpenAI',         requiresKey: true,  keyPlaceholder: 'sk-…' },
  { id: 'gemini', name: 'Google Gemini',  requiresKey: true,  keyPlaceholder: 'AIza…' },
  { id: 'groq',   name: 'Groq',           requiresKey: true,  keyPlaceholder: 'gsk_…' },
  { id: 'ollama', name: 'Ollama (Local)', requiresKey: false },
]

export function AISettingsModal({ settings, onSave, onClose }: Props) {
  const [local,       setLocal]       = useState<AISettings>({ ...settings })
  const [models,      setModels]      = useState<ModelInfo[]>([])
  const [loadingMdl,  setLoadingMdl]  = useState(false)
  const [health,      setHealth]      = useState<{ ok: boolean; message: string } | null>(null)
  const [testingHlt,  setTestingHlt]  = useState(false)

  const currentProvider = PROVIDERS.find(p => p.id === local.provider)!

  // Load models — only auto-fire if we already have a key (or no key needed)
  const loadModels = useCallback(async () => {
    const pMeta = PROVIDERS.find(p => p.id === local.provider)!
    const hasKey = !pMeta.requiresKey || !!local.apiKeys[local.provider]
    if (!hasKey) {
      setModels([])     // clear stale list from previous provider
      return            // don't hit the API without a key
    }
    setLoadingMdl(true)
    setModels([])
    try {
      const list = await fetchModels(local.provider, local)
      setModels(list || [])
    } catch {
      setModels([])
    } finally {
      setLoadingMdl(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.provider, local.apiKeys, local.ollamaUrl])

  // Re-run when provider switches (guarded inside loadModels)
  useEffect(() => {
    setModels([])   // clear immediately to avoid flicker
    setHealth(null) // reset connection badge
    loadModels()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.provider])

  // Also load on first mount (in case user already has a key saved)
  useEffect(() => {
    loadModels()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const testHealth = async () => {
    setTestingHlt(true)
    setHealth(null)
    try {
      const result = await testProviderHealth(local.provider, local)
      setHealth({ ok: result.ok, message: result.message })
    } catch (err: any) {
      setHealth({ ok: false, message: err.message })
    } finally {
      setTestingHlt(false)
    }
  }

  const update = (patch: Partial<AISettings>) => setLocal(prev => ({ ...prev, ...patch }))
  const setKey  = (provider: ProviderID, key: string) =>
    setLocal(prev => ({ ...prev, apiKeys: { ...prev.apiKeys, [provider]: key } }))

  return (
    <div className="aiModalOverlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="aiModal">
        {/* Header */}
        <div className="aiModalHeader">
          <div className="aiModalTitle">
            <span className="aiModalIcon">⚙️</span>
            AI Provider Settings
          </div>
          <button className="aiModalClose" onClick={onClose}>×</button>
        </div>

        <div className="aiModalBody">
          {/* Provider selector */}
          <div className="aiSettingsSection">
            <label className="aiSettingsLabel">Provider</label>
            <div className="aiProviderGrid">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  className={`aiProviderCard ${local.provider === p.id ? 'active' : ''}`}
                  onClick={() => { update({ provider: p.id }); setHealth(null) }}
                >
                  <span className="aiProviderEmoji">{providerEmoji(p.id)}</span>
                  <span className="aiProviderName">{p.name}</span>
                  {!p.requiresKey && <span className="aiProviderBadge">Local</span>}
                </button>
              ))}
            </div>
          </div>

          {/* API Key (hidden for Ollama) */}
          {currentProvider.requiresKey && (
            <div className="aiSettingsSection">
              <label className="aiSettingsLabel">API Key — {currentProvider.name}</label>
              <input
                className="aiSettingsInput"
                type="password"
                placeholder={currentProvider.keyPlaceholder ?? 'Enter API key…'}
                value={local.apiKeys[local.provider] ?? ''}
                onChange={e => setKey(local.provider, e.target.value)}
              />
              <p className="aiSettingsHint">
                Keys are stored only in your browser's localStorage and never sent to our servers.
              </p>
            </div>
          )}

          {/* Ollama URL */}
          {local.provider === 'ollama' && (
            <div className="aiSettingsSection">
              <label className="aiSettingsLabel">Ollama Base URL</label>
              <input
                className="aiSettingsInput"
                type="text"
                value={local.ollamaUrl}
                onChange={e => update({ ollamaUrl: e.target.value })}
                placeholder="http://localhost:11434"
              />
            </div>
          )}

          {/* Model selector */}
          <div className="aiSettingsSection">
            <div className="aiSettingsLabelRow">
              <label className="aiSettingsLabel">Model</label>
              <button
                className="aiRefreshModelsBtn"
                onClick={loadModels}
                disabled={loadingMdl}
                title="Refresh model list"
              >
                {loadingMdl ? '⏳' : '🔄'} Refresh
              </button>
            </div>

            {loadingMdl ? (
              <div className="aiModelsLoading"><span className="aiSettingsSpinner" /> Loading models…</div>
            ) : models.length > 0 ? (
              <select
                className="aiSettingsSelect"
                value={local.model}
                onChange={e => update({ model: e.target.value })}
              >
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            ) : (
              <div className="aiModelsEmpty">
                {currentProvider.requiresKey && !local.apiKeys[local.provider]
                  ? 'Enter API key above to load available models.'
                  : 'No models found. Check your connection and click Refresh.'
                }
              </div>
            )}
          </div>

          {/* Connection test */}
          <div className="aiSettingsSection">
            <div className="aiSettingsLabelRow">
              <label className="aiSettingsLabel">Connection</label>
              <button
                className="aiTestConnectionBtn"
                onClick={testHealth}
                disabled={testingHlt}
              >
                {testingHlt ? '⏳ Testing…' : '🔌 Test Connection'}
              </button>
            </div>
            {health && (
              <div className={`aiHealthResult ${health.ok ? 'ok' : 'err'}`}>
                {health.ok ? '✅' : '❌'} {health.message}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="aiModalFooter">
          <button className="aiModalCancel" onClick={onClose}>Cancel</button>
          <button className="aiModalSave" onClick={() => { onSave(local); onClose() }}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}

function providerEmoji(id: ProviderID): string {
  switch (id) {
    case 'openai': return '🟢'
    case 'gemini': return '💎'
    case 'groq':   return '⚡'
    case 'ollama': return '🦙'
  }
}
