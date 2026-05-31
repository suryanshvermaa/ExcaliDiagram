import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Excalidraw,
  convertToExcalidrawElements,
  CaptureUpdateAction,
} from "@excalidraw/excalidraw";
import { dragState } from "./dragState";
import { SidebarPanel } from "../sidebar/SidebarPanel";
import type { BuiltinAsset } from "../assets/assetCatalog";
import {
  loadDevScene,
  scheduleSaveDevScene,
} from "../storage/devSceneStorage";


const ICON_SERVER     = "http://localhost:3001";
const SIDEBAR_DEFAULT = 340;   // slightly wider to accommodate AI panel
const SIDEBAR_MIN     = 280;
const SIDEBAR_MAX     = 600;

type ExcalidrawProps = React.ComponentProps<typeof Excalidraw>;

type ConvertInput = Exclude<Parameters<typeof convertToExcalidrawElements>[0], null>;
type ConvertElement = ConvertInput[number];

type ExcalidrawFile = {
  id: string;
  dataURL: string;
  mimeType: string;
  created: number;
  lastRetrieved: number;
};

function isExcalidrawFile(v: unknown): v is ExcalidrawFile {
  if (typeof v !== 'object' || !v) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.dataURL === 'string' &&
    typeof r.mimeType === 'string' &&
    typeof r.created === 'number' &&
    typeof r.lastRetrieved === 'number'
  );
}

type ExcalidrawApiLike = {
  addFiles: (files: ExcalidrawFile[]) => void;
  getSceneElements: () => readonly unknown[];
  getAppState: () => { scrollX: number; scrollY: number; zoom: { value: number } };
  updateScene: (scene: unknown, opts?: unknown) => void;
  scrollToContent: (elements: readonly unknown[], opts: { fitToViewport: boolean; animate: boolean }) => void;
};

type InsertableAsset = BuiltinAsset & { svgUrl?: string };

declare global {
  interface Window {
    __excaliDiagramCurrentArchSpec?: unknown;
  }
}

type SvgDims = { width: number; height: number; hasViewBox: boolean };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function parseSvgAttr(svg: string, attr: string): string | null {
  const m = svg.match(new RegExp(`${attr}\\s*=\\s*"([^"]+)"`, 'i'));
  return m ? m[1] : null;
}

function parseSvgNumberLength(raw: string | null): number | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  // Avoid treating percentages or non-px relative units as absolute.
  if (/%$/.test(v) || /em$|rem$|vh$|vw$|vmin$|vmax$|cm$|mm$|in$|pt$|pc$/i.test(v)) return null;
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseSvgViewBox(svg: string): { w: number; h: number } | null {
  const vb = parseSvgAttr(svg, 'viewBox');
  if (!vb) return null;
  const parts = vb.trim().split(/[ ,]+/).map((p) => Number.parseFloat(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p))) return null;
  const w = parts[2];
  const h = parts[3];
  if (w <= 0 || h <= 0) return null;
  return { w, h };
}

function getSvgDims(svg: string): SvgDims {
  const vb = parseSvgViewBox(svg);
  const wAttr = parseSvgNumberLength(parseSvgAttr(svg, 'width'));
  const hAttr = parseSvgNumberLength(parseSvgAttr(svg, 'height'));

  const width = wAttr ?? vb?.w ?? 96;
  const height = hAttr ?? vb?.h ?? 96;

  return {
    width,
    height,
    hasViewBox: Boolean(vb),
  };
}

