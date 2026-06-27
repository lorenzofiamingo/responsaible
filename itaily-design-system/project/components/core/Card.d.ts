import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Shadow depth. @default "sm" */
  elevation?: 'flat' | 'xs' | 'sm' | 'md' | 'lg';
  /** Inner padding. @default "md" */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Lifts & deepens shadow on hover. @default false */
  interactive?: boolean;
  children?: React.ReactNode;
}

/** Warm-surfaced container — 16px radius, 1.5px border, soft warm shadow. */
export function Card(props: CardProps): JSX.Element;
