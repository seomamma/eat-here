import { ANIMAL_AREA_PIECES, STREET_APPROACH_TILES, STREET_EXIT_TILES } from '../data/street';
import { DOOR_X, DOOR_Y, SIDEWALK_Y } from '../data/layout';
import type { Furniture } from './grid';
import type { TilePos } from './pathfinding';

/** Which way along the sidewalk: +1 = towards +x, -1 = towards -x. */
export type StreetSide = 1 | -1;

/** True for tiles in front of the door, outside the sim grid (the sidewalk). */
export function isStreetTile(t: { y: number }): boolean {
  return t.y > DOOR_Y;
}

/**
 * Where a guest arriving from `side` starts on the sidewalk (`behind` tiles further out for
 * party followers) and the tiles it walks: along the sidewalk, in through the door and one tile
 * into the room. The last tile is left out when `entryBlocked`.
 */
export function approachPath(
  side: StreetSide,
  behind: number,
  entryBlocked = false,
): { start: TilePos; path: TilePos[] } {
  const start = { x: DOOR_X + side * (STREET_APPROACH_TILES + behind), y: SIDEWALK_Y };
  const path: TilePos[] = [];
  for (let x = start.x - side; x !== DOOR_X; x -= side) path.push({ x, y: SIDEWALK_Y });
  path.push({ x: DOOR_X, y: SIDEWALK_Y }, { x: DOOR_X, y: DOOR_Y });
  if (!entryBlocked) path.push({ x: DOOR_X, y: DOOR_Y - 1 });
  return { start, path };
}

/** The tiles a guest walks out through the door (the door tile is the route's start). */
export function departTail(side: StreetSide): TilePos[] {
  const out: TilePos[] = [{ x: DOOR_X, y: SIDEWALK_Y }];
  for (let i = 1; i <= STREET_EXIT_TILES; i++) out.push({ x: DOOR_X + side * i, y: SIDEWALK_Y });
  return out;
}

/** Side a guest leaves to: from the party (members leave together) or the guest's own id. */
export function leaveSide(id: string): StreetSide {
  const n = Number(/\d+$/.exec(id)?.[0] ?? 0);
  return n % 2 === 0 ? 1 : -1;
}

/**
 * Splits a walk into the part inside the room and the sidewalk parts around it: a guest on the
 * way in starts with sidewalk tiles, a leaving guest ends with them. `run` is the first to the
 * last tile inside the grid (empty when the whole walk is on the street).
 */
export function splitRun(path: readonly TilePos[]): {
  head: TilePos[];
  run: TilePos[];
  tail: TilePos[];
} {
  const a = path.findIndex((t) => !isStreetTile(t));
  if (a < 0) return { head: [...path], run: [], tail: [] };
  let b = path.length - 1;
  while (b > a && isStreetTile(path[b] as TilePos)) b--;
  return { head: path.slice(0, a), run: path.slice(a, b + 1), tail: path.slice(b + 1) };
}

/** True when the restaurant has an Animal Area (dogs may come in; none can exist yet, M16). */
export function hasAnimalArea(furniture: readonly Pick<Furniture, 'defId'>[]): boolean {
  return furniture.some((f) => ANIMAL_AREA_PIECES.includes(f.defId));
}
