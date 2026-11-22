import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { FURNITURE } from '../../data/furniture';
import { STRINGS } from '../../data/strings';
import { cancelPlacing, confirmPlacing, ghost, ghostRect, rotateGhost } from '../build';

const B = STRINGS.build;
/** Space between the controls and the item, and the minimum margin to the screen edge (CSS px). */
const GAP = 10;
const EDGE = 8;

function RotateIcon() {
  return (
    <svg class="ctl-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M19 12a7 7 0 1 1-2.5-5.4M19 4v5h-5"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

/** Line above the buttons: why the spot is invalid, a warning, or what the piece costs. */
function PlacementHint() {
  const g = ghost.value;
  if (!g) return null;
  const def = FURNITURE[g.placing.defId];
  let text: string;
  let tone: 'bad' | 'warn' | 'info';
  if (!g.result.ok) {
    text = B.reasons[g.result.reason] ?? g.result.reason;
    tone = 'bad';
  } else if (g.orphanChair) {
    text = B.noTable;
    tone = 'warn';
  } else {
    text = g.placing.kind === 'new' ? B.cost(def.name, def.price) : B.moving(def.name);
    tone = 'info';
  }
  return (
    <div class={`build-hint build-hint--${tone}`} role="status">
      {text}
    </div>
  );
}

/** Where the controls go: above the item, flipped below it when there is no room, kept on screen. */
export function placeControls(
  rect: { left: number; top: number; right: number; bottom: number },
  size: { w: number; h: number },
  view: { w: number; h: number },
  topMin: number,
  bottomMax: number,
): { left: number; top: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const left = clamp(
    Math.round((rect.left + rect.right) / 2 - size.w / 2),
    EDGE,
    view.w - EDGE - size.w,
  );
  let top = rect.top - GAP - size.h;
  if (top < topMin) top = rect.bottom + GAP;
  top = clamp(top, topMin, Math.max(topMin, bottomMax - size.h));
  return { left, top: Math.round(top) };
}

/** Rotate / confirm / cancel floating next to the ghost (anchored via the view's screen rect). */
export function BuildControls() {
  const g = ghost.value;
  const rect = ghostRect.value;
  const ref = useRef<HTMLDivElement>(null);
  const [resized, setResized] = useState(0);
  useEffect(() => {
    const on = () => setResized((n) => n + 1);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  // Measured after render so the real size decides the clamping (the hint text varies).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !rect) return;
    const topBar = document.querySelector('.top-bar')?.getBoundingClientRect();
    const topMin = Math.max(EDGE, topBar ? topBar.bottom : 0);
    const bottomMax = window.innerHeight - EDGE;
    const pos = placeControls(
      rect,
      { w: el.offsetWidth, h: el.offsetHeight },
      { w: window.innerWidth, h: window.innerHeight },
      topMin,
      bottomMax,
    );
    el.style.left = `${pos.left}px`;
    el.style.top = `${pos.top}px`;
    el.style.visibility = 'visible';
  });
  void resized;
  if (!g || !rect) return null;
  return (
    <div class="build-controls interactive" ref={ref} style={{ visibility: 'hidden' }}>
      <PlacementHint />
      <div class="build-ctl-row">
        <button type="button" class="ctl-btn ctl-btn--crust" onClick={rotateGhost}>
          <RotateIcon />
          <span>{B.rotate}</span>
        </button>
        <button
          type="button"
          class="ctl-btn ctl-btn--basil"
          aria-label={B.confirm}
          disabled={!g.result.ok}
          onClick={confirmPlacing}
        >
          <svg class="ctl-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 12.5l5 5L19 7"
              fill="none"
              stroke="currentColor"
              stroke-width="3.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          class="ctl-btn ctl-btn--paper"
          aria-label={B.cancel}
          onClick={cancelPlacing}
        >
          <svg class="ctl-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              stroke-width="3.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
