import { useRef, useCallback } from 'react';
import type { LayerTransform } from '@/types/editor';
import {
  canvasToContainer,
  computeLayerCorners,
  computeLayerCenterClient,
  computeNextTransform,
  type DragHandle,
  type DragState,
  type ViewportInfo,
} from '@/utils/transform';

interface TransformBoxProps {
  layerWidth: number;
  layerHeight: number;
  transform: LayerTransform;
  viewportInfo: ViewportInfo;
  onChange: (transform: LayerTransform) => void;
  onCommit: (transform: LayerTransform) => void;
}

export default function TransformBox({
  layerWidth,
  layerHeight,
  transform,
  viewportInfo,
  onChange,
  onCommit,
}: TransformBoxProps) {
  const dragRef = useRef<{
    state: DragState;
    latestTransform: LayerTransform;
  } | null>(null);

  // 計算四個角的 canvas 座標再轉到 container 座標
  const corners = computeLayerCorners(layerWidth, layerHeight, transform);
  const screenCorners = corners.map((c) => canvasToContainer(c.x, c.y, viewportInfo));
  const [sTL, sTR, sBR, sBL] = screenCorners;

  // 旋轉把手位置：頂部中點往上 40px (螢幕距離)
  const sTC = {
    x: (sTL.x + sTR.x) / 2,
    y: (sTL.y + sTR.y) / 2,
  };
  // 沿著旋轉後「向上」方向延伸
  const sin = Math.sin(transform.rotation);
  const cos = Math.cos(transform.rotation);
  const sRot = {
    x: sTC.x - sin * 40,
    y: sTC.y - cos * 40,
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: DragHandle) => {
    e.preventDefault();
    e.stopPropagation();

    const startTransform = { ...transform };
    const layerCenterClient = computeLayerCenterClient(layerWidth, layerHeight, startTransform, viewportInfo);

    const dragState: DragState = {
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startTransform,
      layerCenterClientX: layerCenterClient.x,
      layerCenterClientY: layerCenterClient.y,
    };

    dragRef.current = {
      state: dragState,
      latestTransform: startTransform,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      moveEvent.preventDefault();

      const next = computeNextTransform(
        dragRef.current.state,
        moveEvent.clientX,
        moveEvent.clientY,
        layerWidth,
        layerHeight,
        viewportInfo.viewportZoom
      );

      dragRef.current.latestTransform = next;
      onChange(next);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const finalTransform = dragRef.current?.latestTransform;
      dragRef.current = null;

      if (finalTransform) {
        onCommit(finalTransform);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [layerWidth, layerHeight, transform, viewportInfo, onChange, onCommit]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      {/* SVG: 邊框 + 旋轉臂 + 移動區域 */}
      <svg
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {/* 移動區域（半透明填充以可見並可點擊） */}
        <polygon
          points={`${sTL.x},${sTL.y} ${sTR.x},${sTR.y} ${sBR.x},${sBR.y} ${sBL.x},${sBL.y}`}
          fill="rgba(99,102,241,0.06)"
          stroke="#6366f1"
          strokeWidth={2}
          strokeDasharray="6 4"
          style={{ cursor: 'move', pointerEvents: 'all' }}
          onMouseDown={(e) => handleMouseDown(e as unknown as React.MouseEvent, 'move')}
        />
        {/* 旋轉臂 */}
        <line
          x1={sTC.x}
          y1={sTC.y}
          x2={sRot.x}
          y2={sRot.y}
          stroke="#6366f1"
          strokeWidth={2}
        />
      </svg>

      {/* 四個角控制點 */}
      {[
        { p: sTL, id: 'tl' as DragHandle, cursor: 'nwse-resize' },
        { p: sTR, id: 'tr' as DragHandle, cursor: 'nesw-resize' },
        { p: sBR, id: 'br' as DragHandle, cursor: 'nwse-resize' },
        { p: sBL, id: 'bl' as DragHandle, cursor: 'nesw-resize' },
      ].map(({ p, id, cursor }) => (
        <div
          key={id}
          style={{
            position: 'absolute',
            left: p.x - 7,
            top: p.y - 7,
            width: 14,
            height: 14,
            backgroundColor: 'white',
            border: '2px solid #6366f1',
            borderRadius: 3,
            cursor,
            pointerEvents: 'auto',
            zIndex: 101,
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
          onMouseDown={(e) => handleMouseDown(e, id)}
        />
      ))}

      {/* 旋轉把手 */}
      <div
        style={{
          position: 'absolute',
          left: sRot.x - 11,
          top: sRot.y - 11,
          width: 22,
          height: 22,
          backgroundColor: 'white',
          border: '2px solid #6366f1',
          borderRadius: '50%',
          cursor: 'crosshair',
          pointerEvents: 'auto',
          zIndex: 101,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          color: '#6366f1',
          fontWeight: 'bold',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          userSelect: 'none',
        }}
        onMouseDown={(e) => handleMouseDown(e, 'rotate')}
      >
        ↻
      </div>

      {/* 資訊標籤 */}
      <div
        style={{
          position: 'absolute',
          left: Math.min(sTL.x, sTR.x, sBR.x, sBL.x),
          top: Math.min(sTL.y, sTR.y, sBR.y, sBL.y) - 30,
          backgroundColor: '#1e293b',
          color: 'white',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontFamily: 'monospace',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 102,
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      >
        {(transform.scaleX * 100).toFixed(0)}% · {((transform.rotation * 180) / Math.PI).toFixed(0)}° · ({Math.round(transform.x)}, {Math.round(transform.y)})
      </div>
    </div>
  );
}
