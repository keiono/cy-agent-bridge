# Implementation Checklist — Agent Workflow

> Task-level tracking. Mark `[x]` when complete, and run a phase's
> verification before starting the next one.
>
> **Status (9/5/2026): nothing started.** Rev. 10 — seventh review folded in:
> per-id verification, projection-based apply, four completion states, byte
> limits, in-place apply moved out to the proposals.
>
> **Phase 1 is a hard prerequisite for everything else.** A file import against
> a bridge that attaches to the wrong tab, or that calls a signature the host
> does not have, proves nothing. Phase 2 carries the data
> contract, runs, and the blocking host dependency. Phase 4 (distribution) is
> last on purpose: publishing to npm makes every remaining defect somebody
> else's problem.
>
> **One supported host: `cytoscape-web@development`.** There is no adapter for
> the old contract (`5ac00816`) — the bridge is unpublished with no installed
> base, so it would be code nobody runs. Anything else, including an API-less
> build such as `origin/master`, is refused clearly and per tool (§3.4).

_Design: [agent-workflow.md](agent-workflow.md) — the audit and the reasoning. Open proposals not yet folded in: [agent-workflow-proposals.md](agent-workflow-proposals.md). Section references (§) point into the design._

**Path note:** paths are relative to the repository root unless prefixed
`cytoscape-web/`. `mcp-server/` is a separate npm package with its own lockfile
and `tsc` build; the app under `src/` goes through Vite.

### Pre-read files

| File | Why |
| --- | --- |
| `mcp-server/src/server.ts` | Connection, page selection, tool registration |
| `mcp-server/src/callApi.ts` | The dispatcher; the counter that is not an event id |
| `mcp-server/src/session.ts` | Temp-file lifetime — §9 splits this in two |
| `cytoscape-web/src/app-api/core/*Api.ts` | The contract on `development` |
| `cytoscape-web/src/models/NetworkModel/impl/edgeIds.ts` | `7` → `e7` (§5.1) |
| `cytoscape-web/src/app-api/core/tableApi.ts` | Join resolution, `defaultForType`, `skipped*`, no undo |
| `cytoscape-web/src/app-api/core/exportApi.ts`, `models/CxModel/impl/exporter.ts` | The export-side losses (§11.1) |
| `cytoscape-web/src/features/ToolBar/FileUpload.tsx` | What a full CX2 import does (§11.1) |
| `design/adr/0002`, `0005`, `0006`, `0007` | Decisions this plan builds on |

---

## Phase 1: Correct tools, honest connection (§1.2, §3)

### Repair the seven inconsistencies

Straight rewrites to the `development` contract — no adapters, no variant
selection (§1.2).

- [ ] `visualStyleTools.ts`: `createContinuousMapping` takes
      `(networkId, vpName, options)`, not six positional arguments
- [ ] `selectionTools.ts`: `additiveSelect`, `toggleSelected` take
      `(networkId, nodeIds, edgeIds)`, not a single `ids` array
- [ ] `selectionTools.ts`: `additiveUnselect` → `additiveDeselect`, with the
      same argument split
- [ ] `workspaceTools.ts`: `getNetworkList` → `getNetworks`
- [ ] `visualStyleTools.ts`: `removeMapping` → `deleteMapping`
- [ ] `tableTools.ts`: `setColumnName` → `renameColumn`
- [ ] `networkTools.ts`: read counts from where the host puts them; stop
      shipping the whole `cyNetwork` across CDP only to discard it

### Contract strategy (§3.1, §3.2, §3.5)

- [ ] **Vendor** the `@cytoscape-web/api-types` declarations built from
      `development` into `types/cyweb-api/` at the repository root — npm
      carries the old contract, and `file:` does not resolve in this
      repository's CI
- [ ] Record the **host pin** — the `cytoscape-web` commit id the declarations
      were generated from — beside the vendored files. The same pin builds the
      contract-test host, so types and tested host cannot disagree
- [ ] Point the **app** (`src/tsconfig.json`, currently `@cytoscape-web/api-types@^1.0.0-beta.3`
      from npm) at the same copy — otherwise the two halves of the repository
      describe two different hosts
- [ ] Refresh script run **locally** (it needs a `cytoscape-web` checkout) and
      its output committed
- [ ] Drift check, as a step in the existing `.github/workflows/ci.yml`: clone
      the pinned commit, run `npm run build:api-types`, **diff the regenerated
      declarations against the vendored copy**. Comparing two committed files
      would catch nothing
