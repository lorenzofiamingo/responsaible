import * as React from 'react';

export interface SourceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Human-readable source name, e.g. "Codice Civile — Responsabilità". */
  source: string;
  /** Article / reference, e.g. "Art. 2043 c.c." */
  article: string;
  /** Quoted text of the provision (rendered serif, italic, in guillemets). */
  excerpt?: string;
  /** Relevance score 0–100 → colored match badge. */
  relevance?: number;
  /** Source date / version line. */
  date?: string;
  /** Footnote index matching its Citation. */
  index?: number;
}

/** Primary-source panel for the answer sources rail: code, article, serif excerpt, relevance. */
export function SourceCard(props: SourceCardProps): JSX.Element;
