export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
/** Anel de polígono aberto: o último ponto não repete o primeiro. */
export type Ring = Point[];
