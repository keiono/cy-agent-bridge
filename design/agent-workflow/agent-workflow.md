# cy-agent-bridge — Agent Workflow Plan

> **Status: proposed, nothing implemented.** This plan takes the bridge from a
> working demo to a tool an analyst can rely on, and from a Claude-specific
> tool to one any MCP client drives.
>
> **Scope:** this repository, plus **one blocking host dependency** (§11.1).
> Everything else the host could do better is a proposal (§11.2). The supported
> host is `cytoscape-web@development` and only that (§1.2); any other build
> gets a clear refusal rather than best-effort behaviour.

- Rev. 7 (9/5/2026): Keiichiro ONO and Claude (Opus 5) — Sixth review, three
  clarifications and one thing worth recording. Sharing one host pin between
  the drift check and the contract test made a lone failure ambiguous, so §3.5
  now reads the two together as a four-case table — the useful cell being green
  drift with a red contract test, which means a value-level bug `tsc` cannot
  see. `check:contract` gains a staged scope, since "all 57 tools" would have
  held Phase 1 open indefinitely. The panel handshake is specified rather than
  described, because installing the listener after dispatching the probe races
  the reply. Recorded: `METHOD_NOT_FOUND` is already overloaded in the code —
  an unknown tool name at `tools/index.ts:96`, a missing host method at
  `callApi.ts:45` — which is why the taxonomy splits it.
- Rev. 6 (9/5/2026): Keiichiro ONO and Claude (Opus 5) — Fifth review. The CI
  decision from Rev. 4 turned out to need two things that do not exist:
  `server.ts` has no way to *start* a browser (only `connectOverCDP`), and
  nothing said where CI would get a host to test against. Both are now Phase 1
  tasks, and a single **host pin** — one committed `cytoscape-web` commit id —
  drives both the contract-test host build and the vendored declarations, so
  the types and the tested host cannot disagree. The drift check also says what
  it compares: CI clones the pin, rebuilds, and diffs against the vendored
  copy, rather than comparing two committed files. Recorded while checking: the
  app's api-types entry is a devDependency, so moving it to the vendored copy
  changes types only and no published artifact.
- Rev. 5 (9/5/2026): Keiichiro ONO and Claude (Opus 5) — Fourth review. Three
  gaps closed before implementation: the vendored declarations now say where
  they live, that the app moves onto them too (it types against the *old* npm
  contract today), and that CI only compares while a human regenerates;
  **panel presence turns out to be unobservable** — no detection logic, no
  installed-app API, and the one signal runs server-to-page — so the panel must
  announce itself first; and the tools §1.5 named as missing are now either
  scheduled or, for `deleteAllNetworks`, declined on the record. Also: the
  Pages procedure is the single-app one, not the examples' manifest-driven
  `copy-dist`, and the checklist's "out of scope" no longer contradicts Rev. 4
  by excluding the launch mode it adopted.
- Rev. 4 (9/5/2026): Keiichiro ONO and Claude (Opus 5) — Third review, and
  three decisions that shrink the plan. **Only `development` is supported**:
  the bridge is unpublished with no installed base, so an adapter for the
  `5ac00816` contract would be code nobody runs — §3.4's compatibility matrix
  is gone and the seven fixes become plain rewrites. **Contract tests run
  headless in CI under Playwright launch mode**, which resolves a contradiction
  in Rev. 3: §3.5 demanded a dedicated verification profile while §13 excluded
  the only mechanism that provides one. **The panel is published to GitHub
  Pages.** Typing is settled too: the declarations are vendored from a
  `development` build, because the published api-types describe the old
  contract and this repository has no sibling checkout to point `file:` at.
  Corrected: the `window.CyWebApi` presence check *is* implemented — as a guard
  on an already-chosen page, not as a selection criterion. Open proposals from
  this review live in
  [agent-workflow-proposals.md](agent-workflow-proposals.md).
- Rev. 3 (9/4/2026): Keiichiro ONO and Claude (Opus 5) — Second review.
  **Compatibility targets are now specific commits, not branch names**: the
  release branch `master` carries no App API at all (only
  `src/app-api/CLAUDE.md`), so "the bridge is correct against master" in Rev. 2
  was wrong. The old contract is the tag `api-types-v1.0.0-beta.3`
  (`5ac00816`), which is what the published types describe. That tag has no
  `whenReady()`, no element ids in TSV export, no `skippedCells`, and coerces
  unparseable numbers to `0` — so the adapter spans data semantics, not just
  signatures (§3.4). Export was found to lose information as well as import,
  widening §11.1 from "share the import path" to "a faithful snapshot both
  ways". Four more contracts pinned: missing values and graph type (§5), the
  snapshot a result network is built from (§8), run creation and `runId` (§9),
  and event identity (§4.1). Corrected: `Function.length` is a hint, not a
  contract; an all-unmatched import still creates columns; image results are
  exempt from file shaping.
