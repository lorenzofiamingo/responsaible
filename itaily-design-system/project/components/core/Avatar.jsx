import React from 'react';

/** Circular avatar — initials or image, with optional ring. */
export function Avatar({ name = '', src = null, size = 40, tone = 'accent', ring = false, style = {}, ...rest }) {
  const tones = {
    accent:  { bg: 'var(--terracotta-100)', fg: 'var(--terracotta-700)' },
    neutral: { bg: 'var(--neutral-200)', fg: 'var(--neutral-700)' },
    ink:     { bg: 'var(--neutral-800)', fg: 'var(--paper)' },
  };
  const t = tones[tone] || tones.accent;
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: t.bg, color: t.fg, overflow: 'hidden', flex: 'none',
        fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)',
        fontSize: Math.round(size * 0.4), letterSpacing: '-0.02em',
        boxShadow: ring ? '0 0 0 2px var(--surface-card), 0 0 0 4px var(--color-accent)' : 'none',
        ...style,
      }}
      {...rest}
    >
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </div>
  );
}
