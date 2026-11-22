import Phaser from 'phaser';
import { FURNITURE, type FurnitureDefId } from '../data/furniture';

/** Tile size in world pixels (ART_DIRECTION §3). */
export const TILE = 16;

/** World palette subset (ART_DIRECTION §4). */
const C = {
  outline: '#2B1D16',
  wood1: '#5C3A21',
  wood2: '#8A5A34',
  wood3: '#B9824F',
  wood4: '#E0B07A',
  brick1: '#7A2E1F',
  brick2: '#B5473A',
  brick3: '#D9725A',
  cream1: '#F3E6CF',
  cream2: '#E3D0AE',
  cream3: '#C7B08A',
  tomato2: '#D93A2B',
  tomato3: '#F0664A',
  basil1: '#244D2B',
  basil2: '#3E7A3A',
  basil3: '#6FAE4E',
  cheese2: '#EDB94A',
  cheese3: '#FBE29A',
  cool2: '#4A6A8F',
  cool3: '#8FB3D0',
  cool4: '#DCE9F2',
} as const;

type Ctx = CanvasRenderingContext2D;
type Draw = (r: (color: string, x: number, y: number, w: number, h: number) => void) => void;

/** Creates a canvas texture of exact pixel size and draws it with 1px-precise rects. */
function make(
  textures: Phaser.Textures.TextureManager,
  key: string,
  w: number,
  h: number,
  draw: Draw,
): void {
  if (textures.exists(key)) return;
  const tex = textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`Could not create texture ${key}`);
  const ctx: Ctx = tex.getContext();
  draw((color, x, y, rw, rh) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, rw, rh);
  });
  tex.refresh();
}

/** Filled rect with a 1px outline. */
function box(
  r: Parameters<Draw>[0],
  fill: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  r(C.outline, x, y, w, h);
  r(fill, x + 1, y + 1, w - 2, h - 2);
}

export const TEX = {
  floorWood: ['floor_wood_0', 'floor_wood_1'],
  floorTile: 'floor_tile',
  wallBackL: 'wall_back_l',
  wallBack: 'wall_back',
  wallBackR: 'wall_back_r',
  wallSideL: 'wall_side_l',
  wallSideR: 'wall_side_r',
  door: 'door',
} as const;

function woodFloor(variant: number): Draw {
  return (r) => {
    r(C.wood3, 0, 0, 16, 16);
    // Subtle plank seams and highlights; the variant shifts them.
    const s = variant ? 6 : 0;
    r(C.wood2, 0, 7, 16, 1);
    r(C.wood2, (4 + s) % 16, 8, 1, 8);
    r(C.wood2, (11 + s) % 16, 0, 1, 7);
    r(C.wood4, (2 + s) % 14, 3, 2, 1);
    r(C.wood4, (8 + s) % 14, 11, 3, 1);
  };
}

function backWall(left: boolean, right: boolean): Draw {
  return (r) => {
    r(C.cream1, 0, 0, 16, 16);
    r(C.cream2, 0, 8, 16, 1); // plaster shade line
    // Brick base.
    r(C.brick2, 0, 10, 16, 6);
    r(C.brick1, 0, 12, 16, 1);
    r(C.brick1, 0, 15, 16, 1);
    r(C.brick1, 4, 10, 1, 2);
    r(C.brick1, 12, 10, 1, 2);
    r(C.brick1, 8, 13, 1, 2);
    r(C.brick3, 0, 10, 16, 1);
    r(C.outline, 0, 9, 16, 1); // cap line between plaster and brick
    r(C.outline, 0, 0, 16, 1); // top edge
    if (left) r(C.outline, 0, 0, 1, 16);
    if (right) r(C.outline, 15, 0, 1, 16);
  };
}

function sideWall(isLeft: boolean): Draw {
  return (r) => {
    // Wall top (cap) on the outside, inner face towards the room.
    r(C.cream1, 0, 0, 16, 16);
    const faceX = isLeft ? 11 : 0;
    r(C.cream3, faceX, 0, 5, 16);
    r(C.cream2, isLeft ? 10 : 5, 0, 1, 16);
    r(C.brick2, faceX, 10, 5, 6);
    r(C.brick1, faceX, 12, 5, 1);
    r(C.brick1, faceX, 15, 5, 1);
    r(C.outline, isLeft ? 0 : 15, 0, 1, 16); // outer edge
    r(C.outline, isLeft ? 15 : 0, 0, 1, 16); // inner edge
  };
}

const drawFloorTile: Draw = (r) => {
  r(C.cool4, 0, 0, 16, 16);
  r(C.cool3, 0, 0, 8, 8);
  r(C.cool3, 8, 8, 8, 8);
  r(C.cool2, 0, 15, 16, 1);
  r(C.cool2, 15, 0, 1, 16);
};

