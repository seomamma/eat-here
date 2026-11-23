// Sprite pipeline (D-040): text pixel maps -> atlas PNG + Phaser JSON atlas + anim manifest.
// Pure Node, no dependencies. Used by build.mjs / check.mjs and by tests/assets.
import { deflateSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ROOT = new URL('../../', import.meta.url).pathname;
export const PALETTE_FILE = join(ROOT, 'assets/palette/world.hex');
export const SPRITE_DIR = join(ROOT, 'assets/sprites');
export const OUT_DIR = join(ROOT, 'public/assets');

export const DIRS = ['front', 'back', 'none'];
export const KINDS = {
  character: { ws: [16, 24, 40], h: 24 },
  /** Kids (12x18) and pets: same rules as characters (pivot bottom-centre, feet on the last row). */
  kid: { w: 12, h: 18 },
  critter: {},
  floor: { w: 32, h: 16 },
  wall: { w: 16, h: 48 },
  lowwall: { w: 16, h: 12 },
  dish: { w: 12, h: 12 },
  emote: { w: 16, h: 16 },
  prop: {},
  ui: {},
  shadow: {},
};
const ENTITY_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const ANIM_RE = /^[a-z][a-z0-9]*$/;

/** Parses world.hex into { chars: Map(char -> {r,g,b,a,name}) }. */
export function parsePalette(text) {
  const chars = new Map();
  const errors = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = /^(\S) ([0-9A-Fa-f]{6})(?:@(\d{1,3}))? (\S+)$/.exec(line);
    if (!m) return errors.push(`world.hex:${i + 1}: bad palette line "${line}"`);
    const [, ch, hex, alpha, name] = m;
    if (ch === '.') return errors.push(`world.hex:${i + 1}: '.' is reserved for transparent`);
    if (chars.has(ch)) return errors.push(`world.hex:${i + 1}: duplicate char '${ch}'`);
    const n = parseInt(hex, 16);
    chars.set(ch, {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255,
      a: alpha === undefined ? 255 : Number(alpha),
      name,
    });
  });
  const seen = new Map();
  for (const [ch, c] of chars) {
    if (c.a !== 255) continue;
    const key = (c.r << 16) | (c.g << 8) | c.b;
    if (seen.has(key))
      errors.push(`world.hex: '${ch}' duplicates the colour of '${seen.get(key)}'`);
    seen.set(key, ch);
  }
  return { chars, errors };
}

export function loadPalette() {
  return parsePalette(readFileSync(PALETTE_FILE, 'utf8'));
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.px')) out.push(p);
  }
  return out;
}

/**
 * Parses one .px file. Returns { sprites: [{entity,w,h,px,py,kind,anims:[{name,dir,fps,loop,frames:[string[]]}]}], errors }.
 * Format (see assets/sprites/README.md):
 *   sprite <entity> <w>x<h> pivot <x>,<y> [kind <kind>]
 *   anim <name> <dir> [fps <n>] [once]
 *   frame            (then h rows of w chars)
 *   mirror <name> <dir> <srcName> <srcDir>
 *   variant <entity> <from>=<to> ...
 */
export function parsePx(text, file) {
  const sprites = [];
  const errors = [];
  let sprite = null;
  let anim = null;
  let frame = null;
  const err = (n, msg) => errors.push(`${file}:${n}: ${msg}`);
  const lines = text.split('\n');
  const closeFrame = () => {
    frame = null;
  };
  lines.forEach((raw, i) => {
    const n = i + 1;
    const line = raw.trim();
    if (frame) {
      if (
        line === '' ||
        /^(sprite|anim|frame|mirror|variant)\b/.test(line) ||
        line.startsWith('#')
      ) {
        closeFrame();
      } else {
        frame.rows.push(line);
        return;
      }
    }
    if (line === '' || line.startsWith('#')) return;
    const t = line.split(/\s+/);
    switch (t[0]) {
      case 'sprite': {
        const m = /^(\d+)x(\d+)$/.exec(t[2] ?? '');
        const p = /^(\d+),(\d+)$/.exec(t[4] ?? '');
        if (!t[1] || !m || t[3] !== 'pivot' || !p) return err(n, `bad sprite line "${line}"`);
        let kind = 'prop';
        if (t[5] === 'kind') kind = t[6] ?? '';
        sprite = {
          entity: t[1],
          w: Number(m[1]),
          h: Number(m[2]),
          px: Number(p[1]),
          py: Number(p[2]),
          kind,
          anims: [],
          line: n,
        };
        sprites.push(sprite);
        anim = null;
        break;
      }
      case 'anim': {
        if (!sprite) return err(n, 'anim before sprite');
        anim = { name: t[1], dir: t[2], fps: 1, loop: true, frames: [], line: n };
        for (let k = 3; k < t.length; k++) {
          if (t[k] === 'fps') anim.fps = Number(t[++k]);
          else if (t[k] === 'once') anim.loop = false;
          else err(n, `unknown anim option "${t[k]}"`);
        }
        sprite.anims.push(anim);
        break;
      }
      case 'frame': {
        if (!anim) return err(n, 'frame before anim');
        frame = { rows: [], line: n };
        anim.frames.push(frame);
        break;
      }
      case 'mirror': {
        if (!sprite) return err(n, 'mirror before sprite');
        const src = sprite.anims.find((a) => a.name === t[3] && a.dir === t[4]);
        if (!src) return err(n, `mirror source ${t[3]} ${t[4]} not found`);
        sprite.anims.push({
          name: t[1],
          dir: t[2],
          fps: src.fps,
          loop: src.loop,
          line: n,
          frames: src.frames.map((f) => ({
            rows: f.rows.map((r) => [...r].reverse().join('')),
            line: f.line,
          })),
        });
        anim = null;
        break;
      }
      case 'variant': {
        if (!sprite) return err(n, 'variant before sprite');
        const map = new Map();
        for (const pair of t.slice(2)) {
          const m = /^(\S)=(\S)$/.exec(pair);
          if (!m) return err(n, `bad variant swap "${pair}"`);
          map.set(m[1], m[2]);
        }
        const base = sprite;
        const copy = {
          ...base,
          entity: t[1],
          line: n,
          anims: base.anims.map((a) => ({
            ...a,
            frames: a.frames.map((f) => ({
              line: f.line,
              rows: f.rows.map((r) => [...r].map((c) => map.get(c) ?? c).join('')),
            })),
          })),
        };
        sprites.push(copy);
        // The variant is declared against the sprite above; later anims keep going into `base`.
        break;
      }
      default:
        err(n, `unknown directive "${t[0]}"`);
    }
  });
  return { sprites, errors };
}

