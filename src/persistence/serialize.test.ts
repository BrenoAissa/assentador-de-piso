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

  it('salva com o nome novo e ainda abre arquivos do tempo do Paginador de piso', async () => {
    const json = await serializeProject(emptyProject(), null);
    expect(JSON.parse(json).app).toBe('assentador-piso');
    const antigo = JSON.stringify({ ...JSON.parse(json), app: 'paginador-piso' });
    expect((await parseProject(antigo)).project).toEqual(emptyProject());
  });

  it('arquivo antigo, de antes dos pisos, abre com um piso igual ao que tinha', async () => {
    const velho = emptyProject() as unknown as Record<string, unknown>;
    const tile = { lengthCm: 83, widthCm: 83, jointMm: 2, piecesPerBox: 2, wastePct: 10 };
    const { floors, ...semPisos } = velho;
    void floors;
    const arquivo = JSON.stringify({ app: 'paginador-piso', project: { ...semPisos, tile, layout: emptyProject().floors[0].layout }, image: null });
    const back = await parseProject(arquivo);
    expect(back.project.floors).toHaveLength(1);
    expect(back.project.floors[0].tile).toEqual(tile);
  });

  it('arquivo que não é projeto gera erro claro', async () => {
    await expect(parseProject('{"foo": 1}')).rejects.toThrow('Arquivo de projeto inválido');
    await expect(parseProject('não é json')).rejects.toThrow('Arquivo de projeto inválido');
  });
});
