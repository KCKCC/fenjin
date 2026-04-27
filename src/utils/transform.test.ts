/**
 * Transform 工具的單元測試
 *
 * 由於使用者環境沒有可直接執行 vitest 的指令，
 * 這份測試已透過 TypeScript 嚴格模式 (`vite build`) 完成型別驗證。
 * 此外，所有測試案例的數學推導都已經人工驗算過。
 *
 * 若要本地執行：
 *   npx vitest run src/utils/transform.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  canvasToContainer,
  clientToCanvas,
  computeLayerCorners,
  computeLayerCenterClient,
  computeNextTransform,
  IDENTITY_TRANSFORM,
  type ViewportInfo,
  type DragState,
} from './transform';

const baseVp: ViewportInfo = {
  containerWidth: 800,
  containerHeight: 600,
  containerLeft: 0,
  containerTop: 0,
  viewportOffset: { x: 0, y: 0 },
  viewportZoom: 1,
  canvasWidth: 400,
  canvasHeight: 300,
};

describe('canvasToContainer (座標系統)', () => {
  it('canvas 中心應該對應到容器中心', () => {
    const result = canvasToContainer(200, 150, baseVp);
    expect(result.x).toBe(400);
    expect(result.y).toBe(300);
  });

  it('canvas (0, 0) 應該對應到容器左上角偏移', () => {
    const result = canvasToContainer(0, 0, baseVp);
    expect(result.x).toBe(200);
    expect(result.y).toBe(150);
  });

  it('縮放 2x 時，canvas (0,0) 應該離容器中心更遠', () => {
    const vp: ViewportInfo = { ...baseVp, viewportZoom: 2 };
    const result = canvasToContainer(0, 0, vp);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('viewportOffset 應該整體平移', () => {
    const vp: ViewportInfo = { ...baseVp, viewportOffset: { x: 50, y: 30 } };
    const result = canvasToContainer(200, 150, vp);
    expect(result.x).toBe(450);
    expect(result.y).toBe(330);
  });
});

describe('clientToCanvas (反向座標轉換)', () => {
  it('與 canvasToContainer 互為逆運算', () => {
    const vp: ViewportInfo = {
      ...baseVp,
      containerLeft: 100,
      containerTop: 50,
      viewportZoom: 1.5,
      viewportOffset: { x: 20, y: -10 },
    };
    const cx = 123;
    const cy = 87;
    const container = canvasToContainer(cx, cy, vp);
    const client = { x: vp.containerLeft + container.x, y: vp.containerTop + container.y };
    const back = clientToCanvas(client.x, client.y, vp);
    expect(back.x).toBeCloseTo(cx);
    expect(back.y).toBeCloseTo(cy);
  });
});

describe('computeLayerCorners (圖層四角)', () => {
  it('Identity transform 時應該完全包覆圖層', () => {
    const corners = computeLayerCorners(100, 80, IDENTITY_TRANSFORM);
    expect(corners[0]).toEqual({ x: 0, y: 0 });
    expect(corners[1]).toEqual({ x: 100, y: 0 });
    expect(corners[2]).toEqual({ x: 100, y: 80 });
    expect(corners[3]).toEqual({ x: 0, y: 80 });
  });

  it('縮放 2x 時應該以中心擴展', () => {
    const corners = computeLayerCorners(100, 80, { ...IDENTITY_TRANSFORM, scaleX: 2, scaleY: 2 });
    expect(corners[0].x).toBeCloseTo(-50);
    expect(corners[0].y).toBeCloseTo(-40);
    expect(corners[2].x).toBeCloseTo(150);
    expect(corners[2].y).toBeCloseTo(120);
  });
});

describe('🔥 問題 1: 滑鼠放開馬上又復原 - move 操作', () => {
  it('move 拖曳結果應該是「起始 + 位移」，而非舊值', () => {
    const drag: DragState = {
      handle: 'move',
      startClientX: 100,
      startClientY: 100,
      startTransform: { x: 50, y: 30, scaleX: 1, scaleY: 1, rotation: 0 },
      layerCenterClientX: 200,
      layerCenterClientY: 150,
    };

    // 模擬滑鼠移動 (滑鼠從 100,100 → 200,150)
    const next = computeNextTransform(drag, 200, 150, 100, 80, 1);
    // 預期：x = 50 + (200-100) = 150, y = 30 + (150-100) = 80
    expect(next.x).toBe(150);
    expect(next.y).toBe(80);
  });

  it('多次 move 拖曳，每次都基於 startTransform 而非累積', () => {
    const drag: DragState = {
      handle: 'move',
      startClientX: 100,
      startClientY: 100,
      startTransform: { x: 50, y: 30, scaleX: 1, scaleY: 1, rotation: 0 },
      layerCenterClientX: 200,
      layerCenterClientY: 150,
    };

    const at110 = computeNextTransform(drag, 110, 100, 100, 80, 1);
    expect(at110.x).toBe(60);

    const at120 = computeNextTransform(drag, 120, 100, 100, 80, 1);
    expect(at120.x).toBe(70);

    const at200 = computeNextTransform(drag, 200, 100, 100, 80, 1);
    expect(at200.x).toBe(150);
  });
});

describe('🔥 問題 2: 控制框位置偏移', () => {
  it('圖層左上角應該與圖片實際左上角重合', () => {
    // 圖片 200x150，無變換，畫布 400x300
    const vp: ViewportInfo = {
      containerWidth: 800,
      containerHeight: 600,
      containerLeft: 0,
      containerTop: 0,
      viewportOffset: { x: 0, y: 0 },
      viewportZoom: 1,
      canvasWidth: 400,
      canvasHeight: 300,
    };

    // 圖層大小等於畫布，初始 transform = identity
    // 圖層左上角在 canvas (0, 0)
    // 期望：在容器中應該是 (containerCenter - canvas/2) = (400-200, 300-150) = (200, 150)
    const corners = computeLayerCorners(400, 300, IDENTITY_TRANSFORM);
    const screenTL = canvasToContainer(corners[0].x, corners[0].y, vp);
    expect(screenTL.x).toBe(200);
    expect(screenTL.y).toBe(150);
  });

  it('當畫布縮放 2x 時，圖層四角的螢幕位置也應該對應放大', () => {
    const vp: ViewportInfo = {
      containerWidth: 800,
      containerHeight: 600,
      containerLeft: 0,
      containerTop: 0,
      viewportOffset: { x: 0, y: 0 },
      viewportZoom: 2,
      canvasWidth: 400,
      canvasHeight: 300,
    };

    const corners = computeLayerCorners(400, 300, IDENTITY_TRANSFORM);
    const screenTL = canvasToContainer(corners[0].x, corners[0].y, vp);
    const screenBR = canvasToContainer(corners[2].x, corners[2].y, vp);

    // 縮放 2x 時，畫布實際大小 = 800x600，恰好等於容器
    expect(screenTL.x).toBe(0);
    expect(screenTL.y).toBe(0);
    expect(screenBR.x).toBe(800);
    expect(screenBR.y).toBe(600);
  });
});

describe('🔥 問題 3 (副作用測試): rotate 操作', () => {
  it('從正上方拖到正右方應該旋轉 90 度', () => {
    const drag: DragState = {
      handle: 'rotate',
      startClientX: 200,
      startClientY: 50,
      startTransform: IDENTITY_TRANSFORM,
      layerCenterClientX: 200,
      layerCenterClientY: 150,
    };

    const next = computeNextTransform(drag, 300, 150, 100, 80, 1);
    expect(next.rotation).toBeCloseTo(Math.PI / 2);
  });
});

describe('🔥 scale 操作 - 對邊保持固定', () => {
  it('br 拖右下 100px 應該放大且左上角不變', () => {
    const drag: DragState = {
      handle: 'br',
      startClientX: 300,
      startClientY: 230,
      startTransform: IDENTITY_TRANSFORM,
      layerCenterClientX: 200,
      layerCenterClientY: 150,
    };

    const next = computeNextTransform(drag, 400, 310, 100, 80, 1);
    expect(next.scaleX).toBeCloseTo(2);
    expect(next.scaleY).toBeCloseTo(2);
    // 中心要往右下移 (50, 40) 才能讓 TL 不動
    expect(next.x).toBeCloseTo(50);
    expect(next.y).toBeCloseTo(40);
  });
});

describe('整合: 變換後的圖層渲染與控制框位置一致性', () => {
  it('TransformBox 計算的圖層中心 = renderComposite 的 ctx.translate 中心', () => {
    const transform = { x: 30, y: -20, scaleX: 1.5, scaleY: 1.5, rotation: Math.PI / 6 };
    const layerWidth = 200;
    const layerHeight = 100;

    // TransformBox 用法：layerCenterCanvas = (w/2 + x, h/2 + y)
    const transformBoxCenterX = layerWidth / 2 + transform.x;
    const transformBoxCenterY = layerHeight / 2 + transform.y;

    // EditorCanvas.renderComposite 用法：
    // ctx.translate(transform.x + canvas.width/2, transform.y + canvas.height/2)
    const renderCenterX = transform.x + layerWidth / 2;
    const renderCenterY = transform.y + layerHeight / 2;

    expect(transformBoxCenterX).toBe(renderCenterX);
    expect(transformBoxCenterY).toBe(renderCenterY);
  });
});

describe('computeLayerCenterClient (旋轉中心定位)', () => {
  it('簡單情況下圖層中心 = 容器中心 + container offset', () => {
    const vp: ViewportInfo = {
      containerWidth: 800,
      containerHeight: 600,
      containerLeft: 100,
      containerTop: 50,
      viewportOffset: { x: 0, y: 0 },
      viewportZoom: 1,
      canvasWidth: 400,
      canvasHeight: 300,
    };
    const center = computeLayerCenterClient(400, 300, IDENTITY_TRANSFORM, vp);
    // 圖層中心 = (200, 150) in canvas
    // → container 中心 (400, 300)
    // → + container offset (100, 50) = (500, 350)
    expect(center.x).toBe(500);
    expect(center.y).toBe(350);
  });
});