export function loadSprites() {
  const sprites = [];
  const errors = [];
  for (const file of walk(SPRITE_DIR)) {
    const rel = relative(ROOT, file);
    const r = parsePx(readFileSync(file, 'utf8'), rel);
    errors.push(...r.errors);
    for (const s of r.sprites) sprites.push({ ...s, file: rel });
  }
  return { sprites, errors };
}

export const frameName = (entity, anim, dir, n) => `${entity}_${anim}_${dir}_${n}`;

/** Full validation (ART_DIRECTION §7 step 9). Returns a list of error strings. */
export function validate(palette, sprites) {
  const errors = [];
  const names = new Set();
  const entities = new Set();
  for (const s of sprites) {
    const at = `${s.file}:${s.line} [${s.entity}]`;
    if (!ENTITY_RE.test(s.entity)) errors.push(`${at}: bad entity name`);
    if (entities.has(s.entity)) errors.push(`${at}: duplicate entity`);
    entities.add(s.entity);
    const kind = KINDS[s.kind];
    if (!kind) {
      errors.push(`${at}: unknown kind "${s.kind}"`);
      continue;
    }
    if (
      (kind.w && s.w !== kind.w) ||
      (kind.ws && !kind.ws.includes(s.w)) ||
      (kind.h && s.h !== kind.h)
    )
      errors.push(
        `${at}: kind ${s.kind} needs ${kind.w ?? kind.ws?.join('|') ?? '*'}x${kind.h ?? '*'}, got ${s.w}x${s.h}`,
      );
    if (s.px < 0 || s.py < 0 || s.px >= s.w || s.py >= s.h)
      errors.push(`${at}: pivot outside the frame`);
    const walker = s.kind === 'character' || s.kind === 'kid' || s.kind === 'critter';
    if (walker && (s.px !== s.w / 2 || s.py !== s.h - 1))
      errors.push(`${at}: ${s.kind} pivot must be ${s.w / 2},${s.h - 1}`);
    if (s.anims.length === 0) errors.push(`${at}: no animations`);
    const animKeys = new Set();
    for (const a of s.anims) {
      const aat = `${s.file}:${a.line} [${s.entity} ${a.name} ${a.dir}]`;
      if (!ANIM_RE.test(a.name ?? '')) errors.push(`${aat}: bad anim name`);
      if (!DIRS.includes(a.dir)) errors.push(`${aat}: dir must be one of ${DIRS.join('/')}`);
      if (animKeys.has(`${a.name}_${a.dir}`)) errors.push(`${aat}: duplicate animation`);
      animKeys.add(`${a.name}_${a.dir}`);
      if (!(a.fps > 0)) errors.push(`${aat}: fps must be > 0`);
      if (a.frames.length === 0) errors.push(`${aat}: no frames`);
      a.frames.forEach((f, idx) => {
        const fat = `${s.file}:${f.line} [${frameName(s.entity, a.name, a.dir, idx)}]`;
        const name = frameName(s.entity, a.name, a.dir, idx);
        if (names.has(name)) errors.push(`${fat}: duplicate frame name`);
        names.add(name);
        if (f.rows.length !== s.h) errors.push(`${fat}: ${f.rows.length} rows, expected ${s.h}`);
        let feet = false;
        f.rows.forEach((row, y) => {
          if (row.length !== s.w)
            errors.push(`${fat}: row ${y} has ${row.length} chars, expected ${s.w}`);
          [...row].forEach((c, x) => {
            if (c === '.') return;
            const p = palette.chars.get(c);
            if (!p) return errors.push(`${fat}: row ${y} col ${x}: '${c}' is not in the palette`);
            if (p.a !== 255 && s.kind !== 'shadow')
              errors.push(
                `${fat}: row ${y} col ${x}: translucent '${c}' only allowed in shadow sprites`,
              );
            if (walker && y === s.h - 1) feet = true;
          });
        });
        if (walker && !feet) errors.push(`${fat}: no pixel on the baseline row ${s.h - 1} (feet)`);
      });
    }
  }
  // Level overlays (trim_<piece>, accent_<piece>) share the canvas and pivot of their piece.
  const byName = new Map(sprites.map((x) => [x.entity, x]));
  for (const s of sprites) {
    const m = /^(?:trim|accent)_(.+)$/.exec(s.entity);
    if (!m) continue;
    const base = byName.get(m[1]);
    if (!base) errors.push(`${s.file}:${s.line} [${s.entity}]: no base sprite "${m[1]}"`);
    else if (base.w !== s.w || base.h !== s.h || base.px !== s.px || base.py !== s.py)
      errors.push(`${s.file}:${s.line} [${s.entity}]: size/pivot differ from ${base.entity}`);
  }
  return errors;
}

