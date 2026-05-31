// ── Shared TypeScript types for the AI Architect feature ──────────────────────

export type ProviderID = 'openai' | 'gemini' | 'groq' | 'ollama'

export interface ProviderMeta {
  id:           ProviderID
  name:         string
  requiresKey:  boolean
  defaultModel: string
}

export interface ModelInfo {
  id:          string
  name:        string
  description?: string
  size?:       number
}

// ── Chat / Session types ───────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system'
export type MessageType = 'chat' | 'arch-generate' | 'arch-modify' | 'arch-explain' | 'arch-improve' | 'error'

export interface AIMessage {
  id:        string
  role:      MessageRole
  content:   string
  timestamp: string
  type:      MessageType
  archSpec?: ArchSpec   // present for arch generation/modify messages
  isStreaming?: boolean
}

export interface AISession {
  id:        string
  title:     string
  createdAt: string
  updatedAt: string
  messages:  AIMessage[]
  provider:  ProviderID
  model:     string
}

export interface AISettings {
  provider:  ProviderID
  model:     string
  apiKeys:   Partial<Record<ProviderID, string>>
  ollamaUrl: string
}

// ── Architecture Specification ─────────────────────────────────────────────────

export type NodeType =
  | 'service'
  | 'database'
  | 'cache'
  | 'queue'
  | 'lb'
  | 'cdn'
  | 'gateway'
  | 'client'
  | 'worker'
  | 'scheduler'
  | 'storage'
  | 'monitoring'

export type ConnectionStyle     = 'solid' | 'dashed' | 'dotted'
export type ConnectionDirection = 'forward' | 'backward' | 'bidirectional'
export type BoundaryType        = 'kubernetes' | 'cloud' | 'network' | 'service-group' | 'vpc' | 'region'

export interface ArchNode {
  id:          string
  type:        NodeType
  label:       string
  technology:  string
  description?: string
  group?:      string   // boundary id
}

export interface ArchConnection {
  from:      string
  to:        string
  label?:    string
  style?:    ConnectionStyle
  direction?: ConnectionDirection
}

export interface ArchBoundary {
  id:      string
  type:    BoundaryType
  label:   string
  nodeIds: string[]
  color?:  string
}

export interface ArchSpec {
  title:       string
  description: string
  nodes:       ArchNode[]
  connections: ArchConnection[]
  boundaries:  ArchBoundary[]
}

// ── Layout Engine types ────────────────────────────────────────────────────────

export interface LayoutNode extends ArchNode {
  x:      number
  y:      number
  width:  number
  height: number
  assetId?: string
  color:  string
}

export interface LayoutResult {
  nodes:    LayoutNode[]
  spec:     ArchSpec
}
