import type { Point } from "../types";

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function bbox(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function centroid(points: Point[]): Point {
  const n = points.length;
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

export function pointsToPath(points: Point[]): string {
  if (points.length === 0) return "";
  return (
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z"
  );
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
