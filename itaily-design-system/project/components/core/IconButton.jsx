import React from 'react';
import { Icon } from './Icon.jsx';

/** Square icon-only button. */
export function IconButton({ icon, label, variant = 'ghost', size = 'md', disabled = false, style = {}, ...rest }) {
  const dims = { sm: 32, md: 40, lg: 48 }[size] || 40;
  const isz = { sm: 16, md: 20, lg: 22 }[size] || 20;
  const variants = {
    ghost: { background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid transparent' },
    solid: { background: 'var(--color-accent)', color: 'var(--color-on-accent)', border: '1.5px solid transparent' },
    outline: { background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1.5px solid var(--border-strong)' },
  };
  const v = variants[variant] || variants.ghost;
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      style={{
        width: dims, height: dims,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background var(--duration-fast) var(--ease-out)',
        ...v, ...style,
      }}
      onMouseEnter={(e) => { if (variant === 'ghost') e.currentTarget.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={(e) => { if (variant === 'ghost') e.currentTarget.style.background = 'transparent'; }}
      {...rest}
    >
      <Icon name={icon} size={isz} />
    </button>
  );
}
