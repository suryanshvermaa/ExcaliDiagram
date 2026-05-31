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

const ICON_SERVER = "http://localhost:3001";
const SIDEBAR_DEFAULT = 280;
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 600;

export function ExcalidrawHost() {
  const apiRef = useRef<any>(null);
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
      elements: saved.elements,
      appState: saved.appState,
    });
  }, []);

  // ── Autosave on every scene change ──────────────────────────────────────────
  const onChange = useCallback(
    (elements: any, appState: any, _files: any) => {
      scheduleSaveDevScene(elements, appState, () =>
        setLastSavedAt(new Date())
      );
    },
    []
  );

  // ── Sidebar resize handlers ──────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientX - startX.current;
      const next = Math.min(
        SIDEBAR_MAX,
        Math.max(SIDEBAR_MIN, startW.current + delta)
      );
      setSidebarWidth(next);
    };
    const onUp = () => {
      isResizing.current = false;
    };
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

  // ── Insert SVG onto canvas (Zero Delay) ──────────────────────────────────────
  const insertSvgToCanvas = useCallback(
    (svgString: string, x: number, y: number) => {
      const api = apiRef.current;
      if (!api) return;

      // Extract dimensions from SVG string instantly
      const wMatch = svgString.match(/width="([\d.]+)"/);
      const hMatch = svgString.match(/height="([\d.]+)"/);
      const width = wMatch ? parseFloat(wMatch[1]) : 96;
      const height = hMatch ? parseFloat(hMatch[1]) : 96;

      // Offset so the cursor is precisely at the center of the dropped SVG
      const centeredX = x - width / 2;
      const centeredY = y - height / 2;

      // Generate data URL instantly without FileReader
      const dataUrl = `data:image/svg+xml,${encodeURIComponent(svgString)}`;
      const fileId = `svg-${Date.now()}` as any;

      api.addFiles([
        {
          id: fileId,
          dataURL: dataUrl,
          mimeType: "image/svg+xml",
          created: Date.now(),
          lastRetrieved: Date.now(),
        },
      ]);

      const el = convertToExcalidrawElements([
        {
          type: "image",
          x: centeredX,
          y: centeredY,
          width,
          height,
          fileId,
          status: "saved",
        } as any,
      ]);

      api.updateScene(
        { elements: [...api.getSceneElements(), ...el] },
        { captureUpdate: CaptureUpdateAction.IMMEDIATELY }
      );
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
        if (dragged.svg) {
          svgStr = dragged.svg;
        } else {
          const res = await fetch(
            `${ICON_SERVER}/api/icons/${dragged.id}/svg`
          );
          svgStr = await res.text();
        }
        insertSvgToCanvas(svgStr, sceneX, sceneY);
      } catch (err) {
        console.error("Drop insert failed:", err);
      }
    },
    [insertSvgToCanvas]
  );

  // ── Insert handler for assets (raw SVG string) ──────────────────────────────
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

  // ── Insert handler for code/schema (data URL + dimensions) ──────────────────
  const handleInsertSvgDataUrl = useCallback(
    (dataUrl: string, w: number, h: number) => {
      const api = apiRef.current;
      if (!api) return;
      const appState = api.getAppState();
      const x = -appState.scrollX + 100;
      const y = -appState.scrollY + 100;

      const fileId = `svg-${Date.now()}` as any;
      api.addFiles([
        {
          id: fileId,
          dataURL: dataUrl,
          mimeType: "image/svg+xml",
          created: Date.now(),
          lastRetrieved: Date.now(),
        },
      ]);

      const el = convertToExcalidrawElements([
        {
          type: "image",
          x,
          y,
          width: w,
          height: h,
          fileId,
          status: "saved",
        } as any,
      ]);

      api.updateScene(
        { elements: [...api.getSceneElements(), ...el] },
        { captureUpdate: CaptureUpdateAction.IMMEDIATELY }
      );
    },
    []
  );

  return (
    <div className="editorHost">
      {/* Sidebar drawer */}
      {sidebarOpen && (
        <div className="sidebarDrawer" style={{ width: sidebarWidth }}>
          <SidebarPanel
            onInsertAsset={handleInsertAsset}
            onInsertSvg={handleInsertSvgDataUrl}
          />
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
        className="editorCanvas"
        ref={wrapperRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Excalidraw
          excalidrawAPI={(api: any) => {
            apiRef.current = api;
          }}
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
