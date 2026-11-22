import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { FULL_VIEW, SPOTS, renderMap, type View } from "@questline/t-map";

/** Map units across the screen at the closest zoom: about six station names. */
const MIN_W = 220;
const MAX_W = FULL_VIEW.w * 1.08;
const TAP_SLOP = 8; // px a finger may wander and still be a tap
const PICK_RADIUS = 28; // px around a station that picks it

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The full T map, crisp at any zoom: the SVG's viewBox is moved, never the pixels.
 * Drag to pan, pinch or scroll to zoom, double-tap to zoom in, tap a station to pick it.
 * Arrow keys pan and +/- zoom when the map has focus.
 */
export function MapViewer({
  stamped,
  focus,
  picked,
  onPick,
}: {
  stamped: string[];
  /** Station to centre on at first. Without one the whole map shows. */
  focus?: string;
  picked?: string | null;
  onPick: (id: string | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const view = useRef<View>({ ...FULL_VIEW });
  const size = useRef({ w: 1, h: 1 });
  const key = [...stamped].sort().join();
  const svg = useMemo(() => renderMap({ stamped }), [key]);

  const svgEl = () => box.current?.querySelector("svg") ?? null;
  const pickRing = () => box.current?.querySelector<SVGCircleElement>("circle[data-pick]") ?? null;

  /** Keep the aspect of the box, the zoom in range, and some of the map on screen. */
  const settle = (v: View): View => {
    const { w: cw, h: ch } = size.current;
    const w = clamp(v.w, MIN_W, Math.max(MAX_W, (FULL_VIEW.h * 1.08 * cw) / ch));
    const h = (w * ch) / cw;
    const cx = clamp(v.x + v.w / 2, FULL_VIEW.x, FULL_VIEW.x + FULL_VIEW.w);
    const cy = clamp(v.y + v.h / 2, FULL_VIEW.y, FULL_VIEW.y + FULL_VIEW.h);
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  };
  const apply = (v: View) => {
    view.current = settle(v);
    const el = svgEl();
    const { x, y, w, h } = view.current;
    if (el) el.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  };
  /** Zoom by f (below 1 zooms in) keeping the map point under (px, py) in place. */
  const zoomAt = (f: number, px: number, py: number) => {
    const v = view.current;
    const mx = v.x + (px / size.current.w) * v.w;
    const my = v.y + (py / size.current.h) * v.h;
    const w = clamp(v.w * f, MIN_W, MAX_W * 2);
    const h = (w * size.current.h) / size.current.w;
    apply({ x: mx - (px / size.current.w) * w, y: my - (py / size.current.h) * h, w, h });
  };
  const fit = () => {
    const { w: cw, h: ch } = size.current;
    const w = Math.max(FULL_VIEW.w, (FULL_VIEW.h * cw) / ch);
    const h = (w * ch) / cw;
    apply({ x: FULL_VIEW.x + FULL_VIEW.w / 2 - w / 2, y: FULL_VIEW.y + FULL_VIEW.h / 2 - h / 2, w, h });
  };

  // Size, first view, and re-fitting on rotation.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const first = size.current.w === 1;
      size.current = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
      if (first) {
        const at = focus ? SPOTS[focus] : undefined;
        if (at) {
          const w = 640;
          const h = (w * size.current.h) / size.current.w;
          apply({ x: at.x - w / 2, y: at.y - h / 2, w, h });
        } else fit();
      } else apply(view.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The SVG is replaced when the stamps change: give it back its view.
  useEffect(() => {
    const el = svgEl();
    if (!el) return;
    el.setAttribute("width", "100%");
    el.setAttribute("height", "100%");
    el.setAttribute("preserveAspectRatio", "xMidYMid meet");
    apply(view.current);
  }, [svg]);

  // A ring round the picked station.
  useEffect(() => {
    const el = svgEl();
    if (!el) return;
    pickRing()?.remove();
    const at = picked ? SPOTS[picked] : undefined;
    if (!at) return;
    const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ring.setAttribute("data-pick", "");
    ring.setAttribute("cx", String(at.x));
    ring.setAttribute("cy", String(at.y));
    ring.setAttribute("r", "22");
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "#231F20");
    ring.setAttribute("stroke-width", "3");
    ring.setAttribute("stroke-dasharray", "6 5");
    el.appendChild(ring);
  }, [picked, svg]);

  // Pointers: one drags, two pinch. A short, still press is a tap.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let start: { view: View; pts: { x: number; y: number }[] } | null = null;
    let tap: { x: number; y: number; t: number } | null = null;
    let lastTap: { x: number; y: number; t: number } | null = null;

    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const begin = () => {
      start = { view: { ...view.current }, pts: [...pts.values()].map((p) => ({ ...p })) };
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // a pointer the browser no longer tracks: carry on without capture
      }
      const p = local(e);
      pts.set(e.pointerId, p);
      tap = pts.size === 1 ? { ...p, t: e.timeStamp } : null;
      begin();
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId) || !start) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      const now = [...pts.values()];
      const s = start.view.w / size.current.w;
      if (now.length === 1 && start.pts.length === 1) {
        const dx = now[0]!.x - start.pts[0]!.x, dy = now[0]!.y - start.pts[0]!.y;
        if (tap && Math.hypot(dx, dy) > TAP_SLOP) tap = null;
        apply({ ...start.view, x: start.view.x - dx * s, y: start.view.y - dy * s });
      } else if (now.length >= 2 && start.pts.length >= 2) {
        const [a0, b0] = start.pts as [{ x: number; y: number }, { x: number; y: number }];
        const [a1, b1] = now as [{ x: number; y: number }, { x: number; y: number }];
        const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y), d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
        if (d0 < 1 || d1 < 1) return;
        const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }, m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
        // the map point under the first midpoint stays under the fingers
        const mx = start.view.x + m0.x * s, my = start.view.y + m0.y * s;
        const w = clamp(start.view.w * (d0 / d1), MIN_W, MAX_W * 2);
        const s1 = w / size.current.w;
        apply({ x: mx - m1.x * s1, y: my - m1.y * s1, w, h: w * (size.current.h / size.current.w) });
      }
    };
    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e);
      pts.delete(e.pointerId);
      if (tap && pts.size === 0 && e.timeStamp - tap.t < 350) {
        if (lastTap && e.timeStamp - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
          zoomAt(0.5, p.x, p.y);
          lastTap = null;
        } else {
          lastTap = { ...p, t: e.timeStamp };
          pick(p.x, p.y);
        }
      }
      tap = null;
      begin(); // the remaining finger, if any, carries on panning from here
    };
    const pick = (px: number, py: number) => {
      const v = view.current;
      const s = v.w / size.current.w;
      const mx = v.x + px * s, my = v.y + py * s;
      let best: string | null = null;
      let bestD = PICK_RADIUS * s;
      for (const [id, at] of Object.entries(SPOTS)) {
        const d = Math.hypot(at.x - mx, at.y - my);
        if (d < bestD) {
          best = id;
          bestD = d;
        }
      }
      onPickRef.current(best);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      // a trackpad pinch arrives as ctrl+wheel with small deltas
      const k = e.ctrlKey ? 0.01 : 0.0015;
      zoomAt(Math.exp(e.deltaY * k), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, []);

  const onKey = (e: KeyboardEvent) => {
    const v = view.current;
    const step = v.w * 0.12;
    const c = { x: size.current.w / 2, y: size.current.h / 2 };
    const moves: Record<string, () => void> = {
      ArrowLeft: () => apply({ ...v, x: v.x - step }),
      ArrowRight: () => apply({ ...v, x: v.x + step }),
      ArrowUp: () => apply({ ...v, y: v.y - step }),
      ArrowDown: () => apply({ ...v, y: v.y + step }),
      "+": () => zoomAt(0.7, c.x, c.y),
      "=": () => zoomAt(0.7, c.x, c.y),
      "-": () => zoomAt(1 / 0.7, c.x, c.y),
      "0": fit,
      Escape: () => onPick(null),
    };
    const run = moves[e.key];
    if (run) {
      e.preventDefault();
      run();
    }
  };

  return (
    <div className="cl-viewer">
      <div
        ref={box}
        className="cl-viewer__map"
        tabIndex={0}
        role="application"
        aria-label="Map of the T. Drag to move, pinch or use plus and minus to zoom, tap a station for details."
        onKeyDown={onKey}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="cl-viewer__zoom">
        <button type="button" aria-label="Zoom in" onClick={() => zoomAt(0.6, size.current.w / 2, size.current.h / 2)}>
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomAt(1 / 0.6, size.current.w / 2, size.current.h / 2)}>
          −
        </button>
        <button type="button" aria-label="Show the whole map" onClick={fit} className="cl-viewer__fit">
          ALL
        </button>
      </div>
    </div>
  );
}
