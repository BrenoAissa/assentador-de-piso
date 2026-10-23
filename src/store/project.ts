import { create } from 'zustand';
import { withFloorLayout, withFloorTile, withNewFloor, withoutFloor, withRoomFloor, withSplitRoom } from '../floors';
import type { Ring } from '../geometry/types';
import { deleteImage, loadImage, loadProject, saveImage, saveProject } from '../persistence/db';
import { NO_EDITS, type ManualEdits, type ProjectLayout } from '../tiling/types';
import { drawnPlan, emptyProject, type Floor, type LayoutSpec, type PlanImage, type Project, type Room, type Scale, type TileSpec } from '../types';
import { pushHistory } from './edits';
import { computeIssues, type Step } from './issues';

/** Estado que "Desfazer" restaura. */
interface Snapshot {
  floors: Floor[];
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
  result: ProjectLayout | null;
  loaded: boolean;

  setPlan(blob: Blob, meta: Omit<PlanImage, 'imageId'>): Promise<void>;
  /** Começa um projeto desenhado do zero (sem imagem, escala real). */
  startDrawing(): void;
  setScale(s: Scale | null): void;
  setRooms(rooms: Room[]): void;
  addRoom(room: Room): void;
  updateRoom(id: string, patch: Partial<Room>): void;
  removeRoom(id: string): void;
  /** Muda a peça de um piso; os ajustes manuais dos cômodos dele saem (e entram no histórico). */
  setTile(floorId: string, patch: Partial<TileSpec>): void;
  /** Muda o layout de um piso; mudanças que mexem na grade desfazem os ajustes dele (e entram no histórico). */
  setLayout(floorId: string, patch: Partial<LayoutSpec>): void;
  /** Cria um piso novo copiando rejunte e compra de `copyFrom`; devolve o id dele. */
  addFloor(copyFrom: string): string;
  /** Apaga um piso (menos o primeiro); os cômodos dele voltam ao primeiro piso. */
  removeFloor(id: string): void;
  renameFloor(id: string, name: string): void;
  /** Escolhe o piso do cômodo (null = sem piso). */
  setRoomFloor(roomId: string, floorId: string | null): void;
  /** Divide o cômodo em dois na divisa; devolve o id do cômodo novo. */
  splitRoom(roomId: string, parts: [Ring, Ring]): string;
  /** Troca os ajustes manuais, guardando o passo anterior no histórico. */
  setEdits(edits: ManualEdits): void;
  undo(): void;
  setStep(s: Step): void;
  selectRoom(id: string | null): void;
  setResult(r: ProjectLayout | null): void;
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
    const { floors, edits } = get().project;
    set((s) => ({ history: pushHistory(s.history, { floors, edits }) }));
  };

  /** Aplica uma mudança de piso; se ela descartar ajustes manuais, o passo anterior vai para o histórico. */
  const updateFloors = (fn: (p: Project) => Project) => {
    const before = get().project;
    const after = fn(before);
    if (after.edits !== before.edits && JSON.stringify(after.edits) !== JSON.stringify(before.edits)) remember();
    update(() => after);
  };

  /** Planta nova: os começos e entradas da anterior não fazem sentido aqui. */
  const freshStarts = (floors: Floor[]): Floor[] => floors.map((f) => ({ ...f, layout: { ...f.layout, origin: 'auto', start: undefined } }));

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
      // planta nova: o ponto de partida da anterior não faz sentido aqui
      update((p) => ({ ...p, plan: { ...meta, imageId }, scale: null, rooms: [], edits: NO_EDITS, floors: freshStarts(p.floors) }));
      set({ selectedRoomId: null, history: [] });
    },

    startDrawing() {
      const old = get().project.plan;
      if (old?.imageId) void deleteImage(old.imageId);
      showImage(null);
      const { plan, scale } = drawnPlan();
      update((p) => ({ ...p, plan, scale, rooms: [], edits: NO_EDITS, floors: freshStarts(p.floors) }));
      set({ selectedRoomId: null, history: [], step: 2 });
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

    setTile(floorId, patch) {
      updateFloors((p) => withFloorTile(p, floorId, patch));
    },

    setLayout(floorId, patch) {
      updateFloors((p) => withFloorLayout(p, floorId, patch));
    },

    addFloor(copyFrom) {
      const id = `piso-${crypto.randomUUID().slice(0, 8)}`;
      update((p) => withNewFloor(p, copyFrom, id));
      return id;
    },

    removeFloor(id) {
      updateFloors((p) => withoutFloor(p, id));
    },

    renameFloor(id, name) {
      update((p) => ({ ...p, floors: p.floors.map((f) => (f.id === id ? { ...f, name } : f)) }));
    },

    setRoomFloor(roomId, floorId) {
      updateFloors((p) => withRoomFloor(p, roomId, floorId));
    },

    splitRoom(roomId, parts) {
      const id = crypto.randomUUID();
      update((p) => {
        const next = withSplitRoom(p, roomId, parts, id);
        return { ...next, rooms: next.rooms.map(withIssues) };
      });
      set({ selectedRoomId: roomId });
      return id;
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
          const drawn = project.plan?.kind === 'drawn';
          const image = project.plan && !drawn ? await loadImage(project.plan.imageId) : null;
          const keep = drawn || !!image;
          showImage(image);
          set({ project: keep ? project : { ...project, plan: null }, step: keep ? 2 : 1 });
        }
      } finally {
        set({ loaded: true });
      }
    },

    async replaceProject(project, image) {
      let plan = project.plan;
      if (plan?.kind === 'drawn') {
        // desenhado no app: não tem imagem
      } else if (plan && image) {
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
