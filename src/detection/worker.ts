/// <reference lib="webworker" />
import { detectRooms } from './pipeline';
import type { DetectOptions, RGBAImage } from './types';

self.onmessage = (e: MessageEvent<{ id: number; image: RGBAImage; opts: DetectOptions }>) => {
  const { id, image, opts } = e.data;
  try {
    self.postMessage({ id, ok: true, result: detectRooms(image, opts) });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
