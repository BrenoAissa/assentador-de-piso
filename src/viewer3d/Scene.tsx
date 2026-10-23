import { Bounds, OrbitControls } from '@react-three/drei';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, Color, ExtrudeGeometry, InstancedMesh, Matrix4, ShapeGeometry } from 'three';
import { bbox } from '../geometry/polygon';
import { PIECE_FILL, pieceFill } from '../report/PlanSvg';
import type { Piece, RoomCm } from '../tiling/types';
import { ringsToShapes, TILE_H, WALL_H, WALL_T, wallSegments } from './geometry';
import Hint, { isTouch } from '../ui/Hint';

const INSTANCE_ABOVE = 3000;
const SELECTED = '#f2c230';
const FLAT = -Math.PI / 2;

interface Props {
  result: { pieces: Piece[] };
  rooms: RoomCm[];
  selected: string | null;
  onSelect(key: string | null): void;
}

/** Clique de verdade: ignora o soltar do mouse depois de girar a câmera. */
const isClick = (e: ThreeEvent<MouseEvent>) => e.delta < 5;

function PieceMesh({ piece, selected, onSelect }: { piece: Piece; selected: boolean; onSelect(key: string): void }) {
  const geometry = useMemo(
    () => new ExtrudeGeometry(ringsToShapes(piece.shape), { depth: TILE_H, bevelEnabled: false }),
    [piece.shape],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      rotation-x={FLAT}
      position-y={0.4}
      onClick={(e) => {
        if (!isClick(e)) return;
        e.stopPropagation();
        onSelect(piece.key);
      }}
    >
      <meshStandardMaterial color={selected ? SELECTED : pieceFill(piece)} roughness={0.55} />
    </mesh>
  );
}

/** Peças inteiras como instâncias (plantas com muitas peças). */
function FullTiles({ pieces, selected, onSelect }: { pieces: Piece[]; selected: string | null; onSelect(key: string): void }) {
  const ref = useRef<InstancedMesh>(null);
  const box = useMemo(() => new BoxGeometry(1, TILE_H, 1), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const base = new Color(PIECE_FILL.full);
    const hi = new Color(SELECTED);
    pieces.forEach((p, i) => {
      const r = p.tileRect;
      m.makeScale(r.w, 1, r.h).setPosition(r.x + r.w / 2, 0.4 + TILE_H / 2, r.y + r.h / 2);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, p.key === selected ? hi : base);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [pieces, selected]);
  return (
    <instancedMesh
      ref={ref}
      args={[box, undefined, pieces.length]}
      onClick={(e) => {
        if (!isClick(e) || e.instanceId === undefined) return;
        e.stopPropagation();
        onSelect(pieces[e.instanceId].key);
      }}
    >
      <meshStandardMaterial roughness={0.55} />
    </instancedMesh>
  );
}

function RoomBase({ room }: { room: RoomCm }) {
  const geometry = useMemo(() => new ShapeGeometry(ringsToShapes([room.ring])), [room.ring]);
  return (
    <mesh geometry={geometry} rotation-x={FLAT} position-y={0.1}>
      <meshStandardMaterial color="#6b7177" roughness={0.9} />
    </mesh>
  );
}

function Walls({ room }: { room: RoomCm }) {
  const segs = useMemo(() => wallSegments(room.ring, WALL_T), [room.ring]);
  return (
    <>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.cx, WALL_H / 2, s.cz]} rotation-y={-s.angle} raycast={() => null}>
          <boxGeometry args={[s.length, WALL_H, WALL_T]} />
          <meshStandardMaterial color="#9aa1a7" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

export default function Scene({ result, rooms, selected, onSelect }: Props) {
  const b = useMemo(() => bbox(rooms.map((r) => r.ring)), [rooms]);
  const cx = b.x + b.w / 2;
  const cz = b.y + b.h / 2;
  const size = Math.max(b.w, b.h, 100);
  const placed = useMemo(() => result.pieces.filter((p) => !p.removed), [result]);
  const many = placed.length > INSTANCE_ABOVE;
  const full = useMemo(() => placed.filter((p) => p.kind === 'full' && !p.hidden), [placed]);
  const meshes = many ? placed.filter((p) => p.kind !== 'full' || p.hidden) : placed;

  return (
    <div className="canvas canvas-3d">
      <Canvas
        camera={{ position: [cx, size * 1.2, cz + size * 1.0], fov: 45, near: 1, far: size * 20 }}
        dpr={[1, 2]}
        onPointerMissed={() => onSelect(null)}
      >
        <color attach="background" args={['#eef0ee']} />
        <hemisphereLight args={['#ffffff', '#9aa1a7', 1.2]} />
        <directionalLight position={[cx + size, size * 1.6, cz + size * 0.6]} intensity={1.5} />
        {/* enquadra o piso em qualquer proporção de tela e ao redimensionar */}
        <Bounds fit clip observe margin={1.05}>
          {rooms.map((r) => (
            <RoomBase key={r.id} room={r} />
          ))}
        </Bounds>
        {many && <FullTiles pieces={full} selected={selected} onSelect={onSelect} />}
        {meshes.map((p) => (
          <PieceMesh key={p.key} piece={p} selected={p.key === selected} onSelect={onSelect} />
        ))}
        {rooms.map((r) => (
          <Walls key={r.id} room={r} />
        ))}
        <OrbitControls target={[cx, 0, cz]} maxPolarAngle={Math.PI / 2.1} minDistance={50} maxDistance={size * 6} makeDefault />
      </Canvas>
      <Hint>
        {isTouch()
          ? 'Arraste para girar e use dois dedos para aproximar ou mover. Toque numa peça para ver o recorte.'
          : 'Arraste para girar, use a roda para aproximar e o botão direito para mover. Clique numa peça para ver o recorte.'}
      </Hint>
    </div>
  );
}
