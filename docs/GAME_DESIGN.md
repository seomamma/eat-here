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

Days flow automatically (D-029) — there is no "Open" button.

```
   ┌─────────────── BUSINESS DAY (10:00–22:00, ~4 min) ──────┐
   │  guests arrive → sit → order → chef cooks →              │
   │  waiter serves → guest eats, enjoys decor → pays → leaves│
   │  each guest fills a happiness meter → fame + tips        │
   │  Shop / Build / Recipes always available                 │
   │  (Build mode pauses time while you place furniture)      │
   └───────────────────────────┬──────────────────────────────┘
                               ▼  22:00 closing, last guests finish
   ┌─────────────── DAY REPORT ───────────────────────────────┐
   │  income, costs, guests served, best dish, fame gained    │
   │  RANK UP? new unlocks! · new regular? (post-MVP)         │
   └───────────────────────────┬──────────────────────────────┘
                               ▼  "Next day"
   ┌─────────────── NIGHT (short transition) ─────────────────┐
   │  room darkens, moon, "Day N+1" → morning, doors open     │
   │  (autosave) · new Market offers                          │
   └──────────────────────────────────────────────────────────┘
```

**Short loop (seconds):** watch a guest's happiness meter fill, coins pop.
**Medium loop (one day):** earn money → spend it in the shop, market and recipe book.
**Long loop (many days):** fame → rank ups → unlock recipes, furniture, guest types, bigger restaurant.

## 3. Time

- One **business day** = in-game 10:00–22:00 ≈ **4 minutes real time** at 1× speed (tunable). The HUD shows **hours only** (e.g. "Day 3 · Wed · 13:00") plus a sun/moon icon.
- After closing and the day report, a short **night transition** plays and the next day starts by itself (D-029).
- The game has a calendar (Day 1, Mon–Sun, weeks, seasons later). Weekdays matter for regulars (e.g. Nonna Rosa comes on Fridays).
- **Shop, Market and Recipes are always available.** **Build mode pauses time** while placing/moving furniture; furniture in use (occupied chair, its table, an oven that is baking, a pass holding dishes) can't be moved, and nothing can be placed on a tile where someone stands.
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
| Nice little place (always, when they sit down) | +10 |
| Got seated quickly (≤ 15 s) | +15 |
| Order taken quickly (≤ 10 s) | +10 |
| Food arrived quickly (≤ 25 s) | +15 |
| Dish quality (10 + recipe level × 5, + favorite bonus) | +15 … +35 |
| Decor appeal near their seat (sum of appeal in radius 2, plus painted floors/walls up to +4; capped together) | +0 … +20 |
| Comfy seat (chair + table comfort, by level; M12) | +0 … +14 |
| Lovely music (piano aura, radius 3, best piano only; M12) | +4 … +12 |
| Clean toilet (visited after eating, by level; M12) | +6 … +14 |
| Snack while waiting (vending machine; M12) | +5 … +7 |
| Looked at special decor while walking (post-MVP) | +5 each |
| Long waits | 0 for that step (no negative points in MVP) |

Emotes appear at key moments: 😋 tasty, ❤️ loved it, 💤 slow, 😤 left without table.