- Rev. 2 (9/4/2026): First review. Three further broken tools that a
  method-name audit cannot see, because the names are unchanged and the
  signatures are not. Added the data contract (§5), readiness as distinct from
  connection (§3.3), analysis application as one operation (§8), and run
  artifacts separate from temp files (§9). Corrected: `get_table` already
  summarises its result.
- Rev. 1 (9/4/2026): Initial plan.

_Checklist: [agent-workflow-checklist.md](agent-workflow-checklist.md). Open proposals not yet folded into this plan: [agent-workflow-proposals.md](agent-workflow-proposals.md). Section references (§) point back here._

---

## 1. Why

### 1.1 The target workflow

```
local analysis in Python (clustering, centrality, enrichment)
  → push into a remote Cytoscape Web with a mapping that reads well
  → the user explores, by hand and through the agent
  → pull results back as CX2 / GraphML
```

The CLI agent stays the thing that runs Python. The bridge does not gain a
code-execution service; it gains a data contract good enough that results land
on the right elements, and a record of what happened.

### 1.2 One supported contract, and why the tools are broken against it

The bridge was written against the App API as **published** — the tag
`api-types-v1.0.0-beta.3` (`5ac00816`), which is still what
`@cytoscape-web/api-types` on npm describes. The host has moved since, and that
history explains every bug below. It is not a compatibility requirement:

| Build | App API | Support |
| --- | --- | --- |
| `origin/development` | The current contract, 882 commits ahead of `master` | **The one supported target** |
| `5ac00816` | The old contract the bridge still calls | Not supported — no adapter |
| `origin/master` | **No App API at all** — `src/app-api/` holds only `CLAUDE.md` | Refused clearly |

The bridge is unpublished (`0.1.0`, `private`) with no installed base, so an
adapter for the old contract would be code nobody runs. Dropping it removes a
compatibility matrix, per-host reduced guarantees, and half of Phase 1.

What replaces it is narrower and still necessary: **capability probing reports
support per tool, not per host** (§3.4). A build somewhere between `5ac00816`
and today matches some tools and not others, and the honest answer is a list,
not a verdict. Nothing here asserts what any deployment runs; that is measured
(§3.4), never assumed.

**Where the bridge and `development` disagree — at least seven tools:**

| Tool | Against `development` | Detectable by name? |
| --- | --- | --- |
| `cytoscape_get_networks` | `workspace.getNetworkList` → `getNetworks` | yes |
| `cytoscape_remove_mapping` | `visualStyle.removeMapping` → `deleteMapping` | yes |
| `cytoscape_rename_column` | `table.setColumnName` → `renameColumn` | yes |
| `cytoscape_remove_from_selection` | `additiveUnselect` → `additiveDeselect`, **and** `(ids)` → `(nodeIds, edgeIds)` | name only |
| `cytoscape_add_to_selection` | passes `ids`; host wants `(nodeIds, edgeIds)` | **no** |
| `cytoscape_toggle_selection` | same | **no** |
| `cytoscape_create_continuous_mapping` | passes 6 positional args; host wants `(networkId, vpName, options)` | **no** |

The last three keep their names. `Object.keys()` sees nothing wrong. Continuous
mappings are how a centrality column becomes colour, and selection is the whole
human-in-the-loop story — these are not edge cases.

**Return shapes drift too.** `createNetworkFrom*` returns
`ok({ networkId, cyNetwork })`; the bridge reads `d.nodeCount` and
`d.edgeCount`, which are not there, and reports `undefined`. `cyNetwork` is the
entire network object, serialised across CDP and then discarded.

### 1.3 Ingest is token-bound

`cytoscape_create_network_from_cx2` takes `cxData` and
`cytoscape_import_table_tsv` takes `tsvText` — as tool *arguments*, so the data
passes through the model's context. Retrieval already avoids this:
`export_network` and `export_table_tsv` write to a session directory and return
`{ filePath }`. The asymmetry is the bug.

### 1.4 Connection, readiness and rendering are conflated

