import { describe, expect, it } from 'vitest';
import { rectRing } from '../tiling/testUtils';
import { newFloor } from '../floors';
import { DEFAULT_TILE } from '../tiling/types';
import { validateTile } from '../tiling/validate';
import { emptyProject, type Project, type Room } from '../types';
import { canAdvance, computeIssues, floorInputs, roomsInCm } from './issues';

function room(patch: Partial<Room> = {}): Room {
  return { id: 'r1', name: 'Sala', polygonPx: rectRing(0, 0, 600, 400), receivesTile: true, issues: [], ...patch };
}

describe('computeIssues', () => {
  it('cômodo bom não tem pendências', () => {
    expect(computeIssues(room())).toEqual([]);
  });

  it('polígono de 2 pontos é inválido', () => {
    expect(computeIssues(room({ polygonPx: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }))).toContain('invalid-polygon');
  });

  it('nome vazio é pendência', () => {
    expect(computeIssues(room({ name: '  ' }))).toContain('unnamed');
  });

  it('confiança 0,4 é baixa', () => {
    expect(computeIssues(room({ confidence: 0.4 }))).toContain('low-confidence');
    expect(computeIssues(room({ confidence: 0.8 }))).not.toContain('low-confidence');
  });

  it('mantém pendências extras sem duplicar', () => {
    expect(computeIssues(room(), ['scale-mismatch', 'scale-mismatch'])).toEqual(['scale-mismatch']);
  });
});

describe('roomsInCm', () => {
  it('converte px para cm e ignora cômodos sem piso ou inválidos', () => {
    const p = emptyProject();
    p.scale = { pxPerCm: 2, source: 'manual', confidence: 1 };
    p.rooms = [
      room(),
      room({ id: 'r2', receivesTile: false }),
      room({ id: 'r3', polygonPx: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }),
    ];
    const rooms = roomsInCm(p);
    expect(rooms.map((r) => r.id)).toEqual(['r1']);
    expect(rooms[0].ring[2]).toEqual({ x: 300, y: 200 });
  });

  it('cômodo sem nome recebe o mesmo rótulo do editor ("Cômodo N")', () => {
    const p = emptyProject();
    p.scale = { pxPerCm: 2, source: 'manual', confidence: 1 };
    p.rooms = [room(), room({ id: 'r2', name: '' }), room({ id: 'r3', name: '' })];
    expect(roomsInCm(p).map((r) => r.name)).toEqual(['Sala', 'Cômodo 2', 'Cômodo 3']);
  });

  it('sem escala não há cômodos em cm', () => {
    const p = emptyProject();
    p.rooms = [room()];
    expect(roomsInCm(p)).toEqual([]);
  });
});

describe('canAdvance', () => {
  it('passo 1 exige a planta', () => {
    expect(canAdvance(emptyProject(), 1)).toEqual({ ok: false, reason: 'Envie a planta para continuar.' });
  });

  it('passo 2 sem escala não avança e diz o motivo', () => {
    const p = emptyProject();
    p.rooms = [room()];
    const r = canAdvance(p, 2);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/escala/i);
  });

  it('passo 2 sem cômodo marcado não avança', () => {
    const p = emptyProject();
    p.scale = { pxPerCm: 2, source: 'manual', confidence: 1 };
    p.rooms = [room({ receivesTile: false })];
    expect(canAdvance(p, 2).reason).toMatch(/cômodo/i);
  });

  it('passo 3 com peça inválida não avança', () => {
    const p = emptyProject();
    p.floors[0].tile.lengthCm = 0;
    expect(canAdvance(p, 3)).toEqual({ ok: false, reason: 'Informe o comprimento e a largura da peça.' });
  });

  it('passo 2 completo avança', () => {
    const p = emptyProject();
    p.scale = { pxPerCm: 2, source: 'manual', confidence: 1 };
    p.rooms = [room()];
    expect(canAdvance(p, 2)).toEqual({ ok: true });
  });
});

describe('pisos no cálculo', () => {
  const twoFloors = (): Project => ({
    ...emptyProject(),
    scale: { pxPerCm: 1, source: 'manual', confidence: 1 },
    rooms: [room({ id: 'a' }), room({ id: 'b', floorId: 'piso-2' })],
    floors: [newFloor('piso-1'), newFloor('piso-2', { ...DEFAULT_TILE, lengthCm: 85, widthCm: 85 }), newFloor('piso-3')],
  });

  it('floorInputs agrupa os cômodos por piso e deixa de fora piso sem cômodos', () => {
    const inputs = floorInputs(twoFloors());
    expect(inputs.map((f) => f.id)).toEqual(['piso-1', 'piso-2']);
    expect(inputs[0].rooms.map((r) => r.id)).toEqual(['a']);
    expect(inputs[1].rooms.map((r) => r.id)).toEqual(['b']);
    expect(inputs[1].tile.lengthCm).toBe(85);
  });

  it('cômodo que não recebe piso não entra em nenhum piso', () => {
    const p = twoFloors();
    p.rooms[1] = { ...p.rooms[1], receivesTile: false };
    expect(floorInputs(p).map((f) => f.id)).toEqual(['piso-1']);
  });

  it('com dois pisos, o erro de medida diz de qual piso é', () => {
    const p = twoFloors();
    p.floors[1].tile.lengthCm = 0;
    const erro = validateTile(p.floors[1].tile, p.floors[1].layout)[0];
    expect(canAdvance(p, 3)).toEqual({ ok: false, reason: `${p.floors[1].name}: ${erro}` });
  });

  it('com um piso só, o erro de medida é o de sempre', () => {
    const p = emptyProject();
    p.floors[0].tile.lengthCm = 0;
    expect(canAdvance(p, 3)).toEqual({ ok: false, reason: validateTile(p.floors[0].tile, p.floors[0].layout)[0] });
  });
});

