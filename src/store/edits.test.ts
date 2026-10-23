import { describe, expect, it } from 'vitest';
import { NO_EDITS } from '../tiling/types';
import { dropRoomEdits, HISTORY_LIMIT, hasEdits, layoutChangeResetsEdits, pushHistory, toggleKey } from './edits';

describe('regras dos ajustes manuais', () => {
  it('hasEdits', () => {
    expect(hasEdits(NO_EDITS)).toBe(false);
    expect(hasEdits({ ...NO_EDITS, rowShift: { 'a:1': 10 } })).toBe(true);
    expect(hasEdits({ ...NO_EDITS, removed: ['a:1:2'] })).toBe(true);
  });

  it('mudanças que mexem na grade desfazem os ajustes; as outras não', () => {
    expect(layoutChangeResetsEdits({ pattern: 'running' })).toBe(true);
    expect(layoutChangeResetsEdits({ rotationDeg: 90 })).toBe(true);
    expect(layoutChangeResetsEdits({ origin: { x: 1, y: 2 } })).toBe(true);
    expect(layoutChangeResetsEdits({ minCutCm: 3 })).toBe(false);
    expect(layoutChangeResetsEdits({ kerfCm: 0.2 })).toBe(false);
  });

  it('histórico guarda no máximo o limite, descartando os mais antigos', () => {
    let h: number[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = pushHistory(h, i);
    expect(h).toHaveLength(HISTORY_LIMIT);
    expect(h[0]).toBe(5);
  });

  it('toggleKey liga e desliga uma chave na lista', () => {
    expect(toggleKey(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleKey(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('dropRoomEdits', () => {
  it('tira os ajustes dos cômodos dados e mantém os dos outros', () => {
    const edits = { rowShift: { 'a:0': 3, 'b:2': 1 }, rowOrder: { 'a:1': [1, 0] }, removed: ['a:0:1', 'b:2:0'], hidden: ['a:3:3'] };
    expect(dropRoomEdits(edits, new Set(['a']))).toEqual({ rowShift: { 'b:2': 1 }, rowOrder: {}, removed: ['b:2:0'], hidden: [] });
  });

  it('não confunde cômodos cujo id começa igual', () => {
    const edits = { ...NO_EDITS, removed: ['ab:0:0', 'a:0:0'] };
    expect(dropRoomEdits(edits, new Set(['a'])).removed).toEqual(['ab:0:0']);
  });
});

