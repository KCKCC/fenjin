import { cn } from '@/utils/cn';
import type { LayerSummary, LayerTransform } from '@/types/editor';

interface LayersPanelProps {
  layers: LayerSummary[];
  activeLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onDuplicateLayer: () => void;
  onDeleteLayer: () => void;
  onMoveLayerUp: () => void;
  onMoveLayerDown: () => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onSetLayerOpacity: (layerId: string, opacity: number) => void;
  onSetLayerTransform: (layerId: string, transform: Partial<LayerTransform>) => void;
  onResetLayerTransform: (layerId: string) => void;
}

export default function LayersPanel({
  layers,
  activeLayerId,
  onSelectLayer,
  onAddLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onMoveLayerUp,
  onMoveLayerDown,
  onToggleLayerVisibility,
  onSetLayerOpacity,
  onResetLayerTransform,
}: LayersPanelProps) {
  const activeIdx = layers.findIndex((l) => l.id === activeLayerId);
  const activeLayer = layers[activeIdx] ?? null;

  const hasTransform = !!activeLayer?.transform && (
    activeLayer.transform.x !== 0 ||
    activeLayer.transform.y !== 0 ||
    activeLayer.transform.scaleX !== 1 ||
    activeLayer.transform.scaleY !== 1 ||
    activeLayer.transform.rotation !== 0
  );

  const formatRot = (r: number) => `${((r * 180) / Math.PI).toFixed(1)}°`;
  const formatScale = (s: number) => `${(s * 100).toFixed(0)}%`;

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">圖層</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {layers.length} 層
          </span>
        </div>

        {/* Action Buttons */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={onAddLayer}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
          >
            ＋ 新增
          </button>
          <button
            onClick={onDuplicateLayer}
            disabled={!activeLayerId}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 active:scale-95"
          >
            ⧉ 複製
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={onMoveLayerUp}
            disabled={!activeLayerId || activeIdx === layers.length - 1}
            className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 active:scale-95"
            title="往上移動圖層"
          >
            ↑ 上移
          </button>
          <button
            onClick={onMoveLayerDown}
            disabled={!activeLayerId || activeIdx <= 0}
            className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 active:scale-95"
            title="往下移動圖層"
          >
            ↓ 下移
          </button>
          <button
            onClick={onDeleteLayer}
            disabled={!activeLayer || activeLayer.kind === 'base'}
            className="flex flex-1 items-center justify-center rounded-xl border border-red-200 bg-red-50 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-40 active:scale-95"
            title="刪除選取圖層"
          >
            🗑 刪除
          </button>
        </div>
      </div>

      {/* Active layer properties */}
      {activeLayer && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">圖層屬性</p>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              activeLayer.kind === 'base' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
            )}>
              {activeLayer.kind === 'base' ? '基底' : '繪圖'}
            </span>
          </div>

          {/* Opacity */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-500">不透明度</label>
              <span className="text-[11px] font-mono font-bold text-slate-700">
                {Math.round(activeLayer.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={activeLayer.opacity}
              onChange={(e) => onSetLayerOpacity(activeLayer.id, Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-600"
            />
          </div>

          {/* Transform info (read-only display, editing via TransformBox) */}
          {activeLayer.kind === 'paint' && activeLayer.transform && (
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600">圖層變換</span>
                <button
                  onClick={() => onResetLayerTransform(activeLayer.id)}
                  disabled={!hasTransform}
                  className="rounded-lg px-2 py-0.5 text-[10px] font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:text-slate-300"
                >
                  重置
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">X</span>
                  <span className="font-mono font-bold text-slate-700">{Math.round(activeLayer.transform.x)}px</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Y</span>
                  <span className="font-mono font-bold text-slate-700">{Math.round(activeLayer.transform.y)}px</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">縮放 X</span>
                  <span className="font-mono font-bold text-slate-700">{formatScale(activeLayer.transform.scaleX)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">縮放 Y</span>
                  <span className="font-mono font-bold text-slate-700">{formatScale(activeLayer.transform.scaleY)}</span>
                </div>
                <div className="col-span-2 flex items-center justify-between">
                  <span className="text-slate-400">旋轉</span>
                  <span className="font-mono font-bold text-slate-700">{formatRot(activeLayer.transform.rotation)}</span>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">
                ✦ 切換至「變換」工具後可直接在畫布拖曳調整
              </p>
            </div>
          )}
        </div>
      )}

      {/* Layer list */}
      <div className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">圖層堆疊（上層在前）</p>
        {[...layers].reverse().map((layer, revIdx) => {
          const isActive = layer.id === activeLayerId;
          const originalIdx = layers.length - 1 - revIdx;
          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              className={cn(
                'group flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all duration-100 select-none',
                isActive
                  ? 'border-indigo-300 bg-indigo-50 shadow-sm ring-1 ring-indigo-200'
                  : 'border-transparent bg-slate-50 hover:border-slate-200 hover:bg-white'
              )}
            >
              {/* Visibility toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleLayerVisibility(layer.id); }}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm transition',
                  layer.visible
                    ? 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                    : 'border-slate-200 bg-slate-100 text-slate-300 hover:bg-white'
                )}
                title={layer.visible ? '點擊隱藏' : '點擊顯示'}
              >
                {layer.visible ? '👁' : '🙈'}
              </button>

              {/* Layer thumbnail placeholder */}
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg',
                layer.kind === 'base' ? 'bg-amber-50' : 'bg-slate-100'
              )}>
                {layer.kind === 'base' ? '🖼' : '🎨'}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className={cn(
                  'truncate text-xs font-semibold',
                  isActive ? 'text-indigo-700' : 'text-slate-700'
                )}>
                  {layer.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn(
                    'rounded-full px-1.5 py-px text-[9px] font-bold',
                    layer.kind === 'base' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'
                  )}>
                    #{originalIdx + 1}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {Math.round(layer.opacity * 100)}%
                  </span>
                  {layer.kind === 'paint' && layer.transform && (
                    layer.transform.rotation !== 0 || layer.transform.scaleX !== 1 || layer.transform.x !== 0
                  ) && (
                    <span className="text-[9px] text-indigo-400 font-semibold">✦ 已變換</span>
                  )}
                </div>
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
