# Sprite maps (.px)

Text pixel maps, one char per pixel, colours from `assets/palette/world.hex` (`.` = transparent).
`npm run assets:build` packs them into `public/assets/` (atlas.png, atlas.json, anims.json);
`npm run assets:check` validates them. See docs/ART_DIRECTION.md §7 and D-040.

```
sprite <entity> <w>x<h> pivot <x>,<y> [kind character|kid|critter|floor|wall|lowwall|dish|emote|prop|ui|shadow]
anim <name> <dir front|back|none> [fps <n>] [once]
frame
<h rows of w chars>
mirror <name> <dir> <srcName> <srcDir>      # horizontally flipped copy of an animation
variant <entity> <from>=<to> ...           # palette-swapped copy of the sprite above (declare last)
```

Frame names: `<entity>_<anim>_<dir>_<n>`. Characters: 16x24 (chef 24x24), pivot bottom-centre,
feet on the last row. Kids (`kind kid`) are 12x18 and pets (`kind critter`, e.g. the 14x10 dog) any size; both
follow the same pivot and feet-row rules. The files here were drafted with the helpers in `assets/author/` (`m12c.mjs` drafted the kids, dogs, high chair and broken-heart emote); after the
first draft edit the `.px` files directly (re-running a generator overwrites hand edits).

## M13b additions

- Furniture: `world/furniture_seating.px`, `furniture_fun.px`, `furniture_decor.px`, `oven.px`; each piece has `still front` and `still back` (mirrored in the view for odd rotations). Animated extras: `vending_machine blink front` (2 frames), `oven_pizza bake` / `flare front`.
- Level art: every piece except the oven has two overlay sprites on the same canvas and pivot as the piece (checked by `assets:check`): `trim_<piece>` (drawn on top from Lv.3) and `accent_<piece>` (`blink`, 2 frames, drawn on top from Lv.5). Edit them like any sprite; only the differing pixels are non-transparent. The oven's level art is `oven_woodpile` and `oven_copper`.
- Outdoors: `world/ground.px` (32x16 `floor` tiles), `world/props.px` (trees, bushes, flowers, lamp post, bench, `glow_lamp`). Night glows (`glow_lamp`, `glow_floor_lamp`) are dithered halos drawn above the night veil.
- FX: `ui/fx.px` (`select_marker`, `tile_highlight`, `sparkle` 4 frames, `door_closed`, `door_open` fitted to `door_frame`).
- Drafts come from `assets/author/m13b*.mjs` (`node assets/author/m13b.mjs [decor|fun|seating|oven|dog|outdoor|fx]`). The committed `.px` files are the source of truth: to change art, edit the rows by hand (each frame is `h` rows of `w` characters from `assets/palette/world.hex`), run `npm run assets:build`, look at it with `?gallery=<prefix>`. Re-running a generator overwrites hand edits.
