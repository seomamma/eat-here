// Dog redraw (M13b): clearer head (floppy ear, cream muzzle, dark nose, red collar), body and legs.
// 14x10, pivot at the feet. Front = heading down-right (face visible), back = heading up-right.
import { Grid } from './lib.mjs';

function dog(facing, f = 0, pose = 'walk') {
  const g = new Grid(14, 10);
  const wag = f % 2;
  const idle = pose === 'idle';
  // Leg offsets per frame: [near-front, far-front, near-back, far-back] x shifts.
  const sw = idle ? [0, 0, 0, 0] : [[1, -1, -1, 1], [0, 0, 0, 0], [-1, 1, 1, -1], [0, 0, 0, 0]][f % 4];
  const bob = !idle && f % 2 === 1 ? 1 : 0;
  if (facing === 'front') {
    // tail (rear, upper left)
    g.put(1, 2 + bob - wag, ['Z', 'ZZ', '.Z']);
    // body
    g.rect(2, 3 + bob, 8, 6 + bob, 'Z');
    g.rect(3, 3 + bob, 7, 3 + bob, 'd');
    g.rect(3, 6 + bob, 8, 6 + bob, 'Q');
    g.set(2, 6 + bob, 'Q');
    // far legs (darker), near legs
    g.rect(3 + sw[3], 7, 3 + sw[3], 8, 'Q');
    g.rect(8 + sw[1], 7, 8 + sw[1], 8, 'Q');
    g.rect(4 + sw[2], 7, 5 + sw[2], 8, 'Z');
    g.rect(9 + sw[0], 7, 10 + sw[0], 8, 'Z');
    g.set(5 + sw[2], 8, 'h');
    g.set(10 + sw[0], 8, 'h');
    // head
    g.rect(8, 2 + bob, 12, 6 + bob, 'Z');
    g.rect(8, 2 + bob, 9, 5 + bob, 'Q'); // floppy ear
    g.rect(10, 2 + bob, 12, 2 + bob, 'd');
    g.rect(11, 5 + bob, 12, 6 + bob, 'h'); // muzzle
    g.set(12, 5 + bob, 'k'); // nose
    g.set(11, 3 + bob, 'k'); // eye
    g.set(10, 6 + bob, 'm'); // collar
    g.set(9, 6 + bob, 'm');
  } else {
    // rump and tail near the camera, small head at the top right
    g.put(8, 0 + bob, ['.QQ.', 'QZZQ']);
    g.rect(9, 2 + bob, 11, 3 + bob, 'Z');
    g.set(9, 3 + bob, 'm');
    g.set(10, 3 + bob, 'm');
    g.set(11, 3 + bob, 'm');
    g.rect(2, 3 + bob, 10, 6 + bob, 'Z');
    g.rect(3, 3 + bob, 8, 3 + bob, 'd');
    g.rect(3, 6 + bob, 10, 6 + bob, 'Q');
    g.rect(3, 4 + bob, 5, 5 + bob, 'd'); // rump highlight
    g.put(1, 1 + bob - wag, ['Z', 'Z', 'ZZ']);
    g.rect(4 + sw[2], 7, 5 + sw[2], 8, 'Z');
    g.rect(8 + sw[0], 7, 9 + sw[0], 8, 'Z');
    g.set(5 + sw[2], 8, 'h');
    g.set(9 + sw[0], 8, 'h');
  }
  g.outline('k');
  return g.rows();
}

export function dogText(spriteText) {
  const anims = [];
  for (const facing of ['front', 'back']) {
    anims.push({ name: 'walk', dir: facing, fps: 8, frames: [0, 1, 2, 3].map((f) => dog(facing, f, 'walk')) });
    anims.push({ name: 'idle', dir: facing, fps: 3, frames: [0, 1].map((f) => dog(facing, f, 'idle')) });
  }
  return spriteText('sprite dog 14x10 pivot 7,9 kind critter', anims, ['# A grey dog.', 'variant dog1 Z=J Q=K d=h'].join('\n'));
}
