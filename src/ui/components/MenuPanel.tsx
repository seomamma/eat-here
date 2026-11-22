import { STRINGS } from '../../data/strings';
import { menuOpen, openFromMenu, type MenuTarget } from '../build';
import { phase, report } from '../store';
import { Card } from './Card';
import { MenuCardIcon, type MenuIconId } from './MenuIcons';

const M = STRINGS.menu;

const ACTIVE: { id: MenuTarget; label: string; icon: MenuIconId }[] = [
  { id: 'shop', label: M.shop, icon: 'shop' },
  { id: 'market', label: M.market, icon: 'market' },
  { id: 'recipes', label: M.recipes, icon: 'recipes' },
  { id: 'build', label: M.build, icon: 'build' },
  { id: 'settings', label: M.settings, icon: 'settings' },
];

const SOON: { label: string; icon: MenuIconId }[] = [
  { label: M.staff, icon: 'staff' },
  { label: M.stats, icon: 'stats' },
];

/** The Menu hub: a grid of shortcut cards; opening one closes the hub and opens that panel. */
export function MenuPanel() {
  if (!menuOpen.value || phase.value === 'night' || phase.value === 'report' || report.value)
    return null;
  const close = () => {
    menuOpen.value = false;
  };
  return (
    <div class="modal-backdrop modal-backdrop--light interactive" onClick={close}>
      <div
        class="menu-panel"
        role="dialog"
        aria-label={M.title}
        onClick={(e) => e.stopPropagation()}
      >
        <Card accent="tomato">
          <div class="guest-head">
            <h2 class="guest-name">{M.title}</h2>
            <button type="button" class="close-btn" aria-label={M.close} onClick={close}>
              ×
            </button>
          </div>
          <div class="menu-grid">
            {ACTIVE.map((c) => (
              <button type="button" class="menu-card" key={c.id} onClick={() => openFromMenu(c.id)}>
                <MenuCardIcon id={c.icon} />
                <span class="menu-card-label">{c.label}</span>
              </button>
            ))}
            {SOON.map((c) => (
              <button type="button" class="menu-card menu-card--soon" key={c.label} disabled>
                <MenuCardIcon id={c.icon} />
                <span class="menu-card-label">{c.label}</span>
                <span class="menu-card-soon">{M.comingSoon}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
