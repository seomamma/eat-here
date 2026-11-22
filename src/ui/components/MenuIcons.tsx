const S = { stroke: 'var(--ink)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' } as const;

/** Pizza slice: crust arc on top, tip pointing down, three pepperoni. */
export function PizzaSliceIcon() {
  return (
    <svg class="menu-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 29L5 8c7-4 15-4 22 0z" fill="var(--saffron)" {...S} />
      <path
        d="M5 8c7-4 15-4 22 0"
        fill="none"
        stroke="var(--crust)"
        stroke-width="5"
        stroke-linecap="round"
      />
      <path
        d="M5 8c7-4 15-4 22 0"
        fill="none"
        stroke="var(--ink)"
        stroke-width="1.5"
        opacity="0.9"
      />
      <circle cx="12" cy="14" r="2.6" fill="var(--tomato)" {...S} stroke-width="1.5" />
      <circle cx="19.5" cy="15" r="2.6" fill="var(--tomato)" {...S} stroke-width="1.5" />
      <circle cx="16" cy="21" r="2.2" fill="var(--tomato)" {...S} stroke-width="1.5" />
    </svg>
  );
}

export type MenuIconId = 'shop' | 'market' | 'recipes' | 'build' | 'staff' | 'stats' | 'settings';

/** Simple 32x32 icons for the hub cards. */
export function MenuCardIcon(props: { id: MenuIconId }) {
  return (
    <svg class="menu-card-icon" viewBox="0 0 32 32" aria-hidden="true">
      {shape(props.id)}
    </svg>
  );
}

function shape(id: MenuIconId) {
  switch (id) {
    case 'shop':
      return (
        <>
          <path d="M4 12h24l-2 16H6z" fill="var(--saffron)" {...S} />
          <path d="M11 12V9a5 5 0 0 1 10 0v3" fill="none" {...S} />
        </>
      );
    case 'market':
      return (
        <>
          <path d="M3 14h26l-3 14H6z" fill="var(--crust)" {...S} />
          <circle cx="11" cy="10" r="5" fill="var(--tomato)" {...S} />
          <circle cx="21" cy="10" r="5" fill="var(--basil)" {...S} />
        </>
      );
    case 'recipes':
      return (
        <>
          <path d="M4 6h11v21H4zM17 6h11v21H17z" fill="var(--paper)" {...S} />
          <path d="M7 12h5M7 17h5M20 12h5M20 17h5" stroke="var(--tomato)" stroke-width="2.5" />
        </>
      );
    case 'build':
      return (
        <>
          <path d="M16 4l12 6v12l-12 6L4 22V10z" fill="var(--sky)" {...S} />
          <path d="M4 10l12 6 12-6M16 16v12" fill="none" {...S} />
        </>
      );
    case 'staff':
      return (
        <>
          <circle cx="16" cy="10" r="6" fill="var(--paper)" {...S} />
          <path d="M5 28c0-7 5-10 11-10s11 3 11 10z" fill="var(--paper)" {...S} />
        </>
      );
    case 'stats':
      return (
        <>
          <path d="M5 28V16h6v12zM13 28V6h6v22zM21 28V12h6v16z" fill="var(--paper)" {...S} />
        </>
      );
    case 'settings':
      return (
        <>
          <circle cx="16" cy="16" r="9" fill="var(--paper)" {...S} />
          <circle cx="16" cy="16" r="3.5" fill="none" {...S} />
          <path d="M16 3v4M16 25v4M3 16h4M25 16h4" stroke="var(--ink)" stroke-width="3" />
        </>
      );
  }
}
