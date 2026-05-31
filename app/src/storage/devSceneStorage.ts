// Storage using localStorage — no Tauri dependency, works in any browser.
type DevScene = {
  version: 1
  updatedAt: string
  elements: unknown
  appState: unknown
  files: unknown
}

const STORAGE_KEY = 'excelidrawApp:devScene'

let saveTimer: number | null = null

// Synchronous load — safe to call during React render/state init
export function loadDevScene(): DevScene | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DevScene
    if (!parsed || parsed.version !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export function scheduleSaveDevScene(
  input: { elements: unknown; appState: unknown; files: unknown },
  options: { debounceMs?: number; onSaved?: (updatedAt: string) => void } = {},
) {
  if (saveTimer != null) {
    window.clearTimeout(saveTimer)
  }

  const debounceMs = options.debounceMs ?? 1500  // 1.5 s — fast enough to catch refreshes

  saveTimer = window.setTimeout(() => {
    saveTimer = null
    try {
      const updatedAt = new Date().toISOString()

      // Only persist safe cosmetic appState fields.
      // The full appState contains Maps, internal flags, and UI state
      // that breaks JSON round-trips and causes infinite re-render loops.
      const raw = input.appState as Record<string, unknown>
      const safeAppState = {
        viewBackgroundColor: raw?.viewBackgroundColor ?? '#ffffff',
        theme: raw?.theme ?? 'light',
      }

      const scene: DevScene = {
        version: 1,
        updatedAt,
        elements: input.elements,
        appState: safeAppState,
        files: input.files,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scene))
      options.onSaved?.(updatedAt)
    } catch {
      // ignore (e.g. storage quota exceeded)
    }
  }, debounceMs)
}
