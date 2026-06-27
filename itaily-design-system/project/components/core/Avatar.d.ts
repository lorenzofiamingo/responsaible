import * as React from 'react';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Full name — initials are derived from it. */
  name?: string;
  /** Image URL; falls back to initials. */
  src?: string | null;
  /** Diameter in px. @default 40 */
  size?: number;
  /** @default "accent" */
  tone?: 'accent' | 'neutral' | 'ink';
  /** Terracotta focus ring. @default false */
  ring?: boolean;
}

/** Circular avatar showing an image or derived initials. */
export function Avatar(props: AvatarProps): JSX.Element;
