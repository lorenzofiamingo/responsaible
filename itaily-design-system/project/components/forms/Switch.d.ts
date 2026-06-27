import * as React from 'react';

export interface SwitchProps {
  /** Controlled on/off state. @default false */
  checked?: boolean;
  /** Fired with the next boolean on toggle. */
  onChange?: (next: boolean) => void;
  /** Optional label rendered to the right. */
  label?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

/** On/off toggle switch with terracotta active track. */
export function Switch(props: SwitchProps): JSX.Element;
