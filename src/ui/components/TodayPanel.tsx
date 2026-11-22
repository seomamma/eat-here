import { FURNITURE, type FurnitureDefId } from '../../data/furniture';
import { INGREDIENTS, type IngredientId } from '../../data/ingredients';
import { RECIPES, type RecipeId } from '../../data/recipes';
import { FLOOR_STYLES, WALL_STYLES } from '../../data/surfaces';
import { STRINGS } from '../../data/strings';
import { ledgerTotal, type LedgerEntry, type LedgerKind } from '../../sim/dayStats';
import { todayOpen } from '../build';
import { ledger } from '../store';
import { Card } from './Card';

const T = STRINGS.today;

/** "+22", "−150", "0": the sign and colour make gains and costs readable at a glance. */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${-n}`;
  return '0';
}

function tone(n: number): string {
  return n > 0 ? 'good' : n < 0 ? 'bad' : 'zero';
}

/** Display text of a single notable ledger entry. */
export function highlightText(e: LedgerEntry): string {
  switch (e.kind) {
    case 'furniture': {
      // Paint strokes are labelled "floor:<style>" / "wall:<style>".
      const [kind, style] = e.label.split(':');
      if (kind === 'floor' || kind === 'wall') {
        const table: Record<string, { name: string }> =
          kind === 'floor' ? FLOOR_STYLES : WALL_STYLES;
        const def = table[style ?? ''];
        return T.painted(def?.name ?? e.label, e.count);
      }
      return FURNITURE[e.label as FurnitureDefId]?.name ?? e.label;
    }
    case 'sale':
      return T.sold(FURNITURE[e.label as FurnitureDefId]?.name ?? e.label);
    case 'market':
      return INGREDIENTS[e.label as IngredientId]?.name ?? e.label;
    case 'upgrade': {
      const [id, level] = e.label.split(':');
      const piece = FURNITURE[id as FurnitureDefId];
      if (piece) return T.dishLevel(piece.name, Number(level));
      return T.dishLevel(RECIPES[id as RecipeId]?.name ?? id ?? '', Number(level));
    }
    case 'tip':
      return T.bigTip(e.label);
    default:
      return e.label;
  }
}

/** Entries that are single, named events rather than running totals. */
export function highlights(entries: readonly LedgerEntry[]): LedgerEntry[] {
  return entries.filter((e) => e.label !== '').sort((a, b) => a.tick - b.tick);
}

function Row(props: { label: string; value: number; strong?: boolean }) {
  return (
    <li class={`today-row today-row--${tone(props.value)}${props.strong ? ' today-row--net' : ''}`}>
      <span class="today-label">{props.label}</span>
      <span class="today-value">{signed(props.value)}</span>
    </li>
  );
}

/** "Today" card: where the day's money came from and went, plus the notable single items. */
export function TodayPanel() {
  if (!todayOpen.value) return null;
  const entries = ledger.value;
  const l = { entries };
  const sum = (k: LedgerKind) => ledgerTotal(l, k);
  const notable = highlights(entries);
  const close = () => {
    todayOpen.value = false;
  };
  return (
    <div class="modal-backdrop modal-backdrop--light interactive" onClick={close}>
      <div
        class="today-panel"
        role="dialog"
        aria-label={T.title}
        onClick={(e) => e.stopPropagation()}
      >
        <Card accent="saffron">
          <div class="guest-head">
            <h2 class="guest-name">{T.title}</h2>
            <button type="button" class="close-btn" aria-label={T.close} onClick={close}>
              ×
            </button>
          </div>
          <div class="today-cols">
            <section>
              <h3 class="today-h">{T.income}</h3>
              <ul class="today-list">
                <Row label={T.dishes} value={sum('dish')} />
                <Row label={T.tips} value={sum('tip')} />
                <Row label={T.vending} value={sum('vending')} />
                <Row label={T.sales} value={sum('sale')} />
              </ul>
            </section>
            <section>
              <h3 class="today-h">{T.spending}</h3>
              <ul class="today-list">
                <Row label={T.ingredients} value={sum('ingredients')} />
                <Row label={T.furniture} value={sum('furniture')} />
                <Row label={T.market} value={sum('market')} />
                <Row label={T.upgrades} value={sum('upgrade')} />
              </ul>
            </section>
          </div>
          <ul class="today-list today-net">
            <Row label={T.net} value={ledgerTotal(l)} strong />
          </ul>
          <h3 class="today-h">{T.highlights}</h3>
          <ul class="today-list today-highlights">
            {notable.length === 0 && <li class="today-none">{T.noHighlights}</li>}
            {notable.map((e, i) => (
              <li class={`today-row today-row--${tone(e.amount)}`} key={i}>
                <span class="today-label">{highlightText(e)}</span>
                <span class="today-value">{signed(e.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
