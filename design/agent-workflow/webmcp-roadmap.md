# cy-agent-bridge — Agent Platform and WebMCP Roadmap

> **Status: proposed.** An evaluation of the WebMCP roadmap drafted on
> 9/5/2026 in a separate session (the *external plan*), checked against the
> code and against the WebMCP specification, Chrome's documentation and the
> Chrome DevTools MCP tool reference as they stood on 9/5/2026 — and the
> revised roadmap that results.
>
> It does **not** replace [agent-workflow.md](agent-workflow.md). It sits
> above it: the workflow plan stays the source for the data contract, the
> connection rules and Phase 1; this document decides what the bridge is
> *becoming* and in what order. §8 lists what it would change in the three
> existing documents once accepted.

- Rev. 4 (9/5/2026): Keiichiro ONO and Claude (Fable 5.1) — Seventh review.
  Tiers and side-effect classes corrected: `present_projection` split into a
  view switch (Tier A) and an import (Tier B); `view-mutation` now says what
  it is — persisted view state changes, undo entries included — and
  `untrusted-output` becomes an output attribute rather than a class; Tier B's
  condition is a host-enforced contract, not Theme G. P1 now requires every
  mutating entry point, ported or not, to pass through the in-page queue. The
  runtime lifetime rule replaces the version-precedence rule (§4.1), the
  event cursor is `(Document UUID, sequence)`, P1 is split into a shared
  foundation and a WebMCP experiment, P0 no longer claims all of plan Phase 1
  while handing `whenRendered` to P2, CI is three kinds rather than
  "WebMCP never blocks", and the pins now include Playwright, Chrome DevTools
  MCP, launch arguments and the API shape used. External facts corrected:
  Chrome DevTools MCP does document launch flags (`--chromeArg`, `--channel`,
  `--headless`); the Inspector extension's agent is separate from Gemini in
  Chrome; a schema-derived MCP façade is a third path for CLI agents;
  GraphML's `edgedefault` admits no "unknown".
- Rev. 3 (9/5/2026): Keiichiro ONO and Claude (Fable 5.1) — The external
  plan's content that Rev. 1 "adopted whole" by reference is now written down
  here, since that plan is not a repository document: the dataset/projection
  model with its id chain and re-analysis scopes (§4.6), and the minimal
  interfaces — `OperationContext`, `ArtifactRef`, the capabilities and event
  fields (§4.7). Also carried over: tool-name stability and no WebMCP polyfill
  (P1), the hand-over protocol (P3), the CDP retirement condition (P4), and the
  verification scenarios and performance protocol the plan listed (§6).
- Rev. 2 (9/5/2026): Keiichiro ONO and Claude (Fable 5.1) — **Browser
  support decided: Chromium-based only.** Rev. 1 had recorded that Firefox and
  Safari have no path today and named the one route that would give them one;
  weighing that route's cost against desktop share (Chromium family above 80%)
  and against what it would delay (P2), the decision is not to build it. Three
  cheap things are kept so the door stays open (§3.4), and the same route —
  which also removes the five-step WSL2 setup for Chromium users — is recorded
  as a separate, unscheduled proposal rather than dropped
  ([proposals §10](agent-workflow-proposals.md)).
- Rev. 1 (9/5/2026): Keiichiro ONO and Claude (Fable 5.1) — initial
  evaluation and roadmap.

_Related: [agent-workflow.md](agent-workflow.md) · [agent-workflow-checklist.md](agent-workflow-checklist.md) · [agent-workflow-proposals.md](agent-workflow-proposals.md). Section references of the form §N point into this document; "plan §N" points into agent-workflow.md._

**Document roles.** The plan holds unit contracts; this roadmap holds order,
dependencies and release conditions; the checklist holds verifiable work; the
proposals hold what is not accepted. "The external plan" is cited as history
only — every contract an implementer needs is written in one of the four.

---

## 1. The goal, stated as what a user does

Everything below serves one change: network visualisation stops being a
point-and-click activity with an agent bolted on, and becomes a **CLI-driven
activity in which the browser is where a human looks and points**. The
measure of the roadmap is this session completing without a menu being
opened:

```
$ cyweb run create --project ./yeast-ppi                  # a run, on disk, that outlives the process
$ python analyze.py                                       # igraph: Leiden clusters, betweenness — 400k nodes, local
                                                          #   → results.jsonl (typed, nullable) + projection.cx2 (3,000 nodes)
> agent: apply the projection, coloured by cluster, sized by betweenness
  [browser] the projection appears; the user drags a lasso around one hub's neighbourhood
> agent: wait_for_selection → map the selection back to dataset ids
$ python analyze.py --subgraph selection.json             # re-analyse the induced subgraph, locally
> agent: apply the new projection as a second network
$ ls cyweb-runs/<runId>/                                  # manifest, id maps, results, exports — reproducible tomorrow
```

