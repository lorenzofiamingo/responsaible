import * as React from 'react';

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  /** Kebab-case Lucide icon name, e.g. "file-text", "scale", "search". */
  name: string;
  /** Pixel size (width & height). @default 20 */
  size?: number;
  /** @default 2 */
  strokeWidth?: number;
  /** @default "currentColor" */
  color?: string;
}

/**
 * Renders a Lucide icon. Lucide is Itaily's icon set (2px rounded stroke).
 * Requires the `lucide` UMD global to be present on the page.
 */
export function Icon(props: IconProps): JSX.Element;
