# Game Design — Eat here! Restaurant game

> Status: draft v0.1 — awaiting approval. Numbers are starting points for tuning, not final balance.

## 1. Vision

A cozy, pixel-art **pizzeria management sim** for mobile. You start with a tiny hole-in-the-wall pizzeria and grow it into a legendary restaurant. You never rush to click — your staff do the work. Your job is to **build, decorate, tune recipes, and watch the place come alive**.

**One-line pitch:** *Watch your tiny pizzeria grow — every dish, guest, and chair levels up.*

### Design pillars

1. **Everything grows.** Dishes, furniture, staff, guests' happiness, and the restaurant's rank all visibly level up. Leveling up must always feel good (sound, pop, sparkle).
2. **Cozy, never stressful.** No inventory management, no fail states that punish hard, no timers that demand clicks. The game pauses when you leave.
3. **Alive and charming.** Guests react with emotes, wander, sit, eat, and remember you. Small animations everywhere.
4. **Retro world, modern UI.** Tiny pixel characters in a warm world, framed by clean, bold, modern interface cards.
5. **There is always a next goal.** Motivation comes from goals, not from flashy rewards. At any moment the player can see something to strive for on three horizons:
   - *today* — e.g. "serve 30 guests", beat yesterday's profit;
   - *this week* — the next rank, the next recipe or facility level, a regular who is about to "unlock";
   - *long term* — Legendary Pizzeria, the year's awards, 100 % completion.
   Rewards are celebrated warmly but briefly (a jingle, a card, a sparkle) — never loud "slot machine" effects, countdown pressure or punishment for being away.

### Differentiation: "guests you care about" (vision note, from discovery after M2)

There are thousands of management sims. Our hook is that **the restaurant remembers its guests** and small stories happen around them while the management game keeps running.

Candidate tagline: *"Build a restaurant. Serve your guests. Become part of their stories."*

Three differentiators (all post-MVP, built on systems we already plan):
1. **Guests you actually care about.** Named regulars with a favorite dish, visit day and small relationships that evolve over visits (e.g. *Oliver* comes every Tuesday for his usual; after five visits he greets the chef; one day he brings his girlfriend; later they celebrate something here; one day he comes alone again 💔). Story beats are short, data-driven scripts triggered by visit counts/conditions — no generative AI, no big narrative system. Tone stays cozy: bittersweet at most.
2. **Decor that matters.** Not only "+5 from a plant": furniture gets **appeal tags** (cozy, romantic, view, lively…) and guest types have **preferences** (couples want a romantic corner, students want lively seats, window tables are popular). Fits the data-driven furniture model.
3. **Small moments worth sharing.** Rare, charming events: a proposal at a table, the chef dropping a pizza, a good review causing a queue outside. Implemented as an event table with conditions + cooldowns.

Earliest test of the hook: the first Regulars milestone — "Oliver comes back, says *The usual, please!*, and we get a bonus for remembering his favorite." If players smile at that, we double down.

### Target audience

Adults (roughly born in the 1980s) who grew up with 2D pixel games and love management / time-management-style games, but want a relaxing time-killer they feel attached to. Short sessions (5–15 min) on the phone, with a reason to come back ("one more day", "just level my Margherita").

### Business model

**Premium** (pay once). No ads, no in-app purchases, no energy timers. Design decisions never need to serve monetization.

### Platform

Browser first (HTML5), then iOS/Android. **Portrait and landscape** both supported. Single-player, offline, local saves. English only (no localization in v1.0, but text is kept in one place).

## 2. Core gameplay loop

```
   ┌─────────────── PREP PHASE (time stopped) ───────────────┐
   │  build / move furniture · buy decor · upgrade recipes   │
   │  upgrade furniture · hire/train staff (post-MVP)        │
   └───────────────────────────┬─────────────────────────────┘
                               ▼  tap "Open!"
   ┌─────────────── BUSINESS DAY (~4 min real time) ─────────┐
   │  guests arrive → sit → order → chef cooks →             │
   │  waiter serves → guest eats, enjoys decor → pays → leaves│
   │  each guest fills a happiness meter → fame + tips       │
   └───────────────────────────┬─────────────────────────────┘
                               ▼  22:00 closing
   ┌─────────────── DAY REPORT ──────────────────────────────┐
   │  income, costs, guests served, best dish, fame gained   │
   │  RANK UP? new unlocks! · new regular? (post-MVP)        │
   └───────────────────────────┴──────► next day (autosave)
```

