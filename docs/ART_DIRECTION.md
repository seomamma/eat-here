# Art Direction — Eat here! Restaurant game

> Status: draft v0.1 — awaiting approval.

## 1. Identity in one sentence

**A warm, tiny Italian-flavored pixel world framed by crisp, bold, modern UI cards.**

The contrast is the identity: the *world* is soft, warm, hand-pixeled and cozy; the *interface* is clean, flat, high-contrast, and confident.

### Inspiration principles (not to be copied)

From the user's reference we take **only broad principles**: small expressive pixel characters, white UI surfaces, thick black outlines, bold typography, solid offset accent shadows. See **§8 Originality rules**. We do **not** reuse any characters, layouts, color sets, or compositions from the reference or from Kairosoft / Restaurant City. Our accent palette is deliberately food-themed (tomato, basil, saffron, crust) rather than the reference's purple/orange/teal.

## 2. Camera & perspective (isometric — D-025)

- **Isometric view:** the room is rotated 45°; floor tiles are diamonds; walls run diagonally.
- **2:1 pixel lines:** every diagonal edge steps exactly 2 px across for 1 px down. No other diagonal angles in world art.
- The simulation grid stays square (x to the lower-right, y to the lower-left on screen). Projection:
  - `screenX = (x − y) × 16`, `screenY = (x + y) × 8` (tile origin = top corner of the diamond)
  - inverse for taps: `x = floor((sx/16 + sy/8) / 2)`, `y = floor((sy/8 − sx/16) / 2)`
- **Walls:** the two **back** walls (top-left and top-right edges) are drawn full height. The two **front** walls are drawn as a **low cut-away** (a few px high) so the interior stays visible. The door sits in a front wall.
- **Characters:** 2 drawn facings — **down-right (front)** and **up-right (back)**; down-left and up-left are mirrored → 4 directions.
- **Furniture:** 4 orientations (D-030): 2 drawn (front-facing, back-facing), the other two mirrored. Footprints rotate accordingly (2×1 ↔ 1×2 on odd rotations).
- **Depth sorting:** by `x + y` of an object's front-most footprint tile (higher = in front), tie-broken by `x`. Characters use their interpolated `x + y`.

## 3. Resolution & scaling

| Thing | Size |
|---|---|
| Floor tile (diamond) | 32 × 16 px |
| Back wall segment (per tile edge) | 16 × 48 px (wall face incl. top cap) |
| Front cut-away wall segment | 16 × 12 px |
| Character frame | 16 × 24 px (pivot bottom-center, feet on y=23) |
| Small furniture (chair, plant) | 1×1 footprint, ~32 × 24–32 px canvas |
| Table (2-seat) | 1×1 footprint, ~32 × 24 px |
| Oven / counter | 2×1 footprint, ~48 × 32–40 px |
| Dish icons | 12 × 12 (on 16 × 16 canvas) |
| Emotes | 12 × 12 in 16 × 16 bubble |

Furniture sprites are anchored so the **footprint's top corner** matches the projected tile origin; each def stores its sprite offset.

- World renders with **nearest-neighbor** filtering, `pixelArt: true`, rounded pixel positions.
- **Zoom is integer in device pixels** (D-026): one art pixel = a whole number of physical pixels on every screen. Default zoom chosen so the restaurant fills the available area.
- **UI is not pixel art.** It is HTML/CSS rendered at native device resolution (see ARCHITECTURE.md), so text is razor sharp.

## 4. Palettes

### World palette (locked, ~32 colors)

All world sprites must use only colors from `assets/palette/world.hex` (to be created in the art milestone). Draft core:

| Role | Colors (hex) |
|---|---|
| Outline (never pure black in world) | `#2B1D16` |
| Wood (floor, tables) | `#5C3A21` `#8A5A34` `#B9824F` `#E0B07A` |
| Terracotta / brick | `#7A2E1F` `#B5473A` `#D9725A` |
| Cream / plaster walls | `#F3E6CF` `#E3D0AE` `#C7B08A` |
| Tomato | `#9E1F1F` `#D93A2B` `#F0664A` |
| Basil / plants | `#244D2B` `#3E7A3A` `#6FAE4E` `#A9D46F` |
| Cheese / crust | `#C98A2E` `#EDB94A` `#FBE29A` |
| Skin tones (3 ramps) | `#5A3725` `#8C5A3C` `#C98E66` `#F2C7A0` … |
| Cool accents (tiles, sky, aprons) | `#2F3F5C` `#4A6A8F` `#8FB3D0` `#DCE9F2` |
| Highlights | `#FFFFFF` (sparingly) |

