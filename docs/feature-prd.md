# Feature PRD: Conditional Request/Response Chain Pausing (Entry-side overrides)

Status: **Implemented** (Phase 1 & 2 shipped — see "Post-implementation notes" below for how the final design differs from the draft in this doc).
Author context: designed collaboratively in chat; this doc is written so a fresh
chat session can implement it without re-deriving the investigation below.

---

> **Post-implementation notes (read this first):** The design below has Entry
> gaining override ports as the mechanism for rewriting the outbound request.
> During implementation this was corrected: **Response**, not Entry, is the
> override sink — Entry stays a pure source (the real inbound request, never
> itself overridden), and Response's wired inputs (defaulting to Entry's real
> values) determine what's actually fired upstream. Wherever this doc says
> `MAPPING_ENTRY_INPUT_KEYS` / `executeMappingEntrySegment` / "Entry's override
> ports", read `MAPPING_RESPONSE_INPUT_KEYS` / `executeMappingRequestSegment` /
> "Response's override ports" instead — the Rust-side mechanism in §5.3 (event
> names, `resume_chain_request`, the shared timeout) shipped exactly as
> designed. All three §7 open questions resolved as drafted: method is
> overridable, the shared `chain_timeout` was reused (no separate timeout
> added), and migration `021` was free. Beyond Phase 1 & 2, the shipped release
> also added some follow-on work discovered during live testing, none of it
> scoped here: fire-and-forget visibility events even when a chain doesn't
> pause (so a no-op chain still shows up in the debug log), gzip/deflate/brotli
> response decompression, a `Log` passthrough node, two double-execution bug
> fixes (chain nodes re-running via the canvas Play button, and request-only
> nodes re-running during the response-shaping phase), and a UI overhaul
> (unified Node/Debug Log/Output panel + unseen-count badges on the Debug,
> Overrides, and mapping Log tabs — distinct from the canvas segment badges
> mentioned as out-of-scope in §6, which were not built).

---

## 1. Background — how the mapping chain hook actually works today

Stitch chains bound to a mapping (`mappings.use_chain = true`, `mappings.chain_id`)
only ever run from **one** place: `handle_response()` in
[`src-tauri/src/proxy/handler.rs`](../src-tauri/src/proxy/handler.rs). By the time
that fires, hudsucker has already:

1. Received the client's request in `handle_request()`
2. Captured it into a `PendingRequest { method, host, path, request_headers, request_body }`
   stashed in `self.pending` — **before** any URL remap runs
3. Applied the *static* `url_remap` (if enabled) and forwarded the request upstream
4. Received the real response

Only then does `handle_response()` check `mapping.use_chain`, and if true:
`self.pending.take()` reads back the frozen request snapshot, builds a
`ChainExecutionRequestEvent { request_method, request_headers, request_body, status, headers, body, url }`,
registers a `oneshot::Sender` in `chain_registry` keyed by `request_id`, emits
`mapping:chain-execute`, and **awaits** the frontend calling `resume_chain`.

The frontend (`useChainExecutionListener.ts`) loads the chain, runs
`executeMappingNode()`, and invokes `resume_chain` with the Exit node's output.

**Key consequence:** Entry and Response nodes both "run" at the exact same moment
— after the real response already exists. Entry isn't temporally early; it just
exposes the *already-captured* request-side data. Nothing in the current pipeline
can change what was actually sent upstream, because the request already went out
several steps earlier.

### What already exists in the executor (important — do not re-build)

`executeMappingNode()` in
[`src/lib/stitchEngine/nodeExecutors/mappingExecutor.ts`](../src/lib/stitchEngine/nodeExecutors/mappingExecutor.ts)
**already** spreads wired overrides into Entry's input:

```ts
if (childNode.type === 'mapping-entry') {
  childInput = {
    method: input.requestMethod,
    headers: input.requestHeaders,
    body: input.requestBody,
    url: input.url,
    ...wiredInput,   // <-- already there, just never had a real consumer
  };
}
```

So the *data plumbing* for "wire something into Entry to override it" already
works end-to-end in the JS engine. What's missing is (a) a UI path to actually
wire into Entry's ports, and (b) a proxy-side hook that runs **before** forwarding
and uses Entry's output to build the real upstream request.

### Dead field discovered during design: `mapping-response.url`

Investigated and confirmed inert: `mapping-exit`'s output has no `url` field at
all, `resume_chain` has no `url` parameter, and nothing else reads
`response.url`. It only exists for canonical port-layout alignment
(`MAPPING_PORT_LAYOUT`). Leave as-is for this feature — not in scope to remove,
mentioned here only so it isn't mistaken for something this feature should wire
into.

