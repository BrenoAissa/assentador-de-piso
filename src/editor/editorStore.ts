import { create } from 'zustand';

export type Tool = 'select' | 'draw' | 'calibrate';

interface EditorState {
  tool: Tool;
  setTool(t: Tool): void;
  /** Incrementado para pedir ao editor que reenquadre a planta. */
  fitToken: number;
  requestFit(): void;
}

export const useEditor = create<EditorState>((set) => ({
  tool: 'select',
  setTool: (tool) => set({ tool }),
  fitToken: 0,
  requestFit: () => set((s) => ({ fitToken: s.fitToken + 1 })),
}));
