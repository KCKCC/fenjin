import { forwardRef, useImperativeHandle, useRef } from "react";
import type { EditorState } from "../useEditor";
import type { ElementSelection, Panel, Bubble, Point } from "../types";
import { PanelView } from "./PanelView";
import { BubbleView } from "./BubbleView";
import { bbox } from "../utils/geometry";

type Props = {
  state: EditorState;
  selection: ElementSelection;
  scale: number;
  setSelection: (s: ElementSelection) => void;
  beginDrag: () => void;
  endDrag: () => void;
  updatePanel: (id: string, patch: Partial<Panel>, history?: boolean) => void;
  updateBubble: (id: string, patch: Partial<Bubble>, history?: boolean) => void;
};

export type CanvasHandle = {
  getSvg: () => SVGSVGElement | null;
};

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(
  {
    state,
    selection,
    scale,
    setSelection,
    beginDrag,
    endDrag,
    updatePanel,
    updateBubble,
  },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null);
  useImperativeHandle(ref, () => ({ getSvg: () => svgRef.current }));

  const { page } = state;

  const toCanvas = (clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * page.width;
    const y = ((clientY - rect.top) / rect.height) * page.height;
    return { x, y };
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className="shadow-2xl shadow-black/50"
        style={{ width: page.width * scale, height: page.height * scale }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${page.width} ${page.height}`}
          width={page.width * scale}
          height={page.height * scale}
          style={{ display: "block", background: state.bg }}
          onPointerDown={(e) => {
            if (e.target === svgRef.current) setSelection(null);
          }}
        >
          <rect x={0} y={0} width={page.width} height={page.height} fill={state.bg} />

          {state.panels.map((panel) => (
            <PanelView
              key={panel.id}
              panel={panel}
              scale={scale}
              selected={selection?.type === "panel" && selection.id === panel.id}
              toCanvas={toCanvas}
              onSelect={() => setSelection({ type: "panel", id: panel.id })}
              onBeginDrag={beginDrag}
              onMove={(patch) => updatePanel(panel.id, patch, false)}
              onEndDrag={endDrag}
              onDropImage={(src, w, h) => {
                const box = bbox(panel.points);
                const scaleFit = Math.max(box.width / w, box.height / h);
                updatePanel(panel.id, {
                  image: {
                    src,
                    naturalW: w,
                    naturalH: h,
                    scale: scaleFit,
                    offsetX: (box.width - w * scaleFit) / 2,
                    offsetY: (box.height - h * scaleFit) / 2,
                  },
                });
                setSelection({ type: "panel", id: panel.id });
              }}
            />
          ))}

          {state.bubbles.map((bubble) => (
            <BubbleView
              key={bubble.id}
              bubble={bubble}
              scale={scale}
              selected={
                selection?.type === "bubble" && selection.id === bubble.id
              }
              toCanvas={toCanvas}
              onSelect={() => setSelection({ type: "bubble", id: bubble.id })}
              onBeginDrag={beginDrag}
              onMove={(patch, history) => updateBubble(bubble.id, patch, history)}
              onEndDrag={endDrag}
            />
          ))}
        </svg>
      </div>
    </div>
  );
});
