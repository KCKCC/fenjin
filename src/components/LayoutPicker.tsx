import { LAYOUTS, type LayoutTemplate } from "../utils/layouts";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (t: LayoutTemplate) => void;
};

function Thumb({ t }: { t: LayoutTemplate }) {
  const W = 84;
  const H = 108;
  const pad = 4;
  const iw = W - pad * 2;
  const ih = H - pad * 2;
  const cells: string[] = [];

  if (t.rects) {
    for (const r of t.rects) {
      const x = pad + r.x * iw;
      const y = pad + r.y * ih;
      const w = r.w * iw;
      const h = r.h * ih;
      cells.push(
        `M ${x + 1} ${y + 1} H ${x + w - 1} V ${y + h - 1} H ${x + 1} Z`
      );
    }
  }
  if (t.quads) {
    for (const q of t.quads) {
      const pts = q.map(([qx, qy]) => `${pad + qx * iw},${pad + qy * ih}`);
      cells.push(`M ${pts.join(" L ")} Z`);
    }
  }

  return (
    <svg width={W} height={H} className="block">
      <rect x={0} y={0} width={W} height={H} rx={6} fill="#18181b" />
      {cells.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="#3f3f46"
          stroke="#a1a1aa"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export function LayoutPicker({ open, onClose, onPick }: Props) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-40 top-14 z-50 w-[420px] rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl shadow-black/60">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">分鏡版型</h3>
            <p className="text-[11px] text-zinc-500">
              點選套用（含斜切動感版型）
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
        <div className="grid max-h-[62vh] grid-cols-4 gap-3 overflow-y-auto pr-1">
          {LAYOUTS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                onPick(t);
                onClose();
              }}
              className="group flex flex-col items-center gap-1.5 rounded-lg border border-transparent p-1.5 transition hover:border-indigo-500 hover:bg-zinc-800"
            >
              <div className="overflow-hidden rounded-md ring-1 ring-zinc-800 transition group-hover:ring-indigo-500/60">
                <Thumb t={t} />
              </div>
              <span className="text-[11px] text-zinc-400 group-hover:text-zinc-100">
                {t.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
