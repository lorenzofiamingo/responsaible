import React from 'react';

/** Surface container with the warm Itaily shadow & border treatment. */
export function Card({ children, elevation = 'sm', padding = 'md', interactive = false, style = {}, ...rest }) {
  const pads = { none: 0, sm: 'var(--space-4)', md: 'var(--space-5)', lg: 'var(--space-6)' };
  const shadows = {
    flat: 'none',
    xs: 'var(--shadow-xs)',
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
  };
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1.5px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: shadows[elevation] ?? shadows.sm,
        padding: pads[padding] ?? pads.md,
        transition: 'box-shadow var(--duration-normal) var(--ease-out), transform var(--duration-normal) var(--ease-out)',
        cursor: interactive ? 'pointer' : 'default',
        ...style,
      }}
      onMouseEnter={interactive ? (e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; } : undefined}
      onMouseLeave={interactive ? (e) => { e.currentTarget.style.boxShadow = shadows[elevation] ?? shadows.sm; e.currentTarget.style.transform = 'translateY(0)'; } : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}