**Short loop (seconds):** watch a guest's happiness meter fill, coins pop.
**Medium loop (one day):** earn money → spend it in prep phase.
**Long loop (many days):** fame → rank ups → unlock recipes, furniture, guest types, bigger restaurant.

## 3. Time

- One **business day** = in-game 10:00–22:00 ≈ **4 minutes real time** at 1× speed (tunable).
- The game has a calendar (Day 1, Mon–Sun, weeks, seasons later). Weekdays matter for regulars (e.g. Nonna Rosa comes on Fridays).
- **Prep phase:** time is stopped. All building and purchasing happens here (MVP decision; see DECISIONS.md D-008).
- **Pause:** the game auto-pauses when the app/tab loses focus. **No offline progress.**
- Speed control (1× / 2×) post-MVP.

## 4. Guests

### Guest flow (state machine)

1. **Arrive** at the door.
2. **Find a table.** If a free seat exists → walk to it. If not → wait at the door; patience runs out → leave with a sad emote (no fame, small fame penalty).
3. **Sit & browse menu** (short delay), then raise hand.
4. **Order** when the waiter arrives. Picks a dish from the menu (weighted by guest preferences).
5. **Wait for food** (patience bar slowly decays meter bonus, not a fail).
6. **Eat** (eating animation).
7. **Wander (post-MVP):** may visit the toilet, look at decor.
8. **Pay** at the table (coins pop up), tip based on happiness.
9. **Leave.** Happiness converts into **fame**.

### Happiness meter ("the bar")

Every guest arrives with an **empty bar** (0–100, shown as 5 stars filling up above them when tapped and as an emote during the visit). Experiences add points:

| Experience | Points (draft) |
|---|---|
| Got seated quickly | +10 |
| Order taken quickly | +5 |
| Food arrived quickly | +10 |
| Dish quality (recipe level × 5, + favorite bonus) | +10 … +30 |
| Decor appeal near their seat (sum of appeal in radius) | +0 … +20 |
| Used toilet (post-MVP) | +10 |
| Looked at special decor while walking (post-MVP) | +5 each |
| Long waits | 0 for that step (no negative points in MVP) |

Emotes appear at key moments: 😋 tasty, ❤️ loved it, 💤 slow, 😤 left without table.

**On leaving:** `fame += happiness / 10` (draft), `tip = price × happiness / 200`.

### Guest types

- **MVP:** one guest type ("Local"), with palette variations for visual variety.
- **Post-MVP:** several types (Student, Office worker, Family, Food critic, Tourist…) with different budgets, favorite dishes, patience, and appeal preferences. New types unlock via rank.

### Regulars (post-MVP, first big feature after MVP)

Named characters with a favorite dish and condition, e.g. **Nonna Rosa** — unlocks when you serve a Margherita with **Buffalo Mozzarella** at level ≥ 3. Then she comes **every Friday**. Unlock shows a joyful popup with a jingle: *"Nonna Rosa became a regular!"* Regulars give bonus fame and may unlock secrets.

## 5. Staff

- **MVP:** 1 Chef, 1 Waiter, fixed stats, already hired.
- **Data model supports stats and levels from day one:** `speed`, `cooking`, `service`, `level`, `xp`.
- **Post-MVP (Kairosoft-style):** hire from a pool of candidates, staff gain XP while working, level up (with fanfare), and can be trained for money.

### Roles

| Role | Jobs |
|---|---|
| Chef | Takes order tickets from the kitchen queue, cooks at an oven/stove, places dish on the pass (counter). |
| Waiter | Takes orders at tables, delivers dishes from the pass to tables, clears tables. |

