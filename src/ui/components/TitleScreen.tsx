import { signal } from '@preact/signals';
import { STRINGS } from '../../data/strings';
import { titleMenu } from '../store';
import { Card } from './Card';

const confirming = signal(false);

/** Logo, Continue (only with a valid save) and New Game (asks first when a save exists). */
export function TitleScreen() {
  const menu = titleMenu.value;
  if (!menu) return null;
  const S = STRINGS.title;
  const { save } = menu;
  return (
    <div class="title-screen interactive">
      <div class="title-logo">
        <Card accent="tomato">
          <h1 class="title-name">{STRINGS.gameTitle}</h1>
        </Card>
        <p class="title-subtitle">{S.subtitle}</p>
      </div>
      <div class="title-actions">
        {save && (
          <div class="title-continue">
            <button type="button" class="btn btn--basil btn--primary" onClick={menu.onContinue}>
              {S.continue}
            </button>
            <p class="title-summary">{S.summary(save.day, save.rankName, save.money)}</p>
          </div>
        )}
        <button
          type="button"
          class="btn btn--saffron btn--primary"
          onClick={() => (save ? (confirming.value = true) : menu.onNewGame())}
        >
          {S.newGame}
        </button>
      </div>
      {confirming.value && (
        <div class="modal-backdrop interactive">
          <div class="modal" role="dialog" aria-modal="true" aria-label={S.confirmTitle}>
            <Card accent="tomato">
              <h2 class="modal-title">{S.confirmTitle}</h2>
              <p class="confirm-body">{S.confirmBody}</p>
              <div class="confirm-buttons">
                <button
                  type="button"
                  class="btn btn--paper btn--small"
                  onClick={() => (confirming.value = false)}
                >
                  {S.cancel}
                </button>
                <button
                  type="button"
                  class="btn btn--tomato btn--small"
                  onClick={() => {
                    confirming.value = false;
                    menu.onNewGame();
                  }}
                >
                  {S.startOver}
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
