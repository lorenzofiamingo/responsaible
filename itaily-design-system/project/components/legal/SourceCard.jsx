import React from 'react';
import { Badge } from '../core/Badge.jsx';

/**
 * SourceCard — a primary-source panel: which code/law, the article number,
 * a serif excerpt, and a relevance score. Used in the answer's sources rail.
 */
export function SourceCard({ source, article, excerpt, relevance, date, index, style = {}, ...rest }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1.5px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        borderLeft: '3px solid var(--color-accent)',
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {index != null && (
            <span style={{
              flex: 'none', width: 18, height: 18, borderRadius: 4, background: 'var(--terracotta-100)',
              color: 'var(--terracotta-800)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{index}</span>
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--terracotta-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{article}</span>
        </div>
        {relevance != null && (
          <Badge tone={relevance >= 80 ? 'success' : relevance >= 50 ? 'warning' : 'neutral'}>{relevance}% match</Badge>
        )}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{source}</div>
      {excerpt && (
        <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'var(--text-base)', lineHeight: 'var(--leading-relaxed)', color: 'var(--neutral-700)' }}>
          «{excerpt}»
        </p>
      )}
      {date && (
        <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{date}</div>
      )}
    </div>
  );
}
