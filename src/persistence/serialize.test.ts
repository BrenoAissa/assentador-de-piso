import { describe, expect, it } from 'vitest';
import { rectRing } from '../tiling/testUtils';
import { emptyProject } from '../types';
import { parseProject, serializeProject } from './serialize';

describe('serializeProject / parseProject', () => {
  it('ida e volta preserva o projeto e os bytes da imagem', async () => {
    const p = emptyProject();
    p.plan = { imageId: 'img1', widthPx: 800, heightPx: 600, sourceName: 'planta.png' };
    p.scale = { pxPerCm: 1.5, source: 'ocr', confidence: 0.9 };
    p.rooms = [{ id: 'a', name: 'Sala', polygonPx: rectRing(10, 10, 300, 200), receivesTile: true, issues: [] }];
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 255, 128, 7]);
    const image = new Blob([bytes], { type: 'image/png' });

    const json = await serializeProject(p, image);
    const back = await parseProject(json);

    expect(back.project).toEqual(p);
    expect(back.image).not.toBeNull();
    expect(back.image!.type).toBe('image/png');
    expect(new Uint8Array(await back.image!.arrayBuffer())).toEqual(bytes);
  });

  it('projeto sem imagem', async () => {
    const back = await parseProject(await serializeProject(emptyProject(), null));
    expect(back.image).toBeNull();
    expect(back.project).toEqual(emptyProject());
  });

  it('arquivo que não é projeto gera erro claro', async () => {
    await expect(parseProject('{"foo": 1}')).rejects.toThrow('Arquivo de projeto inválido');
    await expect(parseProject('não é json')).rejects.toThrow('Arquivo de projeto inválido');
  });
});
