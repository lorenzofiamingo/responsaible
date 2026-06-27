// Itaily app — sample (faked) content for the UI kit.
window.ItailyData = {
  user: { name: 'Giulia Romano', plan: 'Studio · Pro', firm: 'Romano & Partners' },
  threads: [
    { id: 't1', title: 'Liability for defective products', when: 'Oggi', group: 'Today' },
    { id: 't2', title: 'GDPR data-processing basis', when: 'Oggi', group: 'Today' },
    { id: 't3', title: 'Tenant eviction — late rent', when: 'Ieri', group: 'Yesterday' },
    { id: 't4', title: 'Non-compete enforceability', when: '12 Mar', group: 'Earlier' },
    { id: 't5', title: 'Inheritance — forced heirship', when: '9 Mar', group: 'Earlier' },
  ],
  // The opening exchange shown when the workspace loads.
  opener: {
    question: 'A contractor caused damage to my client through negligence. What is the basis for a compensation claim under Italian law?',
    answer: [
      { t: 'Under Italian law the claim rests on the general rule of tort liability: anyone who, through ' },
      { t: 'fault or wilful conduct', em: true },
      { t: ', causes another unjust harm is bound to compensate it ' },
      { cite: 1, ref: 'Art. 2043 c.c.' },
      { t: '. Your client must establish four elements — the conduct, fault, the unjust harm, and a causal link between them ' },
      { cite: 2, ref: 'Art. 2697 c.c.' },
      { t: '. Where the contractor was performing under a contract, liability may also be framed as contractual non-performance ' },
      { cite: 3, ref: 'Art. 1218 c.c.' },
      { t: ', which shifts the burden of proof and extends the limitation period to ten years.' },
    ],
    confidence: 'high',
    sources: [
      { index: 1, source: 'Codice Civile — Dei fatti illeciti', article: 'Art. 2043 c.c.', excerpt: 'Qualunque fatto doloso o colposo che cagiona ad altri un danno ingiusto obbliga colui che ha commesso il fatto a risarcire il danno.', relevance: 94, date: 'Vigente · agg. 14 Mar 2025' },
      { index: 2, source: 'Codice Civile — Onere della prova', article: 'Art. 2697 c.c.', excerpt: 'Chi vuol far valere un diritto in giudizio deve provare i fatti che ne costituiscono il fondamento.', relevance: 81, date: 'Vigente' },
      { index: 3, source: 'Codice Civile — Responsabilità del debitore', article: 'Art. 1218 c.c.', excerpt: 'Il debitore che non esegue esattamente la prestazione dovuta è tenuto al risarcimento del danno…', relevance: 76, date: 'Vigente' },
    ],
  },
  // Canned response used when the user sends any new message.
  reply: {
    answer: [
      { t: 'Good question. For a non-compete clause between employer and employee to be enforceable it must satisfy four cumulative conditions: it must be ' },
      { t: 'in writing', em: true },
      { t: ', provide specific consideration to the employee, and be bounded in ' },
      { cite: 1, ref: 'Art. 2125 c.c.' },
      { t: ' as to subject-matter, territory and time — failing any of which the clause is null. The Cassazione has held the consideration must be non-symbolic and determinable ' },
      { cite: 2, ref: 'Cass. civ. 5540/2021' },
      { t: '.' },
    ],
    confidence: 'medium',
    sources: [
      { index: 1, source: 'Codice Civile — Patto di non concorrenza', article: 'Art. 2125 c.c.', excerpt: 'Il patto con il quale si limita lo svolgimento dell\u2019attività del prestatore di lavoro per il tempo successivo alla cessazione del contratto è nullo se non risulta da atto scritto…', relevance: 89, date: 'Vigente' },
      { index: 2, source: 'Corte di Cassazione, Sez. Lavoro', article: 'Cass. civ. 5540/2021', excerpt: 'Il corrispettivo del patto di non concorrenza deve essere congruo e non meramente simbolico…', relevance: 72, date: 'Massima' },
    ],
  },
};
