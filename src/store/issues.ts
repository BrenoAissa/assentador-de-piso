import { isSimple, scaleRing } from '../geometry/polygon';
import { roomFloorId } from '../floors';
import type { FloorInput, RoomCm } from '../tiling/types';
import { validateTile } from '../tiling/validate';
import type { Project, Room, RoomIssue } from '../types';

export const LOW_CONFIDENCE = 0.6;

export function computeIssues(room: Room, extra: RoomIssue[] = []): RoomIssue[] {
  const issues = new Set<RoomIssue>(extra);
  if (!isSimple(room.polygonPx)) issues.add('invalid-polygon');
  if (!room.name.trim()) issues.add('unnamed');
  if (room.confidence !== undefined && room.confidence < LOW_CONFIDENCE) issues.add('low-confidence');
  return [...issues];
}

export const ISSUE_TEXT: Record<RoomIssue, string> = {
  'low-confidence': 'Contorno detectado com pouca confiança. Confira.',
  'scale-mismatch': 'As medidas lidas não batem com a escala. Confira o contorno.',
  unnamed: 'Dê um nome ao cômodo.',
  'invalid-polygon': 'Contorno inválido (linhas se cruzam). Corrija os vértices.',
};

/** Cômodos que recebem piso, válidos, em cm. Vazio enquanto não houver escala. */
export function roomsInCm(project: Project): RoomCm[] {
  const { scale } = project;
  if (!scale) return [];
  return project.rooms
    .map((r, i) => ({ r, label: r.name.trim() || `Cômodo ${i + 1}` }))
    .filter(({ r }) => r.receivesTile && isSimple(r.polygonPx))
    .map(({ r, label }) => ({
      id: r.id,
      name: label,
      ring: scaleRing(r.polygonPx, 1 / scale.pxPerCm),
      ...(r.origin ? { origin: r.origin } : {}),
      ...(r.start ? { start: r.start } : {}),
    }));
}

/** Pisos com os seus cômodos, prontos para o cálculo; piso sem cômodos fica de fora. */
export function floorInputs(project: Project): FloorInput[] {
  const cm = roomsInCm(project);
  const floorOf = new Map(project.rooms.map((r) => [r.id, roomFloorId(project, r)]));
  return project.floors
    .map((f) => ({ id: f.id, tile: f.tile, layout: f.layout, rooms: cm.filter((r) => floorOf.get(r.id) === f.id) }))
    .filter((f) => f.rooms.length > 0);
}

export type Step = 1 | 2 | 3 | 4;

export function canAdvance(project: Project, step: Step): { ok: boolean; reason?: string } {
  if (step === 1 && !project.plan) return { ok: false, reason: 'Envie a planta para continuar.' };
  if (step === 2) {
    if (!project.scale) return { ok: false, reason: 'Defina a escala: use "Calibrar" e informe uma medida conhecida.' };
    if (roomsInCm(project).length === 0) {
      return { ok: false, reason: 'Marque pelo menos um cômodo válido para receber o piso.' };
    }
  }
  if (step === 3) {
    for (const f of project.floors) {
      const errors = validateTile(f.tile, f.layout);
      if (errors.length > 0) return { ok: false, reason: project.floors.length > 1 ? `${f.name}: ${errors[0]}` : errors[0] };
    }
  }
  return { ok: true };
}