Light comes from the **top-left** (the left back wall is lit, the right back wall slightly darker). Shadows under characters/furniture: 1 flat dark ellipse at 35% opacity (the only allowed transparency besides fully transparent).

### UI palette

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#111111` | text, outlines (pure black allowed in UI) |
| `--paper` | `#FFFFFF` | card backgrounds |
| `--canvas` | `#F6F3EE` | screen background behind cards |
| `--tomato` | `#E2483D` | primary actions, money-spend, RANK UP |
| `--basil` | `#3FA25B` | success, money-gain, level up |
| `--saffron` | `#F2B630` | fame, stars, highlights |
| `--crust` | `#C8783A` | secondary / wood-themed accents |
| `--sky` | `#4E86C7` | info, neutral states |

## 5. UI style

- **Cards:** white background, **3 px black border**, 12 px corner radius, **solid offset shadow** (6 px down-right) in an accent color. No blur shadows, no gradients.
- Accent color carries meaning: tomato = action/spend, basil = growth/success, saffron = fame/rank, sky = info.
- **Typography** (bundled locally, SIL OFL licensed):
  - Headings / numbers: **Archivo Black**, uppercase, generous letter spacing for labels.
  - Body: **Inter** (600/800 weights).
- Buttons: same card style; pressed state = shadow shrinks to 2 px and button moves 4 px down-right ("physically pressed").
- Icons: simple, bold, 2-tone (black + one accent), drawn as SVG.
- Name tags above characters (when tapped): small white pill with black border and a colored dot for role (chef = tomato, waiter = sky, guest = saffron).
- Touch targets ≥ 44 × 44 CSS px.
- Layout anchors to screen edges: top bar (money, fame, rank, day/time), bottom bar (actions). Panels slide in from bottom (portrait) or right (landscape).

### Character style (D-027)

Chunky retro pixel: ~6–8 colors per character, 1 px outline, 1–2 px eyes, no small facial details, readable silhouette at 1× zoom. Roles are recognizable by headwear and outfit color alone. Emotion is carried by animation, emotes and bubbles — not by faces. The world (furniture, food, room) may be slightly more detailed than the characters.

### Chosen style reference: "Character Style C — Retro Management" (user, during M12)

`assets/concepts/character-style-c.webp` is an AI concept board the user generated; it is the **direction** for M13 art, not a usable asset (it goes through the §7 pipeline). What we keep: chunky retro characters with large heads, 1–2 px eyes, clear role silhouettes (chef = tall white hat + red neckerchief, guests = simple casual clothes), warm wood furniture, red tables with a white center, the dome-shaped brick pizza oven, cream walls with a brick base.

