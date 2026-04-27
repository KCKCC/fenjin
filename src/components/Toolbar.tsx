import { useState } from 'react';
import { cn } from '@/utils/cn';
import { type LiquifyMode, type LiquifyOptions } from '@/utils/liquify';
import { type EditorTool } from '@/types/editor';

interface ToolbarProps {
  tool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  pressure: number;
  onPressureChange: (p: number) => void;
  paintColor: string;
  onPaintColorChange: (color: string) => void;
  paintOpacity: number;
  onPaintOpacityChange: (opacity: number) => void;
  brushHardness: number;
  onBrushHardnessChange: (hardness: number) => void;
  onFlattenLayer: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  hasImage: boolean;
  options: LiquifyOptions;
  onOptionsChange: (opts: LiquifyOptions) => void;
}

const paintTools: { id: EditorTool; label: string; icon: string }[] = [
  { id: 'transform', label: '變換 (T)', icon: '✦' },
  { id: 'brush', label: '畫筆 (B)', icon: '🖌' },
  { id: 'eraser', label: '橡皮擦 (E)', icon: '🩹' },
];

const liquifyTools: { id: LiquifyMode; label: string; icon: string }[] = [
  { id: 'push', label: '推擠', icon: '↗' },
  { id: 'twirl_cw', label: '順時針', icon: '↻' },
  { id: 'twirl_ccw', label: '逆時針', icon: '↺' },
  { id: 'pinch', label: '縮攏', icon: '⤵' },
  { id: 'bloat', label: '膨脹', icon: '⤴' },
  { id: 'smooth', label: '平滑', icon: '⊙' },
  { id: 'turbulence', label: '湍流', icon: '≈' },
];

export default function Toolbar({
  tool,
  onToolChange,
  brushSize,
  onBrushSizeChange,
  pressure,
  onPressureChange,
  paintColor,
  onPaintColorChange,
  paintOpacity,
  onPaintOpacityChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  hasImage,
  options,
  onOptionsChange,
  brushHardness,
  onBrushHardnessChange,
  onFlattenLayer,
}: ToolbarProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const isPaintTool = tool === 'brush' || tool === 'eraser';

  return (
    <div className="flex w-full max-w-[1400px] flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1">
          <span className="text-[11px] font-bold text-slate-500">繪圖</span>
          <div className="flex items-center gap-1">
            {paintTools.map((item) => (
              <button
                key={item.id}
                onClick={() => onToolChange(item.id)}
                disabled={!hasImage}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg text-sm transition',
                  tool === item.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200',
                  !hasImage && 'cursor-not-allowed opacity-30'
                )}
                title={item.label}
              >
                {item.icon}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-2 py-1">
          <span className="text-[11px] font-bold text-indigo-500">液化</span>
          <div className="flex items-center gap-1">
            {liquifyTools.map((item) => (
              <button
                key={item.id}
                onClick={() => onToolChange(item.id)}
                disabled={!hasImage}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg text-sm transition',
                  tool === item.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-indigo-100',
                  !hasImage && 'cursor-not-allowed opacity-30'
                )}
                title={item.label}
              >
                {item.icon}
              </button>
            ))}
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200" />

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">大小</label>
          <input
            type="range"
            min={4}
            max={160}
            value={brushSize}
            onChange={(e) => onBrushSizeChange(Number(e.target.value))}
            disabled={!hasImage}
            className="h-1.5 w-28 cursor-pointer accent-indigo-600 disabled:opacity-30"
          />
          <span className="w-8 text-right text-xs font-mono text-slate-600">{brushSize}</span>
        </div>

        <div className="h-8 w-px bg-slate-200" />

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">
            {isPaintTool ? '流量' : '強度'}
          </label>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={pressure}
            onChange={(e) => onPressureChange(Number(e.target.value))}
            disabled={!hasImage}
            className="h-1.5 w-24 cursor-pointer accent-indigo-600 disabled:opacity-30"
          />
          <span className="w-8 text-right text-xs font-mono text-slate-600">
            {Math.round(pressure * 100)}
          </span>
        </div>

        <div className="h-8 w-px bg-slate-200" />

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">顏色</label>
          <input
            type="color"
            value={paintColor}
            onChange={(e) => onPaintColorChange(e.target.value)}
            disabled={!hasImage || tool === 'eraser'}
            className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">筆刷不透明度</label>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={paintOpacity}
            onChange={(e) => onPaintOpacityChange(Number(e.target.value))}
            disabled={!hasImage || !isPaintTool}
            className="h-1.5 w-24 cursor-pointer accent-emerald-600 disabled:opacity-30"
          />
          <span className="w-8 text-right text-xs font-mono text-slate-600">
            {Math.round(paintOpacity * 100)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">硬度</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={brushHardness}
            onChange={(e) => onBrushHardnessChange(Number(e.target.value))}
            disabled={!hasImage || !isPaintTool}
            className="h-1.5 w-24 cursor-pointer accent-sky-600 disabled:opacity-30"
          />
          <span className="w-8 text-right text-xs font-mono text-slate-600">{Math.round(brushHardness * 100)}</span>
        </div>

        <button
          onClick={onFlattenLayer}
          disabled={!hasImage}
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-40"
        >🔒 套用變換</button>

        <button
          onClick={() => setIsAdvancedOpen((prev) => !prev)}
          disabled={!hasImage}
          className={cn(
            'rounded-xl border px-3 py-2 text-xs font-semibold transition',
            isAdvancedOpen
              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            !hasImage && 'cursor-not-allowed opacity-30'
          )}
        >
          ⚙️ 液化演算法 {isAdvancedOpen ? '收合' : '展開'}
        </button>

        <div className="ml-auto flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={onUndo}
            disabled={!canUndo || !hasImage}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-300"
            title="復原"
          >
            ↩
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo || !hasImage}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-300"
            title="重做"
          >
            ↪
          </button>
          <button
            onClick={onReset}
            disabled={!hasImage}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            ↺ 重置文件
          </button>
        </div>
      </div>

      {isAdvancedOpen && hasImage && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200 shadow-md">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-indigo-400">內插採樣</span>
            <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
              <button
                onClick={() => onOptionsChange({ ...options, interpolation: 'bilinear' })}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition',
                  options.interpolation === 'bilinear'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                雙線性
              </button>
              <button
                onClick={() => onOptionsChange({ ...options, interpolation: 'bicubic' })}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition',
                  options.interpolation === 'bicubic'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                雙三次
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-emerald-400">銳化補償</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={options.sharpenAmount}
              onChange={(e) => onOptionsChange({ ...options, sharpenAmount: Number(e.target.value) })}
              className="h-1.5 w-28 cursor-pointer accent-emerald-500"
            />
            <span className="w-8 text-right font-mono text-slate-300">
              {Math.round(options.sharpenAmount * 100)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-purple-400">液化筆刷硬度</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={options.brushHardness}
              onChange={(e) => onOptionsChange({ ...options, brushHardness: Number(e.target.value) })}
              className="h-1.5 w-28 cursor-pointer accent-purple-500"
            />
            <span className="w-8 text-right font-mono text-slate-300">
              {Math.round(options.brushHardness * 100)}
            </span>
          </div>

          <div className="ml-auto text-[10px] text-slate-400">
            建議：人物修容可降低銳化；圖層線稿與邊緣修整可改用雙三次。
          </div>
        </div>
      )}
    </div>
  );
}
