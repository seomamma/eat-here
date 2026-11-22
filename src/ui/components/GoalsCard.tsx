import { INGREDIENTS } from '../../data/ingredients';
import { RANKS } from '../../data/ranks';
import { RECIPES } from '../../data/recipes';
import { unlocksAtRank } from '../../data/shop';
import { regularDef } from '../../data/regulars';
import { STRINGS } from '../../data/strings';
import type { Goal } from '../../sim/systems/goals';
import { goals } from '../store';

const G = STRINGS.goals;

function Bar(props: { value: number; max: number }) {
  const pct = props.max > 0 ? Math.min(100, Math.round((props.value / props.max) * 100)) : 100;
  return (
    <span class="goal-bar" aria-hidden="true">
      <span class="goal-bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

function GoalRow(props: { goal: Goal }) {
  const g = props.goal;
  switch (g.kind) {
    case 'rank': {
      const span = g.target - g.base;
      const unlocks = unlocksAtRank(g.rank);
      return (
        <li class="goal">
          <span class="goal-text">{G.rank(RANKS[g.rank - 1]?.name ?? '')}</span>
          <span class="goal-sub">{G.progress(g.fame, g.target)}</span>
          <Bar value={g.fame - g.base} max={span} />
          {unlocks.length > 0 && (
            <span class="goal-sub">{G.unlocksAt(g.rank, unlocks.join(', '))}</span>
          )}
        </li>
      );
    }
    case 'upgrade':
      return (
        <li class="goal">
          <span class="goal-text">{G.upgrade(RECIPES[g.recipe].name, g.level)}</span>
          <span class="goal-sub">
            {g.ingredient && (
              <>
                <span class={g.haveIngredient ? 'goal-ok' : ''}>
                  {g.haveIngredient ? '✓ ' : ''}
                  {G.haveIngredient(INGREDIENTS[g.ingredient].name)}
                </span>
                {' · '}
              </>
            )}
            <span class={g.money >= g.coins ? 'goal-ok' : ''}>{G.coins(g.money, g.coins)}</span>
          </span>
        </li>
      );
    case 'hearts':
      return (
        <li class="goal">
          <span class="goal-text">{G.hearts(regularDef(g.regular).name, g.target)}</span>
          <span class="goal-sub">{G.progress(g.hearts, g.target)}</span>
          <Bar value={g.hearts} max={g.target} />
        </li>
      );
    case 'hint': {
      const p = g.progress;
      return (
        <li class="goal">
          <span class="goal-text">{regularDef(g.regular).unlock.hint}</span>
          <span class="goal-sub">
            {p.asLevel
              ? G.servedAtLevel(RECIPES[p.recipe].name, p.need, p.have >= p.need)
              : G.served(RECIPES[p.recipe].name, p.have, p.need)}
          </span>
          {!p.asLevel && <Bar value={p.have} max={p.need} />}
        </li>
      );
    }
    case 'done':
      return (
        <li class="goal goal--done">
          <span class="goal-text">
            {g.slot === 'rank'
              ? G.rankMax
              : g.slot === 'upgrade'
                ? G.allUpgraded
                : G.allRegularsDone}
          </span>
        </li>
      );
  }
}

/** The three next goals (rank, dish upgrade, regular) at the top of the Menu. */
export function GoalsCard() {
  return (
    <section class="goals" aria-label={G.title}>
      <h3 class="goals-title">{G.title}</h3>
      <ul class="goal-list">
        {goals.value.map((g) => (
          <GoalRow key={g.id} goal={g} />
        ))}
      </ul>
    </section>
  );
}
