import type { LiquifyMode } from '@/utils/liquify';

export type PaintTool = 'brush' | 'eraser';
export type TransformTool = 'transform';
export type EditorTool = LiquifyMode | PaintTool | TransformTool;

export interface LayerTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number; // radians
}

export interface LayerSummary {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  kind: 'base' | 'paint';
  transform?: LayerTransform;
}

export type EditorCommand =
  | { type: 'none'; nonce: number }
  | { type: 'undo'; nonce: number }
  | { type: 'redo'; nonce: number }
  | { type: 'reset'; nonce: number }
  | { type: 'add-layer'; nonce: number }
  | { type: 'duplicate-layer'; nonce: number }
  | { type: 'delete-layer'; nonce: number }
  | { type: 'move-layer-up'; nonce: number }
  | { type: 'move-layer-down'; nonce: number }
  | { type: 'select-layer'; nonce: number; layerId: string }
  | { type: 'toggle-layer-visibility'; nonce: number; layerId: string }
  | { type: 'set-layer-opacity'; nonce: number; layerId: string; opacity: number }
  | { type: 'set-layer-transform'; nonce: number; layerId: string; transform: Partial<LayerTransform> }
  | { type: 'reset-layer-transform'; nonce: number; layerId: string }
  | { type: 'paste-image'; nonce: number; imageData: ImageData }
  | { type: 'flatten-layer'; nonce: number };

export interface EditorStatus {
  historyIndex: number;
  historyLength: number;
  activeLayerId: string | null;
  layers: LayerSummary[];
}