Staff pick jobs from a shared **job queue** (see ARCHITECTURE.md). Idle staff return to their idle spot.

## 6. Recipes

### MVP menu (draft)

| Dish | Price | Ingredient cost | Cook time | Unlock |
|---|---|---|---|---|
| Marinara | 8 | 2 | 6 s | start |
| Margherita | 10 | 3 | 7 s | start |
| Garlic Bread | 6 | 1 | 4 s | start |
| Pepperoni | 13 | 4 | 8 s | Rank 2 |

Costs are **abstract**: each sold dish deducts its ingredient cost. No stock, no shortages.

### Recipe leveling (MVP: simple version)

Each dish has a **level (1–5)**. To level up, you buy an **ingredient upgrade** in the prep phase (e.g. Margherita + *Fresh Basil* → Lv.2, + *Buffalo Mozzarella* → Lv.3). Each level: higher quality points, slightly higher price. Big "LEVEL UP!" animation.

MVP ships with levels 1–3 for each dish.

### Secret recipes (post-MVP: experimental version)

Players can add **any** ingredient to a dish. Each dish has a hidden **taste profile** (e.g. salty / sweet / savory / spicy / fresh). Ingredients shift the profile:
- **Great combo** → mega success, new named variant (e.g. "Hot Honey Pepperoni").
- **Clashing combo** → taste penalty ("Too salty!"); you can **balance it** with another ingredient (e.g. mozzarella softens salt).
- **Disaster** → dish ruined, try again (no permanent loss besides cost).

This is a discovery system with a recipe book that fills up.

## 7. Facilities (furniture & equipment)

All furniture is data-driven: size (footprint), price, **appeal**, function (seat, table, oven, pass, decor, toilet…), and **level (1–5)**.

- **Leveling up facilities** is a core joy: Oven Lv.2 cooks faster; Plant Lv.2 gives more appeal; Table Lv.2 makes guests more comfortable.
- **MVP:** furniture can be placed on a free grid in prep phase. One purchasable item: **Potted Plant** (decor, +appeal). Facility levels come in the first post-MVP milestone.
- Placement rules: must fit on floor, must not block paths (validated by pathfinding), tables need adjacent chairs.

## 8. Economy (MVP draft)

- Starting money: **300**.
- Income: dish price + tip. Costs: ingredient cost per dish. Rent/wages: **post-MVP** (shown in day report as "daily costs" once added).
- Prices (draft): Potted Plant 150, recipe ingredient upgrades 100–400.
- Target feel: player can afford **one meaningful purchase every 1–2 days** early on.

## 9. Fame & Restaurant Rank

Fame accumulates from happy guests. Hitting thresholds triggers a **RANK UP!** with fanfare, and each rank unlocks something.

| Rank | Name | Fame needed (draft) | Unlocks |
|---|---|---|---|
| 1 | Hole in the Wall | 0 | start |
| 2 | Neighborhood Spot | 50 | Pepperoni, more guests per day |
| 3 | Local Favorite | 200 | new decor, staff hiring (post-MVP) |
| 4 | Talk of the Town | 600 | expansion, new guest type |
| 5 | City Classic | 1500 | regulars, more ovens |
| 6 | Legendary Pizzeria | 4000 | **ending celebration** |

Higher rank → more guests arrive per day (spawn rate grows with rank and appeal).

**MVP:** ranks 1–2 playable.

## 10. Long-term goal & ending

- **Headline goal:** reach **Legendary Pizzeria** (target ~8–15 hours of play).
- On reaching it: an ending celebration (credits, staff party), then **choice: continue playing freely**.
- **Completion (optional, post-ending):** collection tracker — all dishes Lv.5, all secret recipes, all guest types, all regulars, all facilities Lv.5. Gives a "100%" badge and stars on the title screen.

## 10b. Reward & progression ideas (backlog, evaluated after M5)

