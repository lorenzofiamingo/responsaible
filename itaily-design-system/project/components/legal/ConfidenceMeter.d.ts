import * as React from 'react';

export interface ConfidenceMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** @default "medium" */
  level?: 'low' | 'medium' | 'high';
  /** Show the text label beside the bar. @default true */
  showLabel?: boolean;
}

/** Three-segment bar conveying how grounded an AI answer is. */
export function ConfidenceMeter(props: ConfidenceMeterProps): JSX.Element;
