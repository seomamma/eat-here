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
