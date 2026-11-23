# Decisions — Eat here! Restaurant game

Format: each decision has an ID, status, the decision, alternatives considered, and why. Add new entries at the bottom; don't delete old ones — mark them *Superseded by D-xxx*.

---

### D-001 Genre: manager sim, not active time-management
**Status:** Accepted (discovery)
**Decision:** Staff act autonomously; the player builds, decorates, tunes recipes and manages. No click-to-serve gameplay.
**Alternatives:** Diner Dash-style active serving; hybrid with frequent taps.
**Why:** Matches "cozy, relaxing" pillar and the target audience's desire to kill time without stress.

### D-002 Theme: pizzeria (v1.0)
**Status:** Accepted
**Decision:** v1.0 is a pizzeria. Other cuisines may come later.
**Why:** A narrow theme gives a stronger identity and a manageable number of recipes and art.

### D-003 Camera: top-down ¾ on a square grid
**Status:** Superseded by D-025
**Alternatives:** Isometric.
**Why:** Roughly half the art cost (3 directions instead of 4+ angles per object), simpler depth sorting and tap-to-tile mapping.

### D-004 Orientation: portrait and landscape, integer zoom
**Status:** Accepted
**Decision:** Support both orientations; pan + pinch zoom snapping to integer zoom levels.
**Why:** User wants Kairosoft-like flexibility. Integer zoom keeps pixel art crisp. Cost: UI must be edge-anchored and responsive (mitigated by D-011). Portrait is the primary design target.

### D-005 Time structure: day cycle
**Status:** Accepted
**Decision:** Prep phase (time stopped) → business day (~4 min) → day report.
**Alternatives:** Continuous time.
**Why:** Clear reward rhythm, natural save points, easier balancing and testing.

### D-006 No offline progress; pause when unfocused
**Status:** Accepted
**Why:** User preference; also removes a whole class of balancing problems.

### D-007 Business model: premium
**Status:** Accepted
**Why:** Fits the audience and cozy design; no monetization pressure on the economy.

### D-008 Building only in prep phase (MVP)
**Status:** Superseded by D-029
**Decision:** Buying/placing/moving furniture only while the restaurant is closed.
**Alternatives:** Build anytime with time paused; build anytime live.
**Why:** Avoids edge cases (moving a table a guest is sitting at, paths invalidated mid-walk). Can be relaxed later.

### D-009 Free-grid furniture placement
**Status:** Accepted
**Decision:** Furniture placed freely on the grid, validated so the door, seats and equipment stay reachable.
**Alternatives:** Fixed slots.
**Why:** Building/decorating is core to the charm. Pathfinding on a small grid is cheap.