- [ ] Type the tool layer against those declarations so a signature change
      fails `tsc`
- [ ] Connect-time probe is **read-only**: method names, arity as a *hint*
      only, and safe read calls. Nothing that creates, selects or deletes
- [ ] Shapes that cannot be established read-only are marked *unverified*; the
      first real call reconciles and reports a contract error on mismatch
- [ ] **Add a launch path to `server.ts`** — it only calls `connectOverCDP`
      today, so nothing can start a browser. `chromium.launch()` behind a flag
      or environment variable, for automation only; attach stays the
      interactive default (ADR-0002)
- [ ] **A CI job that builds the host**: check out `cytoscape/cytoscape-web` at
      the host pin, build it, serve it locally. Not a deployed dev URL — a red
      run must mean the bridge moved, not someone else's deploy
- [ ] `npm run check:contract` — real calls, real assertions, under
      **Playwright launch mode, headless, in CI**, reusing
      `cytoscape-web/test/fixtures`
- [ ] Scope it in stages: the tools the §1.2 rewrites touch (selection, visual
      style, table, network) first, then every mutating tool. "All 57" is not a
      Phase 1 exit criterion
- [ ] Run drift check and contract test on every push — neither is meaningful
      alone (§3.5 has the four-case reading)
- [ ] `check:contract -- <cdpUrl>` still available for pointing at a specific
      deployment
