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

### M1 — The room ✅ (top-down placeholder; superseded visually by M1b)
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

### M1b — Isometric room (D-025, D-026) ✅
**Goal:** the room from M1, drawn in isometric view, pixel-perfect on every phone.
- `src/view/iso.ts`: tile↔screen projection, diamond hit-test, depth key — unit tested.
- Placeholder art regenerated isometric: diamond floors (wood, kitchen checker), two full-height back walls, low cut-away front walls, door in a front wall, furniture as simple iso boxes with 2:1 edges.
- Furniture rotation support in data/state (`rot` 0/1, mirrored sprite, rotated footprint).
- Camera fit/clamp on the room's diamond bounds; zoom integer in device pixels; slimmer landscape HUD insets.

**Acceptance criteria**
- [x] Room reads clearly as an isometric pizzeria in portrait and landscape; room is reasonably large in landscape.
- [x] All diagonal edges are clean 2:1 steps; pixels are even at DPR 1, 2 and 2.625.
- [x] Depth order correct: chairs behind/in front of tables as expected, oven in front of back wall.
- [x] Debug: tapping a tile highlights exactly that diamond (including near diamond edges).
- [x] Unit tests for projection round-trip, hit-test edges, depth ordering and rotated footprints.

### M2 — Walking
**Goal:** characters move correctly through the room.
- A* pathfinding (unit tested).
- Debug: tap a tile → a test character walks there with 4-direction placeholder animation.
- Fixed-timestep sim loop + interpolated rendering.
- Portrait default zoom: one integer step closer than "fit whole room" when the fit leaves the room small (player pans around), found in M1b review.

**Acceptance criteria**
- [x] Character walks around furniture, never through walls/furniture.
- [x] Tapping an unreachable tile does nothing (no crash).
- [ ] Movement is smooth at 30 and 60 fps and at 2× sim speed.
- [x] Pathfinding tests: straight line, around obstacle, unreachable, start = goal.

### M3 — Guests (self-service loop)
**Goal:** guests arrive, sit, "eat" and pay — no staff yet (food appears automatically).
- Guest spawner, guest state machine, seat claiming, patience, leaving.
- Money in sim + HUD (Preact) showing money.
- Coin popup on payment.

**Acceptance criteria**
- [x] Guests enter, find a free chair, sit, eat (timer), pay, leave.
- [x] With all seats full, new guests wait at the door and eventually leave with 😤.
- [x] Money in HUD increases on each payment.
- [x] Headless test: one simulated hour, every spawned guest ends in `gone`, no seat double-booked.

### M4 — Staff, kitchen & serving
**Goal:** the real loop: order → cook → serve.
- Job queue; waiter and chef state machines.
- Guest orders a dish (order bubble), waiter takes order → cook job → chef cooks at oven → dish on pass → waiter delivers → guest eats.
- Ingredient cost deducted per dish.

**Acceptance criteria**
- [x] Full flow visible with 1 chef and 1 waiter, using 3 starting recipes.
- [x] Never two staff on the same job; jobs for guests who left are cancelled.
- [x] Headless test: one day with fixed seed — orders taken = dishes cooked = dishes served (±in-flight), no stuck staff.
- [x] Manual: watch 5 minutes, nothing freezes or walks through walls.

### M5 — The day cycle
**Goal:** prep → open → close → report.
- Clock (10:00–22:00 ≈ 4 min), HUD clock + day number.
- "Open!" button; restaurant stops admitting guests at closing; remaining guests finish.
- Day report modal (income, costs, profit, guests served). Continue → prep phase of next day.
- Auto-pause on tab/app hidden.

**Acceptance criteria**
- [x] A full day plays from Open to Report without input.
- [x] Report numbers match the sim's day stats (unit tested).
- [x] Switching tabs pauses the game; returning resumes exactly where it was.

