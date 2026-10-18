import { describe, expect, it } from 'vitest';
import { rectRing } from '../tiling/testUtils';
import { emptyProject, type Room } from '../types';
import { canAdvance, computeIssues, roomsInCm } from './issues';

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
    p.tile.lengthCm = 0;
    expect(canAdvance(p, 3)).toEqual({ ok: false, reason: 'Informe o comprimento e a largura da peça.' });
  });

  it('passo 2 completo avança', () => {
    const p = emptyProject();
    p.scale = { pxPerCm: 2, source: 'manual', confidence: 1 };
    p.rooms = [room()];
    expect(canAdvance(p, 2)).toEqual({ ok: true });
  });
});
