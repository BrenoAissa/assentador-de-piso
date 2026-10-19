import { create } from 'zustand';
import { deleteImage, loadImage, loadProject, saveImage, saveProject } from '../persistence/db';
import { NO_EDITS, type LayoutResult, type ManualEdits } from '../tiling/types';
import { emptyProject, type LayoutSpec, type PlanImage, type Project, type Room, type Scale, type TileSpec } from '../types';
import { layoutChangeResetsEdits, pushHistory } from './edits';
import { computeIssues, type Step } from './issues';

/** Estado que "Desfazer" restaura. */
interface Snapshot {
  tile: TileSpec;
  layout: LayoutSpec;
  edits: ManualEdits;
}

interface ProjectState {
  project: Project;
  /** Passos para desfazer (só na sessão). */
  history: Snapshot[];
  step: Step;
  planUrl: string | null;
  planBlob: Blob | null;
  selectedRoomId: string | null;
  /** Resultado do passo 4; zerado em qualquer mudança do projeto. */
  result: LayoutResult | null;
  loaded: boolean;

  setPlan(blob: Blob, meta: Omit<PlanImage, 'imageId'>): Promise<void>;
  setScale(s: Scale | null): void;
  setRooms(rooms: Room[]): void;
  addRoom(room: Room): void;
  updateRoom(id: string, patch: Partial<Room>): void;
  removeRoom(id: string): void;
  setTile(patch: Partial<TileSpec>): void;
  /** Muda o layout; mudanças que mexem na grade desfazem os ajustes manuais (e entram no histórico). */
  setLayout(patch: Partial<LayoutSpec>): void;
  /** Troca os ajustes manuais, guardando o passo anterior no histórico. */
  setEdits(edits: ManualEdits): void;
  undo(): void;
  setStep(s: Step): void;
  selectRoom(id: string | null): void;
  setResult(r: LayoutResult | null): void;
  loadFromStorage(): Promise<void>;
  replaceProject(p: Project, image: Blob | null): Promise<void>;
}

function withIssues(room: Room): Room {
  const keep = room.issues.filter((i) => i === 'scale-mismatch');
  return { ...room, issues: computeIssues(room, keep) };
}

export const useProject = create<ProjectState>((set, get) => {
  /** Toda mudança do projeto passa por aqui e invalida o resultado. */
  const update = (fn: (p: Project) => Project) => set((s) => ({ project: fn(s.project), result: null }));

  const remember = () => {
    const { tile, layout, edits } = get().project;
    set((s) => ({ history: pushHistory(s.history, { tile, layout, edits }) }));
  };

  const showImage = (blob: Blob | null) => {
    const prev = get().planUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ planBlob: blob, planUrl: blob ? URL.createObjectURL(blob) : null });
  };

  return {
    project: emptyProject(),
    history: [],
    step: 1,
    planUrl: null,
    planBlob: null,
    selectedRoomId: null,
    result: null,
    loaded: false,

    async setPlan(blob, meta) {
      const old = get().project.plan;
      const imageId = crypto.randomUUID();
      await saveImage(imageId, blob);
      if (old) void deleteImage(old.imageId);
      showImage(blob);
      update((p) => ({ ...p, plan: { ...meta, imageId }, scale: null, rooms: [], edits: NO_EDITS }));
      set({ selectedRoomId: null, history: [] });
    },

    setScale(scale) {
      update((p) => ({
        ...p,
        scale,
        // escala manual resolve as divergências apontadas pelo OCR
        rooms: scale?.source === 'manual' ? p.rooms.map((r) => withIssues({ ...r, issues: [] })) : p.rooms,
      }));
    },

    setRooms(rooms) {
      update((p) => ({ ...p, rooms: rooms.map(withIssues) }));
    },

    addRoom(room) {
      update((p) => ({ ...p, rooms: [...p.rooms, withIssues(room)] }));
      set({ selectedRoomId: room.id });
    },

    updateRoom(id, patch) {
      update((p) => ({
        ...p,
        rooms: p.rooms.map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, ...patch };
          // contorno mexido pelo usuário = contorno conferido
          if (patch.polygonPx) {
            delete next.confidence;
            next.issues = [];
          }
          return withIssues(next);
        }),
      }));
    },

    removeRoom(id) {
      update((p) => ({ ...p, rooms: p.rooms.filter((r) => r.id !== id) }));
      if (get().selectedRoomId === id) set({ selectedRoomId: null });
    },

    setTile(patch) {
      update((p) => ({ ...p, tile: { ...p.tile, ...patch }, edits: NO_EDITS }));
    },

    setLayout(patch) {
      const resets = layoutChangeResetsEdits(patch);
      if (resets) remember();
      update((p) => ({ ...p, layout: { ...p.layout, ...patch }, edits: resets ? NO_EDITS : p.edits }));
    },

    setEdits(edits) {
      remember();
      update((p) => ({ ...p, edits }));
    },

    undo() {
      const h = get().history;
      if (h.length === 0) return;
      const last = h[h.length - 1];
      set({ history: h.slice(0, -1) });
      update((p) => ({ ...p, ...last }));
    },

    setStep(step) {
      set({ step });
    },

    selectRoom(selectedRoomId) {
      set({ selectedRoomId });
    },

    setResult(result) {
      set({ result });
    },

    async loadFromStorage() {
      try {
        const project = await loadProject();
        if (project) {
          const image = project.plan ? await loadImage(project.plan.imageId) : null;
          showImage(image);
          set({ project: image ? project : { ...project, plan: null }, step: image ? 2 : 1 });
        }
      } finally {
        set({ loaded: true });
      }
    },

    async replaceProject(project, image) {
      let plan = project.plan;
      if (plan && image) {
        const imageId = crypto.randomUUID();
        await saveImage(imageId, image);
        plan = { ...plan, imageId };
      } else {
        plan = null;
      }
      showImage(plan ? image : null);
      set({ project: { ...project, plan }, result: null, selectedRoomId: null, history: [], step: plan ? 2 : 1 });
    },
  };
});

let timer: ReturnType<typeof setTimeout> | undefined;

/** Salva o projeto no IndexedDB 1 s depois da última mudança. */
export function startAutosave(): () => void {
  return useProject.subscribe((s, prev) => {
    if (!s.loaded || s.project === prev.project) return;
    clearTimeout(timer);
    timer = setTimeout(() => void saveProject(useProject.getState().project), 1000);
  });
}