`server.ts` takes `contexts[0].pages()[0]` — the first tab of the first
context, whatever it is. ADR-0002 specifies choosing the page by origin match
**and** a `window.CyWebApi` check; the presence check is implemented
(`server.ts` waits for `cywebapi:ready` with a 30-second timeout, then asserts
the object exists), but it runs as a **guard on the page already chosen**, not
as a criterion for choosing one. Origin matching is absent entirely. So the
bridge fails on a page it should have skipped instead of skipping it.

It also connects once at startup and never retries, so the normal case (agent
starts before the user opens the page) yields `TRANSPORT_ERROR` for the whole
session.

Presence is not readiness, and readiness is not rendering — three states, and
the bridge tracks none of them (§3.3).

### 1.5 Smaller findings

- `@anthropic-ai/sdk` is a dependency nothing imports
- No tests exist in `mcp-server/` at all
- The dispatcher sends **full arguments and full results** to the panel, and
  `src/logStore.ts` keeps every entry forever
- `mcp-server/package.json` is `private: true`, has no `bin`, and `server.ts`
  has no shebang: nothing about it is publishable yet
- The README documents registration through `.claude/settings.json`, which is
  not how Claude Code registers MCP servers either

Missing from the bridge but present on `development`: `visualStyle.getStyles` /
`switchStyle` / `applyVisualStyle`, `selection.clearSelection`,
`network.createNetworkFromNodeList`, `network.deleteAllNetworks`, and the
`nodeGraphics` and `contextMenu` domains.

---

## 2. Scope and decisions

| Question | Decision |
| --- | --- |
| Host changes | **One blocking dependency** (§11.1); everything else is a proposal (§11.2) |
| Compatibility | **`development` only.** No adapter for the old contract; anything else is refused clearly (§1.2) |
| Typing | Declarations **vendored** from a `development` build of `@cytoscape-web/api-types`, refreshed by script with a CI drift check (§3.1) |
| Renaming | **Staged.** Display name, packages and events first; the federation id later, with a documented reinstall (§4.1) |
| Distribution | Server on **npm + `npx`**; panel on **GitHub Pages** (§4.2, §4.4) |
| Transport | **Attach for interactive use, launch mode for CI contract tests** (§3.5). Streamable HTTP stays out (§13) |

ADRs to write alongside 0001–0007: the contract strategy (§3), the identity,
typing and missing-value contract (§5), staged renaming with event identity
(§4.1), and applying analysis as one verified operation (§8).

---

## 3. Contracts, connection and readiness

### 3.1 Three layers, because one is not enough

Name existence catches three of the seven problems in §1.2.

1. **Development-time types.** Type the tool layer against the App API
   declarations so a signature change fails `tsc`. The declarations cannot come
   from npm — `@cytoscape-web/api-types` there describes `5ac00816` — and
   cannot come from `file:` either, since this repository has no sibling
   checkout in CI. So the generated `.d.ts` is **vendored** into the repository.
   The commit then records which contract the code was written against, which
   is the fact that went missing the first time.

   Three details decide whether this works in practice, so they are settled
   here rather than discovered later:

   - **Where.** One copy at the repository root (`types/cyweb-api/`), not
     inside `mcp-server/`, because both halves need it.
   - **Who else uses it.** The app under `src/` currently types against
     `@cytoscape-web/api-types@^1.0.0-beta.3` from npm — the *old* contract —
     with `skipLibCheck: false`. Leaving that would have the two halves of one
     repository describing two different hosts. The app moves to the vendored
     copy with the server.
   - **What it is pinned to.** A single committed `cytoscape-web` commit id —
     call it the **host pin**. It is the one fact that says which contract this
     repository targets, and §3.5's contract-test host is built from the same
     pin, so the types and the tested host can never disagree.
   - **How CI checks it.** A human moves the pin and regenerates locally, since
     the refresh script needs a `cytoscape-web` checkout. CI then **clones the
     pinned commit, runs `npm run build:api-types`, and diffs the result
     against the vendored copy** — comparing regenerated output to committed
     output, not one committed file to another. A stale vendored copy and a
     moved pin both fail the same check.
   - **Blast radius of moving the app.** Small: `@cytoscape-web/api-types` is a
     **devDependency**, so it is types only and nothing changes in the
     published artifact. What the switch means is that this repository types
     against the host it supports, while external app developers keep using the
     npm package — the two describing different contracts is exactly the
     release-sync problem in §11.2, not something this repository can fix.
2. **Connect-time probing** (§3.2) — read-only, and the source of per-tool
   support in `get_capabilities`.
3. **Contract tests that exercise real I/O** (§3.5) — the only layer that
   proves a call works, and the only one that would have caught all three
   silent signature changes.

