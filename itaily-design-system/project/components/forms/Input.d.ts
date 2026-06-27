import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Field label rendered above the control. */
  label?: string;
  /** Kebab-case Lucide icon shown inside, leading. */
  icon?: string;
  /** Helper text below the field. */
  hint?: string;
  /** Error message — turns the field red and replaces the hint. */
  error?: string;
  /** @default "md" */
  size?: 'sm' | 'md' | 'lg';
}

/** Single-line text input with terracotta focus ring and optional icon. */
export function Input(props: InputProps): JSX.Element;
