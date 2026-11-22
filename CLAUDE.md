# Eat here! Restaurant game

Cozy pixel-art pizzeria **manager sim** for mobile (browser-first). Phaser + TypeScript + Vite, Preact UI overlay, offline, local saves.

## Read first
- `docs/GAME_DESIGN.md` — what we build · `docs/ROADMAP.md` — current milestone + acceptance criteria
- `docs/ARCHITECTURE.md` — how · `docs/DECISIONS.md` — why · `docs/ART_DIRECTION.md`, `docs/ASSET_LIST.md` — art

## Models & roles
| Work | Model | Who |
|---|---|---|
| Game design, architecture, planning, reviews | Claude Opus 5.5 | main session (Opus, set in `.claude/settings.json`) or `architect` agent |
| Implementation, debugging, everyday code | Claude Sonnet 5.5 | `implementer` agent |

- Delegate coding/bug fixing to `implementer` with a precise brief (milestone, files, acceptance criteria). If agent types aren't loaded, use the Agent tool with `model: "sonnet"` / `model: "opus"`.
- Trivial things (answering, reading a file) need no delegation.

## Language
- Talk to the user in **Swedish**.
- Everything in the repo (code, comments, docs, commits, in-game text) in **English**.

## Working rules
- Plan before coding; build **one milestone at a time** from `docs/ROADMAP.md`; the game must run after every milestone.
- Don't start a milestone or change scope without the user's approval. Record significant decisions in `docs/DECISIONS.md`.
- Simplest viable solution. No new runtime dependency without a DECISIONS.md entry.
- Small, meaningful commits (imperative subject, e.g. `Add A* pathfinding`).

## Code conventions
- TypeScript strict. No `any` without a comment explaining why.
- `src/sim/` is pure TS: **never import Phaser or touch the DOM** there. All game rules live in sim.
- State is plain serializable data (`GameState`). View (`src/view/`, Phaser) and UI (`src/ui/`, Preact) only **read state, listen to events, and dispatch commands** — never mutate state.
- Content (recipes, furniture, staff, guests, ranks, balance numbers) lives in `src/data/` as typed constants. No magic numbers in systems.
- All randomness via the seeded RNG in state.
- UI strings in `src/data/strings.ts`.
- Sim logic gets Vitest tests in `tests/`. Bug fix → add a failing test first when feasible.
- Pixel art: integer zoom only, nearest-neighbor, sizes per ART_DIRECTION.md (16 px tiles, 16×24 characters).

## Commands
- `npm run dev` — Vite dev server
- `npm run build` — `tsc --noEmit` then `vite build`
- `npm run preview` — serve the production build
- `npm test` — Vitest (`vitest run`)
- `npm run lint` — ESLint (flat config; enforces the `src/sim/` boundary)
- `npm run typecheck` — `tsc --noEmit`
- `npm run format` — Prettier (docs/ and CLAUDE.md are excluded)
Before reporting a milestone done: test, lint, typecheck and build must pass.