Required changes before production (originality §8 + our palette):
- **Waiter redesigned (agreed with the user):** a **younger waiter with a tomato-red apron** and their own hairstyle, instead of the grey-haired navy-vest look on the board (kept clearly distinct from the user's first reference image).
- UI accents stay **our** food palette (tomato, basil, saffron, crust, sky) — not the purple/teal shadows on the board.
- Check readability at the real 16×24 frame on a phone; the board is drawn larger.
- Prompt + board are archived here for provenance (§8 rule 2).

## 6. Animation standards

- Frame rate: **8 fps** for most loops (classic snappy pixel feel), 10–12 fps for quick actions.
- Every character animation keeps the **feet on the same pixel row** (y=23) and stays centered — no jitter.

| Animation | Frames | Directions |
|---|---|---|
| idle | 2 (subtle breathing) | down, up, side |
| walk | 4 | front, back (mirrored for the other two) |
| walk_carry (waiter with plate) | 4 | down, up, side |
| sit | 1 | down, up, side |
| eat | 2 | down, up, side |
| cook (chef) | 4 | up (facing oven) |
| order / raise hand | 2 | down, side |
| celebrate (level up) | 4 | down |

- Juice (handled in code, not sprites): squash/stretch on coins, bounce on emotes, sparkles on level up, screen-space "+12" money popups.

## 7. Asset production pipeline (AI-assisted)

AI image tools produce **"fake pixel art"**: inconsistent pixel sizes, too many colors, soft edges, and drifting style. AI output is therefore **concept/reference material**, and every in-game sprite goes through cleanup. Plan for it.

### Pipeline

1. **Style bible first.** Before any production sprite: one approved **style sheet** (a single image with the chef, waiter, one guest, one table, one oven, floor and wall tiles together, at final size). Every later asset is compared against it.
2. **Concept generation (AI).** Generate concepts at high resolution with a consistent prompt template (stored in `assets/prompts/`). Always include: isometric view with 2:1 pixel lines, 16×24 character proportions, warm palette, dark brown outline, flat shading, light from top-left, plain background.
3. **Downscale to grid.** Resize to target size (e.g. 16×24) with **nearest-neighbor** after cropping so 1 "AI pixel" = 1 real pixel.
4. **Palette lock.** Quantize to the locked world palette (no dithering), using Aseprite's palette remap or a script.
5. **Manual cleanup in Aseprite** (or free alternatives LibreSprite / Pixelorama): fix outlines, remove orphan pixels, ensure readable silhouette, consistent light direction.
6. **Transparent background.** Background fully transparent; **no semi-transparent pixels** except the shadow ellipse (which is a separate sprite anyway).
7. **Animate in Aseprite.** One `.aseprite` file per character with tagged animations (`idle_down`, `walk_side`, …). Feet aligned to the baseline; pivot bottom-center.
8. **Export.** Aseprite CLI → packed **sprite sheet PNG + JSON atlas** (Phaser-compatible), via an npm script so exports are reproducible.
9. **Validate (script, `npm run assets:check`).** Checks for each exported asset:
   - dimensions are multiples of the frame size;
   - every opaque pixel's color is in the locked palette;
   - alpha is only 0 or 255;
   - frame names follow `<entity>_<anim>_<dir>_<n>`;
   - pivot/baseline row has content (feet present) for character frames.
10. **In-game review.** View the asset in the debug "asset gallery" scene next to the style sheet at 1×–4× zoom on a real phone before accepting.

### Folder conventions

```
assets/
  source/        .aseprite source files (committed)
  prompts/       AI prompt templates + chosen concept images
  palette/       world.hex (locked palette)
public/assets/   exported PNG + JSON atlases (generated, committed)
```

### Placeholder art

Until the art milestone, use **flat colored rectangles/circles with outlines** generated in code or a tiny placeholder atlas. Placeholders must already respect the sizes above (16×24 characters, 16×16 tiles) so swapping art requires no code changes.

## 8. Originality rules (mandatory)

Genre conventions are free to use: isometric view, pixel art, small chibi characters, grid building, autonomous staff and guests, leveling, rankings. **Specific creative expression is not.** Every production asset must be original.

1. **No copying or tracing.** No Kairosoft (or other game) sprites, tiles, furniture, characters, UI screens, icons, logos, music or sound effects are used, traced, recolored or edited.
2. **AI prompts:** never name an existing game, studio or artist ("in the style of Kairosoft…"), and **never feed screenshots of existing games** into image-to-image / reference / style-transfer features. Only our own style sheet, our own sketches and our own earlier assets may be used as references. Prompt + chosen output are archived in `assets/prompts/` (provenance).
3. **Own UI layout and look.** Our HUD and menus follow our card style (§5). Avoid the genre's most recognizable specific combinations, e.g. a dark top bar with date/money + rounded green/gold-framed buttons at the bottom corners.
4. **Own characters.** Original proportions, faces, hairstyles, outfits and names. Our 16×24 characters and palette are our own spec, not derived from a specific game's sprites.
5. **Own name, logo and marketing.** Never describe or market the game as "a Kairosoft game", in their style, or using their titles. "Inspired by classic management sims" is fine.
6. **Similarity reviews:** at M11 (first final art) and before release, compare our screenshots side by side with the major genre titles. Anything that reads as "the same asset" or "the same screen" gets redesigned. Log the review in DECISIONS.md.
7. **Before commercial release:** a short review by an IP lawyer is recommended (this document is not legal advice).

## 9. Audio direction (brief)

Light, cheerful, acoustic/chiptune hybrid: mandolin + soft synth. Short positive SFX: coin, level-up fanfare, rank-up fanfare, "new regular" jingle, door bell, oven ding, emote pops. Music volume low by default. (Detailed list in ASSET_LIST.md.)
