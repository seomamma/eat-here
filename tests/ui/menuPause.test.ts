import { describe, expect, it } from 'vitest';
import { Game } from '../../src/sim/game';
import { createInitialState } from '../../src/sim/state';
import {
  anyMenuOpen,
  bindBuild,
  guestsOpen,
  menuOpen,
  recipesOpen,
  shopOpen,
  todayOpen,
} from '../../src/ui/build';
import { settingsOpen } from '../../src/ui/settings';

describe('pause while a menu or panel is open', () => {
  it('holds the sim for every menu surface and resumes when the last one closes', () => {
    const g = new Game(createInitialState(1));
    bindBuild(g);
    expect(g.isPaused).toBe(false);
    for (const open of [menuOpen, shopOpen, recipesOpen, guestsOpen, settingsOpen, todayOpen]) {
      open.value = true;
      expect(anyMenuOpen.value).toBe(true);
      expect(g.isPaused).toBe(true);
      const tick = g.state.tick;
      g.update(1000);
      expect(g.state.tick).toBe(tick);
      open.value = false;
      expect(g.isPaused).toBe(false);
    }
    // Two panels at once: still paused after the first one closes.
    menuOpen.value = true;
    shopOpen.value = true;
    menuOpen.value = false;
    expect(g.isPaused).toBe(true);
    shopOpen.value = false;
    expect(g.isPaused).toBe(false);
    g.update(1000);
    expect(g.state.tick).toBeGreaterThan(0);
  });
});
