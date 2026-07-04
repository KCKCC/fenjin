import { useEffect, useRef, useState } from "react";
import type { Bubble, Point } from "../types";

type Props = {
  bubble: Bubble;
  selected: boolean;
  scale: number;
  toCanvas: (clientX: number, clientY: number) => Point;
  onSelect: () => void;
  onBeginDrag: () => void;
  onMove: (patch: Partial<Bubble>, history?: boolean) => void;
  onEndDrag: () => void;
};

export function BubbleView({
  bubble: b,
  selected,
  scale,
  toCanvas,
  onSelect,
  onBeginDrag,
  onMove,
  onEndDrag,
}: Props) {
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);

  const startDrag = (e: React.PointerEvent) => {
    if (editing) return;
    if ((e.target as HTMLElement).dataset.handle) return;
    e.stopPropagation();
    onSelect();
    onBeginDrag();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const start = toCanvas(e.clientX, e.clientY);
    const ox = b.x;
    const oy = b.y;
    const otx = b.tailX;
    const oty = b.tailY;
    const move = (ev: PointerEvent) => {
      const cur = toCanvas(ev.clientX, ev.clientY);
      const dx = cur.x - start.x;
      const dy = cur.y - start.y;
      onMove({ x: ox + dx, y: oy + dy, tailX: otx + dx, tailY: oty + dy }, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onEndDrag();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (corner: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    onBeginDrag();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const start = toCanvas(e.clientX, e.clientY);
    const o = { x: b.x, y: b.y, w: b.width, h: b.height };
    const move = (ev: PointerEvent) => {
      const cur = toCanvas(ev.clientX, ev.clientY);
      const dx = cur.x - start.x;
      const dy = cur.y - start.y;
      let { x, y, w, h } = o;
      if (corner.includes("e")) w = Math.max(40, o.w + dx);
      if (corner.includes("s")) h = Math.max(30, o.h + dy);
      if (corner.includes("w")) {
        w = Math.max(40, o.w - dx);
        x = o.x + (o.w - w);
      }
      if (corner.includes("n")) {
        h = Math.max(30, o.h - dy);
        y = o.y + (o.h - h);
      }
      onMove({ x, y, width: w, height: h }, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onEndDrag();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startTailDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    onBeginDrag();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const cur = toCanvas(ev.clientX, ev.clientY);
      onMove({ tailX: cur.x, tailY: cur.y }, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onEndDrag();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const rx = b.width / 2;
  const ry = b.height / 2;

  const renderShape = () => {
    const common = {
      fill: b.fill,
      stroke: b.stroke,
      strokeWidth: b.strokeWidth,
    };
    switch (b.kind) {
      case "speech":
        return (
          <>
            <path
              d={tailPath(b)}
              fill={b.fill}
              stroke={b.stroke}
              strokeWidth={b.strokeWidth}
            />
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...common} />
            <path
              d={tailPath(b)}
              fill={b.fill}
              stroke="none"
            />
          </>
        );
      case "thought":
        return (
          <>
            {thoughtBubbles(b).map((cir, i) => (
              <circle key={i} cx={cir.cx} cy={cir.cy} r={cir.r} {...common} />
            ))}
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...common} />
          </>
        );
      case "shout":
        return <path d={spikyPath(b)} {...common} strokeLinejoin="round" />;
      case "narration":
        return (
          <rect
            x={b.x}
            y={b.y}
            width={b.width}
            height={b.height}
            {...common}
          />
        );
      case "none":
        return (
          <rect
            x={b.x}
            y={b.y}
            width={b.width}
            height={b.height}
            fill="transparent"
            stroke={selected ? "#c4b5fd" : "transparent"}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        );
    }
  };

  const pad = b.kind === "shout" ? b.width * 0.16 : b.width * 0.1;

  return (
    <g transform={`rotate(${b.rotation} ${cx} ${cy})`}>
      <g onPointerDown={startDrag} style={{ cursor: "move" }}>
        {renderShape()}
      </g>

      {/* text */}
      <foreignObject
        x={b.x + pad}
        y={b.y + b.height * 0.08}
        width={Math.max(b.width - pad * 2, 10)}
        height={Math.max(b.height * 0.84, 10)}
        style={{ pointerEvents: editing ? "auto" : "none" }}
      >
        <div
          ref={editRef}
          contentEditable={editing}
          suppressContentEditableWarning
          onBlur={(e) => {
            setEditing(false);
            onMove({ text: e.currentTarget.innerText });
          }}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontSize: b.fontSize,
            fontFamily: b.fontFamily,
            fontWeight: b.bold ? 800 : 400,
            color: b.color,
            lineHeight: 1.25,
            overflow: "hidden",
            outline: "none",
            wordBreak: "break-word",
            cursor: editing ? "text" : "move",
            userSelect: editing ? "text" : "none",
          }}
        >
          {b.text}
        </div>
      </foreignObject>

      {/* double-click to edit overlay */}
      {!editing && (
        <rect
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          fill="transparent"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          onPointerDown={startDrag}
          style={{ cursor: "move" }}
        />
      )}

      {/* handles */}
      {selected && !editing && (
        <>
          {(["nw", "ne", "se", "sw"] as const).map((c) => {
            const hx = c.includes("w") ? b.x : b.x + b.width;
            const hy = c.includes("n") ? b.y : b.y + b.height;
            return (
              <rect
                key={c}
                data-handle="resize"
                x={hx - 6 / scale}
                y={hy - 6 / scale}
                width={12 / scale}
                height={12 / scale}
                fill="#ffffff"
                stroke="#6366f1"
                strokeWidth={2 / scale}
                rx={2 / scale}
                style={{ cursor: `${c}-resize` }}
                onPointerDown={startResize(c)}
              />
            );
          })}
          {(b.kind === "speech" || b.kind === "thought") && (
            <circle
              data-handle="tail"
              cx={b.tailX}
              cy={b.tailY}
              r={7 / scale}
              fill="#f59e0b"
              stroke="#ffffff"
              strokeWidth={2 / scale}
              style={{ cursor: "move" }}
              onPointerDown={startTailDrag}
            />
          )}
          <rect
            x={b.x}
            y={b.y}
            width={b.width}
            height={b.height}
            fill="none"
            stroke="#6366f1"
            strokeWidth={1 / scale}
            strokeDasharray={`${5 / scale} ${3 / scale}`}
            pointerEvents="none"
          />
        </>
      )}
    </g>
  );
}

function tailPath(b: Bubble): string {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const angle = Math.atan2(b.tailY - cy, b.tailX - cx);
  const perp = angle + Math.PI / 2;
  const baseW = Math.min(b.width, b.height) * 0.28;
  const rx = b.width / 2;
  const ry = b.height / 2;
  // point on ellipse edge toward tail
  const ex = cx + Math.cos(angle) * rx;
  const ey = cy + Math.sin(angle) * ry;
  const b1x = ex + (Math.cos(perp) * baseW) / 2 - Math.cos(angle) * 2;
  const b1y = ey + (Math.sin(perp) * baseW) / 2 - Math.sin(angle) * 2;
  const b2x = ex - (Math.cos(perp) * baseW) / 2 - Math.cos(angle) * 2;
  const b2y = ey - (Math.sin(perp) * baseW) / 2 - Math.sin(angle) * 2;
  return `M ${b1x} ${b1y} L ${b.tailX} ${b.tailY} L ${b2x} ${b2y} Z`;
}

function thoughtBubbles(b: Bubble) {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const angle = Math.atan2(b.tailY - cy, b.tailX - cx);
  const rx = b.width / 2;
  const ry = b.height / 2;
  const ex = cx + Math.cos(angle) * rx;
  const ey = cy + Math.sin(angle) * ry;
  const dx = b.tailX - ex;
  const dy = b.tailY - ey;
  return [0.35, 0.65, 0.95].map((t, i) => ({
    cx: ex + dx * t,
    cy: ey + dy * t,
    r: Math.max(3, (1 - t) * Math.min(b.width, b.height) * 0.12),
    key: i,
  }));
}

function spikyPath(b: Bubble): string {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const rx = b.width / 2;
  const ry = b.height / 2;
  const spikes = 14;
  let d = "";
  for (let i = 0; i < spikes * 2; i++) {
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    const outer = i % 2 === 0;
    const r1 = outer ? 1 : 0.78;
    const x = cx + Math.cos(a) * rx * r1;
    const y = cy + Math.sin(a) * ry * r1;
    d += `${i === 0 ? "M" : "L"} ${x} ${y} `;
  }
  return d + "Z";
}
