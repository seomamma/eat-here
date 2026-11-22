import { useEffect, useRef, useState } from 'preact/hooks';
import { prefersReducedMotion } from '../../platform/motion';

/** How long the money counts up to a new, higher value (ms). */
const COUNT_UP_MS = 450;

/** Pure: value shown `t` ms into a count from `from` to `to` (eased out, whole numbers). */
export function countUpValue(
  from: number,
  to: number,
  t: number,
  durationMs = COUNT_UP_MS,
): number {
  if (t >= durationMs) return to;
  const k = Math.max(0, t / durationMs);
  return Math.round(from + (to - from) * (1 - (1 - k) * (1 - k)));
}

/**
 * The money number. Gains count up quickly (a little "bump" restarts on every change); spending
 * and reduced motion show the new value at once.
 */
export function MoneyAmount(props: { value: number }) {
  const [shown, setShown] = useState(props.value);
  const [bump, setBump] = useState(0);
  const shownRef = useRef(props.value);
  const target = props.value;

  useEffect(() => {
    setBump((b) => b + 1);
    const from = shownRef.current;
    if (target <= from || prefersReducedMotion()) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const v = countUpValue(from, target, now - start);
      shownRef.current = v;
      setShown(v);
      if (v < target) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  // Re-keyed on every change so the CSS bump animation restarts without remounting this state.
  return (
    <span class="money-amount" key={bump}>
      {shown}
    </span>
  );
}
