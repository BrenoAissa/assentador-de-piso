import { del, get, set } from 'idb-keyval';
import type { Project } from '../types';

const PROJECT_KEY = 'project';
const imageKey = (id: string) => `image:${id}`;

export async function saveProject(p: Project): Promise<void> {
  await set(PROJECT_KEY, p);
}

export async function loadProject(): Promise<Project | null> {
  const p = await get<Project>(PROJECT_KEY);
  return p && p.version === 1 ? p : null;
}

export async function saveImage(id: string, blob: Blob): Promise<void> {
  await set(imageKey(id), blob);
}

export async function loadImage(id: string): Promise<Blob | null> {
  return (await get<Blob>(imageKey(id))) ?? null;
}

export async function deleteImage(id: string): Promise<void> {
  await del(imageKey(id));
}
