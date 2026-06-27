Primary-source panel for the sources rail beside an answer.

```jsx
<SourceCard
  index={1}
  source="Codice Civile — Fatti illeciti"
  article="Art. 2043 c.c."
  excerpt="Qualunque fatto doloso o colposo che cagiona ad altri un danno ingiusto…"
  relevance={92}
  date="Vigente · agg. 14 Mar 2025"
/>
```

`relevance` colors the match badge (≥80 success, ≥50 warning). `index` ties it to the inline `<Citation index={1}>`.
