import { useCallback, useRef, useState } from "react";
import type {
  Bubble,
  BubbleKind,
  ElementSelection,
  Panel,
  PageSize,
} from "./types";
import { uid } from "./utils/geometry";
import { buildLayout, LAYOUTS, type LayoutTemplate } from "./utils/layouts";

export const PAGE_SIZES: PageSize[] = [
  { name: "A4 直式", width: 794, height: 1123 },
  { name: "A4 橫式", width: 1123, height: 794 },
  { name: "方形", width: 900, height: 900 },
  { name: "寬幅", width: 1200, height: 700 },
];

export type EditorState = {
  panels: Panel[];
  bubbles: Bubble[];
  page: PageSize;
  bg: string;
};

function makePanel(x: number, y: number, w: number, h: number): Panel {
  return {
    id: uid("panel"),
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    image: null,
    borderWidth: 4,
    borderColor: "#111111",
    bgColor: "#ffffff",
    cornerRadius: 0,
  };
}

const classic4 = LAYOUTS.find((l) => l.id === "classic4")!;

const initialPage = PAGE_SIZES[0];

const initialState: EditorState = {
  panels: buildLayout(classic4, initialPage),
  bubbles: [],
  page: initialPage,
  bg: "#f4f4f5",
};

export function useEditor() {
  const [state, setState] = useState<EditorState>(initialState);
  const [selection, setSelection] = useState<ElementSelection>(null);
  const past = useRef<EditorState[]>([]);
  const future = useRef<EditorState[]>([]);
  const [, force] = useState(0);

  // commit = pushes to history (for discrete actions)
  const commit = useCallback((updater: (s: EditorState) => EditorState) => {
    setState((prev) => {
      past.current.push(prev);
      if (past.current.length > 100) past.current.shift();
      future.current = [];
      force((n) => n + 1);
      return updater(prev);
    });
  }, []);

  // live = updates without history (during drag). Call commitLive to snapshot start.
  const dragStartSnap = useRef<EditorState | null>(null);
  const beginDrag = useCallback(() => {
    setState((prev) => {
      dragStartSnap.current = prev;
      return prev;
    });
  }, []);
  const live = useCallback((updater: (s: EditorState) => EditorState) => {
    setState((prev) => updater(prev));
  }, []);
  const endDrag = useCallback(() => {
    if (dragStartSnap.current) {
      past.current.push(dragStartSnap.current);
      if (past.current.length > 100) past.current.shift();
      future.current = [];
      dragStartSnap.current = null;
      force((n) => n + 1);
    }
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      const p = past.current.pop();
      if (!p) return prev;
      future.current.push(prev);
      force((n) => n + 1);
      return p;
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      const f = future.current.pop();
      if (!f) return prev;
      past.current.push(prev);
      force((n) => n + 1);
      return f;
    });
  }, []);

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  // ---- Actions ----
  const addPanel = useCallback(() => {
    commit((s) => {
      const cx = s.page.width / 2 - 140;
      const cy = s.page.height / 2 - 100;
      const p = makePanel(cx, cy, 280, 200);
      setSelection({ type: "panel", id: p.id });
      return { ...s, panels: [...s.panels, p] };
    });
  }, [commit]);

  const deleteSelected = useCallback(() => {
    if (!selection) return;
    commit((s) => {
      if (selection.type === "panel")
        return { ...s, panels: s.panels.filter((p) => p.id !== selection.id) };
      return { ...s, bubbles: s.bubbles.filter((b) => b.id !== selection.id) };
    });
    setSelection(null);
  }, [commit, selection]);

  const updatePanel = useCallback(
    (id: string, patch: Partial<Panel>, history = true) => {
      const fn = (s: EditorState) => ({
        ...s,
        panels: s.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      });
      history ? commit(fn) : live(fn);
    },
    [commit, live]
  );

  const updateBubble = useCallback(
    (id: string, patch: Partial<Bubble>, history = true) => {
      const fn = (s: EditorState) => ({
        ...s,
        bubbles: s.bubbles.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      });
      history ? commit(fn) : live(fn);
    },
    [commit, live]
  );

  const addBubble = useCallback(
    (kind: BubbleKind) => {
      commit((s) => {
        const b: Bubble = {
          id: uid("bubble"),
          kind,
          x: s.page.width / 2 - 90,
          y: s.page.height / 2 - 50,
          width: 180,
          height: 100,
          text:
            kind === "narration"
              ? "旁白文字…"
              : kind === "shout"
              ? "！！"
              : "在這裡輸入台詞",
          fontSize: 20,
          fontFamily: "'Noto Sans TC', sans-serif",
          bold: kind === "shout",
          color: "#111111",
          fill: "#ffffff",
          stroke: "#111111",
          strokeWidth: 3,
          tailX: s.page.width / 2 - 40,
          tailY: s.page.height / 2 + 90,
          rotation: 0,
        };
        setSelection({ type: "bubble", id: b.id });
        return { ...s, bubbles: [...s.bubbles, b] };
      });
    },
    [commit]
  );

  const setPage = useCallback(
    (page: PageSize) => {
      commit((s) => ({ ...s, page }));
    },
    [commit]
  );

  const setBg = useCallback(
    (bg: string) => commit((s) => ({ ...s, bg })),
    [commit]
  );

  const bringToFront = useCallback(() => {
    if (!selection) return;
    commit((s) => {
      if (selection.type === "panel") {
        const target = s.panels.find((p) => p.id === selection.id);
        if (!target) return s;
        return {
          ...s,
          panels: [...s.panels.filter((p) => p.id !== selection.id), target],
        };
      }
      const target = s.bubbles.find((b) => b.id === selection.id);
      if (!target) return s;
      return {
        ...s,
        bubbles: [...s.bubbles.filter((b) => b.id !== selection.id), target],
      };
    });
  }, [commit, selection]);

  const clearAll = useCallback(() => {
    commit((s) => ({ ...s, panels: [], bubbles: [] }));
    setSelection(null);
  }, [commit]);

  const applyLayout = useCallback(
    (template: LayoutTemplate, keepBubbles = true) => {
      commit((s) => ({
        ...s,
        panels: buildLayout(template, s.page),
        bubbles: keepBubbles ? s.bubbles : [],
      }));
      setSelection(null);
    },
    [commit]
  );

  return {
    state,
    selection,
    setSelection,
    beginDrag,
    live,
    endDrag,
    commit,
    undo,
    redo,
    canUndo,
    canRedo,
    addPanel,
    addBubble,
    deleteSelected,
    updatePanel,
    updateBubble,
    setPage,
    setBg,
    bringToFront,
    clearAll,
    applyLayout,
  };
}
