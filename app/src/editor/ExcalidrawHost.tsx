import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
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
import {
  loadDevScene,
  scheduleSaveDevScene,
} from "../storage/devSceneStorage";
import type { ArchSpec } from "../ai/types/ai.types";

const ICON_SERVER     = "http://localhost:3001";
const SIDEBAR_DEFAULT = 340;   // slightly wider to accommodate AI panel
const SIDEBAR_MIN     = 280;
const SIDEBAR_MAX     = 600;

export function ExcalidrawHost() {
  const apiRef     = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [lastSavedAt,  setLastSavedAt]  = useState<Date | null>(null);

  const isResizing = useRef(false);
  const startX     = useRef(0);
  const startW     = useRef(SIDEBAR_DEFAULT);

  // ── Restore saved scene on mount ──────────────────────────────────────────
  useLayoutEffect(() => {
    const saved = loadDevScene();
    if (!saved || !apiRef.current) return;
    apiRef.current.updateScene({
      elements: saved.elements,
      appState: saved.appState,
    });
  }, []);

  // ── Autosave on every scene change ────────────────────────────────────────
  const onChange = useCallback(
    (elements: any, appState: any, _files: any) => {
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
    const onUp = () => { isResizing.current = false; };
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
    startX.current     = e.clientX;
    startW.current     = sidebarWidth;
  };

  // ── Insert SVG onto canvas ────────────────────────────────────────────────
  const insertSvgToCanvas = useCallback(
    (svgString: string, x: number, y: number) => {
      const api = apiRef.current;
      if (!api) return;

      const wMatch  = svgString.match(/width="([\d.]+)"/);
      const hMatch  = svgString.match(/height="([\d.]+)"/);
      const width   = wMatch ? parseFloat(wMatch[1]) : 96;
      const height  = hMatch ? parseFloat(hMatch[1]) : 96;
      const centeredX = x - width  / 2;
      const centeredY = y - height / 2;

      const dataUrl = `data:image/svg+xml,${encodeURIComponent(svgString)}`;
      const fileId  = `svg-${Date.now()}` as any;

      api.addFiles([{
        id: fileId, dataURL: dataUrl, mimeType: "image/svg+xml",
        created: Date.now(), lastRetrieved: Date.now(),
      }]);

      const el = convertToExcalidrawElements([{
        type: "image", x: centeredX, y: centeredY,
        width, height, fileId, status: "saved",
      } as any]);

      api.updateScene(
        { elements: [...api.getSceneElements(), ...el] },
        { captureUpdate: CaptureUpdateAction.IMMEDIATELY }
      );
    },
    []
  );

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!dragState.get()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      const dragged = dragState.get();
      if (!dragged) return;
      e.preventDefault();
      dragState.set(null);

      const api     = apiRef.current;
      const wrapper = wrapperRef.current;
      if (!api || !wrapper) return;

      const rect     = wrapper.getBoundingClientRect();
      const appState = api.getAppState();
      const { scrollX, scrollY, zoom } = appState;
      const sceneX = (e.clientX - rect.left) / zoom.value - scrollX;
      const sceneY = (e.clientY - rect.top)  / zoom.value - scrollY;

      try {
        let svgStr: string;
        if (dragged.svg) {
          svgStr = dragged.svg;
        } else {
          const res = await fetch(`${ICON_SERVER}/api/icons/${dragged.id}/svg`);
          svgStr    = await res.text();
        }
        insertSvgToCanvas(svgStr, sceneX, sceneY);
      } catch (err) {
        console.error("Drop insert failed:", err);
      }
    },
    [insertSvgToCanvas]
  );

  // ── Insert asset (raw SVG) ────────────────────────────────────────────────
  const handleInsertAsset = useCallback(
    (asset: any) => {
      const api = apiRef.current;
      if (!api) return;
      const appState = api.getAppState();
      const x = -appState.scrollX + 100;
      const y = -appState.scrollY + 100;
      insertSvgToCanvas(asset.svg, x, y);
    },
    [insertSvgToCanvas]
  );

  // ── Insert SVG data URL (from code block) ─────────────────────────────────
  const handleInsertSvgDataUrl = useCallback(
    (dataUrl: string, w: number, h: number) => {
      const api = apiRef.current;
      if (!api) return;
      const appState = api.getAppState();
      const x = -appState.scrollX + 100;
      const y = -appState.scrollY + 100;

      const fileId = `svg-${Date.now()}` as any;
      api.addFiles([{
        id: fileId, dataURL: dataUrl, mimeType: "image/svg+xml",
        created: Date.now(), lastRetrieved: Date.now(),
      }]);
      const el = convertToExcalidrawElements([{
        type: "image", x, y, width: w, height: h, fileId, status: "saved",
      } as any]);
      api.updateScene(
        { elements: [...api.getSceneElements(), ...el] },
        { captureUpdate: CaptureUpdateAction.IMMEDIATELY }
      );
    },
    []
  );

  // ── AI: render arch spec onto canvas (MERGE, not replace) ──────────────────
  const handleRenderArch = useCallback(
    (newElements: any[], files: Record<string, { id: string; dataURL: string; mimeType: string; created: number; lastRetrieved: number }>) => {
      const api = apiRef.current;
      if (!api) return;

      // Add any SVG files first
      const fileEntries = Object.values(files)
      if (fileEntries.length > 0) api.addFiles(fileEntries)

      // MERGE with existing elements — preserves everything already on canvas
      const existing = api.getSceneElements() as any[]
      const merged   = [...existing, ...newElements]

      api.updateScene(
        { elements: merged },
        { captureUpdate: CaptureUpdateAction.IMMEDIATELY }
      );

      // Zoom to show the newly added elements
      setTimeout(() => {
        try { api.scrollToContent(newElements, { fitToViewport: false, animate: true }) } catch { /* ignore */ }
      }, 150)
    },
    []
  );

  // ── AI: extract current ArchSpec from canvas ──────────────────────────────
  const getCurrentArchSpec = useCallback((): ArchSpec | null => {
    // We store the last generated spec in a ref on the window for simplicity
    return (window as any).__excaliDiagramCurrentArchSpec ?? null;
  }, []);

  return (
    <div className="editorHost">
      {/* Sidebar drawer */}
      <div
        className={`sidebarDrawer ${sidebarOpen ? "open" : ""}`}
        style={{
          width: sidebarOpen ? sidebarWidth : 0,
          transition: isResizing.current ? "none" : "width 0.3s cubic-bezier(.4, 0, .2, 1)",
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
        className="editorCanvas"
        ref={wrapperRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Excalidraw
          excalidrawAPI={(api: any) => { apiRef.current = api; }}
          onChange={onChange}
        />
        {lastSavedAt && (
          <div className="savedBadge">
            Saved {lastSavedAt.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