`Function.length` is a **hint, not a contract**. The old
`createContinuousMapping` declares six required and three optional parameters,
so its `length` is **9** — a number that matches neither how it is called nor
how the new one is. Optional parameters, defaults and rest arguments all move
it independently of the contract. Use it as one signal among several, never as
the discriminator on its own.

### 3.2 What connect-time probing may do

**Read-only, and nothing else.** Probing return shapes by calling
`createNetworkFrom*` would create a network on the user's workspace every time
the bridge connects. So connect-time detection is limited to: which methods
exist, their arity as a hint, and read-only calls with known-safe arguments
(`workspace.getWorkspaceInfo`, `layout.getAvailableLayouts`).

Anything that creates, selects, mutates or deletes belongs to the contract test
(§3.5), which runs against a **dedicated verification browser profile and
fixture workspace**, never the user's session.

Where a shape cannot be established read-only, it is recorded as *unverified*
and the first real call reconciles it — reporting a mismatch as a contract
error rather than a data error.

### 3.3 Connection, readiness, rendering

- **Connected** — attached to a page. Choose it by scanning every context and
  page for `window.CyWebApi`, restricted to an **allowed origin list** and
  preferring a configured host URL. When more than one candidate matches, ask
  the user to name one rather than guessing; once chosen, **pin** it.
- **Ready** — `await window.CyWebApi.whenReady()`. Re-run it after a page
  reload: the pinned target survives, the API object does not. A host without
  `whenReady()` is not a supported host (§1.2).
- **Rendered** — a separate contract that `cytoscape_screenshot` and any
  visual assertion must wait on: the requested network is current, loaded, laid
  out, and drawn.

Connect lazily on the first tool call and reconnect after a drop. **Retry
policy differs by kind:** reads are retried automatically; a mutation whose
outcome is unknown after a disconnect is *not* — replaying
`create_network_from_file` produces two networks. Report the uncertainty and
let the agent decide.

### 3.4 Support is reported per tool, not per host

There is one supported contract, so there are no adapters and no per-host
guarantee table. What remains is a list: for each tool, does this host have the
method it needs, in the shape it needs?

`get_capabilities` answers that, and a tool whose method is missing is
**unsupported here** — it is withheld and, if called anyway, returns a contract
error naming what was missing. Never a silent downgrade: half of a join
guarantee is worse than none.

This also covers the case a version check cannot. A build somewhere between
`5ac00816` and today satisfies some tools and not others, and the bridge has no
way to identify a deployment by name: `window.CyWebApi` carries no version or
build identifier at all — exposing one is proposed in
[agent-workflow-proposals.md](agent-workflow-proposals.md). Measuring the
surface is the only honest answer available today.

### 3.5 Contract tests, in launch mode

`npm run check:contract` calls tools with real arguments and asserts on the
values that come back. It creates, mutates and deletes, so it must never touch
a user's session.

**Its scope grows in stages**, because "all 57 tools" as a Phase 1 exit
criterion would hold the phase open for months. It starts with the tools the
§1.2 rewrites touch — selection, visual style, table, network — since those are
where the contract actually broke. It then grows to cover **every mutating
tool**, which is the set where a silent signature change does damage rather
than returning nonsense. Read-only tools with no arguments beyond a network id
are last and least urgent.

It therefore runs under **Playwright launch mode, headless, in CI**, with
fixtures reused from `cytoscape-web/test/fixtures`. That is ADR-0002's own
position — attach is primary *for interactive use*, launch is the fallback for
automated scenarios — and it resolves the contradiction Rev. 3 left behind,
where §3.5 demanded a dedicated verification profile while §13 excluded the
mechanism that provides one.

Two things have to exist first, and neither does today:

- **A host to test against.** The CI job checks out `cytoscape/cytoscape-web`
  at the **host pin** (§3.1), builds it, and serves the build locally. Pointing
  at a deployed dev URL would be cheaper and would make the result depend on
  someone else's deploy — a red run would not tell you whether the bridge or
  the deployment moved. The pin makes the run reproducible and ties it to the
  declarations the code was typed against.
- **A launch path in the server.** `server.ts` only calls
  `chromium.connectOverCDP`; nothing can start a browser. Contract tests need
  `chromium.launch()` behind a flag or an environment variable, which is the
  first place Phase 1 touches ADR-0002's attach-primary framing. The framing
  survives: launch is for automation, attach stays the interactive default.

**The two checks are read together.** Sharing one pin means a failure alone is
ambiguous; the pair is not:

