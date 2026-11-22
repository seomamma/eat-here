import type { MomentIcon } from '../../data/moments';
import type { LookId } from '../../data/regulars';

const S = { stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linejoin': 'round' } as const;
const SKIN = '#E0B07A';

/** Placeholder portrait of a named guest (grey bun and shawl, red cap, ponytail). */
function Face(props: { look: LookId }) {
  switch (props.look) {
    case 'nonna_rosa':
      return (
        <>
          <path d="M3 31c0-7 5-9 13-9s13 2 13 9z" fill="#B5473A" {...S} />
          <circle cx="16" cy="6.5" r="4" fill="#B9B4B0" {...S} />
          <circle cx="16" cy="14" r="8.5" fill={SKIN} {...S} />
          <path
            d="M7.5 13c0-6 4-8 8.5-8s8.5 2 8.5 8c-3-3-6-3.5-8.5-3.5S10.5 10 7.5 13z"
            fill="#B9B4B0"
            {...S}
          />
          <circle cx="12.7" cy="14.5" r="1.2" fill="var(--ink)" />
          <circle cx="19.3" cy="14.5" r="1.2" fill="var(--ink)" />
        </>
      );
    case 'oliver':
      return (
        <>
          <path d="M3 31c0-7 5-9 13-9s13 2 13 9z" fill="#3E7A3A" {...S} />
          <circle cx="16" cy="15" r="8.5" fill={SKIN} {...S} />
          <path d="M7 13c0-7 4-9 9-9s9 2 9 9z" fill="#D93A2B" {...S} />
          <path d="M14 13h14" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" />
          <circle cx="12.7" cy="17" r="1.2" fill="var(--ink)" />
          <circle cx="19.3" cy="17" r="1.2" fill="var(--ink)" />
        </>
      );
    case 'mia':
      return (
        <>
          <path d="M3 31c0-7 5-9 13-9s13 2 13 9z" fill="#EDB94A" {...S} />
          <path d="M23 9c5 1 6 7 3 11-1-3-2-5-3-6z" fill="#8A5A34" {...S} />
          <circle cx="16" cy="15" r="8.5" fill={SKIN} {...S} />
          <path
            d="M7.5 14c0-6 4-9 8.5-9s8.5 3 8.5 9c-2-3-5-4-8.5-4S9.5 11 7.5 14z"
            fill="#8A5A34"
            {...S}
          />
          <circle cx="12.7" cy="16.5" r="1.2" fill="var(--ink)" />
          <circle cx="19.3" cy="16.5" r="1.2" fill="var(--ink)" />
        </>
      );
  }
}

function Glyph(props: { icon: Exclude<MomentIcon, LookId> }) {
  switch (props.icon) {
    case 'heart':
      return (
        <path
          d="M16 28C5 20 4 13 8 9.5c3-2.5 6.5-1 8 2 1.5-3 5-4.5 8-2 4 3.5 3 10.5-8 18.500z"
          fill="var(--tomato)"
          {...S}
        />
      );
    case 'basil':
      return (
        <>
          <path d="M5 25C4 12 12 5 27 5c1 14-6 22-22 20z" fill="#3E7A3A" {...S} />
          <path d="M5 25L19 11" fill="none" {...S} />
        </>
      );
    case 'star':
      return (
        <path
          d="M16 3l3.8 8.2 8.7 1-6.5 6 1.8 8.8L16 22.7 8.2 27l1.8-8.800-6.5-6 8.700-1z"
          fill="var(--saffron)"
          {...S}
        />
      );
  }
}

const LOOKS: readonly MomentIcon[] = ['nonna_rosa', 'oliver', 'mia'];

/** Icon of a moment card or a Guests book entry (32x32 placeholder art). */
export function MomentArt(props: { icon: MomentIcon; size?: number; locked?: boolean }) {
  const size = props.size ?? 56;
  return (
    <svg
      class={`moment-art${props.locked ? ' moment-art--locked' : ''}`}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {LOOKS.includes(props.icon) ? (
        <Face look={props.icon as LookId} />
      ) : (
        <Glyph icon={props.icon as Exclude<MomentIcon, LookId>} />
      )}
    </svg>
  );
}

export function HeartIcon(props: { on: boolean }) {
  return (
    <svg
      class={`heart-pip${props.on ? ' heart-pip--on' : ''}`}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <path
        d="M16 28C5 20 4 13 8 9.5c3-2.5 6.5-1 8 2 1.5-3 5-4.5 8-2 4 3.5 3 10.5-8 18.5z"
        {...S}
        stroke-width="2.5"
      />
    </svg>
  );
}
