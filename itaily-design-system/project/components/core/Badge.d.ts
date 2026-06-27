import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** @default "neutral" */
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  /** @default "soft" */
  variant?: 'soft' | 'solid' | 'outline';
  children?: React.ReactNode;
}

/** Compact status or category label. */
export function Badge(props: BadgeProps): JSX.Element;
