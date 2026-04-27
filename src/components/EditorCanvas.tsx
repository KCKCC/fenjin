import { useCallback, useEffect, useRef, useState } from 'react';
import { applyLiquify, type LiquifyOptions } from '@/utils/liquify';
import type { EditorCommand, EditorStatus, EditorTool, LayerSummary, LayerTransform } from '@/types/editor';
import TransformBox from '@/components/TransformBox';

interface EditorCanvasProps {
  image: HTMLImageElement | null;
  tool: EditorTool;
  brushSize: number;
  pressure: number;
  brushHardness: number; // 0=全羽化, 1=硬邊
  paintColor: string;
  paintOpacity: number;
  showOriginal: boolean;
  options: LiquifyOptions;
  command: EditorCommand;
  onStatusChange: (status: EditorStatus) => void;
}

interface RuntimeLayer extends LayerSummary {
  canvas: HTMLCanvasElement;
  transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
}

interface SnapshotLayer extends LayerSummary {
  imageData: ImageData;
  transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
}

interface DocumentSnapshot {
  layers: SnapshotLayer[];
  activeLayerId: string | null;
}

const MAX_HISTORY = 24;

function createLayerId() {
  return `layer-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function createOffscreenCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function cloneImageData(imageData: ImageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function hexToRgba(hex: string, alpha: number) {
  const sanitized = hex.replace('#', '');
  const normalized = sanitized.length === 3
    ? sanitized.split('').map((char) => char + char).join('')
    : sanitized;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createSoftBrushStamp(
  diameter: number,
  color: string,
  alpha: number,
  hardness: number,
) {
  const size = Math.max(2, Math.ceil(diameter));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const radius = size / 2;
  const safeHardness = Math.max(0, Math.min(1, hardness));
  const innerRadius = radius * safeHardness;
  const gradient = ctx.createRadialGradient(radius, radius, innerRadius, radius, radius, radius);

  // The transparent edge must use the SAME RGB color with alpha 0.
  // Using transparent black causes dark fringes on semi-transparent brush strokes.
  gradient.addColorStop(0, hexToRgba(color, alpha));
  gradient.addColorStop(1, hexToRgba(color, 0));

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function createEraserStamp(diameter: number, alpha: number, hardness: number) {
  const size = Math.max(2, Math.ceil(diameter));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const radius = size / 2;
  const safeHardness = Math.max(0, Math.min(1, hardness));
  const innerRadius = radius * safeHardness;
  const gradient = ctx.createRadialGradient(radius, radius, innerRadius, radius, radius, radius);

  gradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function isPaintTool(tool: EditorTool): tool is 'brush' | 'eraser' {
  return tool === 'brush' || tool === 'eraser';
}

function isTransformTool(tool: EditorTool): tool is 'transform' {
  return tool === 'transform';
}

function isLiquifyTool(tool: EditorTool): tool is Exclude<EditorTool, 'brush' | 'eraser' | 'transform'> {
  return !isPaintTool(tool) && !isTransformTool(tool);
}

/** 將顯示畫布上的點 (canvas 座標) 反推回圖層的本地座標 (layer pixel) */
function canvasPointToLayerSpace(
  canvasX: number,
  canvasY: number,
  layerWidth: number,
  layerHeight: number,
  transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number }
) {
  // 正（渲染）方向：
  //   translate(transform.x + w/2, transform.y + h/2)
  //   rotate(transform.rotation)
  //   scale(scaleX, scaleY)
  //   translate(-w/2, -h/2)
  //   drawImage(0, 0)
  //
  // 因此，函數將圖層本地座標 (lx, ly) 映射為 canvas 座標 (cx, cy)：
  //   cx = (lx - w/2) * cos(...) - (ly - h/2) * sin(...) * scaleX + (w/2 + transform.x)  （不完整）
  // 逆運算：
  // 先平移 → 反旋轉 → 縮放反推

  const cos = Math.cos(-transform.rotation);
  const sin = Math.sin(-transform.rotation);

  const centerX = layerWidth / 2 + transform.x;
  const centerY = layerHeight / 2 + transform.y;

  const offsetX = canvasX - centerX;
  const offsetY = canvasY - centerY;

  const localX = offsetX * cos - offsetY * sin;
  const localY = offsetX * sin + offsetY * cos;

  const layerLx = localX / transform.scaleX + layerWidth / 2;
  const layerLy = localY / transform.scaleY + layerHeight / 2;

  return {
    x: Math.round(layerLx),
    y: Math.round(layerLy),
  };
}

export default function EditorCanvas({
  image,
  tool,
  brushSize,
  pressure,
  brushHardness,
  paintColor,
  paintOpacity,
  showOriginal,
  options,
  command,
  onStatusChange,
}: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalBaseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const layersRef = useRef<RuntimeLayer[]>([]);
  const historyRef = useRef<DocumentSnapshot[]>([]);
  const historyIndexRef = useRef(0);
  const activeLayerIdRef = useRef<string | null>(null);
  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastHandledCommandRef = useRef(0);
  const transformDraggingRef = useRef(false);

  const [canvasSize, setCanvasSize] = useState({ w: 960, h: 640 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [mouseScreenPos, setMouseScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [activeLayerIdForUI, setActiveLayerIdForUI] = useState<string | null>(null);
  const [activeTransform, setActiveTransform] = useState<LayerTransform | null>(null);

  const emitStatus = useCallback(() => {
    setActiveLayerIdForUI(activeLayerIdRef.current);
    if (!transformDraggingRef.current) {
      const activeLayer = layersRef.current.find((l) => l.id === activeLayerIdRef.current);
      if (activeLayer && activeLayer.kind === 'paint') {
        setActiveTransform({ ...activeLayer.transform });
      } else {
        setActiveTransform(null);
      }
    }
    onStatusChange({
      historyIndex: historyIndexRef.current,
      historyLength: historyRef.current.length,
      activeLayerId: activeLayerIdRef.current,
      layers: layersRef.current.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        kind: layer.kind,
        transform: { ...layer.transform },
      })),
    });
  }, [onStatusChange]);

  const renderComposite = useCallback(() => {
    const display = displayCanvasRef.current;
    if (!display) return;

    display.width = canvasSize.w;
    display.height = canvasSize.h;

    const ctx = display.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, display.width, display.height);

    if (showOriginal) {
      if (originalBaseCanvasRef.current) {
        ctx.drawImage(originalBaseCanvasRef.current, 0, 0);
      }
      return;
    }

    for (const layer of layersRef.current) {
      if (!layer.visible) continue;
      const { x, y, scaleX, scaleY, rotation } = layer.transform;
      const cw = layer.canvas.width;
      const ch = layer.canvas.height;
      const centerX = cw / 2;
      const centerY = ch / 2;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      // 變換順序：先平移中心 → 旋轉 → 縮放 → 退中平
      ctx.translate(x + centerX, y + centerY);
      ctx.rotate(rotation);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-centerX, -centerY);
      ctx.drawImage(layer.canvas, 0, 0);
      ctx.restore();
    }
  }, [canvasSize.h, canvasSize.w, showOriginal]);

  const createSnapshot = useCallback((): DocumentSnapshot => {
    return {
      activeLayerId: activeLayerIdRef.current,
      layers: layersRef.current.map((layer) => {
        const ctx = layer.canvas.getContext('2d')!;
        return {
          id: layer.id,
          name: layer.name,
          visible: layer.visible,
          opacity: layer.opacity,
          kind: layer.kind,
          transform: { ...layer.transform },
          imageData: cloneImageData(ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height)),
        };
      }),
    };
  }, []);

  const restoreSnapshot = useCallback((snapshot: DocumentSnapshot) => {
    const restoredLayers: RuntimeLayer[] = snapshot.layers.map((layer) => {
      const canvas = createOffscreenCanvas(layer.imageData.width, layer.imageData.height);
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(cloneImageData(layer.imageData), 0, 0);
      return {
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        kind: layer.kind,
        transform: { ...layer.transform },
        canvas,
      };
    });
    layersRef.current = restoredLayers;
    activeLayerIdRef.current = snapshot.activeLayerId ?? restoredLayers.at(-1)?.id ?? null;
    renderComposite();
    emitStatus();
  }, [emitStatus, renderComposite]);

  const pushHistory = useCallback(() => {
    const snapshot = createSnapshot();
    let nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(snapshot);
    if (nextHistory.length > MAX_HISTORY) {
      nextHistory = nextHistory.slice(nextHistory.length - MAX_HISTORY);
    }
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    emitStatus();
  }, [createSnapshot, emitStatus]);

  const getActiveLayer = useCallback(() => {
    const activeId = activeLayerIdRef.current;
    return layersRef.current.find((layer) => layer.id === activeId) ?? layersRef.current.at(-1) ?? null;
  }, []);

  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return {
      x: Math.max(0, Math.min(canvas.width - 1, Math.round(x))),
      y: Math.max(0, Math.min(canvas.height - 1, Math.round(y))),
    };
  }, []);

  const updateMousePreview = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    setMouseScreenPos({
      x: clientX - containerRect.left,
      y: clientY - containerRect.top,
    });
  }, []);

  const drawOnLayer = useCallback((layer: RuntimeLayer, point: { x: number; y: number }, previous?: { x: number; y: number }) => {
    const ctx = layer.canvas.getContext('2d')!;
    const alpha = Math.max(0.01, Math.min(1, paintOpacity * pressure));
    const diameter = brushSize * 2;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = hexToRgba(paintColor, alpha);
    ctx.fillStyle = hexToRgba(paintColor, alpha);
    ctx.lineWidth = diameter;

    // 筆刷硬度：使用徑向漸層模擬羽化
    if (brushHardness < 1) {
      const tempCanvas = tool === 'eraser'
        ? createEraserStamp(diameter, alpha, brushHardness)
        : createSoftBrushStamp(diameter, paintColor, alpha, brushHardness);
      const rad = tempCanvas.width;

      if (previous) {
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const dist = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.ceil(dist / 4));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const lx = previous.x + dx * t;
          const ly = previous.y + dy * t;
          ctx.drawImage(tempCanvas, lx - rad / 2, ly - rad / 2);
        }
      } else {
        ctx.drawImage(tempCanvas, point.x - rad / 2, point.y - rad / 2);
      }
    } else {
      // 硬邊
      if (previous) {
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(point.x, point.y, brushSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }, [brushSize, brushHardness, paintColor, paintOpacity, pressure, tool]);

  const liquifyLayer = useCallback((
    layer: RuntimeLayer,
    liquifyTool: Exclude<EditorTool, 'brush' | 'eraser' | 'transform'>,
    point: { x: number; y: number },
    previous?: { x: number; y: number }
  ) => {
    const ctx = layer.canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    if (previous) {
      const deltaX = point.x - previous.x;
      const deltaY = point.y - previous.y;
      const distance = Math.hypot(deltaX, deltaY);
      const steps = Math.max(1, Math.ceil(distance / Math.max(1, brushSize * 0.35)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ix = Math.round(previous.x + deltaX * t);
        const iy = Math.round(previous.y + deltaY * t);
        applyLiquify(imageData, ix, iy, brushSize, pressure, liquifyTool, deltaX / steps, deltaY / steps, options);
      }
    } else {
      applyLiquify(imageData, point.x, point.y, brushSize, pressure, liquifyTool, 0, 0, options);
    }
    ctx.putImageData(imageData, 0, 0);
  }, [brushSize, options, pressure]);

  const applyTool = useCallback((canvasPoint: { x: number; y: number }, previousCanvas?: { x: number; y: number }) => {
    const layer = getActiveLayer();
    if (!layer) return;

    // ✨ 將 canvas（顯示畫布）座標反推到圖層本地座標
    const localPoint = canvasPointToLayerSpace(
      canvasPoint.x, canvasPoint.y,
      layer.canvas.width, layer.canvas.height,
      layer.transform
    );
    const localPrevious = previousCanvas
      ? canvasPointToLayerSpace(previousCanvas.x, previousCanvas.y, layer.canvas.width, layer.canvas.height, layer.transform)
      : undefined;

    // 越界檢查
    if (
      localPoint.x < 0 || localPoint.y < 0 ||
      localPoint.x >= layer.canvas.width || localPoint.y >= layer.canvas.height
    ) return;

    if (isPaintTool(tool)) {
      drawOnLayer(layer, localPoint, localPrevious);
    } else if (isLiquifyTool(tool)) {
      liquifyLayer(layer, tool, localPoint, localPrevious);
    }
    renderComposite();
  }, [drawOnLayer, getActiveLayer, liquifyLayer, renderComposite, tool]);

  // --- 初始化與生命週期 ---
  useEffect(() => {
    if (!image) return;
    const maxW = 1400;
    const maxH = 1000;
    let width = image.naturalWidth;
    let height = image.naturalHeight;
    if (width > maxW || height > maxH) {
      const ratio = Math.min(maxW / width, maxH / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    setCanvasSize({ w: width, h: height });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setMouseScreenPos(null);

    const baseCanvas = createOffscreenCanvas(width, height);
    const baseCtx = baseCanvas.getContext('2d')!;
    baseCtx.drawImage(image, 0, 0, width, height);

    const originalCanvas = createOffscreenCanvas(width, height);
    originalCanvas.getContext('2d')!.drawImage(baseCanvas, 0, 0);
    originalBaseCanvasRef.current = originalCanvas;

    const baseLayer: RuntimeLayer = {
      id: createLayerId(),
      name: 'Base Image',
      visible: true,
      opacity: 1,
      kind: 'base',
      canvas: baseCanvas,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    };

    layersRef.current = [baseLayer];
    activeLayerIdRef.current = baseLayer.id;
    historyRef.current = [];
    historyIndexRef.current = 0;
    renderComposite();
    historyRef.current = [createSnapshot()];
    historyIndexRef.current = 0;
    emitStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  // 下載畫布
  const handleDownloadCanvas = useCallback(() => {
    const display = displayCanvasRef.current;
    if (!display) return;

    // 確保顯示畫布已是最新合成結果
    renderComposite();

    const link = document.createElement('a');
    link.download = 'liquify-studio-export.png';
    link.href = display.toDataURL('image/png');
    link.click();
  }, [renderComposite]);

  // ▸ 對外暴露下載方法
  useEffect(() => {
    (window as any).__editorDownload = handleDownloadCanvas;
    return () => { delete (window as any).__editorDownload; };
  }, [handleDownloadCanvas]);

  // --- Command handler ---
  useEffect(() => {
    if (command.nonce === 0 || command.nonce === lastHandledCommandRef.current) return;
    lastHandledCommandRef.current = command.nonce;
    if (layersRef.current.length === 0) return;

    switch (command.type) {
      case 'undo': {
        if (historyIndexRef.current > 0) {
          historyIndexRef.current -= 1;
          restoreSnapshot(historyRef.current[historyIndexRef.current]);
        }
        break;
      }
      case 'redo': {
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current += 1;
          restoreSnapshot(historyRef.current[historyIndexRef.current]);
        }
        break;
      }
      case 'reset': {
        if (historyRef.current.length > 0) {
          historyRef.current = [historyRef.current[0]];
          historyIndexRef.current = 0;
          restoreSnapshot(historyRef.current[0]);
        }
        break;
      }
      case 'add-layer': {
        const newLayer: RuntimeLayer = {
          id: createLayerId(),
          name: `Paint Layer ${layersRef.current.filter((l) => l.kind === 'paint').length + 1}`,
          visible: true, opacity: 1, kind: 'paint',
          canvas: createOffscreenCanvas(canvasSize.w, canvasSize.h),
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        };
        const pos = layersRef.current.findIndex((l) => l.id === activeLayerIdRef.current);
        const insertAt = pos >= 0 ? pos + 1 : layersRef.current.length;
        layersRef.current = [...layersRef.current.slice(0, insertAt), newLayer, ...layersRef.current.slice(insertAt)];
        activeLayerIdRef.current = newLayer.id;
        renderComposite();
        pushHistory();
        break;
      }
      case 'duplicate-layer': {
        const src = getActiveLayer();
        if (!src) break;
        const dupCanvas = createOffscreenCanvas(canvasSize.w, canvasSize.h);
        dupCanvas.getContext('2d')!.drawImage(src.canvas, 0, 0);
        const dup: RuntimeLayer = { ...src, id: createLayerId(), name: `${src.name} Copy`, canvas: dupCanvas, transform: { ...src.transform } };
        const idx = layersRef.current.findIndex((l) => l.id === src.id);
        layersRef.current = [...layersRef.current.slice(0, idx + 1), dup, ...layersRef.current.slice(idx + 1)];
        activeLayerIdRef.current = dup.id;
        renderComposite();
        pushHistory();
        break;
      }
      case 'delete-layer': {
        const target = getActiveLayer();
        if (!target || target.kind === 'base' || layersRef.current.length <= 1) break;
        const idx = layersRef.current.findIndex((l) => l.id === target.id);
        layersRef.current = layersRef.current.filter((l) => l.id !== target.id);
        activeLayerIdRef.current = layersRef.current[Math.max(0, idx - 1)]?.id ?? layersRef.current.at(-1)?.id ?? null;
        renderComposite();
        pushHistory();
        break;
      }
      case 'move-layer-up': {
        const idx = layersRef.current.findIndex((l) => l.id === activeLayerIdRef.current);
        if (idx < 0 || idx >= layersRef.current.length - 1) break;
        [layersRef.current[idx], layersRef.current[idx + 1]] = [layersRef.current[idx + 1], layersRef.current[idx]];
        renderComposite();
        pushHistory();
        break;
      }
      case 'move-layer-down': {
        const idx = layersRef.current.findIndex((l) => l.id === activeLayerIdRef.current);
        if (idx <= 0) break;
        [layersRef.current[idx], layersRef.current[idx - 1]] = [layersRef.current[idx - 1], layersRef.current[idx]];
        renderComposite();
        pushHistory();
        break;
      }
      case 'select-layer': {
        if (layersRef.current.some((l) => l.id === command.layerId)) {
          activeLayerIdRef.current = command.layerId;
          emitStatus();
        }
        break;
      }
      case 'toggle-layer-visibility': {
        layersRef.current = layersRef.current.map((l) => l.id === command.layerId ? { ...l, visible: !l.visible } : l);
        renderComposite();
        pushHistory();
        break;
      }
      case 'set-layer-opacity': {
        layersRef.current = layersRef.current.map((l) => l.id === command.layerId ? { ...l, opacity: command.opacity } : l);
        renderComposite();
        pushHistory();
        break;
      }
      case 'set-layer-transform': {
        layersRef.current = layersRef.current.map((l) =>
          l.id === command.layerId ? { ...l, transform: { ...l.transform, ...command.transform } } : l
        );
        renderComposite();
        pushHistory();
        break;
      }
      case 'reset-layer-transform': {
        layersRef.current = layersRef.current.map((l) =>
          l.id === command.layerId ? { ...l, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 } } : l
        );
        renderComposite();
        pushHistory();
        break;
      }
      case 'paste-image': {
        const newLayer: RuntimeLayer = {
          id: createLayerId(),
          name: `Pasted Image ${layersRef.current.filter((l) => l.kind === 'paint').length + 1}`,
          visible: true, opacity: 1, kind: 'paint',
          canvas: createOffscreenCanvas(command.imageData.width, command.imageData.height),
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        };
        const ctx = newLayer.canvas.getContext('2d')!;
        ctx.putImageData(command.imageData, 0, 0);
        const pos = layersRef.current.findIndex((l) => l.id === activeLayerIdRef.current);
        const insertAt = pos >= 0 ? pos + 1 : layersRef.current.length;
        layersRef.current = [...layersRef.current.slice(0, insertAt), newLayer, ...layersRef.current.slice(insertAt)];
        activeLayerIdRef.current = newLayer.id;
        renderComposite();
        pushHistory();
        break;
      }
      case 'flatten-layer': {
        const activeLayer = getActiveLayer();
        if (!activeLayer || activeLayer.kind === 'base') break;

        // 建立新畫布（與合成畫布同大小），並將該圖層以目前變換狀態繪製到新畫布
        const flattenedCanvas = createOffscreenCanvas(canvasSize.w, canvasSize.h);
        const fCtx = flattenedCanvas.getContext('2d')!;
        const { x, y, scaleX, scaleY, rotation } = activeLayer.transform;
        const cw = activeLayer.canvas.width;
        const ch = activeLayer.canvas.height;
        fCtx.translate(x + cw / 2, y + ch / 2);
        fCtx.rotate(rotation);
        fCtx.scale(scaleX, scaleY);
        fCtx.translate(-cw / 2, -ch / 2);
        fCtx.drawImage(activeLayer.canvas, 0, 0);

        // 取代該圖層內容，並重設 transform
        const newId = createLayerId();
        const flattenedLayer: RuntimeLayer = {
          id: newId,
          name: `${activeLayer.name} (flattened)`,
          visible: activeLayer.visible,
          opacity: activeLayer.opacity,
          kind: activeLayer.kind,
          canvas: flattenedCanvas,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        };

        const oldIdx = layersRef.current.findIndex((l) => l.id === activeLayer.id);
        layersRef.current = [
          ...layersRef.current.slice(0, oldIdx),
          flattenedLayer,
          ...layersRef.current.slice(oldIdx + 1),
        ];
        activeLayerIdRef.current = newId;
        renderComposite();
        pushHistory();
        break;
      }
      case 'none':
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command.nonce]);

  // --- Pointer events ---
  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (event.button === 1 || event.button === 2) {
      isPanningRef.current = true;
      panStartRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
      return;
    }
    if (showOriginal) return;
    const point = getCanvasCoords(event.clientX, event.clientY);
    if (!point) return;
    isDrawingRef.current = true;
    lastPointRef.current = point;
    updateMousePreview(event.clientX, event.clientY);
    applyTool(point);
  }, [applyTool, getCanvasCoords, offset.x, offset.y, showOriginal, updateMousePreview]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    updateMousePreview(event.clientX, event.clientY);
    if (isPanningRef.current) {
      setOffset({ x: event.clientX - panStartRef.current.x, y: event.clientY - panStartRef.current.y });
      return;
    }
    if (!isDrawingRef.current || showOriginal) return;
    const point = getCanvasCoords(event.clientX, event.clientY);
    if (!point) return;
    applyTool(point, lastPointRef.current ?? undefined);
    lastPointRef.current = point;
  }, [applyTool, getCanvasCoords, showOriginal, updateMousePreview]);

  const handlePointerUp = useCallback(() => {
    if (isPanningRef.current) { isPanningRef.current = false; return; }
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    if (!transformDraggingRef.current) pushHistory();
  }, [pushHistory]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    setZoom((current) => Math.max(0.1, Math.min(8, current + (event.deltaY > 0 ? -0.1 : 0.1))));
  }, []);

  // --- Transform callbacks ---
  const handleTransformChange = useCallback((t: LayerTransform) => {
    const layerId = activeLayerIdRef.current;
    if (!layerId) return;
    transformDraggingRef.current = true;
    layersRef.current = layersRef.current.map((l) =>
      l.id === layerId ? { ...l, transform: { ...t } } : l
    );
    setActiveTransform({ ...t });
    renderComposite();
  }, [renderComposite]);

  const handleTransformCommit = useCallback((t: LayerTransform) => {
    const layerId = activeLayerIdRef.current;
    if (!layerId) { transformDraggingRef.current = false; return; }
    layersRef.current = layersRef.current.map((l) =>
      l.id === layerId ? { ...l, transform: { ...t } } : l
    );
    setActiveTransform({ ...t });
    renderComposite();
    transformDraggingRef.current = false;
    pushHistory();
  }, [pushHistory, renderComposite]);

  // --- UI helpers ---
  const brushPreviewSize = brushSize * 2 * zoom;
  const cursorColor = tool === 'eraser' ? '#ef4444' : tool === 'brush' ? paintColor : '#6366f1';
  const isTransform = isTransformTool(tool);
  const isPaint = isPaintTool(tool);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerRect(el.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeLayerForBox = (() => {
    const activeId = activeLayerIdForUI;
    if (!activeId) return null;
    const layer = layersRef.current.find((l) => l.id === activeId);
    return layer && layer.kind === 'paint' ? layer : null;
  })();

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        ref={containerRef}
        className="relative flex min-h-[640px] w-full items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(#dbe4f0_1px,transparent_1px)] bg-[length:22px_22px] bg-slate-50 shadow-inner"
      >
        {image ? (
          <canvas
            id="editor-display-canvas"
            ref={displayCanvasRef}
            className="absolute bg-white shadow-2xl"
            style={{
              left: `calc(50% + ${offset.x}px)`,
              top: `calc(50% + ${offset.y}px)`,
              transform: `translate(-50%, -50%) scale(${zoom})`,
              transformOrigin: 'center center',
              cursor: isTransform ? 'default' : isPaint ? 'crosshair' : 'crosshair',
            }}
            onPointerDown={isTransform ? undefined : handlePointerDown}
            onPointerMove={isTransform ? undefined : handlePointerMove}
            onPointerUp={isTransform ? undefined : handlePointerUp}
            onPointerLeave={isTransform ? undefined : handlePointerUp}
            onWheel={handleWheel}
            onContextMenu={(event) => event.preventDefault()}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <div className="text-5xl">🖼️</div>
            <p className="text-sm font-semibold">請先上傳圖片以建立文件</p>
          </div>
        )}

        {mouseScreenPos && image && !showOriginal && !isTransform && (
          <div
            className="pointer-events-none absolute rounded-full border shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
            style={{
              width: brushPreviewSize,
              height: brushPreviewSize,
              left: mouseScreenPos.x,
              top: mouseScreenPos.y,
              transform: 'translate(-50%, -50%)',
              borderColor: cursorColor,
              background: tool === 'brush'
                ? `${paintColor}18`
                : tool === 'eraser'
                  ? 'rgba(239,68,68,0.08)'
                  : 'rgba(99,102,241,0.08)',
            }}
          />
        )}

        {isTransform && activeLayerForBox && activeTransform && containerRect && (
          <TransformBox
            layerWidth={activeLayerForBox.canvas.width}
            layerHeight={activeLayerForBox.canvas.height}
            transform={activeTransform}
            viewportInfo={{
              containerWidth: containerRect.width,
              containerHeight: containerRect.height,
              containerLeft: containerRect.left,
              containerTop: containerRect.top,
              viewportOffset: offset,
              viewportZoom: zoom,
              canvasWidth: canvasSize.w,
              canvasHeight: canvasSize.h,
            }}
            onChange={handleTransformChange}
            onCommit={handleTransformCommit}
          />
        )}

        {showOriginal && image && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
            <div className="rounded-2xl bg-slate-900/85 px-5 py-2 text-xs font-semibold tracking-wide text-white shadow-lg">
              🔄 原始基底圖預覽
            </div>
          </div>
        )}

        {isTransform && image && !activeLayerForBox && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl bg-slate-900/80 px-6 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
              請在圖層面板選擇一個「繪圖」圖層以使用變換工具
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-3 flex gap-2">
          <div className="rounded-2xl bg-white/90 px-3 py-2 text-[11px] text-slate-600 shadow-sm backdrop-blur-sm">
            <div className="font-semibold text-slate-800">
              {isTransform ? '✦ 變換模式' : isPaint ? (tool === 'brush' ? '🖌 畫筆模式' : '🩹 橡皮擦模式') : '💧 液化模式'}
            </div>
            {image && <div className="text-slate-500">{canvasSize.w} × {canvasSize.h} · {Math.round(zoom * 100)}%</div>}
          </div>

          {/* 重整變換圖層按鈕 */}
          {isTransform && activeLayerForBox && (
            <button
              onClick={() => {
                (window as any).__editorDispatch?.({ type: 'flatten-layer' });
              }}
              className="rounded-xl bg-amber-500 px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-amber-600"
              title="將目前變換套用到圖層內容並重置變換參數"
            >
              �� 套用變換
            </button>
          )}
        </div>

        {image && (
          <div className="absolute bottom-3 right-3 rounded-2xl bg-slate-900/75 px-3 py-2 text-[10px] font-mono text-white shadow backdrop-blur-sm">
            {Math.round(zoom * 100)}%
          </div>
        )}
      </div>

      {image && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setZoom((c) => Math.max(0.1, c - 0.2))} className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50">−</button>
          <span className="min-w-[3.5rem] rounded-xl border border-slate-200 bg-white px-2 py-1 text-center text-xs font-mono font-bold text-slate-700 shadow-sm">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((c) => Math.min(8, c + 0.2))} className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50">+</button>
          <button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">🎯 重設視圖</button>
          <button onClick={() => (window as any).__editorDispatch?.({ type: 'flatten-layer' })} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100">🔒 套用變換並固化</button>
          <div className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 shadow-sm">
            <kbd className="rounded bg-slate-100 px-1">右鍵</kbd> 平移 · <kbd className="mx-1 rounded bg-slate-100 px-1">滾輪</kbd> 縮放 · <kbd className="mx-1 rounded bg-slate-100 px-1">Space</kbd> 對比原圖
          </div>
        </div>
      )}
    </div>
  );
}