| Drift check | Contract test | What moved |
| --- | --- | --- |
| green | green | Nothing. The code, the declarations and the host at the pin agree |
| green | **red** | The **bridge code**. Types match the host, so this is a value-level assumption `tsc` cannot see — which is the class of bug §1.2 is made of |
| **red** | green | The **vendored copy** is stale, or the pin moved without regenerating. Run the refresh script |
| **red** | **red** | The **pin** moved to a host the code has not caught up with |

Neither check is meaningful alone, which is the argument for running both on
every push rather than making the contract test optional.

Attach stays the interactive path, and `check:contract -- <cdpUrl>` remains
available for pointing at a specific deployment before claiming support for it.

### 3.6 What `tools/list` says before a connection exists

Advertise the full set, mark unverified capability in each description, and
send `notifications/tools/list_changed` once probing completes — the SDK
exposes `sendToolListChanged()`. Verify clients re-fetch; a client that ignores
the notification must still get honest errors.

`cytoscape_get_capabilities` therefore belongs in **Phase 1**: it reports which
tools this host supports, and names what was missing for the ones it does not
(§3.4).

---

## 4. Naming, migration and distribution

### 4.1 Rename in two stages

A federation id is an installation identity — the host matches the container
name to `CyApp.id`, so changing it makes the host see a different app: every
installation must be reinstalled and old install URLs stop resolving. That cost
should not ride along with a package rename.

**Stage 1 — no reinstall.** Display name, package names
(`@cytoscape-web/cy-agent-bridge`, `-mcp-server`), log prefix, README, and the
window events. Keep `cyweb.id: claudeBridge`.

**Stage 2 — the id.** `claudeBridge` → `cyAgentBridge`, with a documented
reinstall path and a decision on what old URLs do. Scheduled separately.

**Event identity.** `claude:*` → `cyweb:agent:*`, dispatching both during the
transition. Today's `id` is a module-level counter that is **shared between a
command and its result and resets when the process restarts** — it cannot
identify an event. Define three fields:

- `sessionId` — new per server process
- `callId` — one tool call; the same value on its command and its result
- `eventId` — unique per emitted event

The panel de-duplicates on `eventId`, and only across the old/new **aliases of
the same event** — never across genuinely repeated calls. Test the matrix:
old/new server × old/new panel, all four.

### 4.2 Distributing the server

```bash
npx @cytoscape-web/cy-agent-bridge-mcp-server
```

Needs: `private: true` removed, `bin` plus a shebang on the entry file, `files`,
`publishConfig.access: public`, a `repository` field (npm validates it against
the provenance attestation), an `engines.node` floor, `--version` / `--help`,
and a release workflow that runs the new tests.

### 4.3 Distributing the panel

`npx` covers the MCP server. The panel is a Module Federation remote and needs
somewhere to serve `remoteEntry.js` from — a question this plan had left open,
since the app has only ever run from a dev server on 6100.

It is published to **GitHub Pages**, borrowing the example apps' approach but
not their machinery: `copy-dist.mjs` there is manifest-driven because that
repository publishes four apps from a workspace. This repository has one app, so
the procedure is three steps — build, copy `dist/` into `docs/`, write
`docs/.nojekyll` — and installing into a host is a
`?installApp=<url>/cyweb-app.json` link.

One documented trap comes with that. GitHub Pages runs Jekyll, which drops
`_`-prefixed paths — and Module Federation emits `_virtual_mf-*` chunks that
every app imports first. The examples repository hit this on 8/5/2026 and fixed
it by writing `docs/.nojekyll` from its `copy-dist` script
(`scripts/copy-dist.mjs`). This repository has no `docs/`, no publish script and
no deploy workflow yet, so all three arrive together, `.nojekyll` included, and
a published-artifact check runs before the release is called done.

### 4.4 Client neutrality

`Server.getClientVersion()` returns the connecting client's name and version;
carry it in the connected event so the panel reads "Codex CLI connected".
Registration snippets for Claude Code (`claude mcp add`, `.mcp.json`), Codex CLI
(`~/.codex/config.toml`), Antigravity / Cursor / Windsurf (`mcp.json`), and
generic stdio. Tool descriptions lose their client-specific instructions.

---

## 5. The data contract

This decides whether analysis results land on the right elements. It comes
**before** file transfer: fast transfer of mis-keyed data is worse than none.

### 5.1 Identity

