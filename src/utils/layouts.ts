import type { Panel, PageSize } from "../types";
import { uid } from "./geometry";

// A rect defined in 0..1 ratio space (x, y, w, h)
type Rect = { x: number; y: number; w: number; h: number };
// A free quad defined by four ratio points (for slanted / dynamic panels)
type QuadRatio = [number, number][]; // 4 points, each [x,y] in 0..1

export type LayoutTemplate = {
  id: string;
  name: string;
  // preview cells for the thumbnail (same coords)
  rects?: Rect[];
  quads?: QuadRatio[];
};

export const LAYOUTS: LayoutTemplate[] = [
  {
    id: "single",
    name: "整版單格",
    rects: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  {
    id: "v2",
    name: "上下二格",
    rects: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    id: "h2",
    name: "左右二格",
    rects: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: "v3",
    name: "橫三條",
    rects: [
      { x: 0, y: 0, w: 1, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 1, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 1, h: 1 / 3 },
    ],
  },
  {
    id: "grid4",
    name: "田字四格",
    rects: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: "grid6",
    name: "六宮格",
    rects: [
      { x: 0, y: 0, w: 0.5, h: 1 / 3 },
      { x: 0.5, y: 0, w: 0.5, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 0.5, h: 1 / 3 },
      { x: 0.5, y: 1 / 3, w: 0.5, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 0.5, h: 1 / 3 },
      { x: 0.5, y: 2 / 3, w: 0.5, h: 1 / 3 },
    ],
  },
  {
    id: "classic4",
    name: "經典四格",
    rects: [
      { x: 0, y: 0, w: 1, h: 0.28 },
      { x: 0, y: 0.31, w: 0.5, h: 0.34 },
      { x: 0.5, y: 0.31, w: 0.5, h: 0.34 },
      { x: 0, y: 0.68, w: 1, h: 0.32 },
    ],
  },
  {
    id: "hero-top",
    name: "頂圖三格",
    rects: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: "sidebar",
    name: "主圖＋側欄",
    rects: [
      { x: 0, y: 0, w: 0.66, h: 1 },
      { x: 0.66, y: 0, w: 0.34, h: 1 / 3 },
      { x: 0.66, y: 1 / 3, w: 0.34, h: 1 / 3 },
      { x: 0.66, y: 2 / 3, w: 0.34, h: 1 / 3 },
    ],
  },
  {
    id: "left-strip",
    name: "側欄＋主圖",
    rects: [
      { x: 0, y: 0, w: 0.34, h: 0.5 },
      { x: 0, y: 0.5, w: 0.34, h: 0.5 },
      { x: 0.34, y: 0, w: 0.66, h: 1 },
    ],
  },
  {
    id: "big-bottom",
    name: "上小下大",
    rects: [
      { x: 0, y: 0, w: 1 / 3, h: 0.42 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 0.42 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 0.42 },
      { x: 0, y: 0.42, w: 1, h: 0.58 },
    ],
  },
  {
    id: "cinematic",
    name: "電影寬條",
    rects: [
      { x: 0, y: 0.06, w: 1, h: 0.26 },
      { x: 0, y: 0.37, w: 1, h: 0.26 },
      { x: 0, y: 0.68, w: 1, h: 0.26 },
    ],
  },
  {
    id: "action-diag",
    name: "動感斜切",
    quads: [
      [
        [0, 0],
        [0.62, 0],
        [0.42, 1],
        [0, 1],
      ],
      [
        [0.66, 0],
        [1, 0],
        [1, 0.46],
        [0.5, 0.46],
      ],
      [
        [0.5, 0.5],
        [1, 0.5],
        [1, 1],
        [0.44, 1],
      ],
    ],
  },
  {
    id: "impact",
    name: "衝擊分割",
    quads: [
      [
        [0, 0],
        [1, 0],
        [1, 0.34],
        [0, 0.5],
      ],
      [
        [0, 0.54],
        [0.5, 0.42],
        [0.44, 1],
        [0, 1],
      ],
      [
        [0.54, 0.4],
        [1, 0.38],
        [1, 1],
        [0.48, 1],
      ],
    ],
  },
  {
    id: "zigzag",
    name: "交錯斜格",
    quads: [
      [
        [0, 0],
        [1, 0],
        [1, 0.24],
        [0, 0.34],
      ],
      [
        [0, 0.38],
        [1, 0.28],
        [1, 0.62],
        [0, 0.68],
      ],
      [
        [0, 0.72],
        [1, 0.66],
        [1, 1],
        [0, 1],
      ],
    ],
  },
];

function panelFromCoords(pts: [number, number][]): Panel {
  return {
    id: uid("panel"),
    points: [
      { x: pts[0][0], y: pts[0][1] },
      { x: pts[1][0], y: pts[1][1] },
      { x: pts[2][0], y: pts[2][1] },
      { x: pts[3][0], y: pts[3][1] },
    ],
    image: null,
    borderWidth: 4,
    borderColor: "#111111",
    bgColor: "#ffffff",
    cornerRadius: 0,
  };
}

export function buildLayout(template: LayoutTemplate, page: PageSize): Panel[] {
  const m = 24; // outer margin
  const gap = 14; // inner gutter (applied as half on each side)
  const half = gap / 2;
  const iw = page.width - m * 2;
  const ih = page.height - m * 2;
  const panels: Panel[] = [];

  const rx = (v: number) => m + v * iw;
  const ry = (v: number) => m + v * ih;

  if (template.rects) {
    for (const r of template.rects) {
      const x1 = rx(r.x) + half;
      const y1 = ry(r.y) + half;
      const x2 = rx(r.x + r.w) - half;
      const y2 = ry(r.y + r.h) - half;
      panels.push(
        panelFromCoords([
          [x1, y1],
          [x2, y1],
          [x2, y2],
          [x1, y2],
        ])
      );
    }
  }

  if (template.quads) {
    for (const q of template.quads) {
      panels.push(
        panelFromCoords(
          q.map(([x, y]) => [rx(x), ry(y)]) as [number, number][]
        )
      );
    }
  }

  return panels;
}
