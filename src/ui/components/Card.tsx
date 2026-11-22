import type { ComponentChildren } from 'preact';

export type Accent = 'tomato' | 'basil' | 'saffron' | 'sky' | 'crust';

export function Card(props: { accent?: Accent; children: ComponentChildren }) {
  return <div class={`card card--${props.accent ?? 'tomato'}`}>{props.children}</div>;
}
