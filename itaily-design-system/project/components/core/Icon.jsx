import React from 'react';

/**
 * Itaily Icon — thin wrapper over Lucide (loaded as the global `lucide`).
 * Lucide is Itaily's chosen icon set: 2px stroke, rounded caps/joins — it
 * harmonises with the chunky, friendly wordmark. Pass a kebab-case Lucide name.
 *
 * In HTML cards / UI kits, include:
 *   <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
 */
export function Icon({ name, size = 20, strokeWidth = 2, color = 'currentColor', style = {}, ...rest }) {
  const [, force] = React.useState(0);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && !window.lucide) {
      let tries = 0;
      const t = setInterval(() => {
        tries += 1;
        if (window.lucide || tries > 40) { clearInterval(t); force((n) => n + 1); }
      }, 50);
      return () => clearInterval(t);
    }
  }, []);

  const reg = (typeof window !== 'undefined' && window.lucide && window.lucide.icons) || null;
  const pascal = String(name || '')
    .split(/[-_]/)
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : ''))
    .join('');
  const node = reg && (reg[pascal] || reg[name]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', flex: 'none', verticalAlign: 'middle', ...style }}
      {...rest}
    >
      {Array.isArray(node)
        ? node.map((child, i) => {
            // Lucide IconNode entries are [tag, attrs] or {tag, attrs}
            const tag = Array.isArray(child) ? child[0] : child.tag;
            const attrs = Array.isArray(child) ? child[1] : child.attrs;
            return React.createElement(tag, { key: i, ...attrs });
          })
        : null}
    </svg>
  );
}
