import { create } from 'zustand';

export type Tool = 'select' | 'draw' | 'rect' | 'calibrate';

interface EditorState {
  tool: Tool;
  setTool(t: Tool): void;
  /** Incrementado para pedir ao editor que reenquadre a planta. */
  fitToken: number;
  requestFit(): void;
  /** Parede destacada no editor enquanto o usuário edita o comprimento dela no painel. */
  highlight: { roomId: string; index: number } | null;
  setHighlight(h: { roomId: string; index: number } | null): void;
  /** Ímã ligado (cantos, paredes, guias, ângulo reto). Shift desliga na hora. */
  magnet: boolean;
  setMagnet(on: boolean): void;
}

export const useEditor = create<EditorState>((set) => ({
  tool: 'select',
  setTool: (tool) => set({ tool }),
  fitToken: 0,
  requestFit: () => set((s) => ({ fitToken: s.fitToken + 1 })),
  highlight: null,
  setHighlight: (highlight) => set({ highlight }),
  magnet: true,
  setMagnet: (magnet) => set({ magnet }),
}));
