import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Relative asset paths so the build also works from a subfolder (e.g. itch.io).
  base: './',
  plugins: [preact()],
  test: { include: ['tests/**/*.test.ts'] },
});