function ensureViewBox(svg: string, width: number, height: number): string {
  if (/\bviewBox\s*=\s*"/i.test(svg)) return svg;
  // Insert viewBox into the root <svg ...> tag.
  return svg.replace(/<svg\b/i, `<svg viewBox="0 0 ${width} ${height}"`);
}

function setRootSvgSize(svg: string, width: number, height: number): string {
  // Replace existing width/height if present; otherwise inject them.
  let out = svg;
  if (/\bwidth\s*=\s*"/i.test(out)) {
    out = out.replace(/\bwidth\s*=\s*"[^"]*"/i, `width="${width}"`);
  } else {
    out = out.replace(/<svg\b/i, `<svg width="${width}"`);
  }
  if (/\bheight\s*=\s*"/i.test(out)) {
    out = out.replace(/\bheight\s*=\s*"[^"]*"/i, `height="${height}"`);
  } else {
    out = out.replace(/<svg\b/i, `<svg height="${height}"`);
  }
  return out;
}

function makeHiDpiSvg(svg: string, baseW: number, baseH: number): string {
  // Strategy: keep element size (baseW/baseH) unchanged in Excalidraw,
  // but increase the SVG's intrinsic size so zooming looks crisp.
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  // Excalidraw rasterizes SVGs; if intrinsic size is too small, zooming looks blurry.
  // Use a higher baseline multiplier, but cap to avoid huge memory usage.
  const scale = clamp(Math.ceil(dpr * 16), 16, 48); // 16x..48x depending on DPR
  const MAX_DIM = 4096;
  const MAX_AREA = 12_000_000; // ~12 megapixels cap

  let hiW = clamp(Math.round(baseW * scale), Math.round(baseW), MAX_DIM);
  let hiH = clamp(Math.round(baseH * scale), Math.round(baseH), MAX_DIM);

  const area = hiW * hiH;
  if (area > MAX_AREA) {
    const ratio = Math.sqrt(MAX_AREA / area);
    hiW = Math.max(Math.round(baseW), Math.floor(hiW * ratio));
    hiH = Math.max(Math.round(baseH), Math.floor(hiH * ratio));
  }

  // If we don't have a viewBox, adding width/height alone can change the coordinate system.
  // Add a viewBox matching the original dimensions when possible.
  let out = ensureViewBox(svg, baseW, baseH);
  out = setRootSvgSize(out, hiW, hiH);
  return out;
}

async function fetchSvgText(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch SVG (${r.status})`);
  return r.text();
}

export function ExcalidrawHost() {
  const apiRef     = useRef<unknown>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [lastSavedAt,  setLastSavedAt]  = useState<Date | null>(null);
  const [resizing, setResizing] = useState(false);

  const [dragOverCanvas, setDragOverCanvas] = useState(false);
  const [dragPreview, setDragPreview] = useState<
    | null
    | {
        asset: InsertableAsset;
        x: number;
        y: number;
      }
  >(null);

  // Load saved scene once — passed as initialData prop (correct Excalidraw pattern)
  const [initialData] = useState<ExcalidrawProps['initialData']>(() => {
    const saved = loadDevScene()
    if (!saved) return null
    return { elements: saved.elements, appState: saved.appState, files: saved.files } as unknown as ExcalidrawProps['initialData']
  })

  const isResizing = useRef(false);
  const startX     = useRef(0);
  const startW     = useRef(SIDEBAR_DEFAULT);

  // ── Autosave on every scene change ────────────────────────────────────────
  const onChange = useCallback(
    (elements: unknown, appState: unknown, _files: unknown) => {
      scheduleSaveDevScene(
        { elements, appState, files: _files },
        { onSaved: () => setLastSavedAt(new Date()) }
      );
    },
    []
  );

  // ── Sidebar resize handlers ───────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientX - startX.current;
      const next  = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW.current + delta));
      setSidebarWidth(next);
    };
    const onUp = () => { isResizing.current = false; setResizing(false); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  const onResizeHandleDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    setResizing(true);
    startX.current     = e.clientX;
    startW.current     = sidebarWidth;
  };

  // ── Insert SVG onto canvas ────────────────────────────────────────────────
  const insertSvgToCanvas = useCallback(
    (svgString: string, x: number, y: number) => {
      const api = apiRef.current as ExcalidrawApiLike | null;
      if (!api) return;

      const { width, height } = getSvgDims(svgString);
      const centeredX = x - width  / 2;
      const centeredY = y - height / 2;

      const hiDpiSvg = makeHiDpiSvg(svgString, width, height);
      const dataUrl = `data:image/svg+xml,${encodeURIComponent(hiDpiSvg)}`;
      const fileId  = `svg-${Date.now()}`;

      api.addFiles([{
        id: fileId, dataURL: dataUrl, mimeType: "image/svg+xml",
        created: Date.now(), lastRetrieved: Date.now(),
      }]);

      const skeleton = {
        type: "image",
        x: centeredX,
        y: centeredY,
        width,
        height,
        fileId,
        status: "saved",
      } as unknown as ConvertElement;

      const el = convertToExcalidrawElements([skeleton] as unknown as ConvertInput);

      api.updateScene(
        { elements: [...api.getSceneElements(), ...el] },
        { captureUpdate: CaptureUpdateAction.IMMEDIATELY }
      );
    },
    []
  );

  const insertSvgToCanvasAtSize = useCallback(
    (svgString: string, x: number, y: number, elementW: number, elementH: number) => {
      const api = apiRef.current as ExcalidrawApiLike | null;
      if (!api) return;

      const { width: baseW, height: baseH } = getSvgDims(svgString);
      const centeredX = x - elementW / 2;
      const centeredY = y - elementH / 2;

      const hiDpiSvg = makeHiDpiSvg(svgString, baseW, baseH);
      const dataUrl = `data:image/svg+xml,${encodeURIComponent(hiDpiSvg)}`;
      const fileId = `svg-${Date.now()}`;

      api.addFiles([{
        id: fileId,
        dataURL: dataUrl,
        mimeType: "image/svg+xml",
        created: Date.now(),
        lastRetrieved: Date.now(),
      }]);

      const skeleton = {
        type: "image",
        x: centeredX,
        y: centeredY,
        width: elementW,
        height: elementH,
        fileId,
        status: "saved",
      } as unknown as ConvertElement;

      const el = convertToExcalidrawElements([skeleton] as unknown as ConvertInput);
      api.updateScene(
        { elements: [...api.getSceneElements(), ...el] },
        { captureUpdate: CaptureUpdateAction.IMMEDIATELY }
      );
    },
    []
  );

  const insertRemoteSvgUrlToCanvas = useCallback(
    async (svgUrl: string, x: number, y: number, proxyId?: string) => {
      // Keep server icons visually identical to sidebar by sourcing the exact SVG,
      // but still embed it as HiDPI data URL so zooming stays crisp.
      const TILE = 96;
      try {
        const svg = await fetchSvgText(svgUrl);
        insertSvgToCanvasAtSize(svg, x, y, TILE, TILE);
      } catch {
        if (!proxyId) return;
        const res = await fetch(`${ICON_SERVER}/api/icons/${proxyId}/svg`);
        const svg = await res.text();
        insertSvgToCanvasAtSize(svg, x, y, TILE, TILE);
      }
    },
    [insertSvgToCanvasAtSize]
  );

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    const dragged = dragState.get();
    if (!dragged) {
      if (dragOverCanvas) setDragOverCanvas(false);
      if (dragPreview) setDragPreview(null);
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";

    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();

    if (!dragOverCanvas) setDragOverCanvas(true);
    setDragPreview({
      asset: dragged,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear when actually leaving the canvas wrapper (not moving between children).
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget instanceof HTMLElement && e.currentTarget.contains(related)) return;
    setDragOverCanvas(false);
    setDragPreview(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      const dragged = dragState.get();
      if (!dragged) return;
      e.preventDefault();
      dragState.set(null);
      setDragOverCanvas(false);
      setDragPreview(null);

      const api     = apiRef.current;
      const wrapper = wrapperRef.current;
      if (!api || !wrapper) return;

      const rect     = wrapper.getBoundingClientRect();
      const appState = (api as ExcalidrawApiLike).getAppState();
      const { scrollX, scrollY, zoom } = appState;
      const sceneX = (e.clientX - rect.left) / zoom.value - scrollX;
      const sceneY = (e.clientY - rect.top)  / zoom.value - scrollY;

      try {
        // If this is a server icon, prefer inserting via the same signed URL
        // used for the sidebar preview to avoid visual mismatches.
        if (dragged.svgUrl && !dragged.svg) {
          await insertRemoteSvgUrlToCanvas(dragged.svgUrl, sceneX, sceneY, dragged.id);
          return;
        }

        if (dragged.svg) {
          insertSvgToCanvas(dragged.svg, sceneX, sceneY);
          return;
        }

        // Fallback: fetch SVG text via proxy (when dragging object doesn't include svgUrl)
        const res = await fetch(`${ICON_SERVER}/api/icons/${dragged.id}/svg`);
        const svgStr = await res.text();
        insertSvgToCanvas(svgStr, sceneX, sceneY);
      } catch (err) {
        console.error("Drop insert failed:", err);
      }
    },
    [insertRemoteSvgUrlToCanvas, insertSvgToCanvas]
  );

  // ── Insert asset (raw SVG) ────────────────────────────────────────────────
  const handleInsertAsset = useCallback(
    (asset: InsertableAsset) => {
      const api = apiRef.current;
      if (!api) return;
      const appState = (api as ExcalidrawApiLike).getAppState();
      const x = -appState.scrollX + 100;
      const y = -appState.scrollY + 100;

      if (asset.svg) {
        insertSvgToCanvas(asset.svg, x, y);
      } else if (asset.svgUrl) {
        void insertRemoteSvgUrlToCanvas(asset.svgUrl, x, y, asset.id);
      }
    },
    [insertRemoteSvgUrlToCanvas, insertSvgToCanvas]
  );

  // ── Insert SVG data URL (from code block) ─────────────────────────────────
  const handleInsertSvgDataUrl = useCallback(
    (dataUrl: string, w: number, h: number) => {
      const api = apiRef.current;
      if (!api) return;
      const appState = (api as ExcalidrawApiLike).getAppState();
      const x = -appState.scrollX + 100;
      const y = -appState.scrollY + 100;

      const fileId = `svg-${Date.now()}`;
      (api as ExcalidrawApiLike).addFiles([{
        id: fileId, dataURL: dataUrl, mimeType: "image/svg+xml",
        created: Date.now(), lastRetrieved: Date.now(),
      }]);
      const skeleton = {
        type: "image",
        x,
        y,
        width: w,
        height: h,
        fileId,
        status: "saved",
      } as unknown as ConvertElement;
      const el = convertToExcalidrawElements([skeleton] as unknown as ConvertInput);
      (api as ExcalidrawApiLike).updateScene(
        { elements: [...(api as ExcalidrawApiLike).getSceneElements(), ...el] },
        { captureUpdate: CaptureUpdateAction.IMMEDIATELY }
      );
    },
    []
  );

  // ── AI: render Mermaid-converted elements onto canvas ────────────────────
  const handleRenderArch = useCallback(
    (newElements: unknown[], files: Record<string, unknown>, sessionId: string) => {
      const api = apiRef.current as ExcalidrawApiLike | null;
      if (!api) return;

      // Add any binary files (images) that come with the diagram
      const fileEntries = Object.values(files).filter(isExcalidrawFile)
      if (fileEntries.length > 0) api.addFiles(fileEntries)

      // Stamp every element with the current sessionId and ensure nothing is locked.
      // We keep frames intact — in Excalidraw you can click directly on any
      // element inside a frame to select/move it individually.
      const stamped = newElements.map((el) => ({
        ...(typeof el === 'object' && el ? (el as Record<string, unknown>) : {}),
        locked: false,
        __aiGenerated: sessionId,
      }))

      // Keep any elements the user drew by hand, AND elements generated by OTHER chat sessions.
      // Replace only the elements generated by the CURRENT chat session.
      const kept = api.getSceneElements()
        .filter((el) => {
          if (typeof el !== 'object' || !el) return true
          const gen = (el as Record<string, unknown>).__aiGenerated
          return gen !== sessionId
        })
        .map((el) => (typeof el === 'object' && el ? ({ ...(el as Record<string, unknown>) }) : el))

      api.updateScene({
        elements:      [...kept, ...stamped],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })

      // Scroll to make the new diagram fully visible
      setTimeout(() => {
        try {
          api.scrollToContent(stamped, { fitToViewport: true, animate: true })
        } catch { /* ignore */ }
      }, 80)
    },
    []
  );

  // getCurrentArchSpec kept for API compatibility — hook now tracks Mermaid internally
  const getCurrentArchSpec = useCallback((): unknown => {
    return window.__excaliDiagramCurrentArchSpec ?? null;
  }, []);

  return (
    <div className="editorHost">
      {/* Sidebar drawer */}
      <div
        className={`sidebarDrawer ${sidebarOpen ? "open" : ""}`}
        style={{
          width: sidebarOpen ? sidebarWidth : 0,
          transition: resizing ? "none" : "width 0.3s cubic-bezier(.4, 0, .2, 1)",
        }}
      >
        <SidebarPanel
          onInsertAsset={handleInsertAsset}
          onInsertSvg={handleInsertSvgDataUrl}
          onRenderArch={handleRenderArch}
          getCurrentArchSpec={getCurrentArchSpec}
        />
        {/* Resize handle */}
        <div className="sidebarResizeHandle" onMouseDown={onResizeHandleDown} />
      </div>

      {/* Toggle button */}
      <button
        className="sidebarToggleBtn"
        onClick={() => setSidebarOpen((o) => !o)}
        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        <span style={{ fontSize: 16, fontWeight: 500 }}>{sidebarOpen ? "‹" : "›"}</span>
      </button>

      {/* Canvas area */}
      <div
        className={dragOverCanvas ? "editorCanvas dragOver" : "editorCanvas"}
        ref={wrapperRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Excalidraw
          initialData={initialData}
          excalidrawAPI={(api) => { apiRef.current = api; }}
          onChange={onChange}
        />
        {dragPreview && (
          <div
            className="dragAssetPreview"
            style={{ left: dragPreview.x, top: dragPreview.y }}
            aria-hidden="true"
          >
            {dragPreview.asset.svgUrl ? (
              <img src={dragPreview.asset.svgUrl} alt="" draggable={false} />
            ) : (
              <span dangerouslySetInnerHTML={{ __html: dragPreview.asset.svg }} />
            )}
          </div>
        )}
        {lastSavedAt && (
          <div className="savedBadge">
            Saved {lastSavedAt.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
