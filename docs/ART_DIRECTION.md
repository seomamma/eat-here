# Art Direction — Eat here! Restaurant game

> Status: draft v0.1 — awaiting approval.

## 1. Identity in one sentence

**A warm, tiny Italian-flavored pixel world framed by crisp, bold, modern UI cards.**

The contrast is the identity: the *world* is soft, warm, hand-pixeled and cozy; the *interface* is clean, flat, high-contrast, and confident.

### Inspiration principles (not to be copied)

From the user's reference we take **only broad principles**: small expressive pixel characters, white UI surfaces, thick black outlines, bold typography, solid offset accent shadows. We do **not** reuse any characters, layouts, color sets, or compositions from the reference or from Kairosoft / Restaurant City. Our accent palette is deliberately food-themed (tomato, basil, saffron, crust) rather than the reference's purple/orange/teal.

## 2. Camera & perspective

- **Top-down ¾ view** (looking down at an angle): floors seen from above, walls and furniture show their front face.
- **Square tile grid**, 16×16 px tiles.
- Characters face **4 directions**: down, up, side (right); left = mirrored right. → 3 drawn directions.
- Depth sorting: by the Y coordinate of each object's **base** (feet / footprint bottom). Lower on screen = in front.
- Walls: only the **back wall** (top) and **side walls** are drawn; the front wall is omitted so the room is always visible.

## 3. Resolution & scaling

| Thing | Size |
|---|---|
| Tile | 16 × 16 px |
| Character frame | 16 × 24 px (pivot at bottom-center, feet on y=23) |
| Small furniture (chair, plant) | 16 × 16 / 16 × 24 |
| Table (2-seat) | 16 × 16 footprint (sprite may be 16×20) |
| Oven / counter | 32 × 24 (2-tile footprint) |
| Dish icons | 12 × 12 (drawn on 16×16 canvas) |
| Emotes | 12 × 12 in 16 × 16 bubble |

- World renders with **nearest-neighbor** filtering, `pixelArt: true`, rounded pixel positions.
- **Zoom is integer only** (e.g. 2×, 3×, 4×, 5×) so every pixel stays square. Default zoom chosen so the restaurant fills the screen.
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

Light comes from the **top-left**. Shadows under characters/furniture: 1 flat dark ellipse at 35% opacity (the only allowed transparency besides fully transparent).

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

## 6. Animation standards

- Frame rate: **8 fps** for most loops (classic snappy pixel feel), 10–12 fps for quick actions.
- Every character animation keeps the **feet on the same pixel row** (y=23) and stays centered — no jitter.

| Animation | Frames | Directions |
|---|---|---|
| idle | 2 (subtle breathing) | down, up, side |
| walk | 4 | down, up, side |
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
2. **Concept generation (AI).** Generate concepts at high resolution with a consistent prompt template (stored in `assets/prompts/`). Always include: top-down ¾ view, 16×24 character proportions, warm palette, dark brown outline, flat shading, light from top-left, plain background.
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

## 8. Audio direction (brief)

Light, cheerful, acoustic/chiptune hybrid: mandolin + soft synth. Short positive SFX: coin, level-up fanfare, rank-up fanfare, "new regular" jingle, door bell, oven ding, emote pops. Music volume low by default. (Detailed list in ASSET_LIST.md.)