const drawDoor: Draw = (r) => {
  r(C.wood3, 0, 0, 16, 16);
  r(C.wood2, 0, 0, 16, 1);
  // Doorway threshold + welcome mat so the door reads clearly.
  box(r, C.cool2, 1, 0, 14, 16);
  r(C.cool3, 3, 2, 10, 12);
  box(r, C.brick2, 3, 6, 10, 8);
  r(C.brick3, 5, 8, 6, 1);
  r(C.brick3, 5, 11, 6, 1);
  r(C.cheese2, 12, 1, 1, 1); // doorknob glint
};

const FURNITURE_DRAW: Record<FurnitureDefId, { w: number; h: number; draw: Draw }> = {
  // 16x20: top surface + front face + legs. Bottom edge = footprint bottom.
  table_small: {
    w: 16,
    h: 20,
    draw: (r) => {
      r(C.outline, 2, 14, 3, 6);
      r(C.wood2, 3, 14, 1, 5);
      r(C.outline, 11, 14, 3, 6);
      r(C.wood2, 12, 14, 1, 5);
      box(r, C.wood2, 0, 11, 16, 5); // front apron
      box(r, C.wood4, 0, 2, 16, 11); // top surface
      r(C.tomato2, 3, 4, 10, 7); // cloth
      r(C.tomato3, 3, 4, 10, 1);
      r(C.cream1, 7, 6, 2, 2); // little plate
    },
  },
  // 16x16: backrest + seat + legs.
  chair_wood: {
    w: 16,
    h: 16,
    draw: (r) => {
      r(C.outline, 3, 12, 3, 4);
      r(C.outline, 10, 12, 3, 4);
      r(C.wood2, 4, 12, 1, 3);
      r(C.wood2, 11, 12, 1, 3);
      box(r, C.wood2, 3, 1, 10, 6); // backrest
      box(r, C.wood3, 2, 6, 12, 7); // seat
      r(C.wood4, 3, 7, 10, 1);
    },
  },
  // 32x24: brick oven with a glowing mouth.
  oven_pizza: {
    w: 32,
    h: 24,
    draw: (r) => {
      box(r, C.brick3, 0, 2, 32, 8); // top
      box(r, C.brick2, 0, 9, 32, 15); // front face
      r(C.brick1, 1, 14, 30, 1);
      r(C.brick1, 1, 19, 30, 1);
      r(C.brick1, 8, 10, 1, 4);
      r(C.brick1, 22, 10, 1, 4);
      r(C.brick1, 4, 15, 1, 4);
      r(C.brick1, 27, 15, 1, 4);
      box(r, C.outline, 9, 11, 14, 12); // mouth
      r(C.wood1, 10, 12, 12, 10);
      r(C.tomato2, 12, 16, 8, 6);
      r(C.cheese2, 14, 18, 4, 4);
      r(C.cheese3, 15, 20, 2, 2);
      r(C.cream3, 12, 4, 8, 3); // chimney plate
    },
  },
  // 32x24: serving counter (sprite is shorter than the oven).
  counter_pass: {
    w: 32,
    h: 24,
    draw: (r) => {
      box(r, C.cream2, 0, 8, 32, 8); // top surface
      r(C.cream1, 1, 9, 30, 1);
      box(r, C.wood3, 0, 15, 32, 9); // front face
      r(C.wood2, 1, 17, 14, 5);
      r(C.wood2, 17, 17, 14, 5);
      r(C.outline, 15, 16, 2, 8);
      r(C.cheese3, 5, 5, 6, 4); // warming plates
      r(C.cream3, 5, 8, 6, 1);
      r(C.cream1, 20, 6, 7, 3);
    },
  },
  // 16x24: potted plant.
  plant_potted: {
    w: 16,
    h: 24,
    draw: (r) => {
      box(r, C.basil2, 3, 1, 10, 9);
      box(r, C.basil3, 1, 5, 7, 7);
      box(r, C.basil3, 8, 4, 7, 8);
      r(C.basil1, 6, 7, 1, 3);
      box(r, C.brick2, 3, 14, 10, 10);
      r(C.brick3, 4, 15, 8, 1);
      r(C.outline, 4, 13, 8, 1);
    },
  },
};

/** Generates every placeholder texture at real pixel sizes. Idempotent. */
export function generatePlaceholderTextures(textures: Phaser.Textures.TextureManager): void {
  make(textures, TEX.floorWood[0], 16, 16, woodFloor(0));
  make(textures, TEX.floorWood[1], 16, 16, woodFloor(1));
  make(textures, TEX.floorTile, 16, 16, drawFloorTile);
  make(textures, TEX.wallBackL, 16, 16, backWall(true, false));
  make(textures, TEX.wallBack, 16, 16, backWall(false, false));
  make(textures, TEX.wallBackR, 16, 16, backWall(false, true));
  make(textures, TEX.wallSideL, 16, 16, sideWall(true));
  make(textures, TEX.wallSideR, 16, 16, sideWall(false));
  make(textures, TEX.door, 16, 16, drawDoor);
  for (const defId of Object.keys(FURNITURE) as FurnitureDefId[]) {
    const spec = FURNITURE_DRAW[defId];
    make(textures, defId, spec.w, spec.h, spec.draw);
  }
}
