import { describe, expect, it } from 'vitest';
import { RECIPE_IDS } from '../../src/data/recipes';
import { createInitialState } from '../../src/sim/state';
import { computeGoals } from '../../src/sim/systems/goals';

describe('next goals for recipe levels 1-5', () => {
  it('a Lv.2 -> Lv.3 goal is coins only', () => {
    const s = createInitialState(1);
    s.recipes.marinara.level = 2;
    for (const id of RECIPE_IDS) if (id !== 'marinara') s.recipes[id].level = 5;
    const up = computeGoals(s)[1];
    expect(up).toMatchObject({ kind: 'upgrade', recipe: 'marinara', level: 3, coins: 150 });
    expect(up).toMatchObject({ ingredient: null, haveIngredient: true });
  });

  it('Lv.4 and Lv.5 goals name the ingredient and track whether it is owned', () => {
    const s = createInitialState(1);
    for (const id of RECIPE_IDS) s.recipes[id].level = 5;
    s.recipes.margherita.level = 4;
    expect(computeGoals(s)[1]).toMatchObject({
      recipe: 'margherita',
      level: 5,
      ingredient: 'nonnas_secret_basil',
      haveIngredient: false,
      coins: 500,
    });
    s.inventory.nonnas_secret_basil = 1;
    expect(computeGoals(s)[1]).toMatchObject({ haveIngredient: true });
  });

  it('is done when every unlocked dish is Lv.5', () => {
    const s = createInitialState(1);
    for (const id of RECIPE_IDS) s.recipes[id].level = 5;
    expect(computeGoals(s)[1]).toMatchObject({ kind: 'done', slot: 'upgrade' });
  });
});
