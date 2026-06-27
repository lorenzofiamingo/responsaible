// Itaily app — screen pieces. Composes DS primitives from the bundle.
const DS = window.ItailyDesignSystem_88d7b8;
const { Button, IconButton, Icon, Badge, Avatar, Citation, SourceCard, ConfidenceMeter, Switch } = DS;

/* ---------------- Brand lockup ---------------- */
function BrandMark({ size = 28 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: size, height: size, borderRadius: 7, background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <img src="../../assets/logo/itaily-logo-light.svg" style={{ height: size * 0.42 }} />
      </div>
      <img src="../../assets/logo/itaily-logo.svg" style={{ height: size * 0.62 }} />
    </div>
  );
}

/* ---------------- Login ---------------- */
function LoginScreen({ onEnter }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-page)', padding: 24 }}>
      <div style={{ width: 400, background: 'var(--surface-card)', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 36 }}>
        <img src="../../assets/logo/itaily-logo.svg" style={{ height: 34, marginBottom: 22 }} />
        <h1 style={{ fontSize: 'var(--text-xl)', marginBottom: 6 }}>Italian law, decoded.</h1>
        <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: 'var(--text-base)' }}>Sign in to your studio workspace.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <DS.Input label="Work email" icon="mail" defaultValue="g.romano@romanopartners.it" />
          <DS.Input label="Password" icon="lock" type="password" defaultValue="demo1234" />
          <Button variant="primary" full iconRight={<Icon name="arrow-right" size={18} />} onClick={onEnter} style={{ marginTop: 4 }}>Enter Itaily</Button>
        </div>
        <div style={{ marginTop: 18, textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
          Demo workspace · no real credentials needed
        </div>
      </div>
    </div>
  );
}

/* ---------------- Sidebar ---------------- */
function Sidebar({ threads, activeId, onSelect, onNew, user }) {
  const groups = ['Today', 'Yesterday', 'Earlier'];
  return (
    <aside style={{ width: 264, flex: 'none', background: 'var(--surface-card)', borderRight: '1.5px solid var(--border-default)', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '18px 18px 14px' }}>
        <BrandMark />
      </div>
      <div style={{ padding: '0 14px 12px' }}>
        <Button variant="primary" full size="sm" iconLeft={<Icon name="plus" size={18} />} onClick={onNew}>New question</Button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
        {groups.map((g) => {
          const items = threads.filter((t) => t.group === g);
          if (!items.length) return null;
          return (
            <div key={g} style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '6px 8px' }}>{g}</div>
              {items.map((t) => (
                <button key={t.id} onClick={() => onSelect(t.id)} style={{
                  display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                  padding: '9px 10px', borderRadius: 'var(--radius-sm)', marginBottom: 2,
                  background: t.id === activeId ? 'var(--terracotta-50)' : 'transparent',
                  color: t.id === activeId ? 'var(--terracotta-800)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: t.id === activeId ? 600 : 400,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
                  onMouseEnter={(e) => { if (t.id !== activeId) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={(e) => { if (t.id !== activeId) e.currentTarget.style.background = 'transparent'; }}
                >{t.title}</button>
              ))}
            </div>
          );
        })}
      </div>
      <div style={{ borderTop: '1.5px solid var(--border-subtle)', padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={user.name} size={36} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{user.plan}</div>
        </div>
        <IconButton icon="settings" label="Settings" size="sm" />
      </div>
    </aside>
  );
}

/* ---------------- Answer rendering ---------------- */
function AnswerBody({ parts, activeCite, onCite }) {
  return (
    <span>
      {parts.map((p, i) => {
        if (p.cite != null) return <Citation key={i} index={p.cite} active={activeCite === p.cite} onClick={() => onCite(p.cite)}>{p.ref}</Citation>;
        if (p.em) return <em key={i} style={{ fontStyle: 'normal', fontWeight: 600 }}>{p.t}</em>;
        return <React.Fragment key={i}>{p.t}</React.Fragment>;
      })}
    </span>
  );
}

function Exchange({ q, a, activeCite, onCite }) {
  return (
    <div style={{ marginBottom: 36 }}>
      {/* user question */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 22 }}>
        <Avatar name="Giulia Romano" size={32} tone="neutral" />
        <div style={{ fontSize: 'var(--text-md)', lineHeight: 'var(--leading-snug)', color: 'var(--text-primary)', paddingTop: 4, fontWeight: 500 }}>{q}</div>
      </div>
      {/* itaily answer */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 32, height: 32, flex: 'none', borderRadius: 8, background: 'var(--neutral-800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="../../assets/logo/itaily-mark.svg" style={{ width: 18 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-base)', lineHeight: 'var(--leading-relaxed)', color: 'var(--text-primary)' }}>
            <AnswerBody parts={a.answer} activeCite={activeCite} onCite={onCite} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            <ConfidenceMeter level={a.confidence} />
            <div style={{ width: 1, height: 18, background: 'var(--border-default)' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              <IconButton icon="copy" label="Copy" size="sm" />
              <IconButton icon="thumbs-up" label="Helpful" size="sm" />
              <IconButton icon="thumbs-down" label="Not helpful" size="sm" />
              <IconButton icon="share-2" label="Share" size="sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Composer ---------------- */
function Composer({ value, onChange, onSend, primaryOnly, onTogglePrimary }) {
  return (
    <div style={{ borderTop: '1.5px solid var(--border-default)', background: 'var(--surface-card)', padding: '14px 28px 18px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', padding: 12, boxShadow: 'var(--shadow-sm)' }}>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="Ask anything about Italian law…"
            rows={2}
            style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', color: 'var(--text-primary)', lineHeight: 1.4 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={onTogglePrimary} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: primaryOnly ? 'var(--terracotta-700)' : 'var(--text-tertiary)' }}>
                <Icon name={primaryOnly ? 'check-circle-2' : 'circle'} size={16} />
                Primary sources only
              </button>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                <Icon name="book-open" size={16} /> Codice Civile + 6 corpora
              </span>
            </div>
            <IconButton icon="arrow-up" label="Send" variant="solid" onClick={onSend} />
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          Informational, not legal advice. Verify against the official Gazzetta Ufficiale.
        </div>
      </div>
    </div>
  );
}

/* ---------------- Sources rail ---------------- */
function SourcesRail({ sources, activeCite, onCite }) {
  return (
    <aside style={{ width: 340, flex: 'none', borderLeft: '1.5px solid var(--border-default)', background: 'var(--surface-page)', height: '100vh', overflowY: 'auto', padding: '20px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Icon name="library" size={18} color="var(--color-accent)" />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-md)' }}>Sources</span>
        <Badge tone="neutral" style={{ marginLeft: 'auto' }}>{sources.length}</Badge>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sources.map((s) => (
          <div key={s.index} onClick={() => onCite(s.index)} style={{ cursor: 'pointer', outline: activeCite === s.index ? '2px solid var(--color-accent)' : 'none', outlineOffset: 2, borderRadius: 'var(--radius-md)', transition: 'outline-color 120ms' }}>
            <SourceCard {...s} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18, padding: 14, background: 'var(--terracotta-50)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--terracotta-800)', lineHeight: 'var(--leading-normal)' }}>
        <strong style={{ display: 'block', marginBottom: 4 }}>Why sources?</strong>
        Every Itaily answer is grounded in primary law. Click a citation to verify it here.
      </div>
    </aside>
  );
}

Object.assign(window, { BrandMark, LoginScreen, Sidebar, Exchange, Composer, SourcesRail });