### M6 — Happiness, fame & rank
**Goal:** the "make guests happy → grow" feeling.
- Happiness meter per guest (seated fast, served fast, dish quality, decor appeal).
- Emotes during the visit; tap a guest → info card with star bar.
- Fame from happiness, fame bar in HUD; Rank 1 → 2 with RANK UP modal and fanfare; Rank 2 unlocks Pepperoni.

**Acceptance criteria**
- [x] Each guest visibly fills their bar; values follow GAME_DESIGN table (unit tested).
- [x] Reaching the Rank 2 threshold triggers RANK UP once (reload part verified in M9).
- [x] Pepperoni appears on the menu after rank up and guests order it.

### M7 — Build mode & first purchase
**Goal:** buy and place furniture on a free grid.
- Shop panel (prep phase only) with Potted Plant.
- Build mode: drag ghost, valid/invalid highlight, rotate, confirm/cancel; move existing furniture.
- Placement validation (footprint + reachability). Decor appeal affects nearby guests.

**Acceptance criteria**
- [x] Buying deducts money; can't buy without enough money.
- [x] Invalid placements (blocking the door, a chair or the oven) are refused with red highlight.
- [x] Guests seated near the plant gain decor points (visible in their info card).
- [x] Moving tables/chairs works and guests use the new positions.

### M7b — Flowing days, always-open shop, 4-way rotation (D-029, D-030)
**Goal:** the restaurant runs day after day by itself; you can shop and build any time.
- Remove the prep phase and Open! button. After the report → night transition (~2–3 s, darkened room, moon, "Day N+1") → next day starts at 10:00 automatically.
- HUD clock shows hours only + sun/moon icon.
- Shop and Build available in every phase; Build mode pauses the sim; in-use furniture can't be moved; no placing on tiles with characters; characters re-plan paths after changes.
- Furniture rotation 0–3 (back-facing placeholder sprites + mirroring); chairs must face an adjacent table to be used; auto-face on placement.

**Acceptance criteria**
- [x] Several days play in a row with only the "Next day" tap between them.
- [x] Buying and placing a plant mid-day works; time is frozen while placing and resumes after.
- [x] Moving an occupied chair/table is refused with a clear reason; no character gets stuck after a mid-day change (tested).
- [x] A chair can be rotated through all 4 directions; guests only sit on chairs facing a table.

### M8 — Recipe leveling with rare ingredients (D-031)
**Goal:** "salt on the fries" — level up dishes with special ingredients that are a little hard to get.
- Ingredient data (rarity, which dish/level they unlock) + inventory in state.
- Sources: Market tab in the Shop (3 seeded daily offers), gifts from very happy guests (popup), rank-up reward.
- Recipe panel: each dish with level, price, next upgrade (ingredient owned? + coins).
- Upgrading: coins + ingredient spent, LEVEL UP moment, higher price and quality.

**Acceptance criteria**
- [x] Each of the 4 dishes can be upgraded Lv.1→3 when you own the ingredient and coins; refused otherwise (unit tested).
- [x] Market offers change every morning and are deterministic per seed; gifts happen occasionally (measured rate reported).
- [x] Higher level dishes give more happiness and income (unit tested).
- [x] LEVEL UP and "gift" feedback are clearly visible (sound in M10).

### M9 — Save & load
**Goal:** progress persists.
- Title screen: Continue / New Game.
- Full-state autosave (D-032): every in-game hour, after purchases/upgrades, at day start and when the app is hidden; versioned saves with migration; backup slot.

**Acceptance criteria**
- [x] Close the browser mid-day and reopen → the game continues from the same moment (guests, staff, money, furniture, inventory).
- [x] A purchase made just before closing the tab is still there after reopening.
- [x] Corrupt main save → loads backup with a friendly notice.
- [x] Unit tests: round-trip save/load, migration from a v1 fixture.

