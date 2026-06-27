import * as React from 'react';

/**
 * Inline citation chips for legal references.
 * @startingPoint section="Legal" subtitle="Inline citation chips for legal references" viewport="700x140"
 */
export interface CitationProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The reference text, e.g. "Art. 2043 c.c." */
  children?: React.ReactNode;
  /** Optional footnote number shown in a leading chip. */
  index?: number;
  /** Highlighted state (e.g. when its source is open). @default false */
  active?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

/**
 * Inline legal reference chip — the signature element of an Itaily answer.
 * Monospace, terracotta-tinted; clickable to open the underlying source.
 *
 * @startingPoint section="Legal" subtitle="Inline citation chips for legal references" viewport="700x140"
 */
export function Citation(props: CitationProps): JSX.Element;
