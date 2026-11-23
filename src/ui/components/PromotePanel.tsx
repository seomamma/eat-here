import { CAMPAIGNS, CAMPAIGN_IDS, type CampaignId } from '../../data/campaigns';
import { STRINGS } from '../../data/strings';
import { validateStartCampaign } from '../../sim/systems/campaigns';
import { promoteOpen } from '../build';
import { campaign, dispatch, getSim, money, phase, rank } from '../store';
import { Card } from './Card';

const P = STRINGS.promote;

/** Small icon per campaign: flyer sheet, poster board, radio set. */
function CampaignIcon(props: { id: CampaignId }) {
  const S = { stroke: 'var(--ink)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' } as const;
  return (
    <svg class="shop-icon promote-icon" viewBox="0 0 32 32" aria-hidden="true">
      {props.id === 'flyers' && (
        <>
          <path d="M8 5h13l4 4v18H8z" fill="var(--paper)" {...S} />
          <path d="M12 13h9M12 18h9M12 23h5" stroke="var(--tomato)" stroke-width="2.5" />
        </>
      )}
      {props.id === 'poster' && (
        <>
          <path d="M5 6h22v20H5z" fill="var(--sky)" {...S} />
          <circle cx="16" cy="15" r="5" fill="var(--saffron)" {...S} stroke-width="2" />
          <path d="M9 22h14" stroke="var(--paper)" stroke-width="2.5" />
        </>
      )}
      {props.id === 'radio' && (
        <>
          <path d="M4 11h24v15H4z" fill="var(--crust)" {...S} />
          <circle cx="11" cy="18.500" r="4" fill="var(--paper)" {...S} stroke-width="2" />
          <path
            d="M19 15h6M19 19h6M19 23h4M9 11l10-6"
            stroke="var(--ink)"
            stroke-width="2.5"
            fill="none"
          />
        </>
      )}
    </svg>
  );
}

/** Promote: advertising campaigns (Flyers, Poster, Local radio); one at a time. */
export function PromotePanel() {
  if (!promoteOpen.value) return null;
  const sim = getSim();
  const running = campaign.value;
  const have = money.value;
  return (
    <div class="shop-panel recipe-panel interactive" role="dialog" aria-label={P.title}>
      <Card accent="saffron">
        <div class="guest-head">
          <h2 class="guest-name">{P.title}</h2>
          <button
            type="button"
            class="close-btn"
            aria-label={P.close}
            onClick={() => {
              promoteOpen.value = false;
            }}
          >
            ×
          </button>
        </div>
        <p class="market-note">{P.intro}</p>
        <ul class="shop-list">
          {CAMPAIGN_IDS.map((id) => {
            const def = CAMPAIGNS[id];
            const text = P.campaigns[id];
            const locked = rank.value < def.rank;
            const check = sim ? validateStartCampaign(sim.state, id) : { ok: false };
            const isRunning = running === id;
            const closed = phase.value === 'night' || phase.value === 'report';
            return (
              <li class={`shop-item${locked ? ' shop-item--locked' : ''}`} key={id}>
                <CampaignIcon id={id} />
                <div class="shop-info">
                  <span class="shop-name">{text.name}</span>
                  <span class="shop-appeal">{text.text}</span>
                  {running && !isRunning && !locked && (
                    <span class="shop-appeal shop-appeal--info">{P.busy}</span>
                  )}
                </div>
                {locked ? (
                  <span class="rank-lock">{P.rank(def.rank)}</span>
                ) : isRunning ? (
                  <span class="chip chip--basil promote-running">{P.active}</span>
                ) : (
                  <button
                    type="button"
                    class="btn btn--small btn--basil shop-buy"
                    disabled={!check.ok || closed || have < def.cost}
                    onClick={() => dispatch({ type: 'startCampaign', id })}
                  >
                    {P.start} {def.cost}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
