# Open Proposals — Agent Workflow

> Proposals from the third review (9/5/2026) that are **not yet part of the
> plan**. Each was checked against the code; the finding is separated from the
> proposal so the two can be judged apart.
>
> Three decisions from that review went straight into the plan and are not
> repeated here: `development` as the only supported host, contract tests in
> Playwright launch mode, and the panel published to GitHub Pages. See
> [agent-workflow.md](agent-workflow.md) Rev. 4.

_Plan: [agent-workflow.md](agent-workflow.md) · Checklist: [agent-workflow-checklist.md](agent-workflow-checklist.md). Section references (§) point into the plan._

**Where these would land.** Items marked **bridge** would join a phase of the
checklist; items marked **host** would join §11.2, which is the plan's list of
things to ask of `cytoscape-web`. Nothing here is scheduled until it is
accepted.

**ADR numbers.** The plan reserves 0008–0011 (§2). Any proposal accepted from
this file takes **0012 onwards**, in acceptance order — so §7's error taxonomy
is 0012 only if it is accepted first.

---

## 1. Tool annotations for destructive operations 【bridge】

**Finding.** MCP's `ToolAnnotations` are available in the SDK this repository
already depends on (1.27.1): `readOnlyHint`, `destructiveHint`,
`idempotentHint`, `openWorldHint`. No tool sets any of them, so a client cannot
distinguish `cytoscape_get_workspace` from `cytoscape_delete_network`.

**Proposal.** Annotate every tool, and write down the policy for the
destructive ones — `delete_network`, and `deleteAllNetworks` if it is ever
exposed. Annotations are hints, not enforcement, so the policy matters more
than the flag: which operations require an explicit target id, which refuse to
run against a network the bridge did not create, and which are simply not
offered.

**Note.** This interacts with §3.6: a tool that is withheld for lack of a host
method and a tool that is withheld because it is destructive should not look
the same to the agent.

---

## 2. A version identifier on `window.CyWebApi` 【host】

**Finding.** `CyWebApi` carries no `version` and no build identifier —
confirmed in `src/app-api/core/index.ts`. That is why §3.4 has to measure the
API surface rather than ask what it is talking to.

**Proposal.** Publish `CyWebApi.version` (and ideally a build or commit
identifier). Most of the probing in §3.2 becomes a lookup, and
`get_capabilities` gains an answer it currently cannot give.

**Caveat.** Probing does not go away. A version string tells the bridge what
the host claims; the surface tells it what is there. The former is cheaper and
should be preferred, with probing kept as the check that catches a wrong claim.

---

## 3. Which tier of the host API a global consumer gets 【host】

**Finding — and it is not "undo is missing".** Undo exists. `UndoStore` holds
per-network stacks, `src/app-api/core/undo.ts` records entries
framework-agnostically, and `data/hooks/useUndoStack.tsx` returns
`{ undoStack, postEdit, undoLastEdit, redoLastEdit, clearStack }`. What is
missing is a route to it from outside React.

The real finding is that the host has **two deliberate tiers**, and undo is not
alone outside the outer one. `src/app-api/core/perAppApis.ts` builds
`resource`, `appData` and `dialog` per app and hands them to `AppContext.apis`
at mount; `AppContext.ts` calls that shape "mount-safe" and `window.CyWebApi`
"window-safe". Those APIs are absent from the window object **by design**, not
by omission — a component type cannot be provided by a non-React consumer, and
a per-app identity has no meaning without one.

The bridge is a global consumer. So the question to put to the host is not
"please build undo" but **"what does a global consumer get, and how is that
decided?"**

**Proposal.** Ask the host to state the policy, then apply it to undo/redo
specifically: is an `undo`/`redo` on `window.CyWebApi` acceptable given that it
has no per-app scope, or does it need a scoping story first (undo only the
edits this consumer made)?

**Why it matters here.** §8 requires "a documented way back" for the in-place
apply path, and today the only honest answer is "restore from the snapshot in
the run directory". Note that undo would not cover the TSV import in any case:
that path records no undo entry at all, by the host's own decision.

---

## 4. A mutation call journal 【bridge】

**Finding.** §3.3 says a mutation whose outcome is unknown after a disconnect
is not retried, and §8 says a partial failure must leave a described state.
Neither is implementable without a record of what was in flight.

**Depends on §5.** The journal lives in the run directory, so where that
directory is and how long it survives has to be settled first. Accepting §4
without §5 leaves the journal in a location nobody has agreed on.

**Proposal.** Append every mutating call to a journal in the run directory,
synchronously, before it is issued, and mark its outcome when it returns.
On reconnect, the bridge reconciles: for each call with no recorded outcome,
report it and say how to check.

**Distinct from the manifest (§9).** The manifest describes an analysis so it
can be reproduced; the journal describes calls so a crash can be recovered
from. Merging them would make the manifest a log and the log unreadable.

---

