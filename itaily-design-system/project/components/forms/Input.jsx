import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Text input with optional leading icon and label. */
export function Input({ label, icon = null, hint, error, size = 'md', style = {}, id, ...rest }) {
  const heights = { sm: 36, md: 44, lg: 52 }[size] || 44;
  const inputId = id || (label ? 'in-' + label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <label htmlFor={inputId} style={{ display: 'block', fontFamily: 'var(--font-sans)', ...style }}>
      {label && (
        <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</span>
      )}
      <span style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: heights, padding: '0 14px',
        background: 'var(--surface-card)',
        border: `1.5px solid ${error ? 'var(--status-danger-fg)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)',
        transition: 'border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)',
      }}
        onFocusCapture={(e) => { e.currentTarget.style.borderColor = 'var(--border-focus)'; e.currentTarget.style.boxShadow = 'var(--shadow-focus)'; }}
        onBlurCapture={(e) => { e.currentTarget.style.borderColor = error ? 'var(--status-danger-fg)' : 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        {icon && <Icon name={icon} size={18} color="var(--text-tertiary)" />}
        <input
          id={inputId}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--text-primary)',
            minWidth: 0,
          }}
          {...rest}
        />
      </span>
      {(hint || error) && (
        <span style={{ display: 'block', fontSize: 'var(--text-xs)', marginTop: 5, color: error ? 'var(--status-danger-fg)' : 'var(--text-tertiary)' }}>{error || hint}</span>
      )}
    </label>
  );
}
