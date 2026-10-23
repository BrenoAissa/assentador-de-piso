import {
  BoxGeometry,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  ShapeGeometry,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from 'three';
import { bbox } from '../geometry/polygon';
import { pieceFill } from '../report/PlanSvg';
import type { Piece, RoomCm } from '../tiling/types';
import { ringsToShapes, TILE_H, WALL_H, WALL_T, wallSegments } from './geometry';

const FOV = 30;
const FLAT = -Math.PI / 2;

/** Distância da câmera (olhando reto para baixo) para a planta `w × h` caber na imagem. */
export function topViewDistance(w: number, h: number, aspect: number, fovDeg: number, margin = 1.08): number {
  const half = Math.tan((fovDeg * Math.PI) / 360);
  return Math.max((h * margin) / 2 / half, (w * margin) / 2 / (half * aspect));
}

/**
 * Foto do piso em 3D visto de cima, como PNG (data URL), para a folha de impressão.
 * Monta uma cena própria (sem o visualizador interativo), renderiza uma vez e libera a GPU.
 */
export function renderTopView(result: { pieces: Piece[] }, rooms: RoomCm[], width = 1800): string {
  const b = bbox(rooms.map((r) => r.ring));
  const aspect = Math.min(2.5, Math.max(0.5, b.w / Math.max(1, b.h)));
  const height = Math.round(width / aspect);
  const cx = b.x + b.w / 2;
  const cz = b.y + b.h / 2;

  const scene = new Scene();
  scene.background = new Color('#ffffff');
  scene.add(new HemisphereLight('#ffffff', '#9aa1a7', 1.3));
  const sun = new DirectionalLight('#ffffff', 1.4);
  sun.position.set(cx + b.w, Math.max(b.w, b.h) * 1.6, cz + b.h * 0.6);
  scene.add(sun);

  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const add = (geometry: BufferGeometry, color: string, setup?: (m: Mesh) => void) => {
    const material = new MeshStandardMaterial({ color, roughness: 0.6 });
    const mesh = new Mesh(geometry, material);
    setup?.(mesh);
    scene.add(mesh);
    geometries.push(geometry);
    materials.push(material);
  };

  for (const room of rooms) {
    add(new ShapeGeometry(ringsToShapes([room.ring])), '#6b7177', (m) => {
      m.rotation.x = FLAT;
      m.position.y = 0.1;
    });
    for (const s of wallSegments(room.ring, WALL_T)) {
      add(new BoxGeometry(s.length, WALL_H, WALL_T), '#b9bec2', (m) => {
        m.position.set(s.cx, WALL_H / 2, s.cz);
        m.rotation.y = -s.angle;
      });
    }
  }
  for (const p of result.pieces) {
    if (p.removed) continue;
    add(new ExtrudeGeometry(ringsToShapes(p.shape), { depth: TILE_H, bevelEnabled: false }), pieceFill(p), (m) => {
      m.rotation.x = FLAT;
      m.position.y = 0.4;
    });
  }

  // câmera bem acima do centro, olhando para baixo; "para cima" da imagem = norte da planta
  const camera = new PerspectiveCamera(FOV, width / height, 1, 1e6);
  camera.position.set(cx, topViewDistance(b.w, b.h, width / height, FOV) + WALL_H, cz);
  camera.up.set(0, 0, -1);
  camera.lookAt(cx, 0, cz);

  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally {
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