CX2 edge id `7` becomes `e7` inside the host — cytoscape.js forbids a node and
an edge sharing an id, so `translateCXEdgeId` prefixes every edge
(`src/models/NetworkModel/impl/edgeIds.ts`). A Python script that reads CX2,
computes per-edge values and writes them back keyed on `7` matches nothing.

Every import and export carries an explicit **id map** between source ids and
host ids, written to the run directory (§9) and reused across steps. It comes
from `exportTableToTsv`'s `includeId` column, which is why a host lacking that
option cannot support the loop at all (§3.4).

### 5.2 The import contract

Named per import: target `networkId`, id map, column names **with declared
types**, join key, and the policy for duplicate keys, unmatched rows and
existing values.

`table.importTableFromTsv` resolves a custom key by scanning existing rows, and
when a key value repeats it writes to **every** matching element.

**Encoding must be explicit**, because TSV has no escaping of its own: tabs and
newlines inside values, and `|` as the list separator, need a stated encoding
on both sides. The bridge owns the writer and the reader, so this is a decision
to record, not a problem to discover.

### 5.3 Missing is not zero

A new column is created for **every element** with a type default —
`defaultForType` returns `0` for numeric types — and an empty numeric cell is
then *skipped*, leaving that `0` in place. An element with no computed
centrality is indistinguishable from one whose centrality is genuinely zero.

On `development` an unparseable number is at least reported in `skippedCells`
rather than silently coerced, so the remaining ambiguity is exactly the one
above: a defaulted cell and a real zero look the same.

So the contract states, per column, how **missing**, **empty string** and
**zero** are each represented, and the tool verifies afterwards that the count
of non-default values matches the count of values supplied.

**Correction to Rev. 2:** an import where every key missed is *not* a no-op.
Columns are created before the row loop, so the network gains fully-defaulted
columns and `success: true`. Verification must check the match count, not the
absence of change.

### 5.4 GraphML needs more than the topology

Directedness, and whether the original was a multigraph with meaningful edge
keys, cannot be recovered from a CX2 document — the host does not store them.
So the converter's input is **CX2 + the run manifest**, not CX2 alone: graph
type, original edge keys and id types come from the manifest (§9).

NetworkX's `read_graphml` picks a graph class and an edge-key treatment from
the file, so the acceptance test asserts on the graph **type**, on edge keys
and on per-element values — never on counts alone.

---

## 6. The file-path data path

With §5 settled, transfer is mechanical. Reusing `sessionFilePath()`:

- `cytoscape_import_network_from_file(path, format?, runId)`
- `cytoscape_import_table_from_file(path, tableType, keyColumn, runId, ...)` —
  the §5.2 and §5.3 fields are arguments, not conventions

The server reads bytes in Node and passes them to `page.evaluate` as an
argument; the model sees a path. Inputs above ~8 MB are injected in chunks and
reassembled in the page. The existing inline tools stay for small data.

---

## 7. Export, styling and inspection

`cytoscape_export_network(networkId, format: 'cx2' | 'graphml' | 'sif', runId)`.
GraphML and SIF are produced in Node from CX2 **plus the manifest** (§5.4), as
pure functions — testable without a browser. §11.1 bounds what CX2 carries
today.

`cytoscape_screenshot(networkId?, clip?)` returns a PNG as MCP image content
via Playwright, after the rendering wait of §3.3.

`cytoscape_get_column_stats` returns min, max, quartiles, distinct count and
type, so a continuous mapping is built from the data rather than guessed.

**Named styles need a serialisation contract.** `getStyles` returns metadata
only (`{ id, name, active }`), while `applyVisualStyle` takes a full internal
`VisualStyle` — whose discrete mappings hold a `Map`, which does not survive
JSON. So a style cannot be read out and applied back through the bridge as
data. Two options, and the plan picks one before implementing: copy the style
**inside the browser** (read and apply in one `page.evaluate`, never crossing
CDP), or define a JSON form with an explicit restore step. `switchStyle` is
unaffected — it takes an id.

**The rest of the gap in §1.5 is scheduled, not forgotten.**
`createNetworkFromNodeList` and the `nodeGraphics` and `contextMenu` domains
become tools in Phase 4, once the data contract they would carry is settled.
`deleteAllNetworks` is **deliberately not exposed**: it destroys a workspace in
one call, no workflow here needs it, and the annotation policy it would need is
still open in
[agent-workflow-proposals.md](agent-workflow-proposals.md). Declining it is a
decision, and this is where it is recorded.

---

## 8. Applying analysis as one operation

`importTableFromTsv` is **outside the undo stack** by the host's own decision.
A style recipe is several API calls, so a failure halfway leaves a partly
styled network.

