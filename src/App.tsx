import { useCallback, useEffect, useRef, useState } from 'react';
import Toolbar from '@/components/Toolbar';
import EditorCanvas from '@/components/EditorCanvas';
import LayersPanel from '@/components/LayersPanel';
import { type LiquifyOptions } from '@/utils/liquify';
import type { EditorCommand, EditorStatus, EditorTool } from '@/types/editor';

const initialStatus: EditorStatus = {
  historyIndex: 0,
  historyLength: 0,
  activeLayerId: null,
  layers: [],
};

function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<EditorTool>('push');
  const [brushSize, setBrushSize] = useState(36);
  const [pressure, setPressure] = useState(0.4);
  const [paintColor, setPaintColor] = useState('#7c3aed');
  const [paintOpacity, setPaintOpacity] = useState(0.85);
  const [brushHardness, setBrushHardness] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [editorStatus, setEditorStatus] = useState<EditorStatus>(initialStatus);
  const [editorCommand, setEditorCommand] = useState<EditorCommand>({ type: 'none', nonce: 0 });
  const [liquifyOptions, setLiquifyOptions] = useState<LiquifyOptions>({
    interpolation: 'bicubic',
    brushHardness: 0.18,
    sharpenAmount: 0.12,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nonceRef = useRef(0);

  const dispatchCommand = useCallback((command: { type: EditorCommand['type']; [key: string]: unknown }) => {
    nonceRef.current += 1;
    setEditorCommand({ ...command, nonce: nonceRef.current } as EditorCommand);
  }, []);

  const loadImage = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setEditorStatus(initialStatus);
    };
    img.src = url;
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) loadImage(file);
  }, [loadImage]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) loadImage(file);
  }, [loadImage]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDownload = useCallback(() => {
    (window as any).__editorDownload?.();
  }, []);

  useEffect(() => {
    (window as any).__editorDispatch = dispatchCommand;
    return () => {
      delete (window as any).__editorDispatch;
    };
  }, [dispatchCommand]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        dispatchCommand({ type: 'redo' });
      } else {
        dispatchCommand({ type: 'undo' });
      }
      return;
    }

    if (event.key === ' ') {
      event.preventDefault();
      setShowOriginal(true);
    }

    if (event.key.toLowerCase() === 'b') {
      setTool('brush');
    }

    if (event.key.toLowerCase() === 'e') {
      setTool('eraser');
    }

    if (event.key.toLowerCase() === 't') {
      setTool('transform');
    }

    // 注意：Ctrl+V 由 document-level 'paste' 事件處理（更可靠，不需焦點）
  }, [dispatchCommand]);

  const handleKeyUp = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === ' ') {
      setShowOriginal(false);
    }
  }, []);

  // 處理檔案 → 新圖層 (用於拖入或貼上)
  const addImageAsLayer = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      dispatchCommand({ type: 'paste-image', imageData });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [dispatchCommand]);

  // Document-level paste listener (確保任何狀態下都能貼上)
  useEffect(() => {
    if (!image) return;

    const handleDocPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            addImageAsLayer(file);
            return;
          }
        }
      }
    };

    document.addEventListener('paste', handleDocPaste);
    return () => document.removeEventListener('paste', handleDocPaste);
  }, [addImageAsLayer, image]);

  // 全域 paste 監聽（已上傳圖片後）
  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!image) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          addImageAsLayer(file);
          return;
        }
      }
    }
  }, [addImageAsLayer, image]);

  // 拖入圖片 → 新圖層 (已有 image 時) 或 → 開啟為基底 (尚未上傳時)
  const handleEditorDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (image) {
      addImageAsLayer(file);
    } else {
      loadImage(file);
    }
  }, [addImageAsLayer, image, loadImage]);

  const handleEditorDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleEditorDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    // 只在離開最外層時才取消
    if (event.currentTarget === event.target) {
      setIsDragging(false);
    }
  }, []);

  const hasImage = !!image;
  const activeLayer = editorStatus.layers.find((layer) => layer.id === editorStatus.activeLayerId) ?? null;

  return (
    <div
      className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#eef2ff,_#f8fafc_35%,_#f1f5f9_100%)]"
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onPaste={handlePaste}
      onDrop={handleEditorDrop}
      onDragOver={handleEditorDragOver}
      onDragLeave={handleEditorDragLeave}
      tabIndex={0}
    >
      <header className="border-b border-slate-200/70 bg-white/85 px-6 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-sm font-black text-white shadow-lg shadow-indigo-200">
              LQ
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Liquify Studio Pro</h1>
              <p className="text-xs text-slate-500">液化、圖層、畫筆與橡皮擦整合的線上繪圖工作台</p>
            </div>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-600">
              Layer + Brush Upgrade
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700">
              📁 上傳圖片
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <button
              onClick={() => dispatchCommand({ type: 'add-layer' })}
              disabled={!hasImage}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ＋ 新增圖層
            </button>
            <button
              onClick={handleDownload}
              disabled={!hasImage}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              💾 下載結果
            </button>
          </div>
        </div>
      </header>

      <div className="px-6 py-3">
        <Toolbar
          tool={tool}
          onToolChange={setTool}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          pressure={pressure}
          onPressureChange={setPressure}
          paintColor={paintColor}
          onPaintColorChange={setPaintColor}
          paintOpacity={paintOpacity}
          onPaintOpacityChange={setPaintOpacity}
          canUndo={editorStatus.historyIndex > 0}
          canRedo={editorStatus.historyIndex < editorStatus.historyLength - 1}
          onUndo={() => dispatchCommand({ type: 'undo' })}
          onRedo={() => dispatchCommand({ type: 'redo' })}
          onReset={() => dispatchCommand({ type: 'reset' })}
          hasImage={hasImage}
          options={liquifyOptions}
          brushHardness={brushHardness}
          onBrushHardnessChange={setBrushHardness}
          onFlattenLayer={() => dispatchCommand({ type: 'flatten-layer' })}
          onOptionsChange={setLiquifyOptions}
        />
      </div>

      {/* 全局拖入提示 */}
      {isDragging && image && (
        <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-indigo-500/20 backdrop-blur-sm">
          <div className="rounded-3xl border-4 border-dashed border-indigo-500 bg-white/90 px-12 py-8 text-center shadow-2xl">
            <div className="text-5xl">📥</div>
            <p className="mt-3 text-xl font-bold text-indigo-700">放開以加入新圖層</p>
            <p className="mt-1 text-sm text-slate-500">拖入的圖片將會建立成一個新的繪圖圖層</p>
          </div>
        </div>
      )}

      <main className="flex flex-1 gap-6 px-6 pb-6">
        {!image ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-1 cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed transition ${
              isDragging
                ? 'border-indigo-400 bg-indigo-50/60'
                : 'border-slate-300 bg-white/70 hover:border-indigo-300 hover:bg-indigo-50/40'
            }`}
          >
            <div className="flex flex-col items-center gap-5 px-8 py-16 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-indigo-50 text-4xl shadow-inner">🖼️</div>
              <div>
                <p className="text-xl font-bold text-slate-800">建立你的液化與繪圖專案</p>
                <p className="mt-2 text-sm text-slate-500">
                  點擊上傳、拖入圖片，或直接按 <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">Ctrl/Cmd + V</kbd> 貼上剪貼簿圖片
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">Liquify</span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">Layers</span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">Brush</span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">Eraser</span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">PNG Export</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <section className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">Ctrl/Cmd + Z 復原</span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">Shift + Ctrl/Cmd + Z 重做</span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">Space 顯示原始圖</span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">B 畫筆</span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">E 橡皮擦</span>
              </div>

              <EditorCanvas
                image={image}
                tool={tool}
                brushSize={brushSize}
                pressure={pressure}
                brushHardness={brushHardness}
                paintColor={paintColor}
                paintOpacity={paintOpacity}
                showOriginal={showOriginal}
                options={liquifyOptions}
                command={editorCommand}
                onStatusChange={setEditorStatus}
              />
            </section>

            <div className="flex w-full max-w-sm flex-col gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-lg backdrop-blur-sm">
                <h2 className="text-sm font-bold text-slate-800">目前工作狀態</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">工具</p>
                    <p className="mt-1 font-semibold text-slate-800">{tool}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">圖層</p>
                    <p className="mt-1 font-semibold text-slate-800">{editorStatus.layers.length}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">選取圖層</p>
                    <p className="mt-1 truncate font-semibold text-slate-800">{activeLayer?.name ?? '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">歷史</p>
                    <p className="mt-1 font-semibold text-slate-800">
                      {editorStatus.historyLength === 0 ? '0/0' : `${editorStatus.historyIndex + 1}/${editorStatus.historyLength}`}
                    </p>
                  </div>
                </div>
              </div>

              <LayersPanel
                layers={editorStatus.layers}
                activeLayerId={editorStatus.activeLayerId}
                onSelectLayer={(layerId) => dispatchCommand({ type: 'select-layer', layerId })}
                onAddLayer={() => dispatchCommand({ type: 'add-layer' })}
                onDuplicateLayer={() => dispatchCommand({ type: 'duplicate-layer' })}
                onDeleteLayer={() => dispatchCommand({ type: 'delete-layer' })}
                onMoveLayerUp={() => dispatchCommand({ type: 'move-layer-up' })}
                onMoveLayerDown={() => dispatchCommand({ type: 'move-layer-down' })}
                onToggleLayerVisibility={(layerId) => dispatchCommand({ type: 'toggle-layer-visibility', layerId })}
                onSetLayerOpacity={(layerId, opacity) => dispatchCommand({ type: 'set-layer-opacity', layerId, opacity })}
                onSetLayerTransform={(layerId, transform) => dispatchCommand({ type: 'set-layer-transform', layerId, transform })}
                onResetLayerTransform={(layerId) => dispatchCommand({ type: 'reset-layer-transform', layerId })}
              />
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-slate-200/70 bg-white/70 px-6 py-3 text-center text-[11px] text-slate-500 backdrop-blur-sm">
        保留原有液化功能，並新增圖層、畫筆、橡皮擦、圖層透明度、圖層排序與非破壞式繪圖流程。
      </footer>
    </div>
  );
}

export default App;
