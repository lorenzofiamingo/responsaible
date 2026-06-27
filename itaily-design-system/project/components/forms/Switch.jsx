import React from 'react';

/** On/off toggle. */
export function Switch({ checked = false, onChange, label, disabled = false, style = {}, ...rest }) {
  const [on, setOn] = React.useState(checked);
  React.useEffect(() => setOn(checked), [checked]);
  const toggle = () => {
    if (disabled) return;
    const next = !on;
    setOn(next);
    onChange && onChange(next);
  };
  const control = (
    <span
      role="switch"
      aria-checked={on}
      onClick={toggle}
      style={{
        width: 42, height: 24, flex: 'none', borderRadius: 'var(--radius-pill)',
        background: on ? 'var(--color-accent)' : 'var(--neutral-300)',
        position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--duration-normal) var(--ease-out)',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18,
        borderRadius: '50%', background: 'var(--neutral-0)', boxShadow: 'var(--shadow-sm)',
        transition: 'left var(--duration-normal) var(--ease-out)',
      }} />
    </span>
  );
  if (!label) return control;
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', ...style }} {...rest}>
      {control}
      {label}
    </label>
  );
}
