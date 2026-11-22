import { STRINGS } from '../../data/strings';
import { phase, report } from '../store';
import { sessionActions, setSetting, settings, settingsOpen } from '../settings';
import { Card } from './Card';

const S = STRINGS.settings;

function Toggle(props: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      class={`toggle-row${props.on ? ' toggle-row--on' : ''}`}
      aria-checked={props.on}
      onClick={() => props.onChange(!props.on)}
    >
      <span class="toggle-label">{props.label}</span>
      <span class="toggle-state">{props.on ? S.on : S.off}</span>
      <span class="toggle-switch" aria-hidden="true">
        <span class="toggle-knob" />
      </span>
    </button>
  );
}

/** Settings: sound effects, music and a way back to the title screen (saves first). */
export function SettingsPanel() {
  if (!settingsOpen.value || phase.value === 'night' || phase.value === 'report' || report.value)
    return null;
  const close = () => {
    settingsOpen.value = false;
  };
  const s = settings.value;
  return (
    <div class="modal-backdrop modal-backdrop--light interactive" onClick={close}>
      <div
        class="menu-panel settings-panel"
        role="dialog"
        aria-label={S.title}
        onClick={(e) => e.stopPropagation()}
      >
        <Card accent="sky">
          <div class="guest-head">
            <h2 class="guest-name">{S.title}</h2>
            <button type="button" class="close-btn" aria-label={S.close} onClick={close}>
              ×
            </button>
          </div>
          <div class="settings-rows">
            <Toggle label={S.sfx} on={s.sfx} onChange={(on) => setSetting('sfx', on)} />
            <Toggle label={S.music} on={s.music} onChange={(on) => setSetting('music', on)} />
          </div>
          <button
            type="button"
            class="btn btn--small settings-back"
            onClick={() => sessionActions.backToTitle?.()}
          >
            {S.backToTitle}
          </button>
          <p class="settings-hint">{S.backHint}</p>
        </Card>
      </div>
    </div>
  );
}
