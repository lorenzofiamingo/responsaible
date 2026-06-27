import React from 'react';

/**
 * Citation — inline legal reference chip (Art. 2043 c.c., D.Lgs. 196/2003, Cass. civ. …).
 * Mono type, terracotta-tinted. The visual signature of an Itaily answer.
 */
export function Citation({ children, index, onClick, active = false, style = {}, ...rest }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 400,
        lineHeight: 1, padding: '3px 9px',
        color: active ? 'var(--color-on-accent)' : 'var(--terracotta-700)',
        background: active ? 'var(--color-accent)' : 'var(--terracotta-50)',
        border: '1.5px solid ' + (active ? 'var(--color-accent)' : 'var(--terracotta-200)'),
        borderRadius: 'var(--radius-sm)', cursor: onClick ? 'pointer' : 'default',
        verticalAlign: 'baseline', whiteSpace: 'nowrap',
        transition: 'background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
        ...style,
      }}
      {...rest}
    >
      {index != null && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 15, height: 15, borderRadius: 3, fontSize: 10, fontWeight: 700,
          background: active ? 'rgba(255,255,255,0.25)' : 'var(--terracotta-200)',
          color: active ? 'var(--color-on-accent)' : 'var(--terracotta-800)',
        }}>{index}</span>
      )}
      {children}
    </button>
  );
}
