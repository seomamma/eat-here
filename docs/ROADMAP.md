# Roadmap — Eat here! Restaurant game

> Status: draft v0.1 — awaiting approval.
> Rule: **the game is runnable after every milestone.** Each milestone ends with tests passing, a manual check of its acceptance criteria, and a commit. Placeholder art until M11.

## Phase A — MVP (first playable)

### M0 — Project skeleton ✅
**Goal:** an empty but correctly set up project.
- Vite + TypeScript (strict) + Phaser + Preact + Vitest + ESLint/Prettier.
- Phaser canvas fills the screen (`Scale.RESIZE`, `pixelArt: true`); Preact overlay mounted.
- ESLint rule: `src/sim/**` may not import Phaser or DOM.
- npm scripts: `dev`, `build`, `test`, `lint`, `typecheck`.

**Acceptance criteria**
- [x] `npm run dev` shows a canvas with a colored background and a UI card "Eat here!" on top.
- [x] Works in portrait and landscape (rotate device/resize window) without stretching.
- [x] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` all pass.
- [x] A test proves the sim lint boundary (a deliberate Phaser import in sim fails lint).

### M1 — The room
**Goal:** see the restaurant and move the camera.
- Grid model in sim + placeholder tile rendering (floor, walls, door).
- Furniture from data: 2 tables + 4 chairs, oven, pass counter, at fixed starting positions.
- Camera pan (drag) + zoom (pinch/wheel) with integer zoom steps, bounded.
- Depth sorting by base Y.
- Camera fit reserves space for the HUD (top/bottom bars) so the room isn't covered by UI (seen in M0 landscape).

**Acceptance criteria**
- [x] 10×12 room with walls, door and furniture visible, pixels crisp at every zoom level.
- [x] Zoom only snaps to integer levels; camera can't leave the room bounds.
- [x] Rotating the phone re-fits the camera.
- [x] Unit tests for grid occupancy.

### M2 — Walking
**Goal:** characters move correctly through the room.
- A* pathfinding (unit tested).
- Debug: tap a tile → a test character walks there with 4-direction placeholder animation.
- Fixed-timestep sim loop + interpolated rendering.

**Acceptance criteria**
- [ ] Character walks around furniture, never through walls/furniture.
- [ ] Tapping an unreachable tile does nothing (no crash).
- [ ] Movement is smooth at 30 and 60 fps and at 2× sim speed.
- [ ] Pathfinding tests: straight line, around obstacle, unreachable, start = goal.

### M3 — Guests (self-service loop)
**Goal:** guests arrive, sit, "eat" and pay — no staff yet (food appears automatically).
- Guest spawner, guest state machine, seat claiming, patience, leaving.
- Money in sim + HUD (Preact) showing money.
- Coin popup on payment.

**Acceptance criteria**
- [ ] Guests enter, find a free chair, sit, eat (timer), pay, leave.
- [ ] With all seats full, new guests wait at the door and eventually leave with 😤.
- [ ] Money in HUD increases on each payment.
- [ ] Headless test: one simulated hour, every spawned guest ends in `gone`, no seat double-booked.

### M4 — Staff, kitchen & serving
**Goal:** the real loop: order → cook → serve.
- Job queue; waiter and chef state machines.
- Guest orders a dish (order bubble), waiter takes order → cook job → chef cooks at oven → dish on pass → waiter delivers → guest eats.
- Ingredient cost deducted per dish.

**Acceptance criteria**
- [ ] Full flow visible with 1 chef and 1 waiter, using 3 starting recipes.
- [ ] Never two staff on the same job; jobs for guests who left are cancelled.
- [ ] Headless test: one day with fixed seed — orders taken = dishes cooked = dishes served (±in-flight), no stuck staff.
- [ ] Manual: watch 5 minutes, nothing freezes or walks through walls.

### M5 — The day cycle
**Goal:** prep → open → close → report.
- Clock (10:00–22:00 ≈ 4 min), HUD clock + day number.
- "Open!" button; restaurant stops admitting guests at closing; remaining guests finish.
- Day report modal (income, costs, profit, guests served). Continue → prep phase of next day.
- Auto-pause on tab/app hidden.

**Acceptance criteria**
- [ ] A full day plays from Open to Report without input.
- [ ] Report numbers match the sim's day stats (unit tested).
- [ ] Switching tabs pauses the game; returning resumes exactly where it was.

### M6 — Happiness, fame & rank
**Goal:** the "make guests happy → grow" feeling.
- Happiness meter per guest (seated fast, served fast, dish quality, decor appeal).
- Emotes during the visit; tap a guest → info card with star bar.
- Fame from happiness, fame bar in HUD; Rank 1 → 2 with RANK UP modal and fanfare; Rank 2 unlocks Pepperoni.

**Acceptance criteria**
- [ ] Each guest visibly fills their bar; values follow GAME_DESIGN table (unit tested).
- [ ] Reaching 50 fame triggers RANK UP once (not again on reload).
- [ ] Pepperoni appears on the menu after rank up and guests order it.

### M7 — Build mode & first purchase
**Goal:** buy and place furniture on a free grid.
- Shop panel (prep phase only) with Potted Plant.
- Build mode: drag ghost, valid/invalid highlight, rotate, confirm/cancel; move existing furniture.
- Placement validation (footprint + reachability). Decor appeal affects nearby guests.

**Acceptance criteria**
- [ ] Buying deducts money; can't buy without enough money.
- [ ] Invalid placements (blocking the door, a chair or the oven) are refused with red highlight.
- [ ] Guests seated near the plant gain decor points (visible in their info card).
- [ ] Moving tables/chairs works and guests use the new positions.

### M8 — Recipe leveling
**Goal:** "salt on the fries" — level up dishes.
- Recipe panel: each dish with level, price, next ingredient upgrade + cost.
- Upgrading: money spent, level up toast + sound, higher price and quality.

**Acceptance criteria**
- [ ] Each of the 4 dishes can be upgraded Lv.1→3.
- [ ] Higher level dishes give more happiness and income (unit tested).
- [ ] LEVEL UP feedback is clearly visible and audible.

### M9 — Save & load
**Goal:** progress persists.
- Title screen: Continue / New Game.
- Autosave at prep start and after purchases; versioned saves with migration; backup slot.

**Acceptance criteria**
- [ ] Close the browser mid-prep and reopen → identical state.
- [ ] Close mid-day → reopen at that day's prep phase with that morning's state.
- [ ] Corrupt main save → loads backup with a friendly notice.
- [ ] Unit tests: round-trip save/load, migration from a v1 fixture.

### M10 — MVP polish & playtest
**Goal:** it feels good to play for 20 minutes.
- Placeholder SFX + music, juice pass (bounce, sparkles, popups).
- Balance pass using a headless "simulate 10 days" script (money/fame curves).
- Test on a real phone in both orientations.

**Acceptance criteria**
- [ ] A new player reaches Rank 2 in about 3–5 in-game days.
- [ ] 20-minute playtest by the user with no blocking bugs; feedback captured in DECISIONS.md / backlog.
- [ ] **MVP sign-off by the user.**

## Phase B — Make it ours (after MVP sign-off)

| Milestone | Content |
|---|---|
| M11 Art foundation | Style bible sheet, palette lock, asset pipeline scripts (`assets:check`), first final sprites (chef, waiter, guest, room) replace placeholders |
| M12 Facility levels | Furniture Lv.1–5, upgrade UI, visual variants, level-up juice |
| M13 Regulars | Named regulars with unlock conditions + weekday visits + jingle popup (Nonna Rosa first) |
| M14 Staff growth | Hiring pool, XP, levels, training, more staff |
| M15 Toilet & wandering | Toilet facility, guests look at decor, more decor items |
| M16 Guest types | 3–4 new types with preferences, unlocked by rank |
| M17 Expansion | Bigger room / second floor, Ranks 3–6 content, wages/rent |
| M18 Secret recipes | Taste profiles, free ingredient experimentation, recipe book |
| M19 Ending & completion | Legendary Pizzeria finale, continue-play, 100 % tracker |
| M20 Mobile release prep | Capacitor builds, performance on devices, store assets, settings |

Phase B order may change based on MVP playtest feedback.