Two things in that transcript are new relative to plan §1.1, and both come
from the external plan: the **projection** (the browser never sees the 400k
nodes) and the **selection mapped back to dataset ids** (the human's gesture
becomes the next analysis's input). Those are the parts worth building; the
transport under them is a detail the user should never notice.

"Without a menu" is the **acceptance example**, not a requirement: it proves
the CLI path is complete. It does not restrict a user from exploring and
editing in the GUI, which the round trip depends on.

---

## 2. What was verified before judging the plan

The external plan makes claims about the WebMCP ecosystem after this
session's knowledge boundary, and two new claims about the code. All were
checked.

| Claim | Verified | Where |
| --- | --- | --- |
| WebMCP is a Community Group draft, not a W3C standard | Yes — "Draft Community Group Report, 4 September 2026" | webmachinelearning.github.io/webmcp |
| Entry point is `document.modelContext`; `registerTool(tool, { signal })`; unregister by aborting the signal | Yes | spec + Chrome imperative-API page |
| `execute(input, { signal })` returns `Promise<any>`, serialised to a JSON string; Chrome examples return strings | Yes | spec §executeTool returns `Promise<DOMString>` |
| Chrome: origin trial from Chrome 149; local flag `chrome://flags/#enable-webmcp-testing` | Yes | developer.chrome.com/docs/ai/webmcp |
| Chrome DevTools MCP exposes `list_webmcp_tools` / `execute_webmcp_tool`, experimental | Yes — behind `--categoryExperimentalWebmcp`; `execute_webmcp_tool(pageId, toolName, input?: string)` | chrome-devtools-mcp tool-reference |
| Tools are exposed to agents through an "implementation-defined" observation mechanism — no standard external protocol | Yes | spec |
| `nodeGraphics` takes a function, so it cannot be a JSON tool | Yes — `setRenderHook(hook: NodeGraphicsRenderHook)` | `src/app-api/core/nodeGraphicsApi.ts:51` |
| The host accepts `null` cells at runtime while `ValueType` excludes it | Yes — `validation.ts:500` "null is a legal cell value"; `ValueType = string \| number \| boolean \| …[]` | `src/app-api/core/validation.ts`, `models/TableModel/ValueType.ts` |
| Every tool handler takes a Playwright `Page`; the panel observes only the CDP dispatcher's events | Yes | `mcp-server/src/tools/*.ts`, `src/components/BridgePanel.tsx` |

Three further facts the plan did not state, found while checking, and each
changes something below:

- **Chrome's WebMCP annotations are not MCP's.** The imperative API takes
  `readOnlyHint`, `untrustedContentHint`, `consequentialHint`; MCP's
  `ToolAnnotations` are `readOnlyHint`, `destructiveHint`, `idempotentHint`,
  `openWorldHint`. Two vocabularies, one tool → §4.3.
- **WebMCP is gated by a `tools` permissions policy (default `self`) and
  requires origin-isolated documents.** The host's `index.html` carries no
  origin-trial token today. Registration on a deployed host is therefore a
  no-op until the host ships one → §5, P1.
- **`connectOverCDP` exists only on `playwright.chromium`.** Today's attach
  path is Chromium-only already → §3.3.

---

## 3. Verdict

### 3.1 Adopt — the plan is right, and these are the reasons

**The operation contract, not the MCP server, is the centre.** This is the
plan's main move and it is correct, but the strongest argument for it is one
the plan does not make: the seven broken tools in plan §1.2 exist because the
*tool definitions live in the wrong repository*. A tool that calls
`workspace.getNetworkList` is wrong because it was written next to the
consumer, not next to the API it consumes. Once the host owns the operation
definitions (P3), that whole class of bug is gone by construction — for
**every** consumer, our MCP server included, and whether or not WebMCP ever
ships. WebMCP is one beneficiary of host-owned operations; it is not the
reason to have them.

**Dataset and projection are different things.** The workflow plan assumed
the analysed network is the displayed network, which stops being true
somewhere around 10⁵ nodes. The plan's `datasetId` / `projectionId` split,
the explicit id chain (`source → analysis → projection → host`), and the
aggregate-to-members map are exactly what makes "the user clicked something,
re-analyse it" mean something when the thing clicked is a super-node. Adopted
whole, as the P2 data model.

**Typed JSON/JSONL is the canonical exchange format; TSV is a convenience.**
Verified: the host accepts `null` at runtime and its `defaultForType` writes
`0` into every new numeric cell. TSV cannot say "missing"; JSON can. The
plan's rule — `null` is missing, `""` is empty, `0` is zero, lists are arrays,
non-finite numbers are never silently converted — replaces plan §5.3's
per-column encoding table with something simpler and stricter. The host-side
type gap (`ValueType` excludes `null`) becomes an explicit host task.

**Withdraw "tool-ise every public method".** `setRenderHook` takes a
function. The plan is right that the long tail of the API is not a tool list,
and that the tools worth having are the ones a workflow needs.

**Always-on event history with a cursor and `EVENT_GAP`**; **mutations
serialised in the operations layer, not in a Node queue**;
`MUTATION_OUTCOME_UNKNOWN` and `CANCELLED` as first-class codes; registration
tied to App mount/unmount with separate abort signals for unregistration and
execution — all consistent with the Chrome API and with proposals §4, §7 and
§9. Adopted.

**The correction to the four-case table in plan §3.5.** The plan says "green
drift + red contract test = bridge bug" cannot exclude host behaviour,
fixtures or the browser environment. Correct. The cell should read: *the pin
did not move; the fault is in the bridge code or in the pinned host's
behaviour under test*. It narrows; it does not decide. §8 carries the fix.

**Chrome DevTools MCP as the first CLI-side path to WebMCP tools**, and
**P2 — the round trip — as the first releasable result** that experimental
WebMCP work must not delay. Both adopted.

### 3.2 Change

**P4 has a stricter precondition than the plan states.** For a CLI agent,
the only WebMCP path available today is Chrome DevTools MCP's
`execute_webmcp_tool(pageId, toolName, input: string)`: one generic tool, per
page, with the arguments JSON-encoded into a string. As an evaluation of
**that path**, it is worse than the first-class MCP tools the bridge exposes
now — the model discovers names through a second call and encodes inputs by
hand. It is not the only possible path: a **schema-derived MCP façade** — our
server reading `list_webmcp_tools` and re-exposing each as a first-class tool
— is a third route, and a client that surfaces WebMCP tools natively is a
fourth. So P4 is decided by **measurement**, not by ergonomics on paper:
task success rate, calls per task, recovery from reload and failure, and
whether the artifact hand-off survives. Until such a measurement favours it,
P4 is conditional and unscheduled, and the realistic end state for CLI agents
is **P3**: our MCP server stays the CLI's entry point, calling host-owned
operations — the outcome that fixes the drift problem.

**Security is a gate on P1, not a footnote.** A WebMCP tool registered by the
App runs with the host document's identity, and the `tools` permissions policy
admits any agent Chrome lets in. The host's security boundary is already open
— the examples roadmap's Theme G records that an app can import
`cyweb/CredentialStore` and read NDEx credentials. Registering
`delete_network` or an importer as a WebMCP tool widens that to browser
agents the user did not install. So P1 registers tools by **tier** (§4.4):
read-only and view-only mutations now; data mutations only behind a host-side
policy that does not exist yet. The plan's P1 list includes "selection
changes, layout, fit" — those are view-only and stay; nothing that writes
data or deletes is registered until Theme G is decided.

**Annotations are mapped, not copied.** The operations layer carries one
side-effect classification (`read`, `view-mutation`, `data-mutation`,
`destructive`, plus `untrusted-output`); the MCP adapter maps it to
`ToolAnnotations`, the WebMCP adapter to Chrome's three hints. Neither
vocabulary is the source of truth.

**The origin trial is a host deployment task, and it expires.** Two
enablement paths, kept separate: the developer flag for local work, and an
origin-trial token per deployed origin in the host's HTML, renewed on the
trial's schedule. **Availability is detected, never inferred from the URL**:
the adapter checks whether `document.modelContext` exists and whether
registration is accepted, and `capabilities` reports the result — API absent,
registration refused, or registered. The token goes in the host dependency
list (§5, P1); until the host ships one, the P1 proof runs on localhost.

**Three sources of one operations layer need a precedence rule**, not just
"reject overwrite". Host-native > App-shipped > CDP-injected. The running
instance publishes `{ version, source }` on a well-known property; a later
initialiser with the same version is a no-op, a different major version
refuses and reports `CONTRACT_MISMATCH`. Injection through CDP
`Runtime.evaluate` is not subject to page CSP (and the host sets none), so the
injected path has no loader problem — only this version problem.

**Spec churn gets a pin.** The plan notes that the 9/4 draft and Chrome's 9/1
material differ on `executeTool` input; it says "pin to a verified browser
build" without saying where. Add a **browser pin** — channel and version —
beside the host pin, and keep the WebMCP adapter small enough (a target of
under 200 lines) that rewriting it on a spec change is an afternoon.

### 3.3 Missing — added here

**Chromium-only applies to both paths.** The framing "use WebMCP in Chrome,
keep the current approach elsewhere" has nothing to keep: `connectOverCDP` is
a `playwright.chromium` method, so Firefox and Safari users have no bridge
today either. What to do about that is a decision, made in §3.4.

**Who can call what.** The plan's diagram implies it; a table makes it
checkable:

| Caller | Path to the operations | Status |
| --- | --- | --- |
| CLI agent (Claude Code, Codex, …) | our MCP server → CDP → operations | today |
| CLI agent | Chrome DevTools MCP → CDP → WebMCP → operations | experimental; one generic execute tool |
| Browser agent | WebMCP → operations | **API availability and agent support are separate facts.** Chrome 149 ships the API under origin trial; Chrome's documentation states that the Inspector extension's test agent is *separate from* Gemini in Chrome, and does not say Gemini in Chrome calls WebMCP tools. Which agent products call them is recorded when verified, per product |
| CLI agent, possible | our MCP server as a **façade** over `list_webmcp_tools` → first-class tools | not built; the third route §3.2 names |
| Anything, later | host-native operations, host-registered WebMCP | P3 |

**The WebMCP test path's open question, narrowed.** The mechanism for a
launched browser exists: Chrome DevTools MCP documents `--chromeArg` for
arbitrary Chrome arguments, `--channel` (`stable` / `beta` / `dev` / `canary`)
and `--headless`. What P1 confirms first is narrower — the exact feature
switch that enables WebMCP from the command line, and that the **pinned
browser and pinned DevTools MCP versions work together**. Only if no switch
works does the pin become a pinned *profile*.

### 3.4 Browser support — decided: Chromium-based

**The supported browsers are the Chromium family** — Chrome, Edge, Brave and
the rest. Firefox and Safari are **deliberately unsupported**, not pending.

| Browser | Desktop share (StatCounter, 6/2026) | Path | Decision |
| --- | --- | --- | --- |
| Chrome | 72.2% | CDP attach today; WebMCP in-page; host-native at P3 | supported |
| Edge, Brave, others on Chromium | 10.5% + | CDP attach assumed to match Chrome; **WebMCP enablement verified separately** per browser — Chrome is the reference, and each other browser is listed with its verified version and its capabilities result | supported |
| Safari | ≈ 9% | none. `safaridriver` sessions are OS-isolated from the user's browsing by Apple's design, and Safari blocks `ws://localhost` from an https page (WebKit 171934) | **not supported** |
| Firefox | 6.3% | none. CDP was removed in Firefox 141; WebDriver BiDi attach would work | **not supported** |

Why this and not the multi-browser route:

- **The audience has Chromium.** The user of this workflow runs Python
  locally and drives a CLI agent — a technical early adopter for whom "open it
  in Chrome" is a light constraint. The point-and-click majority is not the
  first audience of this change.
- **The other half is Chrome-only regardless.** WebMCP is a Chrome origin
  trial. A multi-browser transport under a Chrome-only agent standard is
  asymmetric effort.
- **It would delay P2.** The one route that reaches Safari — a page-initiated
  local connector — costs a WebSocket server, an in-page client, pairing, and
  a permanent `wss://` certificate burden for every Safari user. That work
  would sit in P1, ahead of the first releasable result.
- **Firefox alone does not justify it**, and Safari is the expensive one.

**Kept, because they are cheap and keep the door open:**

1. The tool layer calls a `Transport` interface (connect, evaluate, subscribe,
   screenshot), never a Playwright `Page`. CDP is its only implementation in
   P0. This is a matter of where code is written, not extra code.
2. The launch-mode contract test also runs under `firefox.launch()` and
   `webkit.launch()` as a **non-blocking** CI job — Playwright's `page.evaluate`
   is uniform across engines, so this costs nothing to write and reports host
   behaviour differences early without ever blocking a merge.
3. Documentation says **Chromium-based**, not "Chrome", and says Firefox and
   Safari are unsupported by decision.

**Revisit trigger: P3.** Once the host owns the operations layer it can also
ship the connector client itself, which removes the connector's largest
constraint (an installed App). That, or a concrete request from an
institution with a mandated browser, reopens the question. Until then the
connector is [proposals §10](agent-workflow-proposals.md), motivated by the
WSL2 setup rather than by browser support.

---

## 4. Architecture, restated with the changes

### 4.1 One operations layer, three adapters, three sources

Browser-safe module inside the bridge (later inside the host) defining, once
per tool: name, description, JSON Schema, the host methods it requires, its
side-effect class, input validation, the execute function, and result
shaping. It calls `CyWebApi` and nothing else — no store access, no Node, no
Playwright, no MCP SDK, no WebMCP globals.

| Adapter | Owns |
| --- | --- |
| MCP (Node) | discovery, `structuredContent` + text, images, resources, prompts, run and file tools |
| CDP (Node) | page selection, readiness, reconnect, injecting the operations bundle when no App is present, chunked transfer |
| WebMCP (page) | `registerTool` with the App's abort signal, Chrome's annotation vocabulary, string results, per-call cancellation |

Three possible sources — host-native (P3), App-shipped, CDP-injected — and
a precedence between them is not enough: the outcome would depend on which
loaded first. The rule is about **lifetime**, not rank:

- **one runtime per `Document`**, discoverable at a well-known property with
  `{ version, source }`
- initialisation goes through **one shared promise**, so concurrent
  initialisers wait for the same result instead of racing
- a caller that finds a runtime already present **reuses** it if it satisfies
  the contract the caller requires, and otherwise **refuses explicitly**
  (`CONTRACT_MISMATCH`) — there is no replacing a running runtime
- migration to host ownership happens **on page reload**, never live
- the runtime's owner and the WebMCP registration's owner are tracked
  **separately**: the host may own the runtime while the App still holds the
  registration, and the P3 hand-over (§5) moves them one at a time

### 4.2 What stays on the MCP side, permanently

Runs (`run_create / resume / record / list`), file import and export, and
`apply_analysis`. These touch the local filesystem, which no in-page tool can.
WebMCP tools take **artifact identifiers** for data already transferred to the
page, never local paths. This is the plan's split and it is right; §3.2 only
adds that this means a CLI agent will keep our server even in a WebMCP-first
world, which is the "companion" configuration.

### 4.3 Side-effect classes and their two projections

| Class | MCP `ToolAnnotations` | WebMCP hints | Examples |
| --- | --- | --- | --- |
| `read` | `readOnlyHint` | `readOnlyHint` | capabilities, get_networks, column stats, get_selection |
| `view-mutation` | — (idempotent where true) | — | select, layout, fit, switch_style, `show_projection` (switch display to a projection already imported) |
| `data-mutation` | — | `consequentialHint` | `import_projection`, apply_analysis, column writes, create network |
| `destructive` | `destructiveHint` | `consequentialHint` | delete_network |

**`view-mutation` is not "changes nothing persistent".** Layout writes node
positions to the persisted view model and records an undo entry; a style
switch is "recorded as one undo entry" by the host's own comment. The class
means *no data change* — the tables and the graph are untouched — and the
description of every such tool says so.

**`untrusted-output` is an output attribute, not a class.** Any tool can
return attribute values the user typed; it is marked on the tool
independently of its side-effect class and maps to WebMCP's
`untrustedContentHint`.

### 4.4 Registration tiers for WebMCP (gate on P1)

| Tier | Registered as WebMCP tools | Condition |
| --- | --- | --- |
| A | `read` and `view-mutation` | P1, now |
| B | `data-mutation` on an artifact already in the page | after the host enforces a **write contract** for agent-initiated changes: which operations are allowed, against which artifacts, with input validation applied **by the host**. The examples roadmap's Theme G is about the trust boundary of third-party Apps — related, and not this contract. Neither annotations nor the WebMCP registration list is access control |
| C | `destructive`; anything touching credentials or NDEx | not registered; MCP-only, and annotated |

### 4.5 Execution control, independent of transport

As in the external plan: per-page serialisation of agent mutations in the
operations layer; network id fixed at operation start; reads retry, sent
mutations never re-execute automatically; cancellation distinguishes
"not started" from "partially done" and never assumes rollback; human edits
interleaving with agent edits are outside the queue's protection, and the
contract says so. Error codes: the taxonomy of proposals §7 plus
`MUTATION_OUTCOME_UNKNOWN`, `CANCELLED`, `EVENT_GAP`.

**Every mutating entry point goes through the queue from P1** — including
the legacy tools whose semantics are not yet ported. A tool that still calls
`callApi` directly bypasses the serialisation and makes the guarantee false,
so porting the *dispatch* of every mutating tool is a P1 condition even where
porting its *meaning* is not. `apply_analysis`'s in-page part holds the queue
for its whole sequence; internal calls it makes do not re-acquire it, which
means the queue separates **external intake** from **internal execution** so
an operation cannot deadlock on itself.

### 4.6 Dataset, projection and the id chain

The analysed graph and the displayed graph are different objects with
different identifiers.

- A **dataset** carries a `datasetId` and the hash of the input snapshot it
  was analysed from.
- A **projection** carries a `projectionId` and records how it was derived:
  the extraction or aggregation method, its parameters, and the map from each
  projected element to the source elements it stands for.
- The **id chain** is explicit and stored: `source id → analysis id →
  projection id → host id`. Stripping the host's `e` prefix is one link in
  it, not a general mapping. igraph's internal indices are **never** used as
  persistent ids — igraph renumbers on deletion — so the source id travels as
  a vertex attribute.
- **Aggregate elements keep their member sets.** When a set is large it stays
  a local artifact and the page receives a reference plus a count. That is
  what lets "the user selected a super-node" become "re-analyse these 4,000
  members", and what stops an element absent from the projection being read
  as deleted or deselected.
- **Re-analysis has a declared scope**, because the same selection means
  different things: `selection-on-dataset`, `induced-subgraph-of-selection`
  (the default — the selection expanded to the source data and closed under
  its edges), or `displayed-aggregate`. Centrality on the second is not
  centrality on the third; the run records which was used.
- **Display limits are starting constraints**, not measurements: 5,000 nodes
  / 25,000 edges. Exceeding them is refused with a request to extract or
  aggregate, never truncated. For large workflows, layout coordinates are
  computed locally and shipped with the projection.

### 4.7 Minimal interfaces

Four contracts, small enough to state here and stable across transports.

| Interface | Carries |
| --- | --- |
| `OperationContext` | operation id, session id, target `Document`, target network id (fixed at start), optional `runId`, a cancellation signal |
| `ArtifactRef` | artifact id, **kind** (`dataset-snapshot`, `projection-snapshot`, `results`, `id-mapping`, `export`), byte size, content hash. Where the bytes are — local path, in-page store — is the adapter's business, never the operation's |
| capabilities | per-operation availability with a reason when absent; host information as far as the host publishes it; the **contract version** of the operations layer; whether transfer, rendering-wait and run recording are available on this connection |
| event retrieval | a **`Document` UUID** (new per load — no persistent counter to keep), sequence number, network id, per-consumer cursor, timeout, and an explicit gap signal — a cursor is `(uuid, sequence)`, so a reload can never be mistaken for a continuation |

Host additions in support of any of these go through `src/app-api/` and
return `ApiResult<T>`; conversion to MCP `structuredContent` or to WebMCP's
string result is adapter work, never host work.

---

## 5. Roadmap

Numbering follows the external plan. Exit criteria are conditions, not dates.

| Phase | Builds | Exit criterion |
| --- | --- | --- |
| **P0 — the existing path is trustworthy** | Plan Phase 1 **minus what P2 owns**: the seven fixes, host pin, vendored declarations, contract tests in launch mode, page selection, readiness, reconnect, capabilities, error taxonomy, and the three §3.4 keepers (a `Transport` interface with CDP as its only implementation; the Firefox/WebKit job, informational and never an exit criterion; "Chromium-based" wording). Rendering and persistence guarantees are **not** P0 — until they exist, `capabilities` says they are absent | Real calls succeed against the pinned host; wrong page, unsupported host and reconnect are handled and named; no tool file imports Playwright's `Page` |
| **P1a — shared foundation** | The operations module for the **workflow tools**; **every mutating entry point through the in-page queue**, ported or not (§4.5); one runtime per `Document` (§4.1); `Document` UUID and event recovery (§4.7); the four completion states (plan §8.3); panel fed from the operations layer. Existing MCP tool names stay stable while their implementations delegate | The same operation through the legacy path and the operations layer yields the same state, result and error; two mutations never interleave |
| **P1b — WebMCP experiment, in parallel** | App registers the **corrected Tier A** (§4.3–4.4) under `document.modelContext`; browser pin plus the other pins (§6); equivalence against the MCP path in a fixed environment. Only the current `document.modelContext` shape is targeted — no polyfill and no compatibility layer for earlier drafts | The same operation, run through our MCP server and through the pinned WebMCP route, yields the same state, result and error |
| **P2 — the round trip, releasable** | Plan Phases 2–3 with the dataset/projection model (§4.6): host snapshot fix, runs, artifacts, typed results, the four references and new-network apply (plan §8), the **persistence-outcome contract** and `viewport.whenRendered` on the host, selection → dataset ids → re-analysis. Initial release is new-network apply only | §1's transcript completes on the fixed fixture and on a 10⁵-node dataset, with every value on the right element, and every completion state reported honestly |
| **P3 — the host owns the operations** | Operations layer and WebMCP registration move to `src/app-api/`; host publishes the contract types and the registration owner; App detects host ownership and stands down — if it had already registered, it unregisters first, then hands over; a same-name duplicate registration is **never** the detection mechanism; the migration itself happens **on reload** (§4.1) and is tested that way; the host implements the Tier B write contract (§4.4); npm + Pages distribution (plan Phase 4) | With the App disabled, the host's operations and WebMCP tools work; no double registration, no double execution; our MCP server calls host-owned operations |
| **P4 — WebMCP-first, conditional** | Companion configuration of the MCP server (page tools withheld, runs and files kept). Shrinking the bridge and retiring CDP are **separate decisions**: CDP is retired only when the transfer path — files and artifacts into the page — has a replacement, which no WebMCP route provides | **Decided by measurement** (§3.2): task success rate, calls per task, recovery from reload and failure, and artifact hand-off, compared across the MCP path, the generic-tool path, and a façade if built. Unscheduled until a measurement favours it |

**P1 starts when P0's read-only operations are correct**, not when all 57
tools are ported. The long tail is not ported in P1 at all; it moves in P3, if
it moves.

**Host dependencies, by phase** — the single list; plan §11 points here.
P0: none. P1b: an origin-trial token per deployed origin (localhost is
flag-only). P2: the faithful snapshot path (plan §11.1); a **persistence-
outcome contract** — whether a network's restore data was written, as an
`ApiResult`, never a timed wait (plan §8.3); `viewport.whenRendered`; `null`
admitted in `ValueType` or the boundary declared nullable with round-trip
tests. P3: contract types and the operations layer in `src/app-api/`, a
registration owner, and the Tier B write contract (§4.4).

**Deliberately not in the roadmap.** A service that runs arbitrary local
Python from the browser; a general-purpose browser extension; a Streamable
HTTP server; a host-native local connector for non-Chromium browsers. Each is
a separate design if a browser agent ever becomes the primary user.

---

## 6. Verification

The external plan's principle stands: **one contract test suite, run with the
transport swapped** — same fixtures, same inputs, same expected values,
CDP and WebMCP must agree. What this document adds:

- **The pins.** The host pin (plan §3.1), and for the WebMCP path a
  **browser pin** — channel and version — plus the **Playwright version, the
  Chrome DevTools MCP version, the launch arguments, and the API shape used**.
  A stable Chrome channel does not make an experimental API stable; the pin
  records the whole combination that was seen to work.
- **CI is three kinds**, not "required" and "never blocks":
  1. **required** — contract tests of the shared operations and the existing
     MCP path; a regression in shared code is caught here whichever transport
     exposed it;
  2. **required to ship WebMCP features** — the equivalence test in the pinned
     environment; a red run does not block the MCP release of P2, but no
     WebMCP feature ships enabled while it is red;
  3. **informational** — tracking the latest browser and the latest draft.
- **The first P1b task** (§3.3): the feature switch, and that the pinned pair
  works.
- **The four-case reading is a diagnostic table**, not a table of causes.
  Green drift + red contract narrows the fault to the bridge code or the
  pinned host's behaviour under test — fixtures and browser build included —
  without saying which. Both red points at the pin first, but a host
  regression plus a stale vendored copy produces the same pair.
- **Tier enforcement is tested**, not assumed: a Tier C operation must be
  absent from `list_webmcp_tools`, and a Tier B one absent until the host
  policy flag exists.
- **Projection scenarios**: aggregate node selected → members re-analysed;
  element absent from the projection is never reported as deleted or
  deselected; the id chain round-trips with `e`-prefixed host edges.
- **Scale**: the 10⁵- and 10⁶-node fixtures are analysed locally and
  projected; the browser never receives more than the projection limit
  (5,000 nodes / 25,000 edges as the starting constraint, unmeasured), and
  exceeding it is refused, not truncated. The large fixtures are sparse
  graphs with analyses whose answers are checkable — degree, connected
  components — so a wrong id mapping shows up as a wrong number, not a
  plausible one.
- **Lifecycle scenarios** the external plan listed and this document keeps:
  several tabs; server started before the browser and after it; page reload
  mid-session; the App disabled; double registration attempted; a browser
  without WebMCP.
- **Data scenarios**: missing, empty and zero; Unicode; tabs, newlines and
  lists inside values; isolated nodes; self-loops; parallel edges; string ids.
- **Execution-control scenarios**: concurrent mutations; two MCP processes on
  one page; MCP and WebMCP driving the same page; interruption mid-operation;
  partial completion; cancellation before and after the call was sent.
- **Human round-trip scenarios**: the selection changes while the analysis is
  still running; the current network is switched mid-operation; an event gap;
  the original network is untouched throughout.
- **Performance is measured per stage** — local analysis, projection
  generation, transfer, import, render — with hardware, edge count, attribute
  volume and memory recorded. Raising a display limit requires this record,
  not an impression.

**Acceptance scenarios added by the seventh review**, each with its pass
condition:

| Scenario | Passes when |
| --- | --- |
| Results mixing all-zero, missing, empty string and explicit `null` | per-id type, value and missing-ness match — the all-zero column passes |
| 400k-node dataset, 3,000-node projection displayed | the page never receives the dataset; every displayed element resolves to its source ids |
| A super-node is selected and re-analysed | the recorded member set and the recorded analysis scope are what the analysis uses |
| Legacy MCP tools, new tools and WebMCP mutate concurrently | all pass through one queue; the target network never changes mid-operation |
| Reload, App disabled, competing initialisers | one runtime, one registration, no duplicate events; a stale cursor is detected |
| Persistence fails after apply; then a reload | the failure is not reported as success; on success, the result is restored after reload |
| Few nodes, enormous attributes | refused by the byte limit before any host change; buffers released |
| No WebMCP, registration refused, test-environment mismatch | the reason is reported; the MCP path still works |

In-place recovery is not among them: the initial release does not apply in
place (plan §8.2).

---

## 7. Things this document declines

- **Rewriting the four workflow phases now.** The external plan proposes
  recasting agent-workflow.md's Phases 1–4 as P0–P4. Do it once, when P0
  starts, not as a documentation exercise before it — §8 says exactly what
  moves.
- **Promising WebMCP-first by any date.** §3.2's precondition is outside this
  repository's control.
- **Multi-browser support.** Decided against in §3.4, on share, cost and what
  it would delay. The door is kept open at the cost of an interface and a
  non-blocking CI job; the route itself is recorded as a proposal.
- **In-place apply in the initial release.** New-network only (plan §8.2);
  the in-place path is [proposals §11](agent-workflow-proposals.md).

---

## 8. What this changes in the existing documents, once accepted

| Document | Change |
| --- | --- |
| `agent-workflow.md` | §1.1 gains the projection and the dataset/projection id chain; §3.5's four-case table is corrected as in §3.1; §5.3's TSV encoding table is replaced by the typed JSON rule, with TSV demoted to a convenience path; §7 loses "tool-ise the rest of §1.5" in favour of the workflow-tool set; §11.2 gains the origin-trial token, `viewport.whenRendered`, `null` in `ValueType`, and the Theme G write policy; Phases 1–4 are renumbered P0–P3 with P4 conditional. **Already applied** (9/5/2026): §2 and §13 record the Chromium-based decision |
| `agent-workflow-checklist.md` | Phase 1 gains the browser pin and the flag question — and, **already applied**, the `Transport` interface and the non-blocking Firefox/WebKit job; Phase 2 gains projection, typed results and `apply_analysis` over JSON; a new P1 block for the operations layer, Tier A registration and the transport-swapped contract test; Phase 4 gains the companion configuration; every item gains an owner column — bridge / host / external |
| `agent-workflow-proposals.md` | §1 annotations → accepted, with the §4.3 mapping; §4 journal, §5 run conventions, §7 error taxonomy (plus the three new codes), §8 doctor → accepted into P0–P2; §3 undo → deferred to the phase that introduces in-place apply; §6 rendered → superseded by `viewport.whenRendered` (host), canvas sampling kept as an experiment-only aid; §9 serialisation → accepted, in the operations layer rather than Node |
| ADRs | New: operation contract vs adapters; dataset, projection and the id chain; WebMCP registration ownership and tiers; artifacts and runs. Amended with scope and successor notes: 0001 (CDP as transport), 0003 (panel as observer), 0007 (result shaping) |

---

## 9. Sources checked on 9/5/2026

- WebMCP — Draft Community Group Report, 4 September 2026:
  https://webmachinelearning.github.io/webmcp/
- Chrome, "WebMCP" (origin trial from Chrome 149; flag; permissions policy;
  origin isolation): https://developer.chrome.com/docs/ai/webmcp
- Chrome, "Imperative API" (`registerTool`, annotations, `signal`, string
  results): https://developer.chrome.com/docs/ai/webmcp/imperative-api
- Chrome DevTools MCP tool reference (`list_webmcp_tools`,
  `execute_webmcp_tool`, `--categoryExperimentalWebmcp`):
  https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md
- Code: `cytoscape-web/src/app-api/core/nodeGraphicsApi.ts`,
  `core/validation.ts`, `models/TableModel/ValueType.ts`, `index.html`;
  `cy-agent-bridge/mcp-server/src/tools/*.ts`;
  `playwright-core/types/types.d.ts` (`connectOverCDP` under `chromium`)
