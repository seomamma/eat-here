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
**Status:** Accepted
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
**Status:** Accepted (assumption — revisit after MVP)
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
**Status:** Proposed — needs approval
**Alternatives:** UI drawn in Phaser; vanilla DOM without a library.
**Why:** The "modern UI vs retro world" identity wants sharp, native-resolution text and responsive layouts — trivial with CSS, painful in canvas. User is a web developer. Preact (~4 kB) gives components without React's weight; vanilla DOM would become messy with many panels.
**Risk:** Two rendering systems; mitigated by the rule that both only read sim state and send commands.

### D-012 Simulation core independent of rendering
**Status:** Proposed — needs approval
**Decision:** All game logic in `src/sim` as pure TS operating on plain serializable state; Phaser and UI are projections.
**Alternatives:** Logic inside Phaser game objects (typical tutorial style).
**Why:** Testable without a browser, trivial save/load, deterministic debugging with seeded RNG, renderer can change without touching rules.

### D-013 Systems + state machines + job queue (no ECS library)
**Status:** Proposed — needs approval
**Alternatives:** ECS library (bitecs etc.), behavior trees, GOAP.
**Why:** Our entity count is tiny; plain objects + per-entity state machines + a shared job queue are the simplest understandable model and extend fine to many staff.

### D-014 Own A* pathfinding, 4-directional, no character collisions
**Status:** Proposed — needs approval
**Alternatives:** easystar.js; navmesh; local avoidance.
**Why:** ~100 lines, fully tested, no dependency. Characters overlapping briefly is standard and acceptable in this genre.

### D-015 Saves: autosave at prep start; mid-day quit restarts the day
**Status:** Proposed — needs approval
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
**Status:** Proposed — needs approval
**Why:** Small sizes keep the art workload manageable and the charm high. AI output is not usable pixel art directly; a pipeline with palette locking, cleanup and automated validation keeps assets consistent.

### D-022 Content as typed TS data, not JSON
**Status:** Proposed — needs approval
**Why:** Type checking and autocomplete on all content; no schema validation layer needed. Can move to JSON later if a modding/editor need appears.

### D-023 Language: user communication in Swedish, everything in the repo in English
**Status:** Accepted
