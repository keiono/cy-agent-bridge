# Open Proposals — Agent Workflow

> Proposals that are **not yet part of the plan**. §1–§9 come from the third
> review (9/5/2026); §10 from the browser-support decision the same day. Each
> was checked against the code; the finding is separated from the proposal so
> the two can be judged apart.
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

**Status of each proposal** (9/5/2026). "Assumed" means
[webmcp-roadmap.md](webmcp-roadmap.md) builds on it and it is accepted the
moment the roadmap is; nothing here is scheduled on its own.

| § | Proposal | Status | Lands in |
| --- | --- | --- | --- |
| 1 | Tool annotations | **assumed** — roadmap §4.3 | P1a |
| 2 | Version identifier on `CyWebApi` | open — host | roadmap §5 host list if accepted |
| 3 | Which API tier a global consumer gets (undo) | **deferred** — to whichever phase introduces in-place apply (§11) | — |
| 4 | Mutation call journal | **assumed** — roadmap §4.5, plan §8.3 | P2 |
| 5 | Run directory conventions, MCP resources | location and retention **decided** (plan §9); `run_list` and resources open | P2 |
| 6 | A defined "rendered" | **superseded** by `viewport.whenRendered` (host, P2); canvas sampling experiment-only | — |
| 7 | Error taxonomy | **assumed** — roadmap §4.5 | P0 |
| 8 | `doctor` command | open | P0 if accepted |
| 9 | Serialising mutations | **assumed** — roadmap §4.5, in the operations layer | P1a |
| 10 | Local connector for WSL2 | open, unscheduled | — |
| 11 | In-place apply | **deferred** out of the initial release | — |

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

**Finding.** §9 introduces a run directory but originally said nothing about
where it lives, how long it is kept, or how the agent finds an earlier one.

**Partly decided since** (9/5/2026, plan §9): the location is
`<project>/cyweb-runs/<runId>/` with the project set explicitly at startup —
runs follow the project, not the user — and there is **no automatic
deletion**. What remains open here:

**Proposal.** `cytoscape_run_list`, and a manual cleanup command that never
runs on its own. Then expose manifests and outputs through MCP **resources**,
which the SDK supports: an agent can read a past run without a tool call, and
the client can show them.

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

## 10. A page-initiated local connector, for the WSL2 setup 【bridge, later host】

> Recorded when browser support was decided as Chromium-based
> ([webmcp-roadmap.md §3.4](webmcp-roadmap.md)). This is **not** a
> multi-browser proposal: the same mechanism would serve Firefox and Safari,
> and that use is declined. Its motivation here is the setup cost for Chromium
> users on WSL2.

**Finding.** The README's WSL2 section is five manual steps — launch Chrome
with `--remote-debugging-address=0.0.0.0`, add a `netsh` portproxy, open a
firewall rule, find the gateway IP, verify with `curl` — because CDP attach
runs **from WSL2 to the Windows host**, and that direction is not forwarded.
The opposite direction is: WSL2 forwards ports it listens on to Windows
`localhost` by default. A connection that the *page* initiates towards a
server in WSL2 needs none of the five steps.

**Proposal.** The MCP server listens on a local WebSocket; the App (the host
itself, after P3) connects to `ws://localhost:<port>`; the in-page operations
layer executes requests and pushes results and events back. Concretely:

- a WebSocket server in the MCP process, bound to loopback only
- a pairing token shown by the server and entered once in the panel, plus an
  `Origin` allowlist on the handshake — any page on the machine can otherwise
  open the socket and receive the agent's commands
- reconnect logic in the page, not only in Node
- screenshots via the renderer's canvas (`toDataURL`), since `page.screenshot`
  is CDP

**Depends on.** P1's operations layer — the connector is an adapter over it,
and before P1 every tool takes a `Page`. And an installed App until P3, which
is the connector's largest constraint compared with CDP's ability to inject
into a bare host.

**Scope.** Chromium only, `ws://` only. Safari's `wss://` certificate
requirement is exactly the cost the browser decision declined to carry.

**Conditions the five-step removal does not remove.** From Chrome 147, a
WebSocket connection from a page to a local address — loopback included —
triggers a **Local Network Access permission prompt**, and the LNA enterprise
policies (`LocalNetworkAccessAllowedForUrls`, `…BlockedForUrls`,
`…RestrictionsTemporaryOptOut`) apply. So the connector needs: the user to
grant that permission once per origin; a stated behaviour when it is denied;
WSL's own networking configuration (localhost forwarding can be disabled);
and a note that an enterprise policy can block it outright. Fewer steps than
today, not zero.

**Screenshots.** A single canvas's `toDataURL()` is not the displayed view —
annotations and overlays live outside it. The connector should call the
host's image-export contract (plan §11.2, proposal 1) rather than read a
canvas.

**Not decided by this.** Whether the connector *replaces* CDP for interactive
use on Chromium or sits beside it. CDP keeps two things the connector lacks —
zero-install against a bare host, and full-page screenshots — so the likely
shape is both, with the connector preferred when an App is present. That is a
P2-or-later question.

---

## 11. In-place apply 【bridge, needs host】

> Moved out of plan §8 on 9/5/2026. The initial release applies analysis as a
> **new network only** (plan §8.2); this is the path that would write results
> into a network the user already has.

**Finding.** Applying into an existing network is what users will eventually
ask for — "colour *this* network by the clusters" — and it is the case where
a partial failure or a concurrent human edit does damage. Three things do not
exist: a precondition check that the network is unchanged since the analysis
started (counts, column set, content hash), a rule for what happens when it
is not, and a way back. `importTableFromTsv` records no undo entry, so
"undo" is not the way back either (§3).

**Proposal.** When scheduled: a precondition contract, explicit conflict
rejection (never silent merge), and a restore path — most likely the
projection snapshot re-imported beside the damaged network rather than a
generic undo. Depends on §3 being answered by the host, and on the four
completion states (plan §8.3) so that a partial in-place apply can say what
it left behind.

---

## Not carried forward

**Multi-browser transport.** Declined on 9/5/2026 in favour of Chromium-based
support; see [webmcp-roadmap.md §3.4](webmcp-roadmap.md). The mechanism
survives as §10 with a different motivation.

**Typing against both contracts.** Superseded: only `development` is
supported, and the declarations are vendored from a `development` build
(§3.1).
