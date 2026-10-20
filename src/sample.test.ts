import { describe, expect, it } from 'vitest';
import { SAMPLE_ORIGIN, isSample, sampleProject } from './sample';
import { canAdvance, roomsInCm } from './store/issues';
import { solveLayout } from './tiling/engine';
import { emptyProject } from './types';

describe('lar de exemplo', () => {
  it('passa direto por todas as etapas', () => {
    const p = sampleProject();
    expect([1, 2, 3].map((s) => canAdvance(p, s as 1 | 2 | 3).ok)).toEqual([true, true, true]);
  });

  it('o começo fixo da tela inicial é o mesmo que o app escolhe sozinho', () => {
    const p = sampleProject();
    const r = solveLayout(roomsInCm(p), p.tile, p.layout);
    expect(r.originUsed).toEqual(SAMPLE_ORIGIN);
    expect(r.summary.slivers).toBe(0);
  });

  it('é reconhecido como exemplo; um projeto comum não', () => {
    expect(isSample(sampleProject())).toBe(true);
    expect(isSample(emptyProject())).toBe(false);
  });
});
