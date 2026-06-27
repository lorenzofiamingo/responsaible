// Itaily app — orchestrator. Login -> workspace; ask -> cited answer.
// LoginScreen, Sidebar, Exchange, Composer, SourcesRail are global fns from screens.jsx.

function AppShell() {
  const data = window.ItailyData;
  const [authed, setAuthed] = React.useState(false);
  const [activeId, setActiveId] = React.useState('t1');
  const [draft, setDraft] = React.useState('');
  const [primaryOnly, setPrimaryOnly] = React.useState(true);
  const [activeCite, setActiveCite] = React.useState(1);
  const [exchanges, setExchanges] = React.useState([
    { q: data.opener.question, a: data.opener.answer ? { answer: data.opener.answer, confidence: data.opener.confidence, sources: data.opener.sources } : null },
  ]);
  const scrollRef = React.useRef(null);

  const allSources = exchanges[exchanges.length - 1]?.a?.sources || [];

  const send = () => {
    const q = draft.trim();
    if (!q) return;
    const a = { answer: data.reply.answer, confidence: data.reply.confidence, sources: data.reply.sources };
    setExchanges((prev) => [...prev, { q, a }]);
    setDraft('');
    setActiveCite(1);
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 60);
  };

  const newThread = () => {
    setExchanges([]);
    setDraft('');
  };

  if (!authed) return <LoginScreen onEnter={() => setAuthed(true)} />;

  const title = data.threads.find((t) => t.id === activeId)?.title || 'New question';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--surface-page)' }}>
      <Sidebar threads={data.threads} activeId={activeId} onSelect={setActiveId} onNew={newThread} user={data.user} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: 60, flex: 'none', borderBottom: '1.5px solid var(--border-default)', background: 'rgba(250,248,244,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 12 }}>
          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exchanges.length ? title : 'New question'}</h2>
          <window.ItailyDesignSystem_88d7b8.Badge tone="accent" variant="outline" style={{ marginLeft: 4 }}>Italian law</window.ItailyDesignSystem_88d7b8.Badge>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <window.ItailyDesignSystem_88d7b8.IconButton icon="bookmark" label="Save" size="sm" />
            <window.ItailyDesignSystem_88d7b8.IconButton icon="download" label="Export" size="sm" />
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: '32px 28px 8px' }}>
              {exchanges.length === 0 ? (
                <EmptyState onPick={(q) => { setDraft(q); }} />
              ) : (
                exchanges.map((ex, i) => (
                  <Exchange key={i} q={ex.q} a={ex.a} activeCite={activeCite} onCite={setActiveCite} />
                ))
              )}
            </div>
            <Composer value={draft} onChange={setDraft} onSend={send} primaryOnly={primaryOnly} onTogglePrimary={() => setPrimaryOnly((v) => !v)} />
          </div>
          {allSources.length > 0 && <SourcesRail sources={allSources} activeCite={activeCite} onCite={setActiveCite} />}
        </div>
      </main>
    </div>
  );
}

function EmptyState({ onPick }) {
  const Icon = window.ItailyDesignSystem_88d7b8.Icon;
  const suggestions = [
    'What are the grounds for terminating an employment contract for just cause?',
    'How is forced heirship calculated for two children and a spouse?',
    'When is a non-compete clause enforceable against an employee?',
  ];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      <img src="../../assets/logo/itaily-logo.svg" style={{ height: 40, marginBottom: 18 }} />
      <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 8 }}>Ask anything about Italian law.</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-md)', maxWidth: 460, marginBottom: 26 }}>Every answer comes grounded in primary sources, with citations you can verify in one click.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 520 }}>
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => onPick(s)} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', background: 'var(--surface-card)', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '13px 16px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-xs)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--terracotta-300)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
          >
            <Icon name="corner-down-right" size={16} color="var(--color-accent)" />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppShell />);
setTimeout(() => window.lucide && window.lucide.createIcons(), 400);
