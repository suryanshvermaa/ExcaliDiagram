// Lightweight shared state for drag-and-drop from the asset panel to the canvas.
// Using a simple module variable (not React state) so it's synchronous and
// accessible across the component boundary without prop drilling or context.

import type { BuiltinAsset } from '../assets/assetCatalog'

let _dragged: BuiltinAsset | null = null

export const dragState = {
  set: (asset: BuiltinAsset | null) => { _dragged = asset },
  get: () => _dragged,
}