### D-010 Phaser 3 + TypeScript + Vite, browser-first, Capacitor later
**Status:** Accepted
**Alternatives:** Godot (strong 2D engine, but new language/editor for the user; web export heavier), PixiJS (renderer only — we'd build scene/input/animation ourselves), Excalibur/Kaplay (smaller ecosystems).
**Why:** Matches user's web/TS skills, mature 2D features (tilemaps, sprite animation, input, camera, scaling), huge community. Capacitor wraps the web build for stores with minimal changes.
**Note:** Phaser 4 should be evaluated at M0 — if stable and documented, prefer it; otherwise latest Phaser 3.x.

### D-011 UI in DOM (Preact) over the Phaser canvas
**Status:** Accepted (plan approved before M0)
**Alternatives:** UI drawn in Phaser; vanilla DOM without a library.
**Why:** The "modern UI vs retro world" identity wants sharp, native-resolution text and responsive layouts — trivial with CSS, painful in canvas. User is a web developer. Preact (~4 kB) gives components without React's weight; vanilla DOM would become messy with many panels.
**Risk:** Two rendering systems; mitigated by the rule that both only read sim state and send commands.

### D-012 Simulation core independent of rendering
**Status:** Accepted (plan approved before M0)
**Decision:** All game logic in `src/sim` as pure TS operating on plain serializable state; Phaser and UI are projections.
**Alternatives:** Logic inside Phaser game objects (typical tutorial style).
**Why:** Testable without a browser, trivial save/load, deterministic debugging with seeded RNG, renderer can change without touching rules.

### D-013 Systems + state machines + job queue (no ECS library)
**Status:** Accepted (plan approved before M0)
**Alternatives:** ECS library (bitecs etc.), behavior trees, GOAP.
**Why:** Our entity count is tiny; plain objects + per-entity state machines + a shared job queue are the simplest understandable model and extend fine to many staff.

### D-014 Own A* pathfinding, 4-directional, no character collisions
**Status:** Accepted (plan approved before M0)
**Alternatives:** easystar.js; navmesh; local avoidance.
**Why:** ~100 lines, fully tested, no dependency. Characters overlapping briefly is standard and acceptable in this genre.

### D-015 Saves: autosave at prep start; mid-day quit restarts the day
**Status:** Superseded by D-032
**Alternatives:** Snapshot anytime including in-flight guests.
**Why:** Days are ~4 minutes, so little progress is lost; avoids serializing transient AI state. Full-state saving remains possible later since state is plain data.

### D-016 Abstract ingredients (no inventory)
**Status:** Accepted
**Why:** Inventory management adds stress, against the cozy pillar.

### D-017 Recipe leveling: simple in MVP, secret-recipe experimentation later
**Status:** Accepted
**Decision:** MVP: buy predefined ingredient upgrades to level dishes. Later: free experimentation with taste profiles (great combos, clashes, balancing, disasters).

### D-018 Happiness meter per guest → fame → restaurant rank
**Status:** Accepted
**Decision:** Guests start at an empty bar filled by experiences (food, speed, decor, toilet…). On leaving, it converts to fame; fame thresholds trigger rank ups with unlocks.

### D-019 Long-term goal: reach "Legendary Pizzeria", then optional 100 % completion
**Status:** Accepted (adjusted from user proposal)
**Decision:** The ending triggers at the top rank; then the player may continue freely. 100 % completion (all dishes Lv.5, all guests, all facilities Lv.5…) is an optional collection goal, not required to "finish".
**Why:** Requiring 100 % for the ending tends to create an end-game grind.

### D-020 English only, no localization in v1.0
**Status:** Accepted
**Decision:** All text in English; UI strings still kept in one module (`src/data/strings.ts`) to keep the door open.

### D-021 Art: 16 px tiles, 16×24 characters, locked palette, AI concepts + manual cleanup
**Status:** Accepted (plan approved before M0)
**Why:** Small sizes keep the art workload manageable and the charm high. AI output is not usable pixel art directly; a pipeline with palette locking, cleanup and automated validation keeps assets consistent.

### D-022 Content as typed TS data, not JSON
**Status:** Accepted (plan approved before M0)
**Why:** Type checking and autocomplete on all content; no schema validation layer needed. Can move to JSON later if a modding/editor need appears.

### D-023 Language: user communication in Swedish, everything in the repo in English
**Status:** Accepted

### D-024 Phaser 4 instead of Phaser 3
**Status:** Accepted (M0)
**Decision:** Use Phaser 4.2.1 (stable `latest` on npm at M0). All deps pinned to exact versions.
**Why:** D-010 said to prefer Phaser 4 if stable. Note for future sessions: many tutorials/examples online are Phaser 3 — check API differences against Phaser 4 docs before copying code.

### D-025 Camera: isometric view (supersedes D-003)
**Status:** Accepted (after M1)
**Decision:** The world is drawn in **isometric** projection (room rotated 45°, diamond floor tiles, 2:1 pixel lines), like classic Kairosoft management games. The **simulation grid is unchanged** (square tiles, x/y); only the view layer projects it.
**Alternatives:** Keep top-down ¾ (D-003).
**Why:** The user's reference for the desired feel is isometric, and it is what the target audience associates with the genre. Switching right after M1 is the cheapest point: no final art exists and only the renderer must change. Costs accepted: isometric pixel art is harder to draw/clean up (strict 2:1 lines), and the view needs tile↔screen projection, x+y depth sorting and diamond hit-testing.

### D-026 Pixel-perfect zoom in device pixels; slimmer HUD in landscape
**Status:** Accepted (after M1)
**Decision:** Integer zoom is computed in **device pixels** (render at `devicePixelRatio`), so one art pixel is always a whole number of physical pixels, also on fractional-DPR phones (e.g. 2.625). Landscape uses slimmer HUD insets than portrait so the room isn't tiny.
**Why:** Found in M1 review: CSS-pixel integer zoom gives uneven pixels on fractional DPR, and landscape at 844×390 left only 214 px for the room.

### D-027 Character style: "chunky pixel" (user's level 3)
**Status:** Accepted (during M4)
**Decision:** Characters use a minimal, chunky retro style: 16×24 frames, ~6–8 colors per character, 1 px dark outline, 1–2 px eyes, no nose/mouth detail except in emotes, roles told apart by silhouette and headwear (chef hat, waiter cap/vest). The **world** (furniture, room, food) may carry somewhat more detail and warmth than the characters.
**Alternatives:** "Balanced pixel" (more facial detail, recommended in an AI mock-up), "soft pixel" (near-illustrative).
**Why:** At a true 16×24 size the detailed styles can't actually exist — the mock-ups were drawn far larger. Chunky pixel is the most honest to our sprite size, the fastest to produce and animate, the most robust for AI-concept cleanup, and maximizes the retro-world vs modern-UI contrast that is our identity. Expressiveness comes from animation (bounce, squash), emotes and bubbles rather than faces.

### D-028 Happiness scale: good basic service ≈ 3 stars; rank thresholds ×7
**Status:** Accepted (M6 review)
**Decision:** Always-awarded "Nice little place" +10 on sitting down; seated quickly +15 (limit 15 s), order taken quickly +10, food quickly +15; dish quality 10 + 5 × level (Lv1 15 … Lv5 35); decor and fame/tip formulas unchanged; rank fame thresholds 0 / 350 / 1400 / 4200 / 10500 / 28000. **Why:** with the draft numbers an average guest showed ~1.4 stars, which reads as "unhappy" — wrong for a cozy game. Basic good service now shows ~2.5–3 stars; recipe levels and decor are how you reach 5. Rank thresholds scaled to keep Rank 2 around day 3 (measured over 10 seeds × 6 days: Rank 2 on day 3 in all 10, ~136 fame/day, avg happiness ~60).

### D-029 Automatic day/night cycle; shop always open; build mode pauses time (supersedes D-008)
**Status:** Accepted (user request after M7)
**Decision:** No "Open!" button and no prep phase. Day runs 10:00–22:00, closes, shows the day report, then a short night transition and the next day starts automatically. Shop, Market and Recipes are always available; Build mode pauses the sim while placing/moving. Furniture in use can't be moved; nothing is placed on tiles where characters stand; characters re-plan paths after a change. The HUD clock shows hours only.
**Why:** The user wants the flow to feel continuous and alive, and spending money whenever you have it. Pausing during build keeps the edge cases (D-008's reason) manageable.

### D-030 Furniture has 4 orientations
**Status:** Accepted (user request after M7)
**Decision:** `rot` is 0–3. Art draws **2 orientations (front-facing and back-facing)**; the other two are mirrored. 2×1 footprints swap on odd rotations. A chair is usable only when it **faces an adjacent table**; when placed next to a table it auto-faces it by default, and the player can rotate freely (warning when it faces no table).
**Why:** Players expect to turn a chair any way, including "backwards". Cost: one extra drawn view per furniture piece.

### D-031 Rare upgrade ingredients as collectibles (clarifies D-016)
**Status:** Accepted (user request at M8)
**Decision:** Leveling a dish costs coins **and** a special ingredient item. Items are collectibles in an inventory (Market with daily random offers, gifts from very happy guests, rank-up rewards). Daily cooking stays abstract with no stock (D-016 unchanged).
**Why:** The user wants some upgrade items to be hard to get — a collection goal that supports "always a next goal" without inventory stress.

### D-032 Save the full game state, any time (supersedes D-015)
**Status:** Accepted (after M7b)
**Decision:** Saves contain the complete `GameState`, written every in-game hour, after purchases/upgrades/placements, at day start and when the app is hidden. Reload continues exactly where the player left.
**Why:** With D-029 there is no prep phase and purchases happen mid-day; restarting the day on reload would make bought items "disappear". Since all state is plain serializable data (D-012), a full save is simpler than a partial one.

### D-033 Everyday UI: money ledger, in-place build controls, Menu hub
**Status:** Accepted (user request after M8)
**Decision:** (1) The sim keeps a per-day **ledger** of categorized money entries; tapping the money card shows totals + notable items. (2) Build controls float next to the placed item. (3) A single **Menu** button opens a grid of shortcut cards; it replaces the row of Shop/Recipes/Build buttons and scales to future features. Gift threshold lowered to 70 (user choice) so the first gift can arrive after the first plant/upgrade.
**Why:** Players want to understand where money went, and a hub menu keeps the screen clean as features grow. The hub-menu pattern is generic in the genre; our look and layout follow our own card style (ART_DIRECTION §8).

### D-034 MVP balance pass (M10)
**Status:** Accepted (M10)
**Decision:** Tuned by data only, measured with `npm run balance` (scripted player: buys up to 4 plants, upgrades recipes, buys needed commons; 10 seeds × 10 days). Tip divisor 200 → **140**; Rank 2 fame 350 → **500** (Rank 3 stays 1400); guest seat patience 20 → **30 s**; arrival gaps 8–14 / 4–7 s → **9–15 / 5–8 s**; Rank 2 arrival bonus 1.15 → **1.05**, Rank 3 1.3 → **1.15**. **Why:** with four seats and no way to add tables yet, more guests only meant more guests turned away (16 % of arrivals on day 1, up to 48 % by day 10). Tips were too small to notice (the day's biggest tip was 4-5 before Pepperoni). Rank 2 came on day 3 for every seed, the low end of the 3-5 target. Result: Rank 2 on day 4 (day 3 on one seed), turned away 1-14 %, profit positive every day (lowest +219), biggest tip 5-6 on days 1-2 and 7-11 later.

### D-035 Procedural audio, settings and "Back to title" (M10)
**Status:** Accepted (M10)
**Decision:** All sounds are synthesised with the Web Audio API in `src/platform/audio.ts` from tone lists in `src/data/audio.ts` (no asset files, no new dependency). The context is created on the first user gesture and suspended while the page is hidden. SFX are rate-limited per sound and with a global burst budget. Music is a quiet plucked arpeggio loop (80 bpm) that glides to a softer, darker variant while closing, at the report and at night. Settings (sound effects, music) live in their own localStorage key, apart from the save. "Back to title" saves and reloads the page, which drops every binding of the running session in one go (simplest correct teardown). **Why:** placeholder audio that costs nothing to keep and is replaced later by the real assets listed in ASSET_LIST §7; a reload avoids leaking listeners from the old sim.

### D-036 Recipe levels 1–5: coins for Lv.2–3, coins + rare ingredient for Lv.4–5 (revises D-031)
**Status:** Accepted (user choice after M10)
**Decision:** Dishes go to **Lv.5**. Lv.2–3 cost coins only; Lv.4–5 cost coins **and** a rare ingredient. Common ingredients are no longer needed for levels (they stay useful later for toppings/secret recipes; until then the market mainly sells rares).
**Why:** Early levels should feel quick and rewarding; the rare-ingredient hunt becomes the late challenge ("always a next goal"). Later: Lv.5 + a special topping = "super delicious" → attracts a special guest.
**M11b numbers:** Lv.2 = 60, Lv.3 = 150, Lv.4 = 300, Lv.5 = 500 coins (unchanged by the balance script: first Lv.4 ≈ day 5.5, first Lv.5 ≈ day 9.5 for the scripted player). Rarity `exclusive` = only from a story beat (Nonna's Secret Basil). Market and gifts are rares only (market 150–260). Nonna Rosa unlocks at a Margherita Lv.4, Oliver after 20 Pepperoni. Save v4 pays 40 coins per old common owned.

### D-037 Regulars and moments are plain state plus data (M11)
**Status:** Accepted
**Decision:** Moments (`src/data/moments.ts`) and regulars (`src/data/regulars.ts`) are typed data; regular unlocks and story beats are generated into moments. State holds `momentsSeen`, `counters` (`served`, `servedLevel` per recipe) and one `RegularState` per regular (`unlocked, hearts, visits, lastVisitDay, lastHeartDay` plus the day's seeded arrival `plan` and a pending `companionDue`). Triggers are re-checked after a dish is paid, at a new day and after a recipe upgrade. A regular is an ordinary `Guest` with `regularId` and a fixed `look`; a companion (Mia) is an ordinary guest with `companionOf` that prefers the free chair nearest her partner's. The moment card pauses the sim with its own pause reason, like RANK UP. Next Goals are computed from state (`sim/systems/goals.ts`); the "!" dot is UI-only. **Why:** keeps the sim pure and saveable, lets later content (magazine, awards, events) reuse moments, and needs no group system yet (M15).

### D-038 The room grows with rank (moves expansion forward)
**Status:** Accepted (user request at M12)
**Decision:** Each rank-up from Rank 2 unlocks more floor space: the sim grid is allocated at its final size and the room is an unlocked rectangle inside it that grows on rank-up; the door and all existing furniture keep their coordinates; new floor is plain wood. Implemented as M12b right after the M12 catalog. (The terrace and a second floor stay in M17.)
**Why:** "Level up → more space" is the clearest reward for growing, and the bigger catalog in M12 needs room.
**Final schedule (M12b):** the grid is 20×17; the starting room is the old 8×11 interior at x 3..10, y 6..16 (a v5 save is shifted by +2, +5 once, in the v5 → v6 migration). Growth per rank (`src/data/expansion.ts`): Rank 2 +3 columns on +x, Rank 3 +3 rows on −y, Rank 4 +3 columns on +x, Rank 5 +2 columns on −x and +2 rows on −y, Rank 6 +2 columns on +x (final room 18×16, never outside the grid). Walls are derived from `state.room`; the door row (y1) never moves, so no growth towards +y. **Camera zoom rule:** the default zoom fits the whole room, but never goes below 2 device pixels per art pixel (a larger room is panned; after a rank-up the camera glides to the new area); the old portrait rule (one step closer when the room fills under 80 % of the width) stays. Surroundings are generated around the current room from coordinate hashes. **Related (same milestone):** any open menu or panel pauses the sim, and furniture in use can be moved (users are carried along or nudged); selling a piece in use is still refused.

### D-039 Facility levels, aura stacking, surface appeal (M12)
**Status:** Accepted
**Decision:** (1) Every furniture piece has Lv.1-5; the next level costs `levelUpCost[level-1]`; selling refunds 50 % of price + 50 % of upgrade coins. Effects are per-level arrays in `src/data/furniture.ts`: `appeal` (decor only), `comfort` (chairs *and* tables: "Comfy seat" = chair + the table it faces), `aura`, `interaction.points/coins`, `speed` (oven cook time, pass placing/picking up). (2) **Auras:** per reason only the best single source counts (a second piano adds nothing); different reasons add up; the total stays clamped to 100. (3) **Floors/walls** count as decor appeal: floor tiles within 1 of the chair and wall segments whose room tile is within 2 add at most `SURFACE_CAP` = 4 points, and furniture + surfaces share `DECOR_CAP` = 20. Painted styles are stored sparsely (`state.styles`, "x,y" and `l<y>`/`r<x>` keys; defaults are not stored), so they stay coordinate-based for the M12b room growth. (4) **Errands:** a guest waiting for a seat may snack once at a free vending machine; after eating a guest may visit a free toilet before paying. The claim is `guest.errand.furnitureId` (one user at a time, no queue: a busy toilet is simply skipped, a free seat cancels a snack trip), the piece cannot be moved or sold while claimed, and the use spot must stay reachable. (5) **Unlock schedule:** start: wooden chair, small table, plant, wood/checker floor, cream wall; Rank 2: cushioned chair, flower box, floor lamp, toilet, terracotta, brick; Rank 3: long table, vending machine, easel, divider, herringbone, green stripes; Rank 4: piano, statue, pillar, blue tiles. The oven and pass are upgraded, not bought. **Why:** gives money a lasting purpose and every purchase a visible, countable effect while keeping all rules in sim data.
**Balance (M12):** the scripted player (24 days, 10 seeds) keeps its Rank 2 on day 3.7, Rank 3 on day 9.0 and no longer piles up money (day 24: about 700 instead of 5,900; about 5,800 coins spent on furniture, upgrades and paint). Extra tables only lengthen the queue while there is one chef (M14 adds staff): the oven is the first thing worth upgrading.

### D-040 Sprite source format and pipeline (M13)
**Status:** Accepted
**Decision:** Sprites are authored as human-readable text pixel maps (`assets/sprites/**/*.px`): a header (entity, size, pivot, kind), animations per facing (`front`/`back`/`none`) with frames as rows of single characters, optional `mirror` and palette-swap `variant` declarations. Characters index the locked palette in `assets/palette/world.hex` (one char per colour, `.` = transparent, one translucent entry only for the shadow). `npm run assets:build` (Node, no dependencies, own PNG encoder on `zlib`) packs them into `public/assets/atlas.png`, a Phaser JSON atlas and `anims.json` (fps/frames per `<anim>_<dir>`); frame names are `<entity>_<anim>_<dir>_<n>`. `npm run assets:check` validates palette, alpha, sizes per kind, naming and the feet row, and runs inside `npm test` together with a check that the committed atlas is current. Generated files are committed. The view aliases static frames onto the old placeholder texture keys and plays character animations from the manifest; placeholders remain for anything not drawn yet. The first drafts were produced with helpers in `assets/author/` (layered patches + outline); the `.px` files are the source of truth and are edited by hand from then on. The chef is 24 px wide (pivot 12,23) so the peel fits in the bake frames.
**Alternatives:** Aseprite files + CLI export (needs a licensed tool in CI), hand-drawn PNGs (not diffable), runtime-generated art (what the placeholders did).
**Why:** Diffable, reviewable by Claude and humans, reproducible, no new dependency, and the palette lock and baseline rules are enforced by a script. AI concept boards stay references (ART_DIRECTION section 8): the maps are drawn by hand, not converted.


### D-041 Parties, seating rules and street life (M12c)
**Status:** Accepted
**Decision:** (1) A **spawn event is a party** (`src/data/parties.ts`): solo (1), couple (2), friends (2-4) or family (2 adults + 1-2 kids). Rank 1 only brings solo guests and couples (the starting tables seat two); weights by rank are data (`PARTY_MIX`), and a Children's Area (data check `CHILDRENS_AREA_PIECES`, empty until M16) multiplies the family weight. A party with 2+ members is a `Party { id, kind, memberIds }` in `state.parties`; every guest has `partyId` and `kid`. Solo guests have no party. (2) **Seating is atomic:** a party waits together at the door; the first member waiting drives the claim and the patience timer. It claims **one chair per member in one go, all inside one table group** (the chairs that face one table, or a run of tables that touch), after every member got a route; else nobody sits and, when the patience runs out (or at closing), **the whole party leaves together** (`noSeat` / `closed`). Claims stay exclusive (`seatId`). A kid takes a kids-only seat (`chair_high`, Rank 2) first and may use any ordinary chair; adults and lone guests never use kids-only seats, and a kid never sits without a parent. (3) Each member orders their own dish (kids pick among the `KID_MENU_SIZE` cheapest unlocked dishes), eats and pays on their own (one `paid` event and ledger line per dish and tip); the party **leaves together** after the last member has paid. Sitting down together gives every member +5 happiness ("Fun with friends" for couples and friends, "Family time" for families). If a party breaks up (a furniture change cut a route), a member left waiting seeks a seat next to a seated partner like Mia does. Oliver and Mia keep their companion logic. (4) A lone guest prefers a table that is already taken over a free one, so whole tables stay free for parties. (5) **The street:** guests spawn on the sidewalk (`SIDEWALK_Y`, outside the sim grid) `STREET_APPROACH_TILES` tiles from the door on a seeded side, walk along it, in through the door and one tile in; party members line up one tile behind each other. Leaving guests walk out through the door and away along the sidewalk. Paths with sidewalk parts are split (`splitRun`) so re-planning only touches the part inside the room. The door bell rings on `guestEntered`. **Passers-by** and **dog walkers** are **view-only** (`src/view/street.ts`, own seeded RNG, not saved, no effect on the sim); at night (closed) they are much rarer. A dog walker stops at the door and shows a broken heart unless `hasAnimalArea(furniture)` (data list `ANIMAL_AREA_PIECES`, empty until M16). (6) `table_long` (2x1, 4-6 chairs) is the 4-seat table (cheaper: 100, now Rank 2); no new table piece.
**Alternatives:** a seat-by-seat claim with rollback (more states to get wrong); passers-by as sim entities (cost in determinism and saves for pure decoration); a new 2x2 table (needs new art and rotation work for little gain).
**Why:** groups and families are the genre's strongest "building has a purpose" loop: a bigger table or a high chair directly shows up as families that stay. Atomic claims keep the exclusive-seat invariant simple to test.

### D-042 Calmer start and advertising (M12c)
**Status:** Accepted (user playtest: "guests come too often and too fast in the beginning")
**Decision:** (1) **Calmer start:** arrival gaps (now per *party*) 9-15 / 5-8 s -> **24-40 / 14-22 s**; arrival-rate bonus per rank 1 / 1.05 / 1.15 / 1.5 / 1.7 / 2.0 -> **1 / 1.3 / 1.6 / 1.9 / 2.2 / 2.5**; Rank 2 fame 500 -> **400**; decor adds up to +30 % arrivals (curb appeal, 0.4 % per appeal point). Growth now comes from rank (more and bigger parties), decor and advertising. Before / after, scripted player, 10 seeds: day 1 arrivals 26.8 -> 14.4, guests served 24.5 -> 14.1, average seat wait 9.0 s -> 2.8 s, chef busy 77 % -> 44 %, noSeat 0 % both on day 1, Rank 2 day 3.8 -> 4.2, profit positive on every day (lowest 144). (2) **Advertising** (`src/data/campaigns.ts`, Promote card in the Menu, command `startCampaign {id}`; refused at night and in the report, while one runs, below the rank or without the coins; ledger kind `ads`; the first one fires the moment "The whole street heard about your pizzas!"): Flyers (Rank 1, 30 coins, +40 % arrivals for the rest of the day), Poster (Rank 2, 100, +60 % today and tomorrow), Local radio (Rank 3, 260: a **rush** at the next lunch (12:00) or dinner (18:00) start, 6 extra parties within one in-game hour = 20 real seconds, dropped if the room is full). The HUD badge shows "Flyers active" while a campaign runs and "Rush!" during the rush.
**Why:** a quiet first day lets the player learn the loop; the sources of growth are the player's choices. The numbers were tuned with `npm run balance` (see the M12c ROADMAP entry).

### D-043 Level art as overlays; night veil in the world (M13b)
**Status:** Accepted
**Decision:** Furniture level visuals are hand-drawn overlay sprites on the piece's canvas (`trim_<piece>` from Lv.3, 2-frame `accent_<piece>` from Lv.5), drawn on top of the base frame; the oven keeps its woodpile and copper collar. The night veil moved from a CSS overlay into the Phaser world (a tinted rectangle over the camera view) so lamp glow frames can be drawn above it.
**Why:** Overlays cost little atlas space, keep animated bases (oven, vending) working at every level, and give real art instead of a derived tint. Glows need to sit above the darkening, which an HTML overlay cannot allow.

