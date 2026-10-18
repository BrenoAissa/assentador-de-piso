import { Shape, Vector2 } from 'three';
import { pointInPolygon } from '../geometry/polygon';
import type { Ring } from '../geometry/types';

/**
 * Um Shape por anel. O y da planta vira −y do Shape: com a malha girada −90° em x,
 * o Shape deita no chão com a planta em x/z e a extrusão para cima.
 */
export function ringsToShapes(rings: Ring[]): Shape[] {
  return rings.map((ring) => new Shape(ring.map((p) => new Vector2(p.x, -p.y))));
}

export interface WallSegment {
  /** Centro da parede no chão (x da planta, y da planta). */
  cx: number;
  cz: number;
  length: number;
  /** Ângulo da aresta na planta, em radianos. */
  angle: number;
}

/** Paredes por fora do cômodo, estendidas meia espessura em cada ponta para fechar os cantos. */
export function wallSegments(ring: Ring, thickness: number): WallSegment[] {
  const out: WallSegment[] = [];
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    let nx = -dy / len;
    let ny = dx / len;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    if (pointInPolygon({ x: mx + nx * 0.5, y: my + ny * 0.5 }, ring)) {
      nx = -nx;
      ny = -ny;
    }
    out.push({
      cx: mx + (nx * thickness) / 2,
      cz: my + (ny * thickness) / 2,
      length: len + thickness,
      angle: Math.atan2(dy, dx),
    });
  }
  return out;
}