**On leaving:** `fame += floor(happiness / 10)`, `tip = round(price × happiness / 140)` (M10: a 90-happiness Pepperoni guest tips 8, a 90-happiness Margherita guest 6, so the day's "Big tip" highlight is usually 6 or more).

**Patience and arrivals (M10):** a guest waits up to **30 s** for a free seat. Arrival gaps are 9–15 s off-peak and 5–8 s at the lunch (12–14) and dinner (18–21) peaks, scaled by the rank's arrival-rate bonus (Rank 2 ×1.05, Rank 3 ×1.15). With the four starting seats this keeps roughly 5–15 % of the guests leaving for lack of a seat once the pizzeria is busy (about 1–5 % on the first days).

### Guest types

- **MVP:** one guest type ("Local"), with palette variations for visual variety.
- **Post-MVP:** several types (Student, Office worker, Family, Food critic, Tourist…) with different budgets, favorite dishes, patience, and appeal preferences. New types unlock via rank.

### Regulars & Moments (M11 spec)

**Goal:** prove the hook "the restaurant remembers its guests". Small, data-driven, no generative AI.

**Moments engine** (`src/data/moments.ts`, `src/sim/systems/moments.ts`): a moment = `{ id, trigger (condition on state/events), once: true, card: { title, text, icon }, reward? (coins / ingredient / fame / unlock) }`. Fired moments are stored in state (`momentsSeen`). The UI shows a moment as a celebratory card with a short jingle; it pauses the sim while open (like RANK UP). Regular unlocks and story beats are moments; later the magazine, awards and events reuse it.

**Regulars** (`src/data/regulars.ts`): `{ id, name, look (unique palette + small accessory), favorite recipe, unlock condition, visitDays (weekdays), visitWindow (lunch/dinner), beats[] }`.
- Locked → the Guests book shows a **hint** ("Someone in town dreams of a perfect Margherita…").
- Unlock condition met → moment **"Nonna Rosa became a regular!"** + jingle.
- On each visit day, the regular arrives once in their window as a named guest with their own look. They get extra patience; if no seat is free they wait at the door instead of leaving quickly.
- **"The usual, please!"**: if their favorite is on the menu they always order it and get **+10 "Their usual!"** happiness; fame from regulars ×2.
- **Friendship hearts (0–5):** +1 heart per visit with happiness ≥ 70 (max one per day). Hearts are shown in the Guests book and in their guest card.
- **Story beats:** moments triggered by hearts/visits, e.g. at 2 hearts "Nonna Rosa brought you her secret basil" (an exclusive ingredient reward), at 5 hearts a small bonus (e.g. fame or a special decor item later).

**MVP regulars (2):**
| Regular | Unlocks when | Visits | Favorite | Beats |
|---|---|---|---|---|
| **Nonna Rosa** | a Margherita **Lv.4** is served | Fridays (lunch) | Margherita | 2♥: gives Nonna's Secret Basil (exclusive, needed for Margherita Lv.5) · 4♥: "She says it tastes like Napoli" (+fame) |
| **Oliver** | 20 Pepperoni served (after Rank 2) | Tuesdays (dinner) | Pepperoni | 2♥: "Oliver greets the chef by name" · 3♥: "Oliver brought a date!" (2nd named guest, sits with him if a 2-seat table is free) · 5♥: "Oliver and Mia are celebrating something…" (+tip bonus) |

### Vision notes v2 — building & dishes (ideas after M10, under discussion)

**Main focus after the MVP: building out and designing the restaurant.** A rich, pixel-perfect build catalog is the heart of the fun.
- **Functional items** with guest interactions: vending machine (small passive income, guests use it while waiting), piano (music aura → happiness; later a pianist), salad bar (self-serve side dish), wifi corner (laptop guests/students stay longer and order more).
- **Decorations:** flowers, dividers, pillars, statues, lamps, paintings.
- **Flooring and wallpaper** painted per tile/wall segment.
- **Sections/Areas:** Animal Area (later its own pet kitchen → special pet food), Children's Area (toys with animations, kids sliding) → achievement **"Kids Menu"** unlocks kid-friendly dishes (e.g. nuggets).
- Implementation: data-driven `interactionSpots` on furniture (guests visit them while waiting/after eating), appeal tags, area recognition (see Themed Areas).

**Dishes & special guests**
- Dishes level 1→5. New dishes are earned by collecting ingredients (from happy guests, regulars, the market).
- A dish at Lv.5 plus a special **topping item** becomes **"super delicious"** (e.g. Kebab Pizza + Feta) and attracts a matching **special guest** (a named VIP who only comes for that dish).
- Regulars sometimes bring **exclusive ingredients**.

**More idea seeds (user, after M10):**
- **Kebab dishes as a fun extra** (Kebab Roll, Kebab Pita, Kebab & Fries) — not a Swedish-pizzeria theme. Unlocked **through a story, not a VIP drop**: e.g. a regular, *Kemal*, who loves the place; at 3♥ he shares his family's kebab recipe (a Moment) → kebab menu unlocked.
- **Exotic animals:** some guests arrive with exotic pets (parrot, tortoise, ferret…). If such a guest "approves" your Animal Area (a Moment), you unlock **Exotic Animal Food** for the pet kitchen.

**Guardrails (Kairosoft-likeness check).** Genre mechanics are free to use, but a game that *feels* like a clone loses the comparison to the masters of that formula. For each new feature ask: *does it make guests' stories and the room richer, or does it only add numbers?* Keep one currency (coins) + collectible ingredients + hearts; **no second "rare coin"/medal currency**. Our identity = guests you care about (regulars, moments), cozy (no grind), retro world + modern UI, themed areas as social spaces, themed areas as social spaces. (A Swedish-pizzeria theme was considered and rejected by the user.)

**Next Goals card** (pillar 5): a compact card in the Menu (and a small "!" pulse on the Menu button when a goal is newly reached) listing 3 goals: next rank (fame x/y), a recipe/upgrade goal, a regular hint or hearts goal.

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

Costs are **abstract**: each sold dish deducts its ingredient cost. No stock, no shortages. (Special upgrade ingredients are separate collectibles, see below.)

### Recipe leveling 1–5 (D-036)

Each dish has a **level (1–5)**. Lv.2–3 cost **coins only** (60 / 150); Lv.4–5 cost **coins + one special ingredient item** (300 / 500, D-031/D-036). Each level: +5 quality points ("Tasty dish"), +15 % price, a big "LEVEL UP!" moment.

| Dish | Lv.4 needs | Lv.5 needs |
|---|---|---|
| Marinara | San Marzano Tomatoes (rare) | Sicilian Oregano (rare) |
| Margherita | Buffalo Mozzarella (rare) | **Nonna's Secret Basil** (exclusive) |
| Garlic Bread | Aged Parmesan (rare) | Black Garlic (rare) |
| Pepperoni | Hot Honey (rare) | Calabrian Chili (rare) |

**Special ingredients are collectibles**, not stock: you never need them for daily cooking (cooking costs stay abstract, D-016). They are only spent when leveling a dish. Rarity tiers: **rare** (market, gifts, rank rewards) and **exclusive** (only from a story beat, never sold or gifted: Nonna's Secret Basil from Nonna Rosa's 2♥ beat); epic/legendary later. The four old common ingredients are gone. Sources — deliberately a little hard to get:
- **Market** (tab in the Shop): every morning 3 random rare offers (seeded, 150–260 coins), each buyable once that day.
- **Gifts from guests:** a guest who leaves very happy (≥ 70) has a small chance to leave a rare ingredient — *"Nora left you a gift: Buffalo Mozzarella!"*.
- **Rank-up rewards:** each rank up gives one rare ingredient (Rank 2 → Buffalo Mozzarella).
- Later: regulars, awards, suppliers (GAME_DESIGN §10b).

### Secret recipes (post-MVP: experimental version)

Players can add **any** ingredient to a dish. Each dish has a hidden **taste profile** (e.g. salty / sweet / savory / spicy / fresh). Ingredients shift the profile:
- **Great combo** → mega success, new named variant (e.g. "Hot Honey Pepperoni").
- **Clashing combo** → taste penalty ("Too salty!"); you can **balance it** with another ingredient (e.g. mozzarella softens salt).
- **Disaster** → dish ruined, try again (no permanent loss besides cost).

This is a discovery system with a recipe book that fills up.

## 7. Facilities (furniture & equipment)

All furniture is data-driven (`src/data/furniture.ts`): size (footprint), category, price, unlock rank, **appeal**, optional comfort / aura / interaction / speed, five **levels** and the coins for each level-up.

**Levels (M12).** Every placed piece goes Lv.1 → Lv.5 with the *Upgrade* button of its item card (build mode; any phase except night). Level-up cost per step is in the def (`levelUpCost`, 4 values). Effects read the level everywhere: decor appeal, comfort, aura, toilet/vending points and coins, oven and pass speed. Lv.3+ shows a gold trim on the sprite, Lv.5 a blinking sparkle; the oven also gets a woodpile (Lv.3+) and a copper collar (Lv.5). **Selling** refunds 50 % of the price plus 50 % of the coins spent on upgrades (not while in use, never the last oven or pass, only where the room stays walkable).

| Piece | Category | Size | Price | Unlock | Effect (Lv.1 → Lv.5) |
|---|---|---|---|---|---|
| Wooden Chair | Seating | 1×1 | 25 | start | comfort 0 → 4 |
| Cushioned Chair | Seating | 1×1 | 80 | Rank 2 | comfort 3 → 8 |
| Small Table | Seating | 1×1 | 60 | start | comfort 0 → 4 |
| Long Table | Seating | 2×1 | 140 | Rank 3 | comfort 1 → 6; chairs on both long sides |
| Toilet | Fun | 1×1 | 260 | Rank 2 | after eating 35 % visit it (one at a time): "Clean toilet" +6 → +14 |
| Vending Machine | Fun | 1×1 | 320 | Rank 3 | guests waiting for a seat snack (70 %, one at a time): 3 → 9 coins + "Snack" +5 → +7 |
| Piano | Fun | 2×1 | 650 | Rank 4 | decor appeal 3 → 10 and music aura radius 3: +4 → +12 |
| Potted Plant | Decor | 1×1 | 150 | start | appeal 5 → 25 |
| Flower Box | Decor | 1×1 | 70 | Rank 2 | appeal 2 → 10 |
| Floor Lamp | Decor | 1×1 | 110 | Rank 2 | appeal 3 → 14 |
| Painting on Easel | Decor | 1×1 | 180 | Rank 3 | appeal 4 → 18 |
| Low Divider | Decor | 1×1 | 40 | Rank 3 | appeal 1 → 5 (blocks walking, rotatable) |
| Pillar | Decor | 1×1 | 90 | Rank 4 | appeal 2 → 8 |
| Marble Statue | Decor | 1×1 | 420 | Rank 4 | appeal 8 → 30 |
| Pizza Oven | Kitchen | 2×1 | (start) | – | cook time ×1, 0.9, 0.8, 0.7, 0.6 |
| Pass Counter | Kitchen | 2×1 | (start) | – | placing/picking up dishes ×1 … ×0.68 |

**Floors & walls.** Floor tiles (wood, checker; terracotta at Rank 2, herringbone at Rank 3) and the back-wall segments (cream; brick at Rank 2, green stripes at Rank 3, blue tiles at Rank 4) are painted in Paint mode (shop: *Floors & Walls*): drag over tiles or along the walls; one command per stroke, price per changed tile/segment (4-22 coins), refused when the money is short. Painted surfaces carry a tiny appeal counted as decor (see D-039).

- Placement rules: must fit on floor, must not block paths (validated by pathfinding; use spots of the oven, pass, vending machine and toilet stay reachable), a chair is used only if it faces a table.

## 8. Economy (MVP draft)

- Starting money: **300**.
- Income: dish price + tip. Costs: ingredient cost per dish. Rent/wages: **post-MVP** (shown in day report as "daily costs" once added).
- Prices (draft): Potted Plant 150, recipe ingredient upgrades 100–400.
- Target feel: player can afford **one meaningful purchase every 1–2 days** early on.
- Measured (M10, `npm run balance`: scripted player, 10 seeds × 10 days): the first plant is bought on day 1 (300 start coins); a day earns about +250 profit (ingredients paid) on days 1–3 and about +320 from Rank 2; Rank 2 arrives on day 4 (day 3 on one seed); average guest happiness 65–76; tips grow from a day's biggest 5–6 (before Pepperoni) to 8–11.

## 9. Fame & Restaurant Rank

Fame accumulates from happy guests. Hitting thresholds triggers a **RANK UP!** with fanfare, and each rank unlocks something.

| Rank | Name | Fame needed | Unlocks | Space (room grows) |
|---|---|---|---|---|
| 1 | Hole in the Wall | 0 | start | 8 × 11 |
| 2 | Neighborhood Spot | 500 | Pepperoni, more guests per day | +3 columns → 11 × 11 |
| 3 | Local Favorite | 1400 | new decor, staff hiring (post-MVP) | +3 rows → 11 × 14 |
| 4 | Talk of the Town | 4200 | expansion, new guest type | +3 columns → 14 × 14 |
| 5 | City Classic | 10500 | regulars, more ovens | +2 columns, +2 rows → 16 × 16 |
| 6 | Legendary Pizzeria | 28000 | **ending celebration** | +2 columns → 18 × 16 |

The room grows with every rank from 2 (D-038): the door and everything already placed stay put, the new floor is plain wood, and the RANK UP modal shows "More space!".

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

### Themed areas (Children's Area, Animal Area…), rooms & the terrace (idea after M7b — planned, post-MVP)

Build cute themed areas that attract specific guest types: a **Children's Area** brings more **families with small children**, an **Animal Area** brings dog owners (with their dogs!), a **reading nook** brings students, etc. The **terrace** (outdoor seating) is a rank-up unlock that expands the restaurant outside.

Recommended design (keep it simple first):
1. **Themed corners via furniture sets**, not enclosed rooms: a corner is recognized when its set pieces stand close together (e.g. play rug + toy box + small slide within a few tiles). A complete set raises the arrival weight of its guest type and gives its own appeal tag. Data-driven: `corners.ts` lists required pieces + effect.
2. **Low dividers / half walls / fences** as placeable furniture to visually separate areas — gives the "room" feeling without the cost of full room detection.
3. **Real rooms with walls** (flood-fill enclosed areas, doors, room types) only if corners feel too limited after playtesting — they add wall drawing in iso, doors in pathfinding and room recognition.
4. **Groups**: families and friends arrive as groups and need a table with enough chairs — requires multi-seat tables and group seating logic (a prerequisite for families).
5. **Dog owners & the Animal Area** (user favourite): with an Animal Area, **dog owners** start coming **with their dogs** — the dog trots behind its owner, lies down under the table or plays in the Animal Area. Guests near a complete Animal Area get extra happiness ("Cute dogs! +10"), dog owners get a bigger bonus, and the corner adds fame. Dogs come in a few breeds/colours (palette swaps) — a strong "shareable moment" source.
6. **Terrace** = part of the restaurant expansion milestone: a new outdoor zone with its own floor tiles and weather-flavored appeal.

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
