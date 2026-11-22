import type { ComponentChildren } from 'preact';

export type Accent = 'tomato' | 'basil' | 'saffron' | 'sky' | 'crust';

export function Card(props: { accent?: Accent; class?: string; children: ComponentChildren }) {
  const extra = props.class ? ` ${props.class}` : '';
  return <div class={`card card--${props.accent ?? 'tomato'}${extra}`}>{props.children}</div>;
}
