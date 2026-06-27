// Itaily — marketing landing. Composes DS primitives.
const M = window.ItailyDesignSystem_88d7b8;
const { Button, Icon, Badge, Card, Citation, SourceCard, ConfidenceMeter } = M;

const MAX = 1120;

function Nav() {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(250,248,244,0.82)', backdropFilter: 'blur(10px)', borderBottom: '1.5px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: MAX, margin: '0 auto', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 24 }}>
        <img src="../../assets/logo/itaily-logo.svg" style={{ height: 26 }} />
        <nav style={{ display: 'flex', gap: 22, marginLeft: 18 }}>
          {['Product', 'Sources', 'Pricing', 'Hack the Law'].map((x) => (
            <a key={x} href="#" style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 500, textDecoration: 'none' }}>{x}</a>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href="../app/index.html" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)', fontWeight: 600, textDecoration: 'none' }}>Sign in</a>
          <Button variant="primary" size="sm">Request access</Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section style={{ maxWidth: MAX, margin: '0 auto', padding: '72px 28px 40px', display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 48, alignItems: 'center' }}>
      <div>
        <div className="itaily-eyebrow" style={{ marginBottom: 18 }}>AI legal copilot · Italian law</div>
        <h1 style={{ fontSize: 'var(--text-4xl)', lineHeight: 1.02, letterSpacing: '-0.03em', marginBottom: 20 }}>
          Italian law,<br />decoded.
        </h1>
        <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-normal)', maxWidth: 460, marginBottom: 28 }}>
          Ask anything about Italian law in plain language. Itaily answers from the codes, decrees and case law — and shows every source.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Button variant="primary" size="lg" iconRight={<Icon name="arrow-right" size={20} />}>Request access</Button>
          <Button variant="secondary" size="lg" iconLeft={<Icon name="play" size={18} />}>Watch demo</Button>
        </div>
        <div style={{ marginTop: 26, display: 'flex', gap: 20, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="shield-check" size={16} color="var(--green-500)" /> Source-grounded</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="book-open" size={16} color="var(--color-accent)" /> 7 corpora</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="refresh-cw" size={16} color="var(--blue-500)" /> Always current</span>
        </div>
      </div>
      <HeroDemo />
    </section>
  );
}

function HeroDemo() {
  const [active, setActive] = React.useState(1);
  return (
    <Card elevation="lg" padding="none" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1.5px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--neutral-800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="../../assets/logo/itaily-mark.svg" style={{ width: 14 }} />
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>Itaily</span>
        <Badge tone="accent" variant="outline" style={{ marginLeft: 'auto' }}>Live</Badge>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Is a verbal lease of a flat valid in Italy?</div>
        <div style={{ fontSize: 'var(--text-base)', lineHeight: 'var(--leading-relaxed)', color: 'var(--text-primary)' }}>
          A residential lease must be in writing to be valid{' '}
          <Citation index={1} active={active === 1} onClick={() => setActive(1)}>Art. 1, L. 431/1998</Citation>{' '}
          ; a purely verbal lease is generally null, though a tenant in possession may seek judicial determination of its terms{' '}
          <Citation index={2} active={active === 2} onClick={() => setActive(2)}>Art. 13, L. 431/1998</Citation>.
        </div>
        <div style={{ marginTop: 14 }}><ConfidenceMeter level="high" /></div>
        <div style={{ marginTop: 14 }}>
          <SourceCard index={1} source="L. 431/1998 — Locazioni abitative" article="Art. 1, L. 431/1998" excerpt="I contratti di locazione di immobili adibiti ad uso abitativo sono stipulati o rinnovati… a pena di nullità, in forma scritta." relevance={90} date="Vigente" />
        </div>
      </div>
    </Card>
  );
}

function Steps() {
  const steps = [
    { icon: 'message-square-text', t: 'Ask in plain language', d: 'No boolean queries, no legalese required. Describe the situation the way your client did.' },
    { icon: 'search-check', t: 'Itaily finds the law', d: 'It retrieves the governing articles and case law across seven Italian legal corpora.' },
    { icon: 'quote', t: 'Answer, with sources', d: 'A clear answer, an explicit confidence level, and every citation one click from its text.' },
  ];
  return (
    <section style={{ background: 'var(--surface-card)', borderTop: '1.5px solid var(--border-subtle)', borderBottom: '1.5px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: MAX, margin: '0 auto', padding: '64px 28px' }}>
        <div className="itaily-eyebrow" style={{ marginBottom: 12 }}>How it works</div>
        <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 36, maxWidth: 520 }}>From a question to cited law in seconds.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {steps.map((s, i) => (
            <div key={i}>
              <div style={{ width: 46, height: 46, borderRadius: 'var(--radius-md)', background: 'var(--terracotta-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon name={s.icon} size={22} color="var(--color-accent)" />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 6 }}>0{i + 1}</div>
              <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 8 }}>{s.t}</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-base)', lineHeight: 'var(--leading-normal)' }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Corpora() {
  const items = [
    ['Codice Civile', '2,969 articles'], ['Codice Penale', '734 articles'],
    ['Codice di Procedura', '1,400+ articles'], ['Decreti Legislativi', 'GDPR, privacy, labour'],
    ['Cassazione', 'Case law & massime'], ['Gazzetta Ufficiale', 'Daily updates'],
  ];
  return (
    <section style={{ maxWidth: MAX, margin: '0 auto', padding: '64px 28px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 48, alignItems: 'center' }}>
        <div>
          <div className="itaily-eyebrow" style={{ marginBottom: 12 }}>The corpus</div>
          <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 14 }}>Grounded in primary law — never guesswork.</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-md)', lineHeight: 'var(--leading-normal)', marginBottom: 20 }}>
            Itaily reads the same sources a lawyer would, kept current with the Gazzetta Ufficiale. Answers cite the provision — so you can verify, not just trust.
          </p>
          <Badge tone="success" variant="soft">Updated daily</Badge>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {items.map(([name, meta], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface-card)', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
              <Icon name="book-marked" size={18} color="var(--color-accent)" />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>{name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{meta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section style={{ background: 'var(--surface-inverse)', color: 'var(--text-on-inverse)' }}>
      <div style={{ maxWidth: MAX, margin: '0 auto', padding: '72px 28px', textAlign: 'center' }}>
        <img src="../../assets/logo/itaily-logo-light.svg" style={{ height: 38, marginBottom: 20 }} />
        <h2 style={{ color: 'var(--paper)', fontSize: 'var(--text-3xl)', marginBottom: 14, letterSpacing: '-0.03em' }}>Ask. Cite. Comply.</h2>
        <p style={{ color: 'var(--neutral-300)', fontSize: 'var(--text-lg)', maxWidth: 520, margin: '0 auto 28px' }}>
          Built for Hack the Law @ Cambridge. Be among the first studios to try Itaily.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button variant="inverse" size="lg" iconRight={<Icon name="arrow-right" size={20} />}>Request access</Button>
          <Button variant="ghost" size="lg" style={{ color: 'var(--paper)' }}>Read the pitch</Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ maxWidth: MAX, margin: '0 auto', padding: '28px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <img src="../../assets/logo/itaily-logo.svg" style={{ height: 20 }} />
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>© 2025 Itaily · A Hack the Law project</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 18 }}>
        {['Privacy', 'Terms', 'Contact'].map((x) => <a key={x} href="#" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{x}</a>)}
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <div>
      <Nav /><Hero /><Steps /><Corpora /><CTA /><Footer />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Landing />);
setTimeout(() => window.lucide && window.lucide.createIcons(), 400);
