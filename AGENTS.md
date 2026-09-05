# AGENTS.md

> Source of truth for agent context in this repository.

## What this is

Two programs that ship together, connected only by the browser:

| Part | Path | Build | Role |
|---|---|---|---|
| MF app | `src/` | Vite + Module Federation | A right-panel that renders a live log. **Pure observer** — it never calls the host API |
| MCP server | `mcp-server/` | plain `tsc` | A stdio MCP server exposing 57 `cytoscape_*` tools, executed against `window.CyWebApi` over CDP |

```
Claude Code ←→ MCP (stdio) ←→ mcp-server ←→ CDP ←→ Chrome ←→ Cytoscape Web
                                                              ↑ the panel observes
```

The two never import each other. They meet at three `window` CustomEvents the
MCP server dispatches inside `page.evaluate()` and the panel listens for:
`claude:command`, `claude:result`, `claude:error` (plus `claude:connected`).
Adding a tool therefore does not require touching the panel; changing the event
shape does. See `design/adr/0003-panel-as-pure-observer.md`.

## Identity, written once

`package.json`'s `cyweb` block (`id: claudeBridge`, `port: 6100`) is the single
source for the federation container name, the dev port and the install
manifest. `vite.config.ts` is one `defineCyWebApp(import.meta.url)` call that
reads it; `src/` reads the same values through `virtual:cyweb-app-meta`. Never
hand-write the id anywhere else — `test/appConfig.test.ts` asserts they agree.

## Rules that bite if you miss them

- **`src/` must not import Module Federation runtime types.** They reach
  `@module-federation/sdk`, whose declarations `import webpack`, a package this
  app does not depend on. `tsconfig.json` runs with `skipLibCheck: false` on
  purpose to keep the api-types declarations honest; that is what would break.
- **Host API calls return `ApiResult<T>`, never throw.** `mcp-server/src/callApi.ts`
  normalises `{ success: false }` into a `BridgeResult` error with a code. New
  tools go through `callApi`, not their own `page.evaluate()`.
- **The panel holds its log at module scope** (`src/logStore.ts` +
  `useSyncExternalStore`), so it survives unmount/remount. `getSnapshot` must
  return a cached reference or React re-renders forever.
- `mcp-server/` has its own `package.json`, `tsconfig.json` and lockfile, and is
  outside the bundler's `include`. Build it separately.

## Commands

```bash
npm install && npm run dev        # app dev server on 6100; prints an install link
npm run typecheck                 # all three tsconfigs
npx vitest run                    # unit tests
npm run build                     # dist/ + dist/mf-manifest.json
npm run build:zip                 # App Store submission archive

cd mcp-server && npm install && npm run build && node dist/server.js
```

Verify a change end to end by running the host (`cytoscape-web`, port 5500),
installing this app through the printed `?installApp=` link, and calling one
`cytoscape_*` tool from Claude Code — the panel should log it.

## Style

Prettier: no semicolons, single quotes, trailing commas, 80 columns, 2-space
indent. New JSX transform — do not `import React`. TypeScript `strict`.

## History

Split out of `cytoscape-web-app-examples` (as its `claude-bridge/` workspace)
with its history intact. Design documents live in `design/`; `CHECKLIST.md` and
`IMPLEMENTATION_PLAN.md` there are records of how it was built — read them, do
not update them.