Principle: rewards should feel **warm, not compulsive** — celebrate the player, never punish absence or add countdown stress (cozy pillar). Most ideas below share one engine: a **data-driven Moments system** (trigger conditions → celebratory card/popup → reward), built once post-MVP and reused for regulars' story beats, magazine articles, awards and neighborhood events.

| Idea | Verdict | Notes |
|---|---|---|
| Eat Here! Magazine (signature dish reviewed, cover with *your* restaurant, guest boost) | ✅ High | Core of "your restaurant matters to the town". Shareable. Pair with Mystery Critic. |
| Mystery Critic (anonymous critic guest, result → magazine review) | ✅ High | Cheap: a hidden guest type + review card. No direct control → no stress, it rewards a well-run restaurant. |
| Regulars with stories | ✅ Planned | Already first post-MVP feature (Nonna Rosa, Oliver). Birthdays fit here. |
| Secret Recipes | ✅ Planned | M18. Local favorites vs flops. |
| Restaurant Awards (yearly: Best Budget Pizza, Coziest Room…) | ✅ Medium | Fits the yearly evaluation. Trophies are **decor items** with appeal; awards unlock better **suppliers** → premium ingredients for recipe levels. Avoid "Cleanest Kitchen" (we have no cleaning system). |
| Staff Personalities (traits, skills from experience) | ✅ Planned | M14 + traits (e.g. "Speedy baker", "Chatty"). Pizza-focused traits — no pasta in v1.0. |
| Neighborhood Events (football match, festival, rain) | 🟡 Later | Light prep choices (extra staff, menu). Implemented as Moments with temporary spawn/preference modifiers. |
| Happy Streak (was "Customer Frenzy") | 🟡 Reworked | No countdown. N very happy guests in a row → a celebratory "Rush!" with bonus tips. Passive, never punishing. |
| City Permits (terrace, evening hours) | 🟡 Reworked | Taxes/bureaucracy aren't cozy. Keep **rank** as the progression spine; present unlocks like the terrace as "the neighborhood invites you…" rank rewards. **No alcohol service** (age rating + tone). |
| Second restaurant / empire | 🔴 Not v1.0 | Large scope. v1.0 = one restaurant that expands; a second location is a v2/DLC idea. |

**Next Goals card (post-MVP, supports pillar 5):** in the prep phase, a small card lists 2–3 upcoming goals across horizons (e.g. "Rank up: 38/50 fame", "Margherita Lv.3: 220 coins", "Someone loves Pepperoni… 🤔" as a regular hint). Fed by the same Moments/goal data.

Pacing note: one day ≈ 4 min, so "day 60" ≈ 4 h of play. Our target (Legendary in ~8–15 h) is ~120–220 days; milestones in the rank table should be spaced accordingly.

## 11. MVP scope (first playable)

**In:**
- One small restaurant (~10×12 tiles), 2 tables, 1 oven, 1 pass counter, door.
- 1 chef, 1 waiter (pre-hired, fixed stats).
- 1 guest type with palette variants.
- 4 recipes (3 at start, 1 unlocked at Rank 2) with levels 1–3 via ingredient upgrades.
- Full guest flow: arrive → seat → order → cook → serve → eat → pay → leave.
- Happiness bar, emotes, fame, Rank 1→2 with RANK UP popup.
- Day cycle: prep → business day → day report.
- One purchasable furniture item (Potted Plant) placed freely on the grid, giving appeal.
- Money HUD, simple finances in day report.
- Autosave at end of day + load on start.
- Pan + pinch zoom (integer zoom steps), portrait and landscape.
- Placeholder art is acceptable.

**Out (post-MVP backlog, in rough priority):**
1. Facility levels (upgrade furniture Lv.1–5)
2. Regulars (Nonna Rosa & friends) + jingle popup
3. Staff hiring, XP, levels, training
4. Toilet + guest wandering/decor viewing
5. More guest types
6. More furniture & decor, wages/rent
7. Restaurant expansion (bigger room)
8. Secret recipe system (taste profiles)
9. Speed control, settings, audio mixer
10. Ending + completion tracker
11. Mobile packaging (Capacitor), store release