**Which network gets duplicated matters.** Duplicating live state at apply time
attaches results computed minutes ago to a network the user may have edited
since. The result network is therefore built **from the snapshot that was the
analysis input**, recorded in the run directory at export time.

Note that `createNetworkFromNodeList` is *not* a duplication primitive: it
creates a fresh default visual style and empty network attributes. Duplication
means re-importing the snapshot CX2 — with the §11.1 caveat about what a CX2
round trip currently preserves.

**In-place path**, when that is what the user wants, requires a precondition
check that the network has not changed since the analysis started (node and
edge counts, column set, a content hash) and a documented way back.

**One tool, one contract.** `apply_analysis` (or the import tools extended)
takes `runId`, the input snapshot, the apply mode, and returns the verification
result — match rate, values read back, and the state left behind if it failed
part way. That is what makes verification non-optional rather than something
the agent may skip.

**Events for the human round trip.** Scope by `networkId`, a monotonic sequence
number, a per-consumer cursor, timeout and cancellation. Two waiters must not
race for one event, and a consumer that reconnects must be able to say where it
left off.

---

## 9. Runs, temp files and artifacts

The session directory is deleted when the MCP server exits, so exports written
there cannot support resuming tomorrow or reproducing a figure.

A **run directory** outlives the process and holds a manifest: inputs and the
snapshot they came from, the analysis script, environment and library versions,
parameters and random seed, the id map (§5.1), graph type and edge keys (§5.4),
result tables, style settings, and outputs.

**The bridge cannot collect most of that by itself** — Python runs under the
agent, outside this process. So runs are explicit:

- `cytoscape_run_create` / `cytoscape_run_resume` return a `runId`
- `cytoscape_run_record` registers metadata the agent supplies (script path,
  interpreter and library versions, parameters, seed)
- every import, export and apply tool takes `runId` and appends what it knows

An unregistered run is still valid; the manifest then records what it has and
is explicit about what is missing. Reproducibility is a property of what the
agent chose to record, and the manifest should not pretend otherwise.

### 9.1 Result shaping, corrected

`export_network` and `export_table_tsv` implement ADR-0007's shaping, and
`get_table` already returns columns plus a row count — the Rev. 1 claim that it
overflows a context window was wrong. Unshaped: `get_node_ids`, `get_edge_ids`
and the traversal tools, which return raw arrays of every id.

Generalise the wrapper: results over a threshold (32 KB by default) go to the
run directory and return `{ filePath, summary }`. **MCP image content is
exempt** — a screenshot is useful only if the client receives it as an image,
so it never becomes a file path.

### 9.2 The panel must not be the new bottleneck

`callApi` dispatches full arguments and full results to the page, and the panel
keeps every entry for the session. Moving payloads to files does nothing for
this path. **Summarise at dispatch** — method, size, counts, not the payload —
and bound the panel log by entry count and bytes.

---

## 10. The agent-facing surface

`cytoscape_get_capabilities` (Phase 1, per §3.6) reports which tools this host
supports and what was missing for the ones it does not (§3.4), the layout
algorithms available. It cannot report a host version, because the host
publishes none — see
[agent-workflow-proposals.md](agent-workflow-proposals.md).

**Panel presence needs a mechanism first.** Whether the observer panel is
installed cannot be answered today: the server has no detection logic, the App
API exposes no list of installed apps, and the only signal in the system runs
the wrong way — the server dispatches `claude:connected` *to* the page. So the
panel must announce itself. The minimal handshake, specified here because it is
the first thing Phase 1 builds and guessing at it invites rework:

| Step | Who | What |
| --- | --- | --- |
| 1 | Panel | Dispatches `cyweb:agent:panel-ready` on load — caught only if the server is already listening |
| 2 | Server | Inside one `page.evaluate`, installs a `cyweb:agent:panel-ready` listener, dispatches `cyweb:agent:panel-probe`, and resolves on the first reply or a short timeout |
| 3 | Panel | Replies with `cyweb:agent:panel-ready` whenever it sees a probe |

Step 1 alone is not enough: the panel usually loads before the server attaches,
so its announcement is gone by the time anyone is listening — the same
one-shot-event problem the readiness signal has (§3.3). The probe is what makes
the answer available at any time, and the listener has to be installed **before**
the probe is dispatched, in the same evaluate, or the reply races the listener.

A timeout means "no panel", which is a legitimate configuration: the MCP server
works without the panel, and only the log display is lost.