### M9b — UI polish: money breakdown, in-place confirm, Menu (D-033)
**Goal:** friendlier everyday UI before the MVP polish pass.
- Tap the money card → **"Today" breakdown** popover: income (dishes, tips) and spending (ingredients, furniture, market, upgrades) as totals, plus the day's notable single items (e.g. "Potted Plant −150", "Big tip from Nora +22").
- Build mode: **Rotate / ✓ / ✕ float above the item** being placed (anchored to the ghost on screen), instead of a bottom bar.
- **Menu**: one Menu button opens a grid of shortcut cards (Shop, Market, Recipes, Build, and placeholders for future Staff, Stats, Settings). Our own look (card style, pizza icon) — not a copy of any existing game's menu (ART_DIRECTION §8).

**Acceptance criteria**
- [x] Money breakdown totals equal the day's money change (unit tested ledger).
- [x] Floating build controls stay on-screen and next to the ghost at all zoom levels, in portrait and landscape.
- [x] Every action reachable from the Menu; the bottom of the screen is less cluttered.

### M10 — MVP polish & playtest
**Goal:** it feels good to play for 20 minutes.
- Placeholder SFX + music (synthesised in code, D-035), Settings panel (sound, music, back to title), juice pass (bounce, sparkles, popups, reduced-motion aware).
- Balance pass using a headless "simulate 10 days" script (`npm run balance`, money/fame curves, D-034).
- Playtest kit: `docs/PLAYTEST.md`.
- Test on a real phone in both orientations.

**Acceptance criteria**
- [x] A new player reaches Rank 2 in about 3–5 in-game days. (`npm run balance`, scripted player, 10 seeds: day 4 on nine, day 3 on one; D-034. A human will be somewhat slower.)
- [x] Playtest by the user (desktop + phone, plus a second tester via a web build) with no blocking bugs; feedback: HUD layout change (M10b).
- [x] **MVP sign-off by the user** ("everything works", go for Phase B).

### M10b — Portrait HUD layout (user feedback)
- Portrait: **Menu button bottom-left**; **status badge (Open/Closing/Night) top-left**; to its right **money + "Day X" + time**; the "EAT HERE!" title card is removed from the in-game HUD (it stays on the title screen). Fame bar stays below. Landscape follows the same order in one top row.

**Acceptance criteria**
- [x] Layout as described in portrait 390×844 and 360×740; landscape tidy; nothing overlaps the room more than before; money breakdown still opens from the money card.

## Phase B — Make it ours (order agreed after MVP sign-off)

Order chosen to (1) validate our main differentiator early ("guests you care about"), (2) give money a purpose (money piles up after ~day 7), (3) pay down placeholder art before content multiplies.

| # | Milestone | Content |
|---|---|---|
| M11 | **Regulars & Moments** | Moments engine (data-driven trigger → card → reward), named regulars with unlock conditions, weekday visits, "The usual!" bonus, friendship hearts, story beats, "new regular" popup + jingle, Guests book in Menu, Next Goals card |
| M12 | Facility levels & more furniture | Furniture Lv.1–5 with upgrade UI and visual variants; more tables/chairs/decor (incl. low dividers); money sink |
| M13 | Art foundation | Style bible, palette lock, asset pipeline + `assets:check`, first final sprites (chef, waiter, guests, room, MVP furniture) |
| M14 | Staff growth | Hiring pool, XP, levels, traits, more staff |
| M15 | Groups & bigger tables | Guests arriving as groups (couples, friends, families), 4-seat tables, group seating |
| M16 | Themed Areas & guest types | Children's Area → families, Animal Area → dog owners with dogs, reading nook → students; appeal tags + guest preferences |
| M17 | Expansion | Bigger room, terrace, Ranks 3–6 content, wages/rent |
| M18 | Magazine, Mystery Critic & Awards | Moments-driven reviews, critic guest, yearly awards (trophies as decor, better suppliers) |
| M19 | Secret recipes | Taste profiles, free experimentation, recipe book |
| M20 | Ending & completion | Legendary Pizzeria finale, continue-play, 100 % tracker |
| M21 | Mobile release prep | Capacitor builds, device performance, store assets |

Toilet & wandering (old M15) folds into M12/M16 as furniture + happiness sources.

