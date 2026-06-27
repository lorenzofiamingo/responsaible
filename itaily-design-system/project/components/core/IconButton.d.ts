import * as React from 'react';

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Kebab-case Lucide icon name. */
  icon: string;
  /** Accessible label (also the tooltip). */
  label: string;
  /** @default "ghost" */
  variant?: 'ghost' | 'solid' | 'outline';
  /** @default "md" */
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

/** Square, icon-only button for toolbars and compact controls. */
export function IconButton(props: IconButtonProps): JSX.Element;
