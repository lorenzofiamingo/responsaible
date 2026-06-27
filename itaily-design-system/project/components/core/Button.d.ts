import * as React from 'react';

/**
 * Action buttons in every variant & size.
 * @startingPoint section="Core" subtitle="Action buttons in every variant & size" viewport="700x200"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual treatment. @default "primary" */
  variant?: 'primary' | 'secondary' | 'ghost' | 'inverse';
  /** @default "md" */
  size?: 'sm' | 'md' | 'lg';
  /** Icon node rendered before the label. */
  iconLeft?: React.ReactNode;
  /** Icon node rendered after the label. */
  iconRight?: React.ReactNode;
  /** Stretch to fill container width. @default false */
  full?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * Primary action control. Use `primary` (terracotta) for the single main action
 * per view; `secondary` for supporting actions; `ghost` for low-emphasis; `inverse` on dark surfaces.
 *
 * @startingPoint section="Core" subtitle="Action buttons in every variant & size" viewport="700x200"
 */
export function Button(props: ButtonProps): JSX.Element;