MCP **prompts** carry the workflow: `analyze-and-visualize`,
`inspect-current-network`. Prompts are **user-selected**, not injected — so
they are a convenience, and the same route must be reachable from ordinary tool
descriptions, which is what an agent reads without being asked.

---

## 11. Host dependencies

### 11.1 Blocking: CX2 does not round-trip through the App API

Both directions lose information.

**Import.** `networkApi.createNetworkFromCx2` registers topology, tables,
styles and the view — but not `otherAspects`, not `visualStyleOptions`, and not
arbitrary network attributes. The in-app file import
(`src/features/ToolBar/FileUpload.tsx`) does all three.

**Export.** `exportApi.exportToCx2` assembles its `CyNetwork` **without
`visualStyleOptions`**, so size lock, arrow colour and display-column settings
come back as defaults. And it wraps the opaque-aspect record in a
single-element array, while `exportCyNetworkToCx2`
(`src/models/CxModel/impl/exporter.ts`) takes only `Object.keys(aspect)[0]` of
each element — so **a network with two opaque aspects exports with one**.

**The bridge cannot promise a faithful CX2 round trip, or preserve analysis
metadata carried in CX2, until the host has one snapshot path in and one out.**
The ask is a shared implementation for both entries, and a round-trip test
covering multiple opaque aspects and non-default display settings.

Until it ships, the plan states the bound honestly and mitigates: keep the
original CX2 and the analysis metadata as separate run-directory files (§9),
and have the acceptance test assert exactly what survives on an unfixed host.

### 11.2 Proposals

1. **`exportApi`: GraphML, SIF, high-resolution PNG/SVG.** The rendering
   capability exists behind `useRendererFunctionStore`; only the API entry is
   missing.
2. **NDEx load/save on the App API.** The shortest path for a large network is
   to upload to NDEx and hand the host a UUID — no CDP transfer at all.
3. **A network duplication primitive**, since `createNetworkFromNodeList` is
   not one (§8).
4. **Layout progress events.** `applyLayout` resolves only on completion.
5. **A return shape for `createNetworkFrom*`** that carries counts instead of
   the whole `CyNetwork` (§1.2).
6. **Release `@cytoscape-web/api-types` with the host**, and tag host releases
   so a deployment can be identified (§1.2).

---

## 12. Order of work

| Order | Endpoint |
| --- | --- |
| 1 | Tools correct in arguments and return shapes against `development`; vendored declarations with a drift check; connection, readiness and rendering separated; contract tests in CI launch mode; `get_capabilities` |
| 2 | Identity, typing and missing-value contract; file transfer; runs and manifests; the host dependency (§11.1); a worked Python round trip |
| 3 | Manual selection → re-analysis → re-application as one verified operation; recovery from partial failure; rendering verification |
| 4 | Distribution with migration, extra formats, style recipes, multi-client verification |

Phase 2 depends on Phase 1: a file import against a bridge that attaches to the
wrong tab, or that cannot tell which contract it is talking to, proves nothing.

---

## 13. Considered, not doing now

- **Launch mode as the interactive path.** Launch mode arrives in this plan,
  but only for CI contract tests (§3.5). Attach stays primary for interactive
  use, as ADR-0002 decided: a launched browser discards the user's SSO session,
  workspace and IndexedDB state. Removing the five-step WSL2 setup with a
  launched browser is a separate question from running tests.
- **Streamable HTTP transport.** The SDK (1.27.1) implements it; the missing
  part is the authentication and trust boundary, which deserves its own design.

---

## 14. Verification

Offline, in CI: `npm run build`, `vitest run` (format converters, join
validation, missing-value encoding, shaping, adapter selection against a mocked
page), `npm run typecheck`.

Against a live host: `npm run check:contract` in CI, headless, against a
`development` build (§3.5). Two negative cases belong here too — an API-less
build and a build missing a method some tool needs — and both must produce a
clear, named refusal rather than a partial success.

**The acceptance test is one worked example**: a fixed input network and a
Python analysis with **known expected values**, applied through the bridge,
verified to have landed on the correct nodes and edges by reading values back;
then a hand-made selection in the browser, re-analysed, and re-applied. It
fails if a single value lands on the wrong element, and it asserts that an
element with no computed value is distinguishable from one whose value is zero.

Around that example, separate cases for: 5,000 nodes; a transfer genuinely over
8 MB; duplicate join keys; missing values; isolated nodes; parallel edges with
distinct keys; tabs and newlines inside values; a disconnect and reconnect
mid-workflow; and the whole example under two different MCP clients.
