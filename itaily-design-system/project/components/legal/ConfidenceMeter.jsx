import React from 'react';

/**
 * ConfidenceMeter — how grounded an AI answer is. Three-segment bar plus label.
 * Communicates that Itaily answers carry an explicit confidence, never blind certainty.
 */
export function ConfidenceMeter({ level = 'medium', showLabel = true, style = {}, ...rest }) {
  const map = {
    low:    { fill: 1, color: 'var(--status-danger-fg)', text: 'Low confidence' },
    medium: { fill: 2, color: 'var(--status-warning-fg)', text: 'Medium confidence' },
    high:   { fill: 3, color: 'var(--status-success-fg)', text: 'High confidence' },
  };
  const m = map[level] || map.medium;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)', ...style }} {...rest}>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 16, height: 6, borderRadius: 2,
            background: i < m.fill ? m.color : 'var(--neutral-200)',
          }} />
        ))}
      </span>
      {showLabel && (
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: m.color }}>{m.text}</span>
      )}
    </div>
  );
}
