import { useRef, useState } from "react";
import type { Panel, Point } from "../types";
import { bbox, pointsToPath, uid } from "../utils/geometry";

type Props = {
  panel: Panel;
  selected: boolean;
  scale: number;
  toCanvas: (clientX: number, clientY: number) => Point;
  onSelect: () => void;
  onBeginDrag: () => void;
  onMove: (patch: Partial<Panel>) => void;
  onEndDrag: () => void;
  onDropImage: (src: string, naturalW: number, naturalH: number) => void;
};

export function PanelView({
  panel,
  selected,
  scale,
  toCanvas,
  onSelect,
  onBeginDrag,
  onMove,
  onEndDrag,
  onDropImage,
}: Props) {
  const clipId = useRef(uid("clip")).current;
  const box = bbox(panel.points);
  const [isDragOver, setIsDragOver] = useState(false);

  // ---- Move whole panel ----
  const startBodyDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).dataset.handle) return;
    e.stopPropagation();
    onSelect();
    onBeginDrag();
    const start = toCanvas(e.clientX, e.clientY);
    const orig = panel.points.map((p) => ({ ...p }));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const cur = toCanvas(ev.clientX, ev.clientY);
      const dx = cur.x - start.x;
      const dy = cur.y - start.y;
      onMove({
        points: orig.map((p) => ({ x: p.x + dx, y: p.y + dy })) as Panel["points"],
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onEndDrag();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ---- Move one corner (free deform) ----
  const startCornerDrag = (idx: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    onBeginDrag();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const cur = toCanvas(ev.clientX, ev.clientY);
      const pts = panel.points.map((p, i) =>
        i === idx ? cur : p
      ) as Panel["points"];
      onMove({ points: pts });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onEndDrag();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ---- Edge midpoint drag (moves the two adjacent corners) ----
  const startEdgeDrag = (a: number, b: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    onBeginDrag();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const start = toCanvas(e.clientX, e.clientY);
    const orig = panel.points.map((p) => ({ ...p }));
    const move = (ev: PointerEvent) => {
      const cur = toCanvas(ev.clientX, ev.clientY);
      const dx = cur.x - start.x;
      const dy = cur.y - start.y;
      const pts = orig.map((p, i) =>
        i === a || i === b ? { x: p.x + dx, y: p.y + dy } : p
      ) as Panel["points"];
      onMove({ points: pts });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onEndDrag();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ---- Image pan inside panel ----
  const startImagePan = (e: React.PointerEvent) => {
    if (!panel.image || !selected) return;
    if ((e.target as HTMLElement).dataset.handle) return;
    e.stopPropagation();
    onBeginDrag();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const start = toCanvas(e.clientX, e.clientY);
    const img = panel.image;
    const ox = img.offsetX;
    const oy = img.offsetY;
    const move = (ev: PointerEvent) => {
      const cur = toCanvas(ev.clientX, ev.clientY);
      onMove({
        image: { ...img, offsetX: ox + (cur.x - start.x), offsetY: oy + (cur.y - start.y) },
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onEndDrag();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      readImage(file, onDropImage);
      return;
    }
    const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (url) {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => onDropImage(url, im.naturalWidth, im.naturalHeight);
      im.src = url;
    }
  };

  const openFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) readImage(f, onDropImage);
    };
    input.click();
  };

  const lastTap = useRef(0);

  const midpoints: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ];

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d={pointsToPath(panel.points)} />
        </clipPath>
      </defs>

      {/* Background + border shape */}
      <path
        d={pointsToPath(panel.points)}
        fill={panel.bgColor}
        pointerEvents="none"
      />

      {/* Image, clipped to panel */}
      {panel.image && (
        <g clipPath={`url(#${clipId})`} pointerEvents="none">
          <image
            href={panel.image.src}
            x={box.minX + panel.image.offsetX}
            y={box.minY + panel.image.offsetY}
            width={panel.image.naturalW * panel.image.scale}
            height={panel.image.naturalH * panel.image.scale}
            preserveAspectRatio="none"
          />
        </g>
      )}

      {/* Border stroke */}
      <path
        d={pointsToPath(panel.points)}
        fill="none"
        stroke={panel.borderColor}
        strokeWidth={panel.borderWidth}
        strokeLinejoin="round"
        pointerEvents="none"
      />

      {/* Empty state hint */}
      {!panel.image && (
        <foreignObject
          x={box.minX}
          y={box.minY}
          width={box.width}
          height={box.height}
          clipPath={`url(#${clipId})`}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              color: "#a1a1aa",
              fontSize: 13,
              fontFamily: "sans-serif",
              textAlign: "center",
              padding: 8,
              userSelect: "none",
            }}
          >
            <span style={{ fontSize: 26 }}>🖼️</span>
            <span>拖入圖片或雙擊上傳</span>
          </div>
        </foreignObject>
      )}

      {/* 隱形全幅互動感應層：完全貼合分鏡框多邊形，負責所有點擊與圖片拖放 */}
      <path
        d={pointsToPath(panel.points)}
        fill={isDragOver ? "rgba(99, 102, 241, 0.25)" : "transparent"}
        stroke={isDragOver ? "#6366f1" : "transparent"}
        strokeWidth={isDragOver ? 4 / scale : 0}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
          if (!isDragOver) setIsDragOver(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleFileDrop}
        onPointerDown={(e) => {
          if ((e.target as SVGElement).dataset?.handle) return;
          e.stopPropagation();
          onSelect();
          const now = Date.now();
          if (now - lastTap.current < 300) {
            // 雙擊 → 開啟上傳
            lastTap.current = 0;
            openFilePicker();
            return;
          }
          lastTap.current = now;
          if (panel.image && selected) {
            startImagePan(e);
          } else {
            startBodyDrag(e);
          }
        }}
        style={{ cursor: panel.image && selected ? "grab" : "move" }}
      />

      {/* Selection handles */}
      {selected && (
        <>
          {/* edge midpoint handles */}
          {midpoints.map(([a, b], i) => {
            const mx = (panel.points[a].x + panel.points[b].x) / 2;
            const my = (panel.points[a].y + panel.points[b].y) / 2;
            return (
              <rect
                key={`e${i}`}
                data-handle="edge"
                x={mx - 6 / scale}
                y={my - 6 / scale}
                width={12 / scale}
                height={12 / scale}
                fill="#ffffff"
                stroke="#6366f1"
                strokeWidth={2 / scale}
                rx={2 / scale}
                style={{ cursor: "grab" }}
                onPointerDown={startEdgeDrag(a, b)}
              />
            );
          })}
          {/* corner handles */}
          {panel.points.map((p, i) => (
            <circle
              key={`c${i}`}
              data-handle="corner"
              cx={p.x}
              cy={p.y}
              r={8 / scale}
              fill="#6366f1"
              stroke="#ffffff"
              strokeWidth={2 / scale}
              style={{ cursor: "grab" }}
              onPointerDown={startCornerDrag(i)}
            />
          ))}
          {/* selection outline */}
          <path
            d={pointsToPath(panel.points)}
            fill="none"
            stroke="#6366f1"
            strokeWidth={1.5 / scale}
            strokeDasharray={`${6 / scale} ${4 / scale}`}
            pointerEvents="none"
          />
        </>
      )}
    </g>
  );
}

function readImage(
  file: File,
  cb: (src: string, w: number, h: number) => void
) {
  const reader = new FileReader();
  reader.onload = () => {
    const src = reader.result as string;
    const im = new Image();
    im.onload = () => cb(src, im.naturalWidth, im.naturalHeight);
    im.src = src;
  };
  reader.readAsDataURL(file);
}
