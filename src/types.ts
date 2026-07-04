export type Point = { x: number; y: number };

export type PanelImage = {
  src: string;
  // offset in panel local coords (relative to panel bounding box top-left)
  offsetX: number;
  offsetY: number;
  scale: number;
  naturalW: number;
  naturalH: number;
};

export type Panel = {
  id: string;
  // Four corner points (quadrilateral) in canvas coordinates.
  // Order: top-left, top-right, bottom-right, bottom-left
  points: [Point, Point, Point, Point];
  image: PanelImage | null;
  borderWidth: number;
  borderColor: string;
  bgColor: string;
  cornerRadius: number;
};

export type BubbleKind = "speech" | "thought" | "shout" | "narration" | "none";

export type Bubble = {
  id: string;
  kind: BubbleKind;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  color: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  // tail target point (canvas coords) for speech/thought
  tailX: number;
  tailY: number;
  rotation: number;
};

export type ElementSelection =
  | { type: "panel"; id: string }
  | { type: "bubble"; id: string }
  | null;

export type PageSize = {
  name: string;
  width: number;
  height: number;
};
