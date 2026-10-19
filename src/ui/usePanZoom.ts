import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Point, Rect } from '../geometry/types';

export type View = { k: number; tx: number; ty: number };

/**
 * Zoom com a roda (em torno do cursor) e enquadramento de um conteúdo de `w × h` unidades
 * dentro do elemento. `focus` é a parte do conteúdo a enquadrar (padrão: tudo). A conversão
 * tela → conteúdo fica em `toWorld`.
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
        const k = Math.min(Math.max(v.k * Math.exp(-e.deltaY * 0.0015), 0.02), 40);
        const f = k / v.k;
        return { k, tx: cx - (cx - v.tx) * f, ty: cy - (cy - v.ty) * f };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
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
