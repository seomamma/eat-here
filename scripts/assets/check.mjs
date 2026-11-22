// npm run assets:check — validates the palette and every sprite map (ART_DIRECTION §7).
import { checkAll } from './lib.mjs';

const { errors, sprites } = checkAll();
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\nassets:check FAILED: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log(`assets:check OK: ${sprites.length} sprites`);
