import type { Bubble, ElementSelection, Panel } from "../types";

type Props = {
  selection: ElementSelection;
  panel: Panel | undefined;
  bubble: Bubble | undefined;
  onUpdatePanel: (patch: Partial<Panel>) => void;
  onUpdateBubble: (patch: Partial<Bubble>) => void;
  onDelete: () => void;
  onBringFront: () => void;
  onRemoveImage: () => void;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-9 cursor-pointer rounded border border-zinc-700 bg-transparent"
    />
  );
}

function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 accent-indigo-500"
      />
      <span className="w-8 text-right text-xs tabular-nums text-zinc-300">
        {Math.round(value * 100) / 100}
      </span>
    </div>
  );
}

export function Inspector({
  selection,
  panel,
  bubble,
  onUpdatePanel,
  onUpdateBubble,
  onDelete,
  onBringFront,
  onRemoveImage,
}: Props) {
  if (!selection) {
    return (
      <div className="p-4 text-sm text-zinc-500">
        <p className="mb-3 font-medium text-zinc-300">尚未選取元素</p>
        <ul className="space-y-2 text-xs leading-relaxed text-zinc-500">
          <li>• 點擊分鏡框或對話框以選取。</li>
          <li>• 拖曳藍色圓點可自由變形分鏡。</li>
          <li>• 從電腦拖曳圖片到分鏡框即可置入。</li>
          <li>• 雙擊分鏡框可上傳圖片。</li>
          <li>• 雙擊對話框可編輯文字。</li>
          <li>• 拖曳橘色圓點可調整對話尾巴。</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex gap-2">
        <button
          onClick={onBringFront}
          className="flex-1 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
        >
          移至最上層
        </button>
        <button
          onClick={onDelete}
          className="flex-1 rounded-md bg-red-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
        >
          刪除
        </button>
      </div>

      {panel && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-zinc-200">分鏡框設定</h3>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <Row label="外框顏色">
              <ColorInput
                value={panel.borderColor}
                onChange={(v) => onUpdatePanel({ borderColor: v })}
              />
            </Row>
            <Row label="外框粗細">
              <Slider
                value={panel.borderWidth}
                min={0}
                max={24}
                onChange={(v) => onUpdatePanel({ borderWidth: v })}
              />
            </Row>
            <Row label="底色">
              <ColorInput
                value={panel.bgColor}
                onChange={(v) => onUpdatePanel({ bgColor: v })}
              />
            </Row>
          </div>

          {panel.image && (
            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <p className="mb-1 text-xs font-medium text-zinc-300">圖片</p>
              <Row label="縮放">
                <Slider
                  value={panel.image.scale}
                  min={0.05}
                  max={4}
                  step={0.01}
                  onChange={(v) =>
                    onUpdatePanel({ image: { ...panel.image!, scale: v } })
                  }
                />
              </Row>
              <button
                onClick={onRemoveImage}
                className="mt-1 w-full rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
              >
                移除圖片
              </button>
            </div>
          )}
        </div>
      )}

      {bubble && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-zinc-200">對話框設定</h3>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <div className="py-1.5">
              <span className="text-xs text-zinc-400">文字</span>
              <textarea
                value={bubble.text}
                onChange={(e) => onUpdateBubble({ text: e.target.value })}
                rows={2}
                className="mt-1 w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500"
              />
            </div>
            <Row label="樣式">
              <select
                value={bubble.kind}
                onChange={(e) =>
                  onUpdateBubble({ kind: e.target.value as Bubble["kind"] })
                }
                className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none"
              >
                <option value="speech">對話</option>
                <option value="thought">想法</option>
                <option value="shout">吶喊</option>
                <option value="narration">旁白框</option>
                <option value="none">純文字</option>
              </select>
            </Row>
            <Row label="字級">
              <Slider
                value={bubble.fontSize}
                min={10}
                max={64}
                onChange={(v) => onUpdateBubble({ fontSize: v })}
              />
            </Row>
            <Row label="粗體">
              <input
                type="checkbox"
                checked={bubble.bold}
                onChange={(e) => onUpdateBubble({ bold: e.target.checked })}
                className="h-4 w-4 accent-indigo-500"
              />
            </Row>
            <Row label="字型">
              <select
                value={bubble.fontFamily}
                onChange={(e) => onUpdateBubble({ fontFamily: e.target.value })}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none"
              >
                <option value="'Noto Sans TC', sans-serif">黑體</option>
                <option value="'Noto Serif TC', serif">明體</option>
                <option value="'Comic Sans MS', cursive">Comic</option>
              </select>
            </Row>
            <Row label="文字色">
              <ColorInput
                value={bubble.color}
                onChange={(v) => onUpdateBubble({ color: v })}
              />
            </Row>
            <Row label="填色">
              <ColorInput
                value={bubble.fill}
                onChange={(v) => onUpdateBubble({ fill: v })}
              />
            </Row>
            <Row label="線色">
              <ColorInput
                value={bubble.stroke}
                onChange={(v) => onUpdateBubble({ stroke: v })}
              />
            </Row>
            <Row label="線粗">
              <Slider
                value={bubble.strokeWidth}
                min={0}
                max={12}
                onChange={(v) => onUpdateBubble({ strokeWidth: v })}
              />
            </Row>
            <Row label="旋轉">
              <Slider
                value={bubble.rotation}
                min={-180}
                max={180}
                onChange={(v) => onUpdateBubble({ rotation: v })}
              />
            </Row>
          </div>
        </div>
      )}
    </div>
  );
}
