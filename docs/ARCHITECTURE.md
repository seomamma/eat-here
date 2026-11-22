# Architecture — Eat here! Restaurant game

> Status: draft v0.1 — awaiting approval.

## 1. Overview

Three layers with one-way dependencies:

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│  UI layer (Preact, DOM/CSS)  │     │  View layer (Phaser)         │
│  HUD, panels, modals, toasts │     │  tiles, sprites, animation,  │
│  crisp text, responsive      │     │  camera pan/zoom, tap input  │
└──────────────┬───────────────┘     └──────────────┬───────────────┘
               │ reads state, sends commands          │ reads state, listens to events,
               │                                      │ sends commands (tap on tile…)
               ▼                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│  Simulation core (pure TypeScript — NO Phaser, NO DOM)           │
│  GameState · systems (time, guests, staff, jobs, economy, fame)  │
│  grid + pathfinding · commands · events · save/load              │
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  Data (typed TS definitions): recipes, furniture, staff, guests, │
│  ranks, balance constants                                         │
└──────────────────────────────────────────────────────────────────┘
```

**Why:** the simulation is the game. Keeping it free of rendering makes it unit-testable with Vitest, makes save/load trivial (state is plain data), and lets us swap/upgrade rendering and UI independently.

## 2. Tech stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| Build/dev | Vite |
| World rendering | Phaser 4 (4.2.1, see D-024), `pixelArt: true` |
| UI | Preact (+ `@preact/signals`) rendered into a DOM overlay above the canvas |
| Tests | Vitest (simulation), Playwright smoke test later |
| Lint/format | ESLint + Prettier |
| Mobile (later) | Capacitor |
| Save storage | `localStorage` (web) → Capacitor Preferences/Filesystem (mobile) behind one interface |

No other runtime dependencies without a DECISIONS.md entry.

## 3. Folder structure

```
src/
  main.ts                 boot: create sim, Phaser game, mount UI
  sim/                    pure TS, no Phaser/DOM imports (lint-enforced)
    state.ts              GameState types + createInitialState()
    game.ts               Game class: tick(dt), dispatch(command), events
    time.ts               clock, day phases
    grid.ts               tile map, occupancy, placement validation
    pathfinding.ts        A* on grid
    systems/
      guests.ts           guest spawning + state machine
      staff.ts            staff state machine, job pickup
      jobs.ts             job queue
      kitchen.ts          cooking
      economy.ts          money, prices, tips
      fame.ts             happiness → fame → rank
      build.ts            buying, placing, moving furniture
      recipes.ts          recipe levels/upgrades
    save.ts               serialize / deserialize / migrate
    events.ts             typed event emitter
    rng.ts                seeded random
  data/                   game content (typed constants)
    recipes.ts  furniture.ts  staff.ts  guests.ts  ranks.ts  balance.ts
  view/                   Phaser
    scenes/BootScene.ts PreloadScene.ts WorldScene.ts
    WorldRenderer.ts      syncs sprites from GameState each frame
    CameraController.ts   pan, pinch, integer zoom
    sprites/              per-entity sprite wrappers + anim definitions
    input.ts              tap → tile → command
  ui/                     Preact
    App.tsx  hud/  panels/  modals/  components/Card.tsx …
    store.ts              signals bridged from sim events
    styles/               tokens.css, components.css
  platform/
    storage.ts            SaveStorage interface + localStorage impl
    lifecycle.ts          visibility/pause handling
