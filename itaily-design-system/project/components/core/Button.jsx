import React from 'react';

/**
 * Itaily Button — primary action control.
 * Styling references design-system CSS custom properties only.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft = null,
  iconRight = null,
  disabled = false,
  full = false,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: { fontSize: 'var(--text-sm)', padding: '0 var(--space-3)', height: 34, gap: 6 },
    md: { fontSize: 'var(--text-base)', padding: '0 var(--space-5)', height: 42, gap: 8 },
    lg: { fontSize: 'var(--text-md)', padding: '0 var(--space-6)', height: 52, gap: 10 },
  };

  const variants = {
    primary: {
      background: 'var(--color-accent)',
      color: 'var(--color-on-accent)',
      border: 'var(--border-width) solid transparent',
    },
    secondary: {
      background: 'var(--surface-card)',
      color: 'var(--text-primary)',
      border: 'var(--border-width) solid var(--border-strong)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-primary)',
      border: 'var(--border-width) solid transparent',
    },
    inverse: {
      background: 'var(--neutral-0)',
      color: 'var(--neutral-900)',
      border: 'var(--border-width) solid transparent',
    },
  };

  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.primary;

  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        height: s.height,
        padding: s.padding,
        width: full ? '100%' : 'auto',
        fontFamily: 'var(--font-display)',
        fontWeight: 'var(--weight-medium)',
        fontSize: s.fontSize,
        letterSpacing: 'var(--tracking-snug)',
        lineHeight: 1,
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)',
        ...v,
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'translateY(1px)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
