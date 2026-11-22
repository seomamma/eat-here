import { inBounds, buildOccupancy, tileAt, type Furniture, type GridState } from './grid';

export interface TilePos {
  x: number;
  y: number;
}

/** Walkability per tile (row-major). Rebuild it when furniture or tiles change. */
export interface WalkGrid {
  width: number;
  height: number;
  walkable: boolean[];
}

/** Floor and door tiles without furniture are walkable; walls and furniture are not. */
export function buildWalkGrid(grid: GridState, furniture: readonly Furniture[]): WalkGrid {
  const occupied = buildOccupancy(furniture);
  const walkable: boolean[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const t = tileAt(grid, x, y);
      const floor = t === 'floor_wood' || t === 'floor_tile' || t === 'door';
      walkable.push(floor && !occupied.has(`${x},${y}`));
    }
  }
  return { width: grid.width, height: grid.height, walkable };
}

export function isWalkable(w: WalkGrid, x: number, y: number): boolean {
  return inBounds(w, x, y) && w.walkable[y * w.width + x] === true;
}

/** Fixed neighbour order (+x, +y, -x, -y) keeps results deterministic. */
const NEIGHBOURS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;

interface Node {
  idx: number;
  g: number;
  h: number;
  /** Insertion order: last tie-break. */
  seq: number;
}

function less(a: Node, b: Node): boolean {
  const fa = a.g + a.h;
  const fb = b.g + b.h;
  if (fa !== fb) return fa < fb;
  if (a.h !== b.h) return a.h < b.h; // prefer nodes closer to the goal
  return a.seq < b.seq;
}

export interface PathOptions {
  /** The goal tile may be blocked (e.g. a claimed chair); other blocked tiles stay impassable. */
  allowGoalBlocked?: boolean;
  /** The start tile may be blocked (e.g. a guest standing up from a chair). */
  allowStartBlocked?: boolean;
}

/**
 * A* over walkable tiles, 4-directional, Manhattan heuristic. Returns the tiles from `start`
 * to `goal` inclusive, or null when either end is not walkable (unless allowed by `opts`, and
 * still inside the grid) or the goal is unreachable. Blocked tiles are never passed through.
 */
export function findPath(
  w: WalkGrid,
  start: TilePos,
  goal: TilePos,
  opts: PathOptions = {},
): TilePos[] | null {
  if (!inBounds(w, start.x, start.y) || !inBounds(w, goal.x, goal.y)) return null;
  if (!opts.allowStartBlocked && !isWalkable(w, start.x, start.y)) return null;
  if (!opts.allowGoalBlocked && !isWalkable(w, goal.x, goal.y)) return null;
  if (start.x === goal.x && start.y === goal.y) return [{ x: start.x, y: start.y }];

  const heuristic = (x: number, y: number) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
  const startIdx = start.y * w.width + start.x;
  const goalIdx = goal.y * w.width + goal.x;
  const best = new Map<number, number>([[startIdx, 0]]);
  const parent = new Map<number, number>();
  const closed = new Set<number>();
  const heap: Node[] = [];
  let seq = 0;

  const push = (n: Node) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      const pn = heap[p] as Node;
      if (!less(n, pn)) break;
      heap[i] = pn;
      i = p;
    }
    heap[i] = n;
  };
  const pop = (): Node => {
    const top = heap[0] as Node;
    const last = heap.pop() as Node;
    if (heap.length > 0) {
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= heap.length) break;
        if (c + 1 < heap.length && less(heap[c + 1] as Node, heap[c] as Node)) c++;
        if (!less(heap[c] as Node, last)) break;
        heap[i] = heap[c] as Node;
        i = c;
      }
      heap[i] = last;
    }
    return top;
  };

  push({ idx: startIdx, g: 0, h: heuristic(start.x, start.y), seq: seq++ });
  while (heap.length > 0) {
    const cur = pop();
    if (closed.has(cur.idx)) continue;
    if (cur.idx === goalIdx) {
      const path: TilePos[] = [];
      for (let i: number | undefined = goalIdx; i !== undefined; i = parent.get(i)) {
        path.push({ x: i % w.width, y: Math.floor(i / w.width) });
      }
      return path.reverse();
    }
    closed.add(cur.idx);
    const cx = cur.idx % w.width;
    const cy = Math.floor(cur.idx / w.width);
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      const idx = ny * w.width + nx;
      if (!isWalkable(w, nx, ny) && !(opts.allowGoalBlocked && idx === goalIdx)) continue;
      const g = cur.g + 1;
      const known = best.get(idx);
      if (known !== undefined && known <= g) continue;
      best.set(idx, g);
      parent.set(idx, cur.idx);
      push({ idx, g, h: heuristic(nx, ny), seq: seq++ });
    }
  }
  return null;
}