### ⚠️ Naming collision to avoid

There is an **unrelated, retired** feature called "pre-request chain"
(`015_pre_request_chain.sql` / `018_retire_pre_request_chains.sql` — a Fetch-tab
feature letting a saved *request* run a chain instead of a pre-request script;
removed because "the JS/Chain chooser was removed"). **Do not name anything in
this feature "pre_request_chain"** — use "request chain" / "request-side chain"
terminology instead to avoid confusion with the retired concept. They are
unrelated: this feature is proxy-side and mapping-scoped, not Fetch-tab/request-scoped.

---

## 2. Design decision: keep the 3-node model (Entry / Response / Exit)

An earlier draft of this design proposed a 4th node type (`mapping-request-exit`)
as a dedicated terminal for the request side, mirroring `mapping-exit`. **This was
rejected.** Correct model, confirmed by the user:

- **Entry** — the request hitting the proxy. Already a source (real request);
  gains the ability to also be **overridden** via wired connections into its own
  ports (method/headers/body/url), exactly like Response already supports today.
  Entry's own (possibly-overridden) output **is** the request sent upstream —
  no separate terminal node.
- **Response** — the upstream reply. Unchanged. Already overridable; feeds Exit.
- **Exit** — unchanged. What's returned to the browser.

No new `StitchNodeType` variant. No new node constants/icons/colors. The only
node-level change is exposing named input ports on `mapping-entry` (see §5).

---

## 3. The core mechanism: two independent "needs chain" flags

Replace the single always-pause `use_chain` behavior with two independently
computed booleans, stored per-mapping:

- **`needs_request_chain`** — true only if something is wired into one of
  Entry's override ports. If true, `handle_request()` must pause and run the
  request segment before forwarding upstream.
