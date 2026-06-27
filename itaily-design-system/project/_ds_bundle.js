/* @ds-bundle: {"format":3,"namespace":"ItailyDesignSystem_88d7b8","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Citation","sourcePath":"components/legal/Citation.jsx"},{"name":"ConfidenceMeter","sourcePath":"components/legal/ConfidenceMeter.jsx"},{"name":"SourceCard","sourcePath":"components/legal/SourceCard.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"c2cb79a26ad0","components/core/Badge.jsx":"a2579fc914ba","components/core/Button.jsx":"9a73100f0dd4","components/core/Card.jsx":"1faa991cc101","components/core/Icon.jsx":"ddb755cec789","components/core/IconButton.jsx":"3aea13ef587f","components/forms/Input.jsx":"8eb82dbaa910","components/forms/Switch.jsx":"c346d94307a8","components/legal/Citation.jsx":"5d4e51c918be","components/legal/ConfidenceMeter.jsx":"9fe453a37ad9","components/legal/SourceCard.jsx":"c9ce5ea21a6f","ui_kits/app/AppShell.jsx":"10382bbae71f","ui_kits/app/data.js":"7b7251585b57","ui_kits/app/screens.jsx":"795ae74b501d","ui_kits/web/Landing.jsx":"dce832bcba8d"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ItailyDesignSystem_88d7b8 = window.ItailyDesignSystem_88d7b8 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Circular avatar — initials or image, with optional ring. */
function Avatar({
  name = '',
  src = null,
  size = 40,
  tone = 'accent',
  ring = false,
  style = {},
  ...rest
}) {
  const tones = {
    accent: {
      bg: 'var(--terracotta-100)',
      fg: 'var(--terracotta-700)'
    },
    neutral: {
      bg: 'var(--neutral-200)',
      fg: 'var(--neutral-700)'
    },
    ink: {
      bg: 'var(--neutral-800)',
      fg: 'var(--paper)'
    }
  };
  const t = tones[tone] || tones.accent;
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: t.bg,
      color: t.fg,
      overflow: 'hidden',
      flex: 'none',
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: Math.round(size * 0.4),
      letterSpacing: '-0.02em',
      boxShadow: ring ? '0 0 0 2px var(--surface-card), 0 0 0 4px var(--color-accent)' : 'none',
      ...style
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Compact status / category label. */
function Badge({
  children,
  tone = 'neutral',
  variant = 'soft',
  style = {},
  ...rest
}) {
  const tones = {
    neutral: {
      fg: 'var(--neutral-700)',
      bg: 'var(--neutral-100)',
      solid: 'var(--neutral-700)'
    },
    accent: {
      fg: 'var(--terracotta-700)',
      bg: 'var(--terracotta-50)',
      solid: 'var(--color-accent)'
    },
    success: {
      fg: 'var(--status-success-fg)',
      bg: 'var(--status-success-bg)',
      solid: 'var(--green-500)'
    },
    warning: {
      fg: 'var(--status-warning-fg)',
      bg: 'var(--status-warning-bg)',
      solid: 'var(--amber-500)'
    },
    danger: {
      fg: 'var(--status-danger-fg)',
      bg: 'var(--status-danger-bg)',
      solid: 'var(--red-500)'
    },
    info: {
      fg: 'var(--status-info-fg)',
      bg: 'var(--status-info-bg)',
      solid: 'var(--blue-500)'
    }
  };
  const t = tones[tone] || tones.neutral;
  const looks = variant === 'solid' ? {
    background: t.solid,
    color: 'var(--neutral-0)'
  } : variant === 'outline' ? {
    background: 'transparent',
    color: t.fg,
    boxShadow: `inset 0 0 0 1.5px ${t.fg}`
  } : {
    background: t.bg,
    color: t.fg
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      letterSpacing: '0.01em',
      lineHeight: 1,
      padding: '4px 9px',
      borderRadius: 'var(--radius-sm)',
      whiteSpace: 'nowrap',
      ...looks,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Itaily Button — primary action control.
 * Styling references design-system CSS custom properties only.
 */
function Button({
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
    sm: {
      fontSize: 'var(--text-sm)',
      padding: '0 var(--space-3)',
      height: 34,
      gap: 6
    },
    md: {
      fontSize: 'var(--text-base)',
      padding: '0 var(--space-5)',
      height: 42,
      gap: 8
    },
    lg: {
      fontSize: 'var(--text-md)',
      padding: '0 var(--space-6)',
      height: 52,
      gap: 10
    }
  };
  const variants = {
    primary: {
      background: 'var(--color-accent)',
      color: 'var(--color-on-accent)',
      border: 'var(--border-width) solid transparent'
    },
    secondary: {
      background: 'var(--surface-card)',
      color: 'var(--text-primary)',
      border: 'var(--border-width) solid var(--border-strong)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-primary)',
      border: 'var(--border-width) solid transparent'
    },
    inverse: {
      background: 'var(--neutral-0)',
      color: 'var(--neutral-900)',
      border: 'var(--border-width) solid transparent'
    }
  };
  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.primary;
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    style: {
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
      ...style
    },
    onMouseDown: e => {
      if (!disabled) e.currentTarget.style.transform = 'translateY(1px)';
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = 'translateY(0)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'translateY(0)';
    }
  }, rest), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Surface container with the warm Itaily shadow & border treatment. */
function Card({
  children,
  elevation = 'sm',
  padding = 'md',
  interactive = false,
  style = {},
  ...rest
}) {
  const pads = {
    none: 0,
    sm: 'var(--space-4)',
    md: 'var(--space-5)',
    lg: 'var(--space-6)'
  };
  const shadows = {
    flat: 'none',
    xs: 'var(--shadow-xs)',
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--surface-card)',
      border: '1.5px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: shadows[elevation] ?? shadows.sm,
      padding: pads[padding] ?? pads.md,
      transition: 'box-shadow var(--duration-normal) var(--ease-out), transform var(--duration-normal) var(--ease-out)',
      cursor: interactive ? 'pointer' : 'default',
      ...style
    },
    onMouseEnter: interactive ? e => {
      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    } : undefined,
    onMouseLeave: interactive ? e => {
      e.currentTarget.style.boxShadow = shadows[elevation] ?? shadows.sm;
      e.currentTarget.style.transform = 'translateY(0)';
    } : undefined
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Itaily Icon — thin wrapper over Lucide (loaded as the global `lucide`).
 * Lucide is Itaily's chosen icon set: 2px stroke, rounded caps/joins — it
 * harmonises with the chunky, friendly wordmark. Pass a kebab-case Lucide name.
 *
 * In HTML cards / UI kits, include:
 *   <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
 */
function Icon({
  name,
  size = 20,
  strokeWidth = 2,
  color = 'currentColor',
  style = {},
  ...rest
}) {
  const [, force] = React.useState(0);
  React.useEffect(() => {
    if (typeof window !== 'undefined' && !window.lucide) {
      let tries = 0;
      const t = setInterval(() => {
        tries += 1;
        if (window.lucide || tries > 40) {
          clearInterval(t);
          force(n => n + 1);
        }
      }, 50);
      return () => clearInterval(t);
    }
  }, []);
  const reg = typeof window !== 'undefined' && window.lucide && window.lucide.icons || null;
  const pascal = String(name || '').split(/[-_]/).map(s => s ? s[0].toUpperCase() + s.slice(1) : '').join('');
  const node = reg && (reg[pascal] || reg[name]);
  return /*#__PURE__*/React.createElement("svg", _extends({
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: 'inline-block',
      flex: 'none',
      verticalAlign: 'middle',
      ...style
    }
  }, rest), Array.isArray(node) ? node.map((child, i) => {
    // Lucide IconNode entries are [tag, attrs] or {tag, attrs}
    const tag = Array.isArray(child) ? child[0] : child.tag;
    const attrs = Array.isArray(child) ? child[1] : child.attrs;
    return React.createElement(tag, {
      key: i,
      ...attrs
    });
  }) : null);
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Square icon-only button. */
function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  style = {},
  ...rest
}) {
  const dims = {
    sm: 32,
    md: 40,
    lg: 48
  }[size] || 40;
  const isz = {
    sm: 16,
    md: 20,
    lg: 22
  }[size] || 20;
  const variants = {
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '1.5px solid transparent'
    },
    solid: {
      background: 'var(--color-accent)',
      color: 'var(--color-on-accent)',
      border: '1.5px solid transparent'
    },
    outline: {
      background: 'var(--surface-card)',
      color: 'var(--text-primary)',
      border: '1.5px solid var(--border-strong)'
    }
  };
  const v = variants[variant] || variants.ghost;
  return /*#__PURE__*/React.createElement("button", _extends({
    "aria-label": label,
    title: label,
    disabled: disabled,
    style: {
      width: dims,
      height: dims,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      transition: 'background var(--duration-fast) var(--ease-out)',
      ...v,
      ...style
    },
    onMouseEnter: e => {
      if (variant === 'ghost') e.currentTarget.style.background = 'var(--surface-hover)';
    },
    onMouseLeave: e => {
      if (variant === 'ghost') e.currentTarget.style.background = 'transparent';
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: isz
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Text input with optional leading icon and label. */
function Input({
  label,
  icon = null,
  hint,
  error,
  size = 'md',
  style = {},
  id,
  ...rest
}) {
  const heights = {
    sm: 36,
    md: 44,
    lg: 52
  }[size] || 44;
  const inputId = id || (label ? 'in-' + label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      display: 'block',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--text-secondary)',
      marginBottom: 6
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: heights,
      padding: '0 14px',
      background: 'var(--surface-card)',
      border: `1.5px solid ${error ? 'var(--status-danger-fg)' : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-md)',
      transition: 'border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)'
    },
    onFocusCapture: e => {
      e.currentTarget.style.borderColor = 'var(--border-focus)';
      e.currentTarget.style.boxShadow = 'var(--shadow-focus)';
    },
    onBlurCapture: e => {
      e.currentTarget.style.borderColor = error ? 'var(--status-danger-fg)' : 'var(--border-default)';
      e.currentTarget.style.boxShadow = 'none';
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      color: 'var(--text-primary)',
      minWidth: 0
    }
  }, rest))), (hint || error) && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 'var(--text-xs)',
      marginTop: 5,
      color: error ? 'var(--status-danger-fg)' : 'var(--text-tertiary)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** On/off toggle. */
function Switch({
  checked = false,
  onChange,
  label,
  disabled = false,
  style = {},
  ...rest
}) {
  const [on, setOn] = React.useState(checked);
  React.useEffect(() => setOn(checked), [checked]);
  const toggle = () => {
    if (disabled) return;
    const next = !on;
    setOn(next);
    onChange && onChange(next);
  };
  const control = /*#__PURE__*/React.createElement("span", {
    role: "switch",
    "aria-checked": on,
    onClick: toggle,
    style: {
      width: 42,
      height: 24,
      flex: 'none',
      borderRadius: 'var(--radius-pill)',
      background: on ? 'var(--color-accent)' : 'var(--neutral-300)',
      position: 'relative',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background var(--duration-normal) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: on ? 21 : 3,
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: 'var(--neutral-0)',
      boxShadow: 'var(--shadow-sm)',
      transition: 'left var(--duration-normal) var(--ease-out)'
    }
  }));
  if (!label) return control;
  return /*#__PURE__*/React.createElement("label", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      color: 'var(--text-primary)',
      ...style
    }
  }, rest), control, label);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/legal/Citation.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Citation — inline legal reference chip (Art. 2043 c.c., D.Lgs. 196/2003, Cass. civ. …).
 * Mono type, terracotta-tinted. The visual signature of an Itaily answer.
 */
function Citation({
  children,
  index,
  onClick,
  active = false,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    onClick: onClick,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-sm)',
      fontWeight: 400,
      lineHeight: 1,
      padding: '3px 9px',
      color: active ? 'var(--color-on-accent)' : 'var(--terracotta-700)',
      background: active ? 'var(--color-accent)' : 'var(--terracotta-50)',
      border: '1.5px solid ' + (active ? 'var(--color-accent)' : 'var(--terracotta-200)'),
      borderRadius: 'var(--radius-sm)',
      cursor: onClick ? 'pointer' : 'default',
      verticalAlign: 'baseline',
      whiteSpace: 'nowrap',
      transition: 'background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
      ...style
    }
  }, rest), index != null && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 15,
      height: 15,
      borderRadius: 3,
      fontSize: 10,
      fontWeight: 700,
      background: active ? 'rgba(255,255,255,0.25)' : 'var(--terracotta-200)',
      color: active ? 'var(--color-on-accent)' : 'var(--terracotta-800)'
    }
  }, index), children);
}
Object.assign(__ds_scope, { Citation });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/legal/Citation.jsx", error: String((e && e.message) || e) }); }

// components/legal/ConfidenceMeter.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ConfidenceMeter — how grounded an AI answer is. Three-segment bar plus label.
 * Communicates that Itaily answers carry an explicit confidence, never blind certainty.
 */
function ConfidenceMeter({
  level = 'medium',
  showLabel = true,
  style = {},
  ...rest
}) {
  const map = {
    low: {
      fill: 1,
      color: 'var(--status-danger-fg)',
      text: 'Low confidence'
    },
    medium: {
      fill: 2,
      color: 'var(--status-warning-fg)',
      text: 'Medium confidence'
    },
    high: {
      fill: 3,
      color: 'var(--status-success-fg)',
      text: 'High confidence'
    }
  };
  const m = map[level] || map.medium;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      gap: 3
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 16,
      height: 6,
      borderRadius: 2,
      background: i < m.fill ? m.color : 'var(--neutral-200)'
    }
  }))), showLabel && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-medium)',
      color: m.color
    }
  }, m.text));
}
Object.assign(__ds_scope, { ConfidenceMeter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/legal/ConfidenceMeter.jsx", error: String((e && e.message) || e) }); }

// components/legal/SourceCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * SourceCard — a primary-source panel: which code/law, the article number,
 * a serif excerpt, and a relevance score. Used in the answer's sources rail.
 */
function SourceCard({
  source,
  article,
  excerpt,
  relevance,
  date,
  index,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--surface-card)',
      border: '1.5px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
      borderLeft: '3px solid var(--color-accent)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 0
    }
  }, index != null && /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      width: 18,
      height: 18,
      borderRadius: 4,
      background: 'var(--terracotta-100)',
      color: 'var(--terracotta-800)',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 700,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, index), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-sm)',
      color: 'var(--terracotta-700)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, article)), relevance != null && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: relevance >= 80 ? 'success' : relevance >= 50 ? 'warning' : 'neutral'
  }, relevance, "% match")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--text-primary)',
      marginBottom: 6
    }
  }, source), excerpt && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-serif)',
      fontStyle: 'italic',
      fontSize: 'var(--text-base)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--neutral-700)'
    }
  }, "\xAB", excerpt, "\xBB"), date && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-tertiary)'
    }
  }, date));
}
Object.assign(__ds_scope, { SourceCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/legal/SourceCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/AppShell.jsx
try { (() => {
// Itaily app — orchestrator. Login -> workspace; ask -> cited answer.
// LoginScreen, Sidebar, Exchange, Composer, SourcesRail are global fns from screens.jsx.

function AppShell() {
  const data = window.ItailyData;
  const [authed, setAuthed] = React.useState(false);
  const [activeId, setActiveId] = React.useState('t1');
  const [draft, setDraft] = React.useState('');
  const [primaryOnly, setPrimaryOnly] = React.useState(true);
  const [activeCite, setActiveCite] = React.useState(1);
  const [exchanges, setExchanges] = React.useState([{
    q: data.opener.question,
    a: data.opener.answer ? {
      answer: data.opener.answer,
      confidence: data.opener.confidence,
      sources: data.opener.sources
    } : null
  }]);
  const scrollRef = React.useRef(null);
  const allSources = exchanges[exchanges.length - 1]?.a?.sources || [];
  const send = () => {
    const q = draft.trim();
    if (!q) return;
    const a = {
      answer: data.reply.answer,
      confidence: data.reply.confidence,
      sources: data.reply.sources
    };
    setExchanges(prev => [...prev, {
      q,
      a
    }]);
    setDraft('');
    setActiveCite(1);
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 60);
  };
  const newThread = () => {
    setExchanges([]);
    setDraft('');
  };
  if (!authed) return /*#__PURE__*/React.createElement(LoginScreen, {
    onEnter: () => setAuthed(true)
  });
  const title = data.threads.find(t => t.id === activeId)?.title || 'New question';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    threads: data.threads,
    activeId: activeId,
    onSelect: setActiveId,
    onNew: newThread,
    user: data.user
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      height: 60,
      flex: 'none',
      borderBottom: '1.5px solid var(--border-default)',
      background: 'rgba(250,248,244,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 28px',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'var(--text-md)',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, exchanges.length ? title : 'New question'), /*#__PURE__*/React.createElement(window.ItailyDesignSystem_88d7b8.Badge, {
    tone: "accent",
    variant: "outline",
    style: {
      marginLeft: 4
    }
  }, "Italian law"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(window.ItailyDesignSystem_88d7b8.IconButton, {
    icon: "bookmark",
    label: "Save",
    size: "sm"
  }), /*#__PURE__*/React.createElement(window.ItailyDesignSystem_88d7b8.IconButton, {
    icon: "download",
    label: "Export",
    size: "sm"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: scrollRef,
    style: {
      flex: 1,
      overflowY: 'auto',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      maxWidth: 760,
      width: '100%',
      margin: '0 auto',
      padding: '32px 28px 8px'
    }
  }, exchanges.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    onPick: q => {
      setDraft(q);
    }
  }) : exchanges.map((ex, i) => /*#__PURE__*/React.createElement(Exchange, {
    key: i,
    q: ex.q,
    a: ex.a,
    activeCite: activeCite,
    onCite: setActiveCite
  }))), /*#__PURE__*/React.createElement(Composer, {
    value: draft,
    onChange: setDraft,
    onSend: send,
    primaryOnly: primaryOnly,
    onTogglePrimary: () => setPrimaryOnly(v => !v)
  })), allSources.length > 0 && /*#__PURE__*/React.createElement(SourcesRail, {
    sources: allSources,
    activeCite: activeCite,
    onCite: setActiveCite
  }))));
}
function EmptyState({
  onPick
}) {
  const Icon = window.ItailyDesignSystem_88d7b8.Icon;
  const suggestions = ['What are the grounds for terminating an employment contract for just cause?', 'How is forced heirship calculated for two children and a spouse?', 'When is a non-compete clause enforceable against an employee?'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo/itaily-logo.svg",
    style: {
      height: 40,
      marginBottom: 18
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-2xl)',
      marginBottom: 8
    }
  }, "Ask anything about Italian law."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: 'var(--text-md)',
      maxWidth: 460,
      marginBottom: 26
    }
  }, "Every answer comes grounded in primary sources, with citations you can verify in one click."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      width: '100%',
      maxWidth: 520
    }
  }, suggestions.map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => onPick(s),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      textAlign: 'left',
      background: 'var(--surface-card)',
      border: '1.5px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      padding: '13px 16px',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      color: 'var(--text-primary)',
      boxShadow: 'var(--shadow-xs)'
    },
    onMouseEnter: e => {
      e.currentTarget.style.borderColor = 'var(--terracotta-300)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = 'var(--border-default)';
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "corner-down-right",
    size: 16,
    color: "var(--color-accent)"
  }), s))));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(AppShell, null));
setTimeout(() => window.lucide && window.lucide.createIcons(), 400);
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/data.js
try { (() => {
// Itaily app — sample (faked) content for the UI kit.
window.ItailyData = {
  user: {
    name: 'Giulia Romano',
    plan: 'Studio · Pro',
    firm: 'Romano & Partners'
  },
  threads: [{
    id: 't1',
    title: 'Liability for defective products',
    when: 'Oggi',
    group: 'Today'
  }, {
    id: 't2',
    title: 'GDPR data-processing basis',
    when: 'Oggi',
    group: 'Today'
  }, {
    id: 't3',
    title: 'Tenant eviction — late rent',
    when: 'Ieri',
    group: 'Yesterday'
  }, {
    id: 't4',
    title: 'Non-compete enforceability',
    when: '12 Mar',
    group: 'Earlier'
  }, {
    id: 't5',
    title: 'Inheritance — forced heirship',
    when: '9 Mar',
    group: 'Earlier'
  }],
  // The opening exchange shown when the workspace loads.
  opener: {
    question: 'A contractor caused damage to my client through negligence. What is the basis for a compensation claim under Italian law?',
    answer: [{
      t: 'Under Italian law the claim rests on the general rule of tort liability: anyone who, through '
    }, {
      t: 'fault or wilful conduct',
      em: true
    }, {
      t: ', causes another unjust harm is bound to compensate it '
    }, {
      cite: 1,
      ref: 'Art. 2043 c.c.'
    }, {
      t: '. Your client must establish four elements — the conduct, fault, the unjust harm, and a causal link between them '
    }, {
      cite: 2,
      ref: 'Art. 2697 c.c.'
    }, {
      t: '. Where the contractor was performing under a contract, liability may also be framed as contractual non-performance '
    }, {
      cite: 3,
      ref: 'Art. 1218 c.c.'
    }, {
      t: ', which shifts the burden of proof and extends the limitation period to ten years.'
    }],
    confidence: 'high',
    sources: [{
      index: 1,
      source: 'Codice Civile — Dei fatti illeciti',
      article: 'Art. 2043 c.c.',
      excerpt: 'Qualunque fatto doloso o colposo che cagiona ad altri un danno ingiusto obbliga colui che ha commesso il fatto a risarcire il danno.',
      relevance: 94,
      date: 'Vigente · agg. 14 Mar 2025'
    }, {
      index: 2,
      source: 'Codice Civile — Onere della prova',
      article: 'Art. 2697 c.c.',
      excerpt: 'Chi vuol far valere un diritto in giudizio deve provare i fatti che ne costituiscono il fondamento.',
      relevance: 81,
      date: 'Vigente'
    }, {
      index: 3,
      source: 'Codice Civile — Responsabilità del debitore',
      article: 'Art. 1218 c.c.',
      excerpt: 'Il debitore che non esegue esattamente la prestazione dovuta è tenuto al risarcimento del danno…',
      relevance: 76,
      date: 'Vigente'
    }]
  },
  // Canned response used when the user sends any new message.
  reply: {
    answer: [{
      t: 'Good question. For a non-compete clause between employer and employee to be enforceable it must satisfy four cumulative conditions: it must be '
    }, {
      t: 'in writing',
      em: true
    }, {
      t: ', provide specific consideration to the employee, and be bounded in '
    }, {
      cite: 1,
      ref: 'Art. 2125 c.c.'
    }, {
      t: ' as to subject-matter, territory and time — failing any of which the clause is null. The Cassazione has held the consideration must be non-symbolic and determinable '
    }, {
      cite: 2,
      ref: 'Cass. civ. 5540/2021'
    }, {
      t: '.'
    }],
    confidence: 'medium',
    sources: [{
      index: 1,
      source: 'Codice Civile — Patto di non concorrenza',
      article: 'Art. 2125 c.c.',
      excerpt: 'Il patto con il quale si limita lo svolgimento dell\u2019attività del prestatore di lavoro per il tempo successivo alla cessazione del contratto è nullo se non risulta da atto scritto…',
      relevance: 89,
      date: 'Vigente'
    }, {
      index: 2,
      source: 'Corte di Cassazione, Sez. Lavoro',
      article: 'Cass. civ. 5540/2021',
      excerpt: 'Il corrispettivo del patto di non concorrenza deve essere congruo e non meramente simbolico…',
      relevance: 72,
      date: 'Massima'
    }]
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/data.js", error: String((e && e.message) || e) }); }

// ui_kits/app/screens.jsx
try { (() => {
// Itaily app — screen pieces. Composes DS primitives from the bundle.
const DS = window.ItailyDesignSystem_88d7b8;
const {
  Button,
  IconButton,
  Icon,
  Badge,
  Avatar,
  Citation,
  SourceCard,
  ConfidenceMeter,
  Switch
} = DS;

/* ---------------- Brand lockup ---------------- */
function BrandMark({
  size = 28
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: 7,
      background: 'var(--color-accent)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo/itaily-logo-light.svg",
    style: {
      height: size * 0.42
    }
  })), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo/itaily-logo.svg",
    style: {
      height: size * 0.62
    }
  }));
}

/* ---------------- Login ---------------- */
function LoginScreen({
  onEnter
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surface-page)',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 400,
      background: 'var(--surface-card)',
      border: '1.5px solid var(--border-default)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-lg)',
      padding: 36
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo/itaily-logo.svg",
    style: {
      height: 34,
      marginBottom: 22
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-xl)',
      marginBottom: 6
    }
  }, "Italian law, decoded."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 24px',
      color: 'var(--text-secondary)',
      fontSize: 'var(--text-base)'
    }
  }, "Sign in to your studio workspace."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(DS.Input, {
    label: "Work email",
    icon: "mail",
    defaultValue: "g.romano@romanopartners.it"
  }), /*#__PURE__*/React.createElement(DS.Input, {
    label: "Password",
    icon: "lock",
    type: "password",
    defaultValue: "demo1234"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    iconRight: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      size: 18
    }),
    onClick: onEnter,
    style: {
      marginTop: 4
    }
  }, "Enter Itaily")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      textAlign: 'center',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-tertiary)'
    }
  }, "Demo workspace \xB7 no real credentials needed")));
}

/* ---------------- Sidebar ---------------- */
function Sidebar({
  threads,
  activeId,
  onSelect,
  onNew,
  user
}) {
  const groups = ['Today', 'Yesterday', 'Earlier'];
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 264,
      flex: 'none',
      background: 'var(--surface-card)',
      borderRight: '1.5px solid var(--border-default)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 18px 14px'
    }
  }, /*#__PURE__*/React.createElement(BrandMark, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 14px 12px'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 18
    }),
    onClick: onNew
  }, "New question")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '4px 10px'
    }
  }, groups.map(g => {
    const items = threads.filter(t => t.group === g);
    if (!items.length) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: g,
      style: {
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--text-tertiary)',
        padding: '6px 8px'
      }
    }, g), items.map(t => /*#__PURE__*/React.createElement("button", {
      key: t.id,
      onClick: () => onSelect(t.id),
      style: {
        display: 'block',
        width: '100%',
        textAlign: 'left',
        border: 'none',
        cursor: 'pointer',
        padding: '9px 10px',
        borderRadius: 'var(--radius-sm)',
        marginBottom: 2,
        background: t.id === activeId ? 'var(--terracotta-50)' : 'transparent',
        color: t.id === activeId ? 'var(--terracotta-800)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        fontWeight: t.id === activeId ? 600 : 400,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      },
      onMouseEnter: e => {
        if (t.id !== activeId) e.currentTarget.style.background = 'var(--surface-hover)';
      },
      onMouseLeave: e => {
        if (t.id !== activeId) e.currentTarget.style.background = 'transparent';
      }
    }, t.title)));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1.5px solid var(--border-subtle)',
      padding: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: user.name,
    size: 36
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--text-primary)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, user.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-tertiary)'
    }
  }, user.plan)), /*#__PURE__*/React.createElement(IconButton, {
    icon: "settings",
    label: "Settings",
    size: "sm"
  })));
}

/* ---------------- Answer rendering ---------------- */
function AnswerBody({
  parts,
  activeCite,
  onCite
}) {
  return /*#__PURE__*/React.createElement("span", null, parts.map((p, i) => {
    if (p.cite != null) return /*#__PURE__*/React.createElement(Citation, {
      key: i,
      index: p.cite,
      active: activeCite === p.cite,
      onClick: () => onCite(p.cite)
    }, p.ref);
    if (p.em) return /*#__PURE__*/React.createElement("em", {
      key: i,
      style: {
        fontStyle: 'normal',
        fontWeight: 600
      }
    }, p.t);
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, p.t);
  }));
}
function Exchange({
  q,
  a,
  activeCite,
  onCite
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 36
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Giulia Romano",
    size: 32,
    tone: "neutral"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-md)',
      lineHeight: 'var(--leading-snug)',
      color: 'var(--text-primary)',
      paddingTop: 4,
      fontWeight: 500
    }
  }, q)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      flex: 'none',
      borderRadius: 8,
      background: 'var(--neutral-800)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo/itaily-mark.svg",
    style: {
      width: 18
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-base)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--text-primary)'
    }
  }, /*#__PURE__*/React.createElement(AnswerBody, {
    parts: a.answer,
    activeCite: activeCite,
    onCite: onCite
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      marginTop: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(ConfidenceMeter, {
    level: a.confidence
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 18,
      background: 'var(--border-default)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "copy",
    label: "Copy",
    size: "sm"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "thumbs-up",
    label: "Helpful",
    size: "sm"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "thumbs-down",
    label: "Not helpful",
    size: "sm"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "share-2",
    label: "Share",
    size: "sm"
  }))))));
}

/* ---------------- Composer ---------------- */
function Composer({
  value,
  onChange,
  onSend,
  primaryOnly,
  onTogglePrimary
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1.5px solid var(--border-default)',
      background: 'var(--surface-card)',
      padding: '14px 28px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 760,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1.5px solid var(--border-strong)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-card)',
      padding: 12,
      boxShadow: 'var(--shadow-sm)'
    }
  }, /*#__PURE__*/React.createElement("textarea", {
    value: value,
    onChange: e => onChange(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    },
    placeholder: "Ask anything about Italian law\u2026",
    rows: 2,
    style: {
      width: '100%',
      border: 'none',
      outline: 'none',
      resize: 'none',
      background: 'transparent',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-md)',
      color: 'var(--text-primary)',
      lineHeight: 1.4
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onTogglePrimary,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: primaryOnly ? 'var(--terracotta-700)' : 'var(--text-tertiary)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: primaryOnly ? 'check-circle-2' : 'circle',
    size: 16
  }), "Primary sources only"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-tertiary)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "book-open",
    size: 16
  }), " Codice Civile + 6 corpora")), /*#__PURE__*/React.createElement(IconButton, {
    icon: "arrow-up",
    label: "Send",
    variant: "solid",
    onClick: onSend
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 10,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-tertiary)'
    }
  }, "Informational, not legal advice. Verify against the official Gazzetta Ufficiale.")));
}

/* ---------------- Sources rail ---------------- */
function SourcesRail({
  sources,
  activeCite,
  onCite
}) {
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 340,
      flex: 'none',
      borderLeft: '1.5px solid var(--border-default)',
      background: 'var(--surface-page)',
      height: '100vh',
      overflowY: 'auto',
      padding: '20px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "library",
    size: 18,
    color: "var(--color-accent)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-md)'
    }
  }, "Sources"), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral",
    style: {
      marginLeft: 'auto'
    }
  }, sources.length)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, sources.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.index,
    onClick: () => onCite(s.index),
    style: {
      cursor: 'pointer',
      outline: activeCite === s.index ? '2px solid var(--color-accent)' : 'none',
      outlineOffset: 2,
      borderRadius: 'var(--radius-md)',
      transition: 'outline-color 120ms'
    }
  }, /*#__PURE__*/React.createElement(SourceCard, s)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      padding: 14,
      background: 'var(--terracotta-50)',
      borderRadius: 'var(--radius-md)',
      fontSize: 'var(--text-sm)',
      color: 'var(--terracotta-800)',
      lineHeight: 'var(--leading-normal)'
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      display: 'block',
      marginBottom: 4
    }
  }, "Why sources?"), "Every Itaily answer is grounded in primary law. Click a citation to verify it here."));
}
Object.assign(window, {
  BrandMark,
  LoginScreen,
  Sidebar,
  Exchange,
  Composer,
  SourcesRail
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web/Landing.jsx
try { (() => {
// Itaily — marketing landing. Composes DS primitives.
const M = window.ItailyDesignSystem_88d7b8;
const {
  Button,
  Icon,
  Badge,
  Card,
  Citation,
  SourceCard,
  ConfidenceMeter
} = M;
const MAX = 1120;
function Nav() {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 10,
      background: 'rgba(250,248,244,0.82)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1.5px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: MAX,
      margin: '0 auto',
      padding: '14px 28px',
      display: 'flex',
      alignItems: 'center',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo/itaily-logo.svg",
    style: {
      height: 26
    }
  }), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 22,
      marginLeft: 18
    }
  }, ['Product', 'Sources', 'Pricing', 'Hack the Law'].map(x => /*#__PURE__*/React.createElement("a", {
    key: x,
    href: "#",
    style: {
      color: 'var(--text-secondary)',
      fontSize: 'var(--text-sm)',
      fontWeight: 500,
      textDecoration: 'none'
    }
  }, x))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "../app/index.html",
    style: {
      color: 'var(--text-primary)',
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      textDecoration: 'none'
    }
  }, "Sign in"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm"
  }, "Request access"))));
}
function Hero() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: MAX,
      margin: '0 auto',
      padding: '72px 28px 40px',
      display: 'grid',
      gridTemplateColumns: '1.05fr 0.95fr',
      gap: 48,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "itaily-eyebrow",
    style: {
      marginBottom: 18
    }
  }, "AI legal copilot \xB7 Italian law"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-4xl)',
      lineHeight: 1.02,
      letterSpacing: '-0.03em',
      marginBottom: 20
    }
  }, "Italian law,", /*#__PURE__*/React.createElement("br", null), "decoded."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-lg)',
      color: 'var(--text-secondary)',
      lineHeight: 'var(--leading-normal)',
      maxWidth: 460,
      marginBottom: 28
    }
  }, "Ask anything about Italian law in plain language. Itaily answers from the codes, decrees and case law \u2014 and shows every source."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    iconRight: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      size: 20
    })
  }, "Request access"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "play",
      size: 18
    })
  }, "Watch demo")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26,
      display: 'flex',
      gap: 20,
      fontSize: 'var(--text-sm)',
      color: 'var(--text-tertiary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 16,
    color: "var(--green-500)"
  }), " Source-grounded"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "book-open",
    size: 16,
    color: "var(--color-accent)"
  }), " 7 corpora"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "refresh-cw",
    size: 16,
    color: "var(--blue-500)"
  }), " Always current"))), /*#__PURE__*/React.createElement(HeroDemo, null));
}
function HeroDemo() {
  const [active, setActive] = React.useState(1);
  return /*#__PURE__*/React.createElement(Card, {
    elevation: "lg",
    padding: "none",
    style: {
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '12px 16px',
      borderBottom: '1.5px solid var(--border-subtle)',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: 6,
      background: 'var(--neutral-800)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo/itaily-mark.svg",
    style: {
      width: 14
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-sm)'
    }
  }, "Itaily"), /*#__PURE__*/React.createElement(Badge, {
    tone: "accent",
    variant: "outline",
    style: {
      marginLeft: 'auto'
    }
  }, "Live")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--text-secondary)',
      marginBottom: 12
    }
  }, "Is a verbal lease of a flat valid in Italy?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-base)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--text-primary)'
    }
  }, "A residential lease must be in writing to be valid", ' ', /*#__PURE__*/React.createElement(Citation, {
    index: 1,
    active: active === 1,
    onClick: () => setActive(1)
  }, "Art. 1, L. 431/1998"), ' ', "; a purely verbal lease is generally null, though a tenant in possession may seek judicial determination of its terms", ' ', /*#__PURE__*/React.createElement(Citation, {
    index: 2,
    active: active === 2,
    onClick: () => setActive(2)
  }, "Art. 13, L. 431/1998"), "."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(ConfidenceMeter, {
    level: "high"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(SourceCard, {
    index: 1,
    source: "L. 431/1998 \u2014 Locazioni abitative",
    article: "Art. 1, L. 431/1998",
    excerpt: "I contratti di locazione di immobili adibiti ad uso abitativo sono stipulati o rinnovati\u2026 a pena di nullit\xE0, in forma scritta.",
    relevance: 90,
    date: "Vigente"
  }))));
}
function Steps() {
  const steps = [{
    icon: 'message-square-text',
    t: 'Ask in plain language',
    d: 'No boolean queries, no legalese required. Describe the situation the way your client did.'
  }, {
    icon: 'search-check',
    t: 'Itaily finds the law',
    d: 'It retrieves the governing articles and case law across seven Italian legal corpora.'
  }, {
    icon: 'quote',
    t: 'Answer, with sources',
    d: 'A clear answer, an explicit confidence level, and every citation one click from its text.'
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--surface-card)',
      borderTop: '1.5px solid var(--border-subtle)',
      borderBottom: '1.5px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: MAX,
      margin: '0 auto',
      padding: '64px 28px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "itaily-eyebrow",
    style: {
      marginBottom: 12
    }
  }, "How it works"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'var(--text-2xl)',
      marginBottom: 36,
      maxWidth: 520
    }
  }, "From a question to cited law in seconds."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 24
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 'var(--radius-md)',
      background: 'var(--terracotta-50)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s.icon,
    size: 22,
    color: "var(--color-accent)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-tertiary)',
      marginBottom: 6
    }
  }, "0", i + 1), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-md)',
      marginBottom: 8
    }
  }, s.t), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-secondary)',
      fontSize: 'var(--text-base)',
      lineHeight: 'var(--leading-normal)'
    }
  }, s.d))))));
}
function Corpora() {
  const items = [['Codice Civile', '2,969 articles'], ['Codice Penale', '734 articles'], ['Codice di Procedura', '1,400+ articles'], ['Decreti Legislativi', 'GDPR, privacy, labour'], ['Cassazione', 'Case law & massime'], ['Gazzetta Ufficiale', 'Daily updates']];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: MAX,
      margin: '0 auto',
      padding: '64px 28px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '0.8fr 1.2fr',
      gap: 48,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "itaily-eyebrow",
    style: {
      marginBottom: 12
    }
  }, "The corpus"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'var(--text-2xl)',
      marginBottom: 14
    }
  }, "Grounded in primary law \u2014 never guesswork."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: 'var(--text-md)',
      lineHeight: 'var(--leading-normal)',
      marginBottom: 20
    }
  }, "Itaily reads the same sources a lawyer would, kept current with the Gazzetta Ufficiale. Answers cite the provision \u2014 so you can verify, not just trust."), /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    variant: "soft"
  }, "Updated daily")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 12
    }
  }, items.map(([name, meta], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 16px',
      background: 'var(--surface-card)',
      border: '1.5px solid var(--border-default)',
      borderRadius: 'var(--radius-md)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "book-marked",
    size: 18,
    color: "var(--color-accent)"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-sm)'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-tertiary)'
    }
  }, meta)))))));
}
function CTA() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--surface-inverse)',
      color: 'var(--text-on-inverse)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: MAX,
      margin: '0 auto',
      padding: '72px 28px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo/itaily-logo-light.svg",
    style: {
      height: 38,
      marginBottom: 20
    }
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      color: 'var(--paper)',
      fontSize: 'var(--text-3xl)',
      marginBottom: 14,
      letterSpacing: '-0.03em'
    }
  }, "Ask. Cite. Comply."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--neutral-300)',
      fontSize: 'var(--text-lg)',
      maxWidth: 520,
      margin: '0 auto 28px'
    }
  }, "Built for Hack the Law @ Cambridge. Be among the first studios to try Itaily."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "inverse",
    size: "lg",
    iconRight: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      size: 20
    })
  }, "Request access"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "lg",
    style: {
      color: 'var(--paper)'
    }
  }, "Read the pitch"))));
}
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      maxWidth: MAX,
      margin: '0 auto',
      padding: '28px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo/itaily-logo.svg",
    style: {
      height: 20
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-tertiary)'
    }
  }, "\xA9 2025 Itaily \xB7 A Hack the Law project"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 18
    }
  }, ['Privacy', 'Terms', 'Contact'].map(x => /*#__PURE__*/React.createElement("a", {
    key: x,
    href: "#",
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)'
    }
  }, x))));
}
function Landing() {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Nav, null), /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement(Steps, null), /*#__PURE__*/React.createElement(Corpora, null), /*#__PURE__*/React.createElement(CTA, null), /*#__PURE__*/React.createElement(Footer, null));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(Landing, null));
setTimeout(() => window.lucide && window.lucide.createIcons(), 400);
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web/Landing.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Citation = __ds_scope.Citation;

__ds_ns.ConfidenceMeter = __ds_scope.ConfidenceMeter;

__ds_ns.SourceCard = __ds_scope.SourceCard;

})();
