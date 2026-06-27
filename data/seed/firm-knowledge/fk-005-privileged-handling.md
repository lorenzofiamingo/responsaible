---
title: Handling privileged client knowledge in AI workflows (firm policy)
category: guidance
tags: privacy, confidential, privilege, on-perimeter, open model, self-hosted, data residency
ref: KB/Risk/AI-Confidentiality-Policy v1
date: 2026-03-05
---

Confidential and privileged client material — internal memos, precedents, and matter
files — must never be sent to a third-party model API. Where an AI agent needs to draw
on the firm knowledge base, retrieval runs on-perimeter and the reasoning model must be
an open, self-hostable model (e.g. NVIDIA Nemotron via a private NIM endpoint) so that
no privileged text leaves the firm boundary. Public-law research against EUR-Lex or the
open web may use external services, since those inputs are not confidential.