- **`needs_response_chain`** — true only if Response's own ports are wired, or
  Exit is fed by anything other than the default 1:1 passthrough from Response.
  If true, `handle_response()` pauses and runs the response segment (this is
  today's existing, only, pause path).

Both computed automatically (no manual toggle in v1) whenever the chain is
saved, and self-healed on load for legacy chains (mirrors how
`ensureMappingChainUpToDate` already self-heals older chains today).

### Detection algorithm (pure function, no I/O)

```
analyzeMappingChainRequirements(nodes, connections): { needsRequestChain: boolean; needsResponseChain: boolean }

entryNode = nodes.find(n => n.type === 'mapping-entry')
responseNode = nodes.find(n => n.type === 'mapping-response')
exitNode = nodes.find(n => n.type === 'mapping-exit')

needsRequestChain =
  connections.some(c => c.targetNodeId === entryNode.id)
  // Entry is both source AND (optionally overridden) sink for the request
  // side — no separate exit node, so "is entry touched at all" is sufficient.

needsResponseChain =
  connections.some(c => c.targetNodeId === responseNode.id)
  || !isDefaultResponseToExitWiring(exitNode, responseNode, connections)

isDefaultResponseToExitWiring(exitNode, responseNode, connections):
  incoming = connections.filter(c => c.targetNodeId === exitNode.id)
  canonicalKeys = ['status', 'headers', 'body', 'cookies']
  // true only if every incoming connection to Exit is *exactly* a 1:1
  // passthrough from Response (same key in as out), covering some subset of
  // the canonical keys, and nothing else targets Exit.
  return incoming.every(c =>
    c.sourceNodeId === responseNode.id
    && c.sourceKey != null
    && (c.targetSlot === c.sourceKey || c.targetSlot === null)
    && canonicalKeys.includes(c.sourceKey)
  )
```

Note the asymmetry is intentional: Entry has no separate exit node (it IS the
sink), so its check is a simple "any incoming connection". Response's segment
must additionally check the Response→Exit wiring, because Response's overridden
output still has to travel through a separate node (Exit) to matter.

This is a **v1 heuristic** — flag explicitly in code comments that edge cases
(e.g. a custom node sitting between Response and Exit but coincidentally
producing identical values) will be classified as "needs pause" (safe/conservative
false-positive direction, never a false negative that silently skips a real
transform).

---

## 4. Phase 1 — Analyzer + gate the *existing* response pause

**Goal:** ship the latency win for the pause mechanism that already exists,
with zero new Rust plumbing. This alone benefits every existing `use_chain`
mapping that hasn't customized Response→Exit.

### 4.1 New pure analyzer function
- New file (or add to existing utils, implementer's judgement — e.g.
  `src/lib/stitchEngine/mappingChainAnalysis.ts`) exporting
  `analyzeMappingChainRequirements(nodes, connections)` per §3.
- Unit tests mirroring the style in
  [`src/lib/stitchMappingMigration.test.ts`](../src/lib/stitchMappingMigration.test.ts)
  and [`src/lib/stitchEngine.test.ts`](../src/lib/stitchEngine.test.ts) — cover:
  fresh scaffold (both false), response-only customization (response=true,
  request=false), a custom node between Response and Exit even without touching
  Response's own ports (response=true), extra/missing Exit connections (response=true).

### 4.2 DB migration
- New file `src-tauri/migrations/021_mapping_chain_flags.sql`:
  ```sql
  ALTER TABLE mappings ADD COLUMN needs_request_chain INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE mappings ADD COLUMN needs_response_chain INTEGER NOT NULL DEFAULT 1;
  ```
  Default `needs_response_chain = 1` preserves current always-pause behavior for
  existing rows until they're re-analyzed (see 4.3); `needs_request_chain = 0`
  is safe because the capability doesn't exist yet for any existing chain.
- Mirror the `ALTER TABLE ... ADD COLUMN` try/catch-if-exists pattern used in
  [`src/lib/db.ts`](../src/lib/db.ts) (search `use_chain` there) for the
  frontend-side idempotent migration if the project runs migrations from both
  sides (check `db.ts` around line 204 for the existing `use_chain` column-add
  pattern and replicate it).

### 4.3 Persist the flags whenever a chain changes
- Extend `ensureMappingChainUpToDate()` in
  [`src/lib/stitchMappingMigration.ts`](../src/lib/stitchMappingMigration.ts) (or
  add a sibling call right after it, wherever a mapping chain is loaded) to run
  the analyzer and persist results via `updateMapping(mapping.id, { needs_request_chain, needs_response_chain })`
  whenever they differ from the stored values. This makes legacy chains
  self-heal exactly like the existing wiring migrations do.
- Also recompute + persist on every chain **save** — hook into wherever nodes/
  connections get written for a mapping-bound chain (`useStitchAutoSave` /
  `stitchStore.ts`'s node/connection mutation actions that already know
  `chains.find(c => c.id === activeChainId)?.mappingId`).

### 4.4 Extend `Mapping` type + DB layer
- [`src/lib/db.ts`](../src/lib/db.ts): add `needs_request_chain: boolean`,
  `needs_response_chain: boolean` to the `Mapping` interface.
- [`src/lib/mappings.ts`](../src/lib/mappings.ts): add to `RawMapping`,
  `deserializeMapping`, `updateMapping`'s allowed `changes` keys + `boolToInt`
  mapping, and `syncMappingsToProxy`'s per-mapping payload object (the arrow
  function passed to `syncToProxy('sync_mappings', 'mappings', mappings, (m) => ({...}))`).

### 4.5 Rust: add fields + gate the existing pause
- [`src-tauri/src/proxy/types/mappings.rs`](../src-tauri/src/proxy/types/mappings.rs):
  add `pub needs_request_chain: bool` and `pub needs_response_chain: bool` to
  `MappingRule` (use `#[serde(default)]` like `use_chain` already does, for
  backward-compat with any stale in-flight payload during the transition).
- [`src-tauri/src/proxy/handler.rs`](../src-tauri/src/proxy/handler.rs) line
  ~593: change `let chain_applied = if mapping.use_chain {` to
  `if mapping.use_chain && mapping.needs_response_chain {`. No other change
  needed here for Phase 1 — this alone makes the existing pause conditional.