- [ ] **ADR-0008: contract strategy** — why names and `Function.length` are
      insufficient (the old mapping's `length` is 9), and why the declarations
      are vendored

### Per-tool support, not per-host (§3.4)

- [ ] Each tool declares the method it needs; the probe resolves which are
      available on the connected host
- [ ] A tool whose method is missing is **withheld**, and returns a contract
      error naming what was missing if called anyway — never a silent downgrade
- [ ] Readiness is `await CyWebApi.whenReady()`; a host without it is not a
      supported host
- [ ] No reduced-guarantee modes: a capability that cannot be delivered with
      the same data contract is unsupported

### Browser scope (§13, and webmcp-roadmap.md §3.4)

- [ ] Tool handlers call a **`Transport` interface** — connect, evaluate,
      subscribe, screenshot — and never import Playwright's `Page`. CDP is the
      only implementation; the interface exists so P3 can add another without
      touching a tool
- [ ] The launch-mode contract test also runs under `firefox.launch()` and
      `webkit.launch()` as a **non-blocking** job — informational only, never a
      merge gate
- [ ] README and error messages say **Chromium-based**, and say Firefox and
      Safari are unsupported by decision

### Connection, readiness, rendering (§3.3)

- [ ] Page selection: scan all contexts and pages, restrict to an allowed
      origin list, prefer the configured host URL
- [ ] More than one candidate → ask the user to choose; then **pin** it
- [ ] Re-initialise after a page reload — the pinned target survives, the API
      object does not
- [ ] A rendering wait: network current, loaded, laid out, drawn
- [ ] Lazy connect on first tool call; reconnect after a drop
- [ ] **Reads retry; mutations with an unknown outcome do not**

### Tool discovery (§3.6)

- [ ] Decide and implement what the first `tools/list` returns before any
      connection exists
- [ ] `sendToolListChanged()` after probing; verify clients re-fetch
- [ ] Withheld or unverified tools still return an honest error when called
- [ ] `cytoscape_get_capabilities` — per-tool support and what was missing for
      the rest, plus layouts. It cannot report a host version: the host
      publishes none
- [ ] **Panel detection has no mechanism yet** — the server has no detection
      logic and the App API lists no installed apps. Build the handshake
      specified in §10:
  - [ ] Panel dispatches `cyweb:agent:panel-ready` on load, and again whenever
        it sees `cyweb:agent:panel-probe`
  - [ ] Server, in **one** `page.evaluate`: install the listener, *then*
        dispatch the probe, then resolve on the first reply or a short timeout
        — installing after dispatching races the reply
  - [ ] A timeout means "no panel", which is a supported configuration: only
        the log display is lost

### Housekeeping

- [ ] Remove the unused `@anthropic-ai/sdk` dependency
- [ ] Add vitest to `mcp-server/` with a `test` script

### Tests

- [ ] Probe resolution: full `development` surface, a surface missing one
      method, and an API-less page
- [ ] A withheld tool called anyway returns a contract error naming the method
- [ ] Page selection picks Cytoscape Web out of several tabs, and asks when two
      candidates match
- [ ] Retry policy: a read retries, a mutation does not

### Verification

- [ ] `check:contract` green in CI against a `development` build; an API-less
      build and a build missing a needed method both produce a **clear, named
      refusal**
- [ ] Continuous mapping and all three selection tools work
- [ ] Server started **before** the browser still yields working tools
- [ ] Reload the page mid-session; the next tool call succeeds
- [ ] Connecting the bridge creates nothing in the user's workspace

---

## Phase 2: Data contract, runs, transfer (§5, §6, §9, §11.1)

### Identity and typing (§5.1, §5.2)

- [ ] Id map between source ids and host ids on every import and export,
      persisted to the run directory, sourced from `exportTableToTsv`'s
      `includeId` column
- [ ] Import arguments carry the contract: target `networkId`, id map, column
      names **with declared types**, join key, and the policy for duplicate
      keys, unmatched rows and existing values
- [ ] Encoding for tabs, newlines and the `|` list separator, written down and
      shared by the writer and the reader
- [ ] Join defaults implemented as stated in §5.2: reject duplicate, unknown
      and mistyped keys **before** sending; partial results only with a named
      target set; omitted row ≠ explicit `null` on an existing column
- [ ] **ADR-0009: identity, typing and missing-value contract**

### Missing is not zero (§5.3)

- [ ] Per column, state how **missing**, **empty string** and **zero** are
      represented — new columns are created for every element with
      `defaultForType`, which is `0` for numeric types
- [ ] Pre-import validation: keys resolved, duplicated, unknown
- [ ] Post-import verification decided **per id** — value, type and
      missing-ness read back for every supplied element; counts (matched,
      written, defaulted) are diagnostics only, never the pass condition
- [ ] Fail loudly below a stated match-rate threshold — and note that an
      all-unmatched import still **creates fully-defaulted columns**, so
      "nothing changed" is not the signal

### File transfer (§6)

- [ ] `cytoscape_import_network_from_file(path, format?, runId)`
- [ ] `cytoscape_import_table_from_file(path, tableType, keyColumn, columnTypes,
      missingValuePolicy, duplicateKeyPolicy, runId)`
- [ ] Chunked injection above ~8 MiB: transfer id, sequence, total size, and
      a content hash verified in the page **before** import
- [ ] Byte limits beside the element limits: 64 MiB per artifact, 128 MiB of
      transfer buffers in the page — unmeasured starting values, verified in
      this phase; refused before any host change; buffers released on
      completion, abort and timeout
- [ ] Keep the inline tools for small payloads

### Runs and artifacts (§9)

- [ ] `cytoscape_run_create` / `cytoscape_run_resume` returning a `runId`
- [ ] `cytoscape_run_record` for metadata the agent supplies — script path,
      interpreter and library versions, parameters, seed
- [ ] Every import, export and apply tool takes `runId` and appends what it
      knows; the manifest is explicit about what is missing
- [ ] Run directory at `<project>/cyweb-runs/<runId>/`, project set
      explicitly at startup, **no automatic deletion**; separate from the
      session temp directory
- [ ] Manifest carries the id map, graph type and original edge keys (§5.4)
- [ ] Generalised shaping over 32 KB → `{ filePath, summary }`, with **MCP
      image content exempt**

### Panel load (§9.2)

- [ ] `callApi` summarises before dispatching — method, size, counts
- [ ] `src/logStore.ts` bounded by entry count and bytes

### Host dependency (§11.1)

- [ ] File an issue on `cytoscape-web`: **one snapshot path in and one out.**
      Import must keep `otherAspects`, `visualStyleOptions` and network
      attributes; export must pass `visualStyleOptions` and must not drop every
      opaque aspect after the first key
- [ ] Ask for a round-trip test with **two or more opaque aspects** and
      non-default display settings (size lock, arrow colour, display columns)
- [ ] Until it ships: document what survives, and keep the original CX2 plus
      analysis metadata as separate run-directory files
- [ ] File a second issue: a **persistence-outcome contract** — did the
      network's restore data reach IndexedDB — as an `ApiResult`. The
      scheduler delays writes 300 ms and logs failures, so API success proves
      nothing about persistence (`persistenceScheduler.ts`)

### Tests

- [ ] Id map round trip, including the `e` prefix on edges
- [ ] Join validation: duplicate keys, unmatched keys, missing values, wrong
      types
- [ ] Missing / empty / zero are distinguishable after a round trip
- [ ] Tabs and newlines inside values survive
- [ ] Chunked injection reassembles byte-identically
- [ ] Shaping threshold: under, over, exactly at; an image result stays an image

### Verification

- [ ] A worked Python round trip: analyse a fixed network, import results by
      path, read values back and confirm they landed on the **correct**
      elements
- [ ] No payload appears in the transcript
- [ ] An import whose keys all miss is reported as a failure, despite the new
      columns it created
- [ ] On an unfixed host, the documented CX2 loss is exactly what is observed —
      including the second opaque aspect and the display settings

---

## Phase 3: The human round trip (§7, §8)

### Apply as one operation (§8)

- [ ] Four references, distinct and named: `datasetSnapshotRef` (local
      only, never sent whole), `projectionSnapshotRef`, `resultsRef`,
      `idMappingRef` with aggregate member sets and method (§8.1)
- [ ] The result network is built **from the projection snapshot** — never
      from the dataset, never from live state at apply time
- [ ] `apply_analysis` joins results into a **local copy of the projection**
      and imports only that CX2; the host TSV importer is not on this path
- [ ] Apply mode is **new network only** in the initial release; the in-place
      path is proposals §11 and is not a release condition
- [ ] `createNetworkFromNodeList` is not a duplicate (default style, empty
      attributes); "new network" means importing the joined CX2
- [ ] Snapshots exclude undo history and transient selection state
- [ ] Completion reported as four states — applied/verified, rendered,
      persisted, recorded (§8.3); a persistence failure returns the created
      `networkId` and the state reached
- [ ] Persistence retry and operation re-execution are **different actions**;
      the tool never re-creates a network on its own
- [ ] `apply_analysis` contract: `runId`, the four references, and the
      verification result with completion states and partial-failure state
- [ ] **ADR-0010: applying analysis as one verified operation**

### Events (§8)

- [ ] Buffer scoped by `networkId`, with a monotonic sequence number
- [ ] Cursor is `(Document UUID, sequence)`; a new UUID per load, no
      persistent counter
- [ ] Per-consumer cursor; two waiters do not race for one event
- [ ] Timeout and cancellation
- [ ] `EVENT_GAP` on reload or retention loss — never a stale event. Recovery
      re-checks the watched `networkId` and `projectionId`: re-read that
      selection if they exist, report their absence if they do not
- [ ] A rendering wait or screenshot never fits or switches the network on
      its own (ADR-0006)
- [ ] Panel marks an operation as **not persisted** when no local recorder
      was connected at the time
- [ ] `cytoscape_wait_for_selection(timeoutMs)`
- [ ] `cytoscape_clear_selection`

### Inspection and styling (§7)

- [ ] `cytoscape_get_column_stats` — min, max, quartiles, distinct, type
- [ ] `cytoscape_screenshot`, honouring the rendering wait from Phase 1
- [ ] Named styles: `getStyles` (metadata) and `switchStyle` (id) are
      straightforward; **decide the `applyVisualStyle` route first** — copy
      inside the browser in one `page.evaluate`, or define a JSON form and a
      restore step, because a `VisualStyle` holds a `Map` and does not survive
      JSON

### Tests

- [ ] Two concurrent waiters each see every event
- [ ] Cursor survives a reconnect
- [ ] Precondition check rejects a network modified since analysis started
- [ ] A style copied through the chosen route is identical, mappings included
- [ ] Column statistics on numeric, categorical and sparse columns

### Verification

- [ ] Select nodes by hand; the agent re-analyses that selection and applies
      the result as a new network built from the recorded projection
- [ ] A style step failing halfway leaves the user's network untouched
- [ ] Screenshot shows the styled network, taken after rendering completes
- [ ] Results mixing all-zero, missing, empty and explicit `null` pass the
      per-id check — the all-zero column included
- [ ] A 400k-node dataset displayed as a 3,000-node projection: the page never
      receives the dataset; each displayed element resolves to its source ids
- [ ] A super-node selected and re-analysed uses the recorded member set and
      the recorded analysis scope
- [ ] Persistence failure after apply is not reported as success; after a
      reload, a persisted result is restored
- [ ] Few nodes with enormous attributes are refused by the byte limit before
      any host change, and the buffers are released

---

## Phase 4: Distribution, formats and recipes (§4, §5.4, §7)

### Rename, stage 1 — no reinstall (§4.1)

- [ ] Display name, package names, log prefix, README
- [ ] Events `claude:*` → `cyweb:agent:*`, both dispatched. **The inventory is
      not symmetrical:** `cyweb:agent:panel-ready` was introduced in Phase 1 and
      exists only in the new namespace, so "both dispatched" applies to the
      four legacy events (`command`, `result`, `error`, `connected`) and not to
      it
- [ ] Three identifiers, replacing today's single reset-on-restart counter:
      `sessionId`, `callId` (same on a command and its result), `eventId`
- [ ] Panel de-duplicates on `eventId`, across old/new aliases of the same
      event only — never across repeated calls
- [ ] `cyweb.id` stays `claudeBridge`; stage 2 is scheduled separately with a
      reinstall path and a decision on old install URLs
- [ ] **ADR-0011: staged renaming and event identity**

### Publish the server (§4.2)

- [ ] Remove `private: true`; add `bin`, a shebang, `files`,
      `publishConfig.access`, `repository`, `engines.node`
- [ ] `--version` and `--help`
- [ ] Release workflow that runs the Phase 1–3 tests
- [ ] Update the workspace `.mcp.json` to the `npx` form

### Publish the panel (§4.3)

- [ ] Build into `docs/`, publish to GitHub Pages, following the example apps
- [ ] Write `docs/.nojekyll` — Jekyll drops `_`-prefixed paths and Module
      Federation emits the `_virtual_mf-*` chunk every app imports first; the
      examples repository hit exactly this on 8/5/2026
- [ ] A publish script and a deploy workflow (this repository has neither)
- [ ] A published-artifact check: install the Pages build into a host through
      its `?installApp=` link before calling the release done

### Client neutrality (§4.4, §10)

- [ ] `Server.getClientVersion()` into the connected event; panel shows it
- [ ] Registration snippets: Claude Code, Codex CLI, Antigravity / Cursor /
      Windsurf, generic stdio — replacing the current `.claude/settings.json`
      instructions, which are wrong for Claude Code too
- [ ] Remove client-specific phrasing from tool descriptions
- [ ] MCP prompts `analyze-and-visualize` and `inspect-current-network` — and
      the same route reachable from ordinary tool descriptions, since prompts
      are user-selected rather than injected

### Formats and recipes (§5.4, §7)

- [ ] `mcp-server/src/formats/graphml.ts` — input is **CX2 + manifest**; graph
      type, original edge keys, id types and attribute types come from the
      manifest
- [ ] `mcp-server/src/formats/sif.ts`
- [ ] `cytoscape_export_network` gains `format`
- [ ] `cytoscape_apply_style_recipe` — colour-by / size-by / label-by, discrete
      for categorical, continuous from `get_column_stats` quantiles
- [ ] `createNetworkFromNodeList`, `nodeGraphics`, `contextMenu`: **deferred**
      until a workflow needs them — the workflow tools are the tool set, not
      the API surface (roadmap §3.1)
- [ ] `deleteAllNetworks` is **declined**, not deferred — record the reason
      (§7) so it is not rediscovered as an oversight

### Tests

- [ ] GraphML against CX2 + manifest fixtures: empty networks, list-typed
      columns, XML escaping, parallel edges with distinct keys, directed and
      undirected
- [ ] Migration matrix: old/new server × old/new panel, all four, each command
      logged exactly once
- [ ] Recipe produces mappings, never bypasses (ADR-0005)
- [ ] Palette assignment is deterministic for a given column

### Verification

- [ ] `npm pack`, register the tarball from outside this repository, call a tool
- [ ] A host running the previous panel build logs each command once
- [ ] GraphML read back with NetworkX yields the expected graph **type**, edge
      keys and per-element values — not merely matching counts
- [ ] The §14 worked example completes under two different MCP clients

---

## Cross-cutting cases

Run from Phase 2 onward, not only at the end:

- [ ] 5,000-node network
- [ ] A transfer genuinely over 8 MB
- [ ] Duplicate join keys / missing values / isolated nodes / parallel edges
- [ ] Tabs and newlines inside attribute values
- [ ] Disconnect and reconnect mid-workflow

## Out of scope

**Launch mode as an interactive path** — launch mode itself is in scope and is
how contract tests run (Phase 1); what stays out is using it instead of attach
for ordinary work, which would discard the user's session (§13). Also out: the
Streamable HTTP transport (§13) and the host proposals in §11.2. The blocking
host dependency is §11.1 and is tracked in Phase 2.
