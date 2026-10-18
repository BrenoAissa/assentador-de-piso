import { create } from 'zustand';
import { useProject } from '../store/project';
import { detectPlan } from './index';

interface DetectionState {
  status: 'idle' | 'running' | 'done' | 'error';
  stage: string;
  progress?: number;
  warnings: string[];
  error?: string;
  found: number;
  sensitivity: number;
  setSensitivity(v: number): void;
  run(blob: Blob): Promise<void>;
}

let runId = 0;

export const useDetection = create<DetectionState>((set, get) => ({
  status: 'idle',
  stage: '',
  warnings: [],
  found: 0,
  sensitivity: 1,
  setSensitivity: (sensitivity) => set({ sensitivity }),

  async run(blob) {
    const id = ++runId;
    const planId = useProject.getState().project.plan?.imageId;
    set({ status: 'running', stage: 'Preparando a imagem', progress: undefined, warnings: [], error: undefined });
    try {
      const res = await detectPlan(blob, { sensitivity: get().sensitivity }, (stage, progress) => {
        if (id === runId) set({ stage, progress });
      });
      const store = useProject.getState();
      // planta trocada ou nova detecção no meio do caminho: descarta
      if (id !== runId || store.project.plan?.imageId !== planId) return;
      store.setRooms(
        res.rooms.map((r) => ({
          id: crypto.randomUUID(),
          name: r.name ?? '',
          polygonPx: r.polygonPx,
          receivesTile: true,
          confidence: r.confidence,
          issues: r.scaleMismatch ? ['scale-mismatch'] : [],
        })),
      );
      if (res.scale && store.project.scale?.source !== 'manual') store.setScale(res.scale);
      set({ status: 'done', warnings: res.warnings, found: res.rooms.length });
    } catch (e) {
      if (id === runId) set({ status: 'error', error: e instanceof Error ? e.message : 'Falha na detecção.' });
    }
  },
}));