tests/                    Vitest specs for sim/
docs/                     planning documents
public/assets/            exported atlases, fonts, audio
assets/                   art sources (aseprite, prompts, palette)
```

## 4. Simulation core

### GameState (plain, serializable data)

```ts
interface GameState {
  version: number;          // save format version
  seed: number;             // rng
  clock: { day: number; minuteOfDay: number; phase: 'prep' | 'open' | 'closing' | 'report' };
  money: number;
  fame: number;
  rank: number;
  grid: GridState;          // size, floor/wall tiles
  furniture: Furniture[];   // { id, defId, x, y, rot, level }
  staff: Staff[];           // { id, defId, role, x, y, state, jobId, stats, level, xp }
  guests: Guest[];          // { id, typeId, x, y, state, seatId, order, happiness, patience, path }
  jobs: Job[];              // { id, kind, targetId, assigneeId, status }
  orders: Order[];          // { id, guestId, recipeId, status }
  recipes: Record<RecipeId, { unlocked: boolean; level: number }>;
  dayStats: DayStats;       // income, costs, guestsServed, fameGained…
  unlocks: string[];
}
```

- Entities are **plain objects with an `id`** and a `defId` pointing into `data/`. Static info (price, footprint, sprite key) lives in data, never duplicated in state.
- No full ECS. **Systems are functions** `(state, dt, ctx) => void` run in a fixed order. This is the simplest thing that scales to our size.

### Game loop

- Fixed timestep: the sim advances in **100 ms ticks** (10 Hz), decoupled from render frame rate. `Game.update(realDt)` accumulates time and runs N ticks. Speed multiplier = more ticks per real second.
- Rendering interpolates positions between ticks for smooth walking.
- System order per tick: `time → guests(spawn) → jobs(assign) → staff → kitchen → guests(update) → economy → fame`.

### Commands & events

- **Commands** (UI/View → Sim): `openRestaurant`, `buyFurniture`, `placeFurniture`, `moveFurniture`, `upgradeRecipe`, `continueAfterReport`… validated in the sim; return `ok | error reason`.
- **Events** (Sim → UI/View): `moneyChanged`, `guestArrived`, `guestEmote`, `dishReady`, `paid`, `levelUp`, `rankUp`, `dayEnded`… UI reacts with toasts/modals/sounds; View with animations/particles.
- UI/View never mutate state directly.

### Entity behavior: state machines

Each guest and staff member has a `state` field and a small explicit state machine (switch on state per tick). Example guest states:

`arriving → waitingForSeat → walkingToSeat → browsing → wantsToOrder → waitingForFood → eating → paying → leaving → gone`

Timeouts (patience) and transitions are data-driven (from `data/guests.ts`, `data/balance.ts`).

### Jobs (how staff decide what to do)

- Things that need doing become **jobs** in a queue: `takeOrder(guestId)`, `cook(orderId)`, `deliver(orderId)`, `clearTable(tableId)`.
- Each idle staff member picks the **oldest job their role can do**, preferring the nearest on ties.
- Jobs are claimed (`assigneeId`) so two waiters never take the same one. If a job becomes invalid (guest left), it's cancelled and the assignee returns to idle.

This keeps behavior predictable, debuggable, and naturally extends to more staff.

### Grid & pathfinding

- Tile grid (MVP ~10×12). Each tile: `floor | wall | outside` + occupancy (furniture id or empty).
- Furniture defines a **footprint** and **use spots** (tiles where a character stands/sits to use it, with facing direction), e.g. chair: use spot = itself; oven: tile in front.
- **A\*** with 4-directional movement over walkable tiles, own implementation (~100 lines, unit tested). Paths cached until the grid changes.
- Characters don't collide with each other (they can overlap briefly) — the standard trick in this genre, keeps things simple.
- **Placement validation:** footprint free + on floor + after placement every chair, oven, pass and the door are still reachable (BFS from door).

### Randomness

All randomness goes through a **seeded RNG** stored in state → reproducible bugs and deterministic tests.

## 5. View layer (Phaser)

- One main `WorldScene`. `WorldRenderer` keeps a map `entityId → Sprite`, creating/destroying sprites as entities appear/disappear, and each frame sets position, animation (from state + direction) and depth (`x + y` of the front-most footprint tile, see ART_DIRECTION §2).
- **Camera:** drag to pan, pinch / wheel to zoom, snapping to **integer zoom levels in device pixels** (D-026), bounded to the restaurant. Default zoom = largest integer that fits the restaurant in the viewport.
- **Scale mode:** Phaser `Scale.RESIZE` — canvas always fills the screen; orientation changes trigger re-fit.
- Input: tap → `screenToTile` (diamond hit-test) → command or selection (shows guest info card).
- Juice (popups, sparkles, coin bounce) lives here, triggered by sim events.

## 6. UI layer (Preact over DOM)

- A full-screen `<div id="ui">` above the canvas with `pointer-events: none`; interactive elements set `pointer-events: auto`, so taps pass through to the world where there's no UI.
- Sim state is mirrored into **signals** (`money`, `fame`, `rank`, `clock`, `phase`…) via events, so only affected UI re-renders.
- Layout with CSS (flex/grid + media queries for orientation). Safe-area insets (`env(safe-area-inset-*)`) for notches.
- Style tokens from ART_DIRECTION.md in `tokens.css`.

**Why DOM instead of Phaser UI:** you already know HTML/CSS; text is sharp at any resolution; responsive portrait/landscape layouts are far easier; scrolling lists, accessibility and fonts come for free. The world stays pixel-perfect in the canvas.

## 7. State management summary

- **Single source of truth:** `GameState` inside the sim.
- View and UI are **projections** of it, updated via events/signals and per-frame reads.
- Pure data → JSON-serializable at any time.

## 8. Save system

- Saves are `JSON.stringify(GameState)` + `{ version, savedAt }`, written through `SaveStorage` (`load(slot)`, `save(slot, data)`).
- **When:** autosave at the **start of each prep phase** (i.e. after the day report) and after any prep-phase purchase.
- **Mid-day quit:** if the app is closed during a business day, loading returns to the start of that day's prep phase (last save). The day is short, so little is lost, and we avoid serializing in-flight guests/paths. (Pausing while app is merely in background keeps the live state in memory.)
- **Versioning:** each save has `version`; `migrate()` upgrades old saves step by step (`v1 → v2 → …`). Unit-tested with fixture saves.
- One save slot in MVP; keep a `backup` copy of the previous save to recover from corruption.

## 9. Lifecycle & pause

- `document.visibilitychange` / Capacitor `appStateChange` → `game.pause()` / `game.resume()`. No offline progress: time simply doesn't pass while paused.
- Opening a modal (report, rank up) also pauses the sim.

## 10. Data-driven content

All content defined as typed TS constants (not JSON) for type safety and autocomplete:

```ts
export const FURNITURE = {
  plant_potted: { name: 'Potted Plant', kind: 'decor', footprint: [1, 1], price: 150,
                  appeal: [5, 8, 12, 17, 25], sprite: 'plant_potted', useSpots: [] },
  ...
} satisfies Record<string, FurnitureDef>;
```

Adding a dish, chair or guest type = adding data (+ sprite), no system code.

## 11. Testing strategy

- **Sim unit tests (Vitest):** pathfinding, placement validation, guest state machine, job assignment, economy math, rank thresholds, save migration.
- **Headless sim runs:** run 1 full day with a fixed seed in a test, assert guests served > 0, money increased, no stuck entities (every guest reaches `gone`).
- **Manual playtest checklist** per milestone (in ROADMAP).
- Debug overlay (dev only): grid lines, paths, entity states, FPS, fast-forward.

## 12. Performance budget

Target: 60 fps on a mid-range phone (~2021). MVP has < 30 entities; the main costs are draw calls → use texture atlases, a single tilemap layer for floors/walls, avoid per-frame allocations in the sim.