// ---------------------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Encodes RGBA pixels (Uint8Array, w*h*4) as an 8-bit RGBA PNG. */
export function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------------------
// Atlas
// ---------------------------------------------------------------------------------------
const ATLAS_W = 512;
const PAD = 1;

/** Packs every frame; returns { png: Buffer, atlas: object, anims: object }. */
export function buildAtlas(palette, sprites) {
  const frames = [];
  for (const s of sprites) {
    for (const a of s.anims) {
      a.frames.forEach((f, idx) =>
        frames.push({ name: frameName(s.entity, a.name, a.dir, idx), s, rows: f.rows }),
      );
    }
  }
  const order = [...frames].sort(
    (a, b) => b.s.h - a.s.h || b.s.w - a.s.w || (a.name < b.name ? -1 : 1),
  );
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const f of order) {
    if (x + f.s.w + PAD > ATLAS_W) {
      x = 0;
      y += rowH + PAD;
      rowH = 0;
    }
    f.x = x;
    f.y = y;
    x += f.s.w + PAD;
    rowH = Math.max(rowH, f.s.h);
  }
  const H = y + rowH;
  const rgba = new Uint8Array(ATLAS_W * H * 4);
  for (const f of order) {
    f.rows.forEach((row, ry) => {
      [...row].forEach((c, rx) => {
        const p = palette.chars.get(c);
        if (!p) return;
        const o = ((f.y + ry) * ATLAS_W + f.x + rx) * 4;
        rgba[o] = p.r;
        rgba[o + 1] = p.g;
        rgba[o + 2] = p.b;
        rgba[o + 3] = p.a;
      });
    });
  }
  const atlasFrames = {};
  for (const f of [...frames].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    atlasFrames[f.name] = {
      frame: { x: f.x, y: f.y, w: f.s.w, h: f.s.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.s.w, h: f.s.h },
      sourceSize: { w: f.s.w, h: f.s.h },
      pivot: { x: f.s.px / f.s.w, y: f.s.py / f.s.h },
    };
  }
  const entities = {};
  for (const s of [...sprites].sort((a, b) => (a.entity < b.entity ? -1 : 1))) {
    const anims = {};
    for (const a of [...s.anims].sort((p, q) =>
      `${p.name}_${p.dir}` < `${q.name}_${q.dir}` ? -1 : 1,
    )) {
      anims[`${a.name}_${a.dir}`] = {
        fps: a.fps,
        loop: a.loop,
        frames: a.frames.map((_, i) => frameName(s.entity, a.name, a.dir, i)),
      };
    }
    entities[s.entity] = { kind: s.kind, w: s.w, h: s.h, pivot: [s.px, s.py], anims };
  }
  return {
    png: encodePng(ATLAS_W, H, rgba),
    atlas: {
      frames: atlasFrames,
      meta: {
        app: 'eat-here assets:build',
        version: '1',
        image: 'atlas.png',
        format: 'RGBA8888',
        size: { w: ATLAS_W, h: H },
        scale: '1',
      },
    },
    anims: { version: 1, entities },
  };
}

/** Everything `assets:build` writes, as { filename: Buffer|string }. Throws on validation errors. */
export function buildAll() {
  const palette = loadPalette();
  const { sprites, errors } = loadSprites();
  const all = [...palette.errors, ...errors, ...validate(palette, sprites)];
  if (all.length) throw new Error(all.join('\n'));
  const { png, atlas, anims } = buildAtlas(palette, sprites);
  return {
    'atlas.png': png,
    'atlas.json': JSON.stringify(atlas, null, 1) + '\n',
    'anims.json': JSON.stringify(anims, null, 1) + '\n',
  };
}

export function checkAll() {
  const palette = loadPalette();
  const { sprites, errors } = loadSprites();
  return { errors: [...palette.errors, ...errors, ...validate(palette, sprites)], sprites };
}
