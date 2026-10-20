import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Point, Rect } from '../geometry/types';

export type View = { k: number; tx: number; ty: number };

const MIN_K = 0.02;
const MAX_K = 40;
const clampK = (k: number) => Math.min(Math.max(k, MIN_K), MAX_K);

/**
 * Zoom com a roda (em torno do cursor) ou com dois dedos (pinça, que também arrasta a vista), e
 * enquadramento de um conteúdo de `w × h` unidades dentro do elemento. `focus` é a parte do
 * conteúdo a enquadrar (padrão: tudo). A conversão tela → conteúdo fica em `toWorld`.
 *
 * Quando o segundo dedo encosta, o gesto passa a ser só da vista: o que o primeiro dedo tinha
 * começado recebe um `pointercancel` (cada tela desfaz o arraste) e os toques seguintes não
 * chegam a ela até os dois dedos saírem.
 */
export function usePanZoom(ref: RefObject<HTMLElement | null>, w: number, h: number, fitToken = 0, focus?: Rect) {
  const [view, setView] = useState<View>({ k: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const fx = focus?.x ?? 0;
  const fy = focus?.y ?? 0;
  const fw = focus?.w ?? w;
  const fh = focus?.h ?? h;

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el || fw <= 0 || fh <= 0) return;
    const { width, height } = el.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const k = Math.min(width / fw, height / fh) * 0.92;
    setView({ k, tx: (width - fw * k) / 2 - fx * k, ty: (height - fh * k) / 2 - fy * k });
  }, [ref, fx, fy, fw, fh]);

  useEffect(() => {
    fit();
  }, [fit, fitToken]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setView((v) => {
        const k = clampK(v.k * Math.exp(-e.deltaY * 0.0015));
        const f = k / v.k;
        return { k, tx: cx - (cx - v.tx) * f, ty: cy - (cy - v.ty) * f };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const touches = new Map<number, Point>();
    let pinch: { d: number; mid: Point; view: View } | null = null;
    /** O cancelamento que este hook manda para a tela não conta como toque. */
    const own = new WeakSet<Event>();
    const local = (e: PointerEvent): Point => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pair = () => {
      const [a, b] = [...touches.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || own.has(e)) return;
      touches.set(e.pointerId, local(e));
      if (pinch) return e.stopPropagation();
      if (touches.size !== 2) return;
      pinch = { ...pair(), view: viewRef.current };
      e.stopPropagation();
      const first = [...touches.keys()][0];
      const cancel = new PointerEvent('pointercancel', { bubbles: true, pointerId: first, pointerType: 'touch' });
      own.add(cancel);
      e.target?.dispatchEvent(cancel);
    };
    const move = (e: PointerEvent) => {
      if (own.has(e) || !touches.has(e.pointerId)) return;
      touches.set(e.pointerId, local(e));
      if (!pinch) return;
      e.stopPropagation();
      if (touches.size < 2) return;
      const { d, mid } = pair();
      const v0 = pinch.view;
      const k = clampK((v0.k * d) / pinch.d);
      // o ponto da planta que estava entre os dedos continua entre os dedos
      const wx = (pinch.mid.x - v0.tx) / v0.k;
      const wy = (pinch.mid.y - v0.ty) / v0.k;
      setView({ k, tx: mid.x - wx * k, ty: mid.y - wy * k });
    };
    const up = (e: PointerEvent) => {
      if (own.has(e) || !touches.has(e.pointerId)) return;
      touches.delete(e.pointerId);
      if (!pinch) return;
      e.stopPropagation();
      if (touches.size === 0) pinch = null;
    };
    const opts = { capture: true };
    el.addEventListener('pointerdown', down, opts);
    el.addEventListener('pointermove', move, opts);
    el.addEventListener('pointerup', up, opts);
    el.addEventListener('pointercancel', up, opts);
    return () => {
      el.removeEventListener('pointerdown', down, opts);
      el.removeEventListener('pointermove', move, opts);
      el.removeEventListener('pointerup', up, opts);
      el.removeEventListener('pointercancel', up, opts);
    };
  }, [ref]);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = ref.current!.getBoundingClientRect();
      const v = viewRef.current;
      return { x: (clientX - rect.left - v.tx) / v.k, y: (clientY - rect.top - v.ty) / v.k };
    },
    [ref],
  );

  const toScreen = useCallback((p: Point): Point => {
    const v = viewRef.current;
    return { x: p.x * v.k + v.tx, y: p.y * v.k + v.ty };
  }, []);

  return { view, setView, fit, toWorld, toScreen };
}
