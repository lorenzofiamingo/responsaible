import React from 'react';

/** Compact status / category label. */
export function Badge({ children, tone = 'neutral', variant = 'soft', style = {}, ...rest }) {
  const tones = {
    neutral: { fg: 'var(--neutral-700)', bg: 'var(--neutral-100)', solid: 'var(--neutral-700)' },
    accent:  { fg: 'var(--terracotta-700)', bg: 'var(--terracotta-50)', solid: 'var(--color-accent)' },
    success: { fg: 'var(--status-success-fg)', bg: 'var(--status-success-bg)', solid: 'var(--green-500)' },
    warning: { fg: 'var(--status-warning-fg)', bg: 'var(--status-warning-bg)', solid: 'var(--amber-500)' },
    danger:  { fg: 'var(--status-danger-fg)', bg: 'var(--status-danger-bg)', solid: 'var(--red-500)' },
    info:    { fg: 'var(--status-info-fg)', bg: 'var(--status-info-bg)', solid: 'var(--blue-500)' },
  };
  const t = tones[tone] || tones.neutral;
  const looks = variant === 'solid'
    ? { background: t.solid, color: 'var(--neutral-0)' }
    : variant === 'outline'
    ? { background: 'transparent', color: t.fg, boxShadow: `inset 0 0 0 1.5px ${t.fg}` }
    : { background: t.bg, color: t.fg };
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
        letterSpacing: '0.01em', lineHeight: 1,
        padding: '4px 9px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap',
        ...looks, ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
