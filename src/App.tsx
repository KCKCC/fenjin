import { useEffect, useRef, useState } from "react";
import { useEditor, PAGE_SIZES } from "./useEditor";
import { Canvas, type CanvasHandle } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { exportSvgToPng } from "./utils/exportImage";
import { clamp } from "./utils/geometry";
import { LayoutPicker } from "./components/LayoutPicker";
import type { BubbleKind } from "./types";

const BUBBLE_TYPES: { kind: BubbleKind; label: string; icon: string }[] = [
  { kind: "speech", label: "對話", icon: "💬" },
  { kind: "thought", label: "想法", icon: "💭" },
  { kind: "shout", label: "吶喊", icon: "💥" },
  { kind: "narration", label: "旁白", icon: "▭" },
  { kind: "none", label: "純文字", icon: "T" },
];

export default function App() {
  const ed = useEditor();
  const canvasRef = useRef<CanvasHandle>(null);
  const [scale, setScale] = useState(0.62);
  const [exporting, setExporting] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);

  const selPanel =
    ed.selection?.type === "panel"
      ? ed.state.panels.find((p) => p.id === ed.selection!.id)
      : undefined;
  const selBubble =
    ed.selection?.type === "bubble"
      ? ed.state.bubbles.find((b) => b.id === ed.selection!.id)
      : undefined;

  // Prevent global browser drop (opening image in new window)
  useEffect(() => {
    const preventGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", preventGlobalDrop, false);
    window.addEventListener("drop", preventGlobalDrop, false);
    return () => {
      window.removeEventListener("dragover", preventGlobalDrop, false);
      window.removeEventListener("drop", preventGlobalDrop, false);
    };
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (typing) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) ed.redo();
        else ed.undo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && ed.selection) {
        e.preventDefault();
        ed.deleteSelected();
      } else if (e.key === "Escape") {
        ed.setSelection(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ed]);

  const handleExport = async () => {
    const svg = canvasRef.current?.getSvg();
    if (!svg) return;
    setExporting(true);
    ed.setSelection(null);
    await new Promise((r) => setTimeout(r, 60));
    try {
      await exportSvgToPng(svg, ed.state.page.width, ed.state.page.height, 2);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <LayoutPicker
        open={layoutOpen}
        onClose={() => setLayoutOpen(false)}
        onPick={(t) => ed.applyLayout(t)}
      />
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-lg">📐</span>
          <span className="text-sm font-bold tracking-wide">MangaFrame</span>
          <span className="hidden text-[11px] text-zinc-500 sm:inline">漫畫分鏡工具</span>
        </div>

        <div className="mx-2 h-5 w-px bg-zinc-700" />

        <button
          onClick={ed.addPanel}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
        >
          ＋ 新增分鏡
        </button>

        <div className="flex items-center gap-1 rounded-md bg-zinc-800 p-1">
          {BUBBLE_TYPES.map((b) => (
            <button
              key={b.kind}
              onClick={() => ed.addBubble(b.kind)}
              title={`新增${b.label}`}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
            >
              <span>{b.icon}</span>
              <span className="hidden md:inline">{b.label}</span>
            </button>
          ))}
        </div>

        <div className="mx-1 h-5 w-px bg-zinc-700" />

        <button
          onClick={ed.undo}
          disabled={!ed.canUndo}
          className="rounded-md px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
          title="復原 (Ctrl+Z)"
        >
          ↶ 復原
        </button>
        <button
          onClick={ed.redo}
          disabled={!ed.canRedo}
          className="rounded-md px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
          title="重做 (Ctrl+Shift+Z)"
        >
          ↷ 重做
        </button>

        <div className="ml-auto flex items-center gap-3">
          <select
            value={ed.state.page.name}
            onChange={(e) => {
              const p = PAGE_SIZES.find((x) => x.name === e.target.value);
              if (p) ed.setPage(p);
            }}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none"
          >
            {PAGE_SIZES.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <button
              onClick={() => setScale((s) => clamp(s - 0.1, 0.2, 2))}
              className="h-6 w-6 rounded bg-zinc-800 hover:bg-zinc-700"
            >
              −
            </button>
            <span className="w-10 text-center tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => clamp(s + 0.1, 0.2, 2))}
              className="h-6 w-6 rounded bg-zinc-800 hover:bg-zinc-700"
            >
              ＋
            </button>
          </div>

          <button
            onClick={() => setLayoutOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
          >
            <span>▦</span> 版型
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {exporting ? "匯出中…" : "⬇ 匯出 PNG"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Canvas area */}
        <main
          className="relative flex-1 overflow-auto p-10"
          style={{
            backgroundImage:
              "radial-gradient(circle, #27272a 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
          onPointerDown={(e) => {
            if (e.currentTarget === e.target) ed.setSelection(null);
          }}
        >
          <Canvas
            ref={canvasRef}
            state={ed.state}
            selection={ed.selection}
            scale={scale}
            setSelection={ed.setSelection}
            beginDrag={ed.beginDrag}
            endDrag={ed.endDrag}
            updatePanel={ed.updatePanel}
            updateBubble={ed.updateBubble}
          />
        </main>

        {/* Right inspector */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-zinc-200">屬性面板</h2>
          </div>
          <Inspector
            selection={ed.selection}
            panel={selPanel}
            bubble={selBubble}
            onUpdatePanel={(patch) =>
              selPanel && ed.updatePanel(selPanel.id, patch)
            }
            onUpdateBubble={(patch) =>
              selBubble && ed.updateBubble(selBubble.id, patch)
            }
            onDelete={ed.deleteSelected}
            onBringFront={ed.bringToFront}
            onRemoveImage={() =>
              selPanel && ed.updatePanel(selPanel.id, { image: null })
            }
          />

          <div className="border-t border-zinc-800 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-zinc-400">頁面底色</span>
              <input
                type="color"
                value={ed.state.bg}
                onChange={(e) => ed.setBg(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-zinc-700 bg-transparent"
              />
            </div>
            <button
              onClick={ed.clearAll}
              className="w-full rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
            >
              清空畫布
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
