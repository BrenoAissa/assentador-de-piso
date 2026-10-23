import { normalizeProject, type Project } from '../types';

/** Marca dos arquivos de projeto; os salvos quando o app se chamava Paginador de piso também abrem. */
const APP_ID = 'assentador-piso';
const OLD_APP_IDS = ['paginador-piso'];

interface ProjectFile {
  app: string;
  project: Project;
  image: { type: string; base64: string } | null;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64ToBlob(base64: string, type: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function serializeProject(project: Project, image: Blob | null): Promise<string> {
  const file: ProjectFile = {
    app: APP_ID,
    project,
    image: image ? { type: image.type, base64: await blobToBase64(image) } : null,
  };
  return JSON.stringify(file);
}

export async function parseProject(json: string): Promise<{ project: Project; image: Blob | null }> {
  let file: ProjectFile;
  try {
    file = JSON.parse(json);
  } catch {
    throw new Error('Arquivo de projeto inválido.');
  }
  const p = file?.project;
  // antes dos pisos o projeto tinha `tile` e `layout`; normalizeProject transforma no primeiro piso
  const old = p as unknown as { tile?: unknown; layout?: unknown } | undefined;
  const hasTile = (Array.isArray(p?.floors) && p.floors.length > 0) || (!!old?.tile && !!old?.layout);
  if (![APP_ID, ...OLD_APP_IDS].includes(file?.app) || p?.version !== 1 || !Array.isArray(p.rooms) || !hasTile) {
    throw new Error('Arquivo de projeto inválido.');
  }
  return { project: normalizeProject(p), image: file.image ? base64ToBlob(file.image.base64, file.image.type) : null };
}
