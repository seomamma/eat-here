import { RECIPES } from '../../data/recipes';
import { STRINGS } from '../../data/strings';
import { bestSeller, profitOf } from '../../sim/dayStats';
import { Card } from './Card';
import { dispatch, report } from '../store';

function Row(props: { label: string; value: string; tone?: 'good' | 'bad' | 'total' }) {
  return (
    <div class={`report-row${props.tone ? ` report-row--${props.tone}` : ''}`}>
      <span class="report-label">{props.label}</span>
      <span class="report-value">{props.value}</span>
    </div>
  );
}

/** End-of-day report; "Next day" sends `continueAfterReport`. */
export function ReportModal() {
  const r = report.value;
  if (!r) return null;
  const { stats } = r;
  const profit = profitOf(stats);
  const best = bestSeller(stats);
  const S = STRINGS.report;
  return (
    <div class="modal-backdrop interactive">
      <div class="modal" role="dialog" aria-modal="true" aria-label={S.title(r.day)}>
        <Card accent="saffron">
          <h2 class="modal-title">{S.title(r.day)}</h2>
          <div class="report-rows">
            <Row label={S.income} value={`+${stats.income}`} />
            <Row label={S.tips} value={`+${stats.tips}`} />
            <Row label={S.ingredients} value={`-${stats.ingredientCosts}`} />
            <Row
              label={S.profit}
              value={`${profit >= 0 ? '+' : '-'}${Math.abs(profit)}`}
              tone={profit >= 0 ? 'good' : 'bad'}
            />
            <Row label={S.served} value={String(stats.guestsServed)} />
            <Row label={S.fame} value={`+${stats.fameGained}`} />
            <Row label={S.leftNoSeat} value={String(stats.guestsLeftNoSeat)} />
            <Row
              label={S.bestSeller}
              value={best ? `${RECIPES[best].name} ×${stats.ordersByRecipe[best] ?? 0}` : S.none}
            />
          </div>
          <button
            type="button"
            class="btn btn--basil btn--primary"
            onClick={() => dispatch({ type: 'continueAfterReport' })}
          >
            {S.next}
          </button>
        </Card>
      </div>
    </div>
  );
}
