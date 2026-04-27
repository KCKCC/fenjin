import type { LayerTransform } from '@/types/editor';

export interface ViewportInfo {
  /** 容器寬度（px，container-local） */
  containerWidth: number;
  /** 容器高度（px，container-local） */
  containerHeight: number;
  /** 容器左上角在 viewport client 座標的位置 */
  containerLeft: number;
  /** 容器左上角在 viewport client 座標的位置 */
  containerTop: number;
  /** 顯示畫布相對於容器中心的偏移 (px，container-local) */
  viewportOffset: { x: number; y: number };
  /** 畫布縮放比例 */
  viewportZoom: number;
  /** 畫布邏輯尺寸 */
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * 將 canvas 座標 (cx, cy) 轉換到容器內的螢幕座標。
 *
 * 顯示畫布元素的 CSS 規則：
 *   left: 50%; top: 50%
 *   transform: translate(-50%, -50%) translate(offset.x, offset.y) scale(zoom)
 *
 * 因此 canvas (0, 0) 在容器內的螢幕座標為：
 *   containerCenterX + offset.x - (canvasWidth/2) * zoom
 *   containerCenterY + offset.y - (canvasHeight/2) * zoom
 *
 * 一般 canvas 座標 (cx, cy)：
 *   x = containerCenterX + offset.x + (cx - canvasWidth/2) * zoom
 *   y = containerCenterY + offset.y + (cy - canvasHeight/2) * zoom
 */
export function canvasToContainer(cx: number, cy: number, vp: ViewportInfo) {
  const containerCenterX = vp.containerWidth / 2 + vp.viewportOffset.x;
  const containerCenterY = vp.containerHeight / 2 + vp.viewportOffset.y;
  return {
    x: containerCenterX + (cx - vp.canvasWidth / 2) * vp.viewportZoom,
    y: containerCenterY + (cy - vp.canvasHeight / 2) * vp.viewportZoom,
  };
}

/** 將 viewport client 座標 (clientX/Y) 轉成容器內座標 */
export function clientToContainer(clientX: number, clientY: number, vp: ViewportInfo) {
  return {
    x: clientX - vp.containerLeft,
    y: clientY - vp.containerTop,
  };
}

/** 將 viewport client 座標 (clientX/Y) 轉成 canvas 座標 */
export function clientToCanvas(clientX: number, clientY: number, vp: ViewportInfo) {
  const containerCenterClientX = vp.containerLeft + vp.containerWidth / 2 + vp.viewportOffset.x;
  const containerCenterClientY = vp.containerTop + vp.containerHeight / 2 + vp.viewportOffset.y;
  return {
    x: vp.canvasWidth / 2 + (clientX - containerCenterClientX) / vp.viewportZoom,
    y: vp.canvasHeight / 2 + (clientY - containerCenterClientY) / vp.viewportZoom,
  };
}

/** 計算圖層四個角在 canvas 座標系中的位置 */
export function computeLayerCorners(
  layerWidth: number,
  layerHeight: number,
  transform: LayerTransform
) {
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);
  const hw = (layerWidth * transform.scaleX) / 2;
  const hh = (layerHeight * transform.scaleY) / 2;

  // 圖層中心 = (layerWidth/2 + transform.x, layerHeight/2 + transform.y)
  const cx = layerWidth / 2 + transform.x;
  const cy = layerHeight / 2 + transform.y;

  const localCorners = [
    { lx: -hw, ly: -hh },
    { lx: hw, ly: -hh },
    { lx: hw, ly: hh },
    { lx: -hw, ly: hh },
  ];

  return localCorners.map(({ lx, ly }) => ({
    x: cx + lx * cos - ly * sin,
    y: cy + lx * sin + ly * cos,
  }));
}

/** 計算圖層中心在 viewport client 座標的位置 */
export function computeLayerCenterClient(
  layerWidth: number,
  layerHeight: number,
  transform: LayerTransform,
  vp: ViewportInfo
) {
  const layerCenterCanvasX = layerWidth / 2 + transform.x;
  const layerCenterCanvasY = layerHeight / 2 + transform.y;
  const local = canvasToContainer(layerCenterCanvasX, layerCenterCanvasY, vp);
  return {
    x: vp.containerLeft + local.x,
    y: vp.containerTop + local.y,
  };
}

export type DragHandle = 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'rotate';

export interface DragState {
  handle: DragHandle;
  startClientX: number;
  startClientY: number;
  startTransform: LayerTransform;
  layerCenterClientX: number;
  layerCenterClientY: number;
}

/**
 * 純函數：根據拖曳狀態與當前滑鼠位置，計算新的 transform。
 * 這個函數可以被測試。
 */
export function computeNextTransform(
  drag: DragState,
  currentClientX: number,
  currentClientY: number,
  layerWidth: number,
  layerHeight: number,
  viewportZoom: number
): LayerTransform {
  const { handle, startClientX, startClientY, startTransform, layerCenterClientX, layerCenterClientY } = drag;

  const dxCanvas = (currentClientX - startClientX) / viewportZoom;
  const dyCanvas = (currentClientY - startClientY) / viewportZoom;

  const next: LayerTransform = { ...startTransform };

  if (handle === 'move') {
    next.x = startTransform.x + dxCanvas;
    next.y = startTransform.y + dyCanvas;
    return next;
  }

  if (handle === 'rotate') {
    const startAngle = Math.atan2(startClientY - layerCenterClientY, startClientX - layerCenterClientX);
    const currAngle = Math.atan2(currentClientY - layerCenterClientY, currentClientX - layerCenterClientX);
    next.rotation = startTransform.rotation + (currAngle - startAngle);
    return next;
  }

  // 縮放：考慮旋轉
  const cosNeg = Math.cos(-startTransform.rotation);
  const sinNeg = Math.sin(-startTransform.rotation);
  const localDx = dxCanvas * cosNeg - dyCanvas * sinNeg;
  const localDy = dxCanvas * sinNeg + dyCanvas * cosNeg;

  const origW = layerWidth * startTransform.scaleX;
  const origH = layerHeight * startTransform.scaleY;

  const isLeft = handle === 'tl' || handle === 'bl';
  const isRight = handle === 'tr' || handle === 'br';
  const isTop = handle === 'tl' || handle === 'tr';
  const isBottom = handle === 'bl' || handle === 'br';

  let newW = origW;
  let newH = origH;

  if (isRight) newW = Math.max(10, origW + localDx);
  if (isLeft) newW = Math.max(10, origW - localDx);
  if (isBottom) newH = Math.max(10, origH + localDy);
  if (isTop) newH = Math.max(10, origH - localDy);

  next.scaleX = newW / layerWidth;
  next.scaleY = newH / layerHeight;

  // 保持對邊固定：在本地座標位移再旋轉回 canvas 座標
  const cosPos = Math.cos(startTransform.rotation);
  const sinPos = Math.sin(startTransform.rotation);
  const dw = newW - origW;
  const dh = newH - origH;
  const lShiftX = isLeft ? -dw / 2 : isRight ? dw / 2 : 0;
  const lShiftY = isTop ? -dh / 2 : isBottom ? dh / 2 : 0;

  next.x = startTransform.x + lShiftX * cosPos - lShiftY * sinPos;
  next.y = startTransform.y + lShiftX * sinPos + lShiftY * cosPos;

  return next;
}

export const IDENTITY_TRANSFORM: LayerTransform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};
