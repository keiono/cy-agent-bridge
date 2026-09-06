# Agent Workflow — document guide

> Four documents plan one change: the bridge becomes a tool an analyst can
> rely on, driven from a CLI agent, with the browser as the place a human
> looks and points. **Nothing here is implemented yet.**
>
> This file is a guide to the other four. It carries no decisions of its own.

## The four documents

| Document | Role | What belongs in it |
| --- | --- | --- |
| [agent-workflow.md](agent-workflow.md) | **Unit contracts.** What each piece must do, and the audit that showed why | Data and identity contracts, connection and readiness rules, the apply operation, run artifacts, host dependencies |
| [webmcp-roadmap.md](webmcp-roadmap.md) | **Order, dependencies, release conditions.** What is built when, and what has to be true first | Phases P0–P4, the architecture that spans transports, browser support, WebMCP, CI structure, verification scenarios |
| [agent-workflow-checklist.md](agent-workflow-checklist.md) | **Verifiable work.** Task-level tracking | Checkable items with tests and per-phase verification |
| [agent-workflow-proposals.md](agent-workflow-proposals.md) | **Not accepted.** Ideas with their evidence, kept apart from the plan | Findings separated from proposals, each with a status and where it would land |

The rule that keeps them apart: **a contract an implementer needs is written
in the plan, never only referenced.** Earlier revisions cited an "external
plan" from another session; that is history now, and everything needed to
build sits in these four.

## Where to start

**Implementing.** Read the checklist's Phase 1, then the plan sections it
references (§1.2, §3). The plan's §1 is the audit — seven tools that cannot
work against the current host API — and it is the reason Phase 1 exists.

**Deciding something.** The roadmap is where phase order, browser support and
release conditions live. Its revision list explains why each decision was
made, including the ones that were reversed.

**Wondering why something is not being built.** The proposals file, and the
"Considered, not doing now" sections (plan §13, roadmap §7).

**Reviewing.** Every document has a dated revision list at the top. Reviews
that found real defects are recorded there rather than silently folded in —
the mistakes are part of the record.

## Two numbering systems, and the gap between them

The roadmap numbers phases **P0–P4**; the plan (§12) and the checklist still
use **1–4**. The renumbering is scheduled for when P0 starts, not before —
see roadmap §7 and §8. Until then:

| Roadmap | Plan / checklist | Note |
| --- | --- | --- |
| P0 — the existing path is trustworthy | Phase 1 | P0 excludes the rendering and persistence guarantees, which P2 owns |
| P1a — shared foundation | **not yet in the checklist** | The operations layer and the in-page mutation queue |
| P1b — WebMCP experiment | **not yet in the checklist** | Runs in parallel with P1a; Chrome only |
| P2 — the round trip, releasable | Phases 2–3 | The first releasable result |
| P3 — the host owns the operations | Phase 4 | Distribution moves here |
| P4 — WebMCP-first | — | Conditional and unscheduled |

**P1a and P1b have no checklist sections yet.** That is the one known gap;
they get written when the roadmap is accepted.

## How this relates to the rest of `design/`

[`../README.md`](../README.md) and the documents beside it describe the bridge
**as built**. This directory describes what it is becoming. The
[ADRs](../adr/) record decisions already made (0001–0007); the plan and
roadmap reserve **0008–0011** for decisions taken here, and anything accepted
out of the proposals takes 0012 onwards.

## Keeping them consistent

When something is decided:

1. the contract goes in the **plan**, with a revision entry saying what
   changed and why;
2. its order and its dependencies go in the **roadmap**;
3. the work to do it goes in the **checklist**;
4. if it came from the **proposals**, its status there changes and says where
   it landed.

A decision that appears in only one of the four is the failure mode these
documents have already hit twice.