### 4.6 Validation
- `npx tsc -b` + `npx vitest run` (frontend). `cargo check` + `cargo test` (Rust,
  via the execution_subagent per this repo's established workflow).
- Manually verify: a mapping with a fresh/untouched chain no longer pauses on
  response (check via existing debug logging / timing), a mapping with a
  Response→Exit customization still pauses exactly as before.

---

## 5. Phase 2 — Entry-side override ports + new request-side pause

**Goal:** the actual new capability — let a chain rewrite the outbound request
before it's forwarded upstream, only pausing when something is actually wired
into Entry.

### 5.1 Expose Entry's override ports in the UI
- [`src/components/StitchView/utils/nodeOutputKeys.ts`](../src/components/StitchView/utils/nodeOutputKeys.ts):
  add `export const MAPPING_ENTRY_INPUT_KEYS = ['method', 'headers', 'body', 'url'] as const;`
  (no `cookies` — Entry already parses cookies from the `headers.Cookie` value,
  same reasoning as why Response has no `status` override port). Update
  `getNodeInputKeys()`:
  ```ts
  if (node.type === 'mapping-entry') return [...MAPPING_ENTRY_INPUT_KEYS];
  ```
  `MAPPING_PORT_LAYOUT` already includes `method` and `url` at the right
  positions — no change needed there, ports will align automatically.
- [`src/components/StitchView/components/StitchCanvas.tsx`](../src/components/StitchView/components/StitchCanvas.tsx):
  the connection-drop "replace existing connection to this named port" guard
  currently only checks `targetNode?.type === 'mapping-exit' || targetNode?.type === 'mapping-response'`
  (search `handleConnectionDrop`) — add `'mapping-entry'` to that list so
  rewiring an already-occupied Entry port correctly replaces the old connection
  instead of stacking duplicates.
- No changes needed to `StitchEditorPanel.tsx`/`StitchNode.constants.tsx` — Entry
  keeps its existing icon/color/label; only its port set changes.

### 5.2 New "request segment" executor (slice, don't reuse the full mapping executor)
`executeMappingNode()` runs entry+response+exit+customs together — that's still
correct for the *response-side* pause (all data is available by then). But the
new *request-side* pause fires before the response exists, so it must only run
the subset of the graph that Entry (transitively) depends on.
- New function in `mappingExecutor.ts` (or a new sibling file), e.g.
  `executeMappingEntrySegment(mappingNode, input, allNodes, allConnections, envVariables, callbacks, cancelledRef): Promise<{ method, url, headers, body }>`.
- Needs a graph-slicing helper: "given a target node id, return it plus every
  node that transitively feeds into it" (BFS backward through connections).
  Add as a small exported utility (e.g. `getUpstreamNodes` in a new
  `graphSlicing.ts`, or alongside `topologicalSort.ts`) — reusable, testable in
  isolation.
- Reuse the **same child-discovery filter** already fixed in `executeMappingNode`
  (`n.parentNodeId === mappingNode.id || n.parentNodeId === null`) before
  slicing, so behavior stays consistent with the response-side executor for
  legacy vs. current node shapes.
- Reuse the **same per-node try/catch + `onError` reporting pattern** already
  added to `executeMappingNode` (tag rethrown errors with
  `stitchErrorReported` so `chainExecutor.ts`'s outer catch doesn't
  misattribute the error if this ever also runs through the manual Play path).
- The existing `resolveNodeInputs` fix (single-port source wired into a named
  slot unwraps a matching key) already makes "JS Snippet → Entry.url" work
  correctly — no changes needed there, just be aware it's what makes the
  intended UX ("destructure X, return `{ X }`") function.

### 5.3 Rust: new request-side pause mechanism (mirrors the existing response one)
- [`src-tauri/src/proxy/types/chain.rs`](../src-tauri/src/proxy/types/chain.rs):
  add parallel types:
  ```rust
  #[derive(Clone, Serialize)]
  #[serde(rename_all = "camelCase")]
  pub struct ChainRequestExecutionEvent {
      pub request_id: String,
      pub chain_id: String,
      pub mapping_id: String,
      pub method: String,
      pub host: String,
      pub path: String,
      pub headers: HashMap<String, String>,
      pub body: String,
  }

  pub struct ChainRequestResult {
      pub method: String,
      pub url: String,
      pub headers: HashMap<String, String>,
      pub body: String,
  }

  pub type ChainRequestRegistryRef = Arc<Mutex<HashMap<String, oneshot::Sender<Option<ChainRequestResult>>>>>;
  pub type ChainRequestEmitFn = Arc<dyn Fn(&ChainRequestExecutionEvent) + Send + Sync + 'static>;
  ```
- [`src-tauri/src/commands/chain_commands.rs`](../src-tauri/src/commands/chain_commands.rs):
  add `resume_chain_request`, mirroring `resume_chain` exactly (same
  success/None-on-failure fallthrough semantics), resolving a
  `ChainRequestRegistryRef` entry instead.
- [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs): mirror the existing chain
  registry setup block (search `chain_registry_ref` / `ChainRegistryState` /
  `ChainTimeoutState`, ~line 307) — add `chain_request_registry_ref`,
  `ChainRequestRegistryState`, and reuse the same `chain_timeout_ref` (one
  shared configurable timeout is fine, no need for a second one) or add a
  parallel `ChainRequestTimeoutState` if independent tuning is wanted later.
  Register `resume_chain_request` in the command handler list next to
  `commands::resume_chain`. Build the `chain_request_emit_fn` the same way
  `chain_emit_fn` is built (`make_emit(app.handle(), "mapping:chain-execute-request")`).
- [`src-tauri/src/proxy/handler.rs`](../src-tauri/src/proxy/handler.rs)
  `handle_request()`: mapping matching currently only happens in
  `handle_response()` (`matched_mapping` search by URL). For the request-side
  pause, matching must happen **here**, in `handle_request`, using the
  already-available `method`/`host`/`path` (before forwarding). Add a pause
  branch mirroring the existing `handle_response` one:
  1. Find a mapping with `use_chain && needs_request_chain` matching this URL.
  2. Register a oneshot in `chain_request_registry`, emit
     `mapping:chain-execute-request` with the captured request-side fields.
  3. Await the oneshot (respecting the shared timeout pattern already used for
     `chain_registry`/`pause_registry`).
  4. On `Some(result)`: apply `result.method`/`result.url`/`result.headers`/
     `result.body` to `parts` before forwarding — same technique `url_remap`
     already uses (`parts.uri = new_uri.parse()...`, `parts.headers.insert(...)`),
     plus replacing the body (need to rebuild the `Body`/`Bytes` the same way
     the existing body-buffering code in `handle_request` already does).
  5. On `None` (failure/timeout): forward the original, unmodified request
     (identical fallthrough semantics to the response side).

### 5.4 Frontend: new request-side listener
- New hook (e.g. `useChainRequestExecutionListener.ts`, sibling to
  [`src/hooks/useChainExecutionListener.ts`](../src/hooks/useChainExecutionListener.ts))
  or extend the existing one to also `useTauriListener('mapping:chain-execute-request', ...)`.
  Mirror the existing handler's structure: load chain via `loadChainWithNodes`,
  run `ensureMappingChainUpToDate`, find the mapping node, call
  `executeMappingEntrySegment(...)` (§5.2), `invoke('resume_chain_request', {...})`
  on success, same try/catch-and-signal-failure fallthrough as the existing
  listener on error.
- Mount it in the same place as the existing listener (`AppTabs.tsx`,
  `useChainExecutionListener()` call site) so it's always active regardless of
  which tab is open.
- Reuse the same `isActiveChain` / "adopt if nothing is active yet" logic
  already fixed in `useChainExecutionListener.ts` for visual feedback
  consistency (executionCurrentNodeId/executionNodeOutputs updates so the
  canvas highlights Entry's segment live, same UX as the response side today).

### 5.5 Validation
- `cargo check` + `cargo test` for the new Rust types/command/handler branch.
- New frontend tests: `executeMappingEntrySegment` unit tests (mirrors the
  `mapping container execution` describe block in `stitchEngine.test.ts`) —
  cover: no wiring (returns real request untouched), JS Snippet wired into
  Entry.url (returns overridden url, real method/headers/body untouched),
  error inside the segment (reports via `onError` against the real failing
  node, not the mapping container).
- `useChainRequestExecutionListener.test.tsx` mirroring
  `useChainExecutionListener.test.tsx`'s existing test structure.
- End-to-end manual check via `yarn tauri dev`: a mapping with only Entry
  customized should show request-side pause latency but zero response-side
  latency (and vice versa for a Response-only mapping), matching the 4 mockup
  scenarios in `docs/stitch-3-node-mockup.html`.

---

## 6. Explicitly out of scope (this PRD covers Phase 1 & 2 only)

- **Phase "polish"**: visual badges on the canvas showing which segment is
  live vs pass-through (mockup exists in `docs/stitch-3-node-mockup.html`,
  discussed but not scheduled).
- **Manual testing/replay of the request segment** from the Stitch UI without a
  live proxy hit (would be a nice companion to the existing per-node "Replay"
  feature, but needs design of its own — what "last input" would Entry replay
  against outside of a live request?).
- **Per-mapping independent timeout tuning** for the new request-side pause
  (defaulted to reuse the existing shared `chain_timeout` in this PRD).
- **Manual override of the auto-computed flags** (v1 is fully inferred, no UI
  toggle to force a pause/skip regardless of wiring).

## 7. Open questions to confirm with the user before/while implementing

1. Should `method` really be overridable on Entry, or should Entry stay
   read-only for `method` (mirroring how Response has no `status` override)?
   Current design includes it — flagged here since it wasn't explicitly
   confirmed, unlike headers/body/url.
2. Is reusing the single shared `chain_timeout` for both pause phases
   acceptable, or should the request-side pause get its own configurable
   timeout from the start?
3. Confirm migration number `021` is still free at implementation time (check
   `src-tauri/migrations/` for anything added since this PRD was written).
