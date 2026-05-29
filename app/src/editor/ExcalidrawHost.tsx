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
} from "@excalidraw/excalidraw";
import {
  ExcalidrawImperativeAPI,
  AppState,
  BinaryFiles,
} from "@excalidraw/excalidraw/types/types";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { dragState } from "./dragState";
import { SidebarPanel } from "../sidebar/SidebarPanel";
import {
  loadDevScene,
  scheduleSaveDevScene,
} from "../storage/devSceneStorage";

const ICON_SERVER = "http://localhost:3001";
const SIDEBAR_DEFAULT = 280;
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 600;

export default function ExcalidrawHost() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const isResizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(SIDEBAR_DEFAULT);

  // ── Restore saved scene on mount ────────────────────────────────────────────
  useLayoutEffect(() => {
    const saved = loadDevScene();
    if (!saved || !apiRef.current) return;
    apiRef.current.updateScene({
      elements: saved.elements as ExcalidrawElement[],
      appState: saved.appState as Partial<AppState>,
    });
  }, []);

  // ── Autosave on every scene change ──────────────────────────────────────────
  const onChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, _files: BinaryFiles) => {
      scheduleSaveDevScene(elements, appState, () => setLastSavedAt(new Date()));
    },
    []
  );

  // ── Sidebar resize handlers ──────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX.current - e.clientX;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW.current + delta));
      setSidebarWidth(next);
    };
    const onUp = () => { isResizing.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onResizeHandleDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startX.current = e.clientX;
    startW.current = sidebarWidth;
  };

  // ── Insert SVG onto canvas ───────────────────────────────────────────────────
  const insertSvgToCanvas = useCallback(
    async (svgString: string, x: number, y: number) => {
      const api = apiRef.current;
      if (!api) return;

      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const dataUrl = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const fileId = `svg-${Date.now()}` as any;
      await api.addFiles([
        {
          id: fileId,
          dataURL: dataUrl as any,
          mimeType: "image/svg+xml",
          created: Date.now(),
          lastRetrieved: Date.now(),
        },
      ]);

      const { width, height } = await new Promise<{ width: number; height: number }>((res) => {
        const img = new Image();
        img.onload = () => res({ width: img.naturalWidth || 200, height: img.naturalHeight || 200 });
        img.src = dataUrl;
      });

      const el = convertToExcalidrawElements([
        {
          type: "image",
          x,
          y,
          width,
          height,
          fileId,
          status: "saved",
        } as any,
      ]);

      api.updateScene({
        elements: [...api.getSceneElements(), ...el],
      }, { captureUpdate: CaptureUpdateAction.IMMEDIATELY });
    },
    []
  );

  // ── Drag-over: only activate when dragState has a value ─────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!dragState.get()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // ── Drop: compute scene coords and insert ───────────────────────────────────
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      const dragged = dragState.get();
      if (!dragged) return;
      e.preventDefault();
      dragState.set(null);

      const api = apiRef.current;
      const wrapper = wrapperRef.current;
      if (!api || !wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      const appState = api.getAppState();
      const { scrollX, scrollY, zoom } = appState;
      const sceneX = (e.clientX - rect.left) / zoom.value - scrollX;
      const sceneY = (e.clientY - rect.top) / zoom.value - scrollY;

      try {
        let svgStr: string;
        if (dragged.svgString) {
          svgStr = dragged.svgString;
        } else {
          const res = await fetch(`${ICON_SERVER}/api/icons/${dragged.id}/svg`);
          svgStr = await res.text();
        }
        await insertSvgToCanvas(svgStr, sceneX, sceneY);
      } catch (err) {
        console.error("Drop insert failed:", err);
      }
    },
    [insertSvgToCanvas]
  );

  // ── Insert handler for sidebar panels ───────────────────────────────────────
  const handleInsert = useCallback(
    async (svgStringOrDataUrl: string) => {
      const api = apiRef.current;
      if (!api) return;
      const { x, y } = api.getAppState().scrollX !== undefined
        ? { x: 100, y: 100 }
        : { x: 100, y: 100 };
      await insertSvgToCanvas(svgStringOrDataUrl, x, y);
    },
    [insertSvgToCanvas]
  );

  return (
    <div className="editorHost">
      {/* Sidebar drawer */}
      {sidebarOpen && (
        <div className="sidebarDrawer" style={{ width: sidebarWidth }}>
          <SidebarPanel onInsert={handleInsert} />
          {/* Resize handle */}
          <div className="resizeHandle" onMouseDown={onResizeHandleDown} />
        </div>
      )}

      {/* Toggle button */}
      <button
        className="sidebarToggle"
        onClick={() => setSidebarOpen((o) => !o)}
        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? "‹" : "›"}
      </button>

      {/* Canvas area */}
      <div
        className="canvasWrapper"
        ref={wrapperRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Excalidraw
          excalidrawAPI={(api) => { apiRef.current = api; }}
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