## 5. Run directory conventions, and manifests as MCP resources 【bridge】

> Ordering note: this is a prerequisite for §4, despite coming after it here.
> The numbering follows review order, not implementation order.

**Finding.** §9 introduces a run directory but says nothing about where it
lives, how long it is kept, or how the agent finds an earlier one.

**Proposal.** Settle a location (an XDG-style data directory, or `./cyweb-runs`
relative to the working directory — the choice affects whether runs follow the
project or the user), a retention and cleanup policy, and
`cytoscape_run_list`. Then expose manifests and outputs through MCP
**resources**, which the SDK supports: an agent can read a past run without a
tool call, and the client can show them.

**New compatibility axis.** Resources are a capability a client may not
implement, and §4.4 currently scopes client differences to registration and
display names. So resources are **additive only**: everything readable through
a resource must also be reachable through a tool (`cytoscape_run_list` plus a
file path), and no workflow may depend on the client supporting
`resources/read`.

---

## 6. A defined mechanism for "rendered" 【bridge, possibly host】

**Finding.** §3.3 requires a rendered state — "network current, loaded, laid
out, drawn" — and does not say how to observe it. `applyLayout` resolves on
completion, but nothing reports that the renderer has painted.

**Proposal, bridge-side.** Compose what exists: the layout promise, then
`viewport.fit`, then a bounded wait for the canvas to stop changing.

The stability check must observe through a **path other than the screenshot
tool's own output** — sampling canvas pixels inside the page over successive
animation frames, say. Comparing two screenshots would make the detector
capture the thing it exists to decide when to capture. Good enough for a
screenshot tool either way, and honest about being a heuristic.

**Proposal, host-side.** A rendering-complete event would replace the
heuristic. Worth asking for once the bridge-side version shows how often the
heuristic is wrong.

---

## 7. An error taxonomy 【bridge】

**Finding.** `mcp-server/src/types.ts` defines four codes: `METHOD_NOT_FOUND`,
`API_ERROR`, `TRANSPORT_ERROR`, `SHAPING_ERROR`. The plan introduces states
none of them describe — a tool withheld for lack of a host method, a page not
ready, a network not rendered, a precondition that failed before an in-place
apply, a join below its match threshold.

One of the four is already overloaded: `METHOD_NOT_FOUND` is returned both for
an unknown **tool name** (`tools/index.ts:96`) and for a **host method missing
from `CyWebApi`** (`callApi.ts:45`). Those are different failures with
different remedies, and today an agent cannot tell them apart.

**Proposal.** An ADR fixing a stable set, with the rule that an agent may
branch on the code and must not have to parse the message. The set is part of
the tool contract, so it is versioned with the package.

**The existing four all survive**, so the ADR is additive:

| Code | Fate |
| --- | --- |
| `METHOD_NOT_FOUND` | Kept, narrowed to an unknown **tool name** (`tools/index.ts:96`). The missing-host-method sense (`callApi.ts:45`) moves to `UNSUPPORTED_ON_HOST`. "Tool name" rather than "method" on purpose: JSON-RPC's own method-not-found (`-32601`) is a different layer and the SDK owns it |
| `API_ERROR` | Kept — the host returned `success: false` |
| `TRANSPORT_ERROR` | Kept — CDP failed |
| `SHAPING_ERROR` | Kept, and used more: Phase 2 generalises shaping to every tool (§9.1), so this code stops being export-specific |

New: `CONTRACT_MISMATCH`, `UNSUPPORTED_ON_HOST`, `NOT_READY`, `NOT_RENDERED`,
`PRECONDITION_FAILED`, `VERIFICATION_FAILED`.

---

## 8. A `doctor` command 【bridge】

**Finding.** The WSL2 setup is five manual steps (a launched Chrome, a
portproxy, a firewall rule, a gateway IP, a curl check), and every failure
reaches the user as one `TRANSPORT_ERROR`.

**Proposal.** `cy-agent-bridge doctor`: is the CDP endpoint reachable, which
pages were found, which are on an allowed origin, which expose `CyWebApi`, and
which tools that host supports. It duplicates no logic — it prints what the
connection path already computes (§3.2–3.4) — and turns the most common
support question into a command.

---

## 9. Serialising mutations, and multi-client behaviour 【bridge】

**Finding.** MCP clients may issue concurrent requests, and more than one
client can attach to the same page. Every tool goes through one `page.evaluate`
per call with no ordering guarantee, so two overlapping imports interleave
their writes.

**Proposal.** A per-page mutation queue: reads stay concurrent, mutations
serialise. Then state what happens when two clients drive one page — whether
the second is refused, queued, or allowed with the log showing both, which is
also a §4.1 event-identity question (whose `sessionId` is on the panel entry).

---

## Not carried forward

**Typing against both contracts.** Superseded: only `development` is
supported, and the declarations are vendored from a `development` build
(§3.1).
