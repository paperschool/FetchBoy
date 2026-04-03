# Long Changelog

## [0.19.2] - 2026-04-03

- feat: moved PreRequestDebugLog from standalone panel in MainPanel into ScriptsTab — debug output now renders inline below the Monaco editor when script status is non-idle, with scriptDebugState and onDebugClose props threaded through RequestDetailsAccordion
- feat: added `scriptKeepOpen` boolean to RequestSnapshot — "Keep Open" checkbox in ScriptsTab prevents accordion from closing on send; useSendRequest switches to scripts tab instead of collapsing when enabled
- feat: restructured ScriptsTab layout to horizontal `[sidebar | editor+debug]` — collapsible 256px sidebar with PanelLeftOpen/PanelLeftClose toggle contains save-as-template form and embedded ScriptTemplatePanel; ScriptTemplatePanel gains `embedded` prop to skip outer chrome
- fix: environment variables set via `fb.env.set()` during pre-request script execution now re-interpolate in the current request — useSendRequest reads fresh variables from useEnvironmentStore.getState() after script completes instead of using stale `applyEnv` closure
- fix: `usePreRequestScript` env mutation persistence no longer throws "Attempted to assign to readonly property" — shallow-copied immer-frozen variable objects with spread before mutating; registered migration 013 (script_templates table) in db.rs

## [0.19.1] - 2026-04-02

- feat: comprehensive i18n `t()` migration across 38 component files — replaced hardcoded English text with typed translation keys in SettingsPanel, AuthPanel, BreakpointEditor, MappingEditor, InterceptTopBar, CertificateManagement, PausedRequestDetail, TabContextMenu, InterceptTable, InterceptSidebar, RequestDetailView/Headers/Body, HistoryPanel, CollectionTree, Debug tables, ResponseViewer, all Save dialogs, EnvironmentPanel, MainPanel, RequestDetailsAccordion, KeyValueRows, MappingCookieEditor, MappingLogTable, AppTabs, StitchSidebar/EmptyState, BreakpointsTree, MappingsTree, SettingsAccordion, Sidebar, TopBar, WhatsNewModal, KeyboardShortcutsModal
- feat: ~378 translation keys across 14 namespace files — added keys for intercept (28 new), breakpoints (10 new), mappings (10 new), stitch (11 new), common (6 new), fetch (18 new), collections (8 new), settings (3 new), history (3 new)
- fix: loop/mapping container node drag no longer causes child nodes to wiggle — removed the 200ms rebalance timer from `handleUpdatePosition` that fired mid-drag, added `handleContainerDragEnd` callback that triggers rebalance only on pointer release via new `onDragEnd` prop on StitchLoopNode and StitchMappingNode
- feat: stitch node execution success highlight now fades out with a 3s `stitch-success-fade` CSS animation — holds bright green-400 glow for 60% of duration then smoothly fades to transparent, replacing the abrupt static highlight
- fix: mapping-exit node no longer renders an output port dot — terminal node in the mapping chain has no downstream connections

## [0.19.0] - 2026-04-02

### Epic 16: Code Quality Hardening, Constants, & Localisation

- refactor: created 4 Tauri IPC wrapper hooks (useProxyConfig, useCertificateManagement, useBreakpointMatching, useSystemOperations) — eliminated all direct `invoke()` calls from component files, routing through hooks per DIP
- refactor: created 3 shared hooks (useAutoSave, useEventBuffer, useInlineRename) with 22 tests — replaced duplicated debounce/buffer/rename patterns in 5 consumer files; created UrlPatternInput and InlineEditableText shared UI components
- refactor: decomposed stitchEngine.ts (885 lines) into 14 focused modules under `src/lib/stitchEngine/` with barrel export preserving public API; decomposed useSendRequest.ts into interpolateRequest, usePreRequestScript, useHistoryPersistence composition hooks
- refactor: decomposed Rust types.rs (613 lines) into 8 module files under `src-tauri/src/proxy/types/`; introduced MatchType enum replacing stringly-typed match dispatching; replaced 16 Mutex `.unwrap()` calls with `.expect("context")` — 4 provably-safe unwraps remain with safety comments
- feat: i18n foundation — `t(key, params?)` helper with TypeScript-enforced keys, interpolation support, 14 namespace files populated with ~260 domain strings across all feature areas; constants.ts expanded with TIMEOUTS, PROGRESS, UI_DIMENSIONS, CANVAS, SETTINGS_DEFAULTS sections
- refactor: renamed `Intercept view/` directory to `InterceptView/` with all imports updated; extracted StitchNode constants, TabBar context menu, nodeFactory utility; 66 new tests added (hooks, urlUtils, arrayHelpers, urlPatternConfig, i18n)

## [0.18.19] - 2026-04-01

- feat: import post-processing pipeline — flatten single-child folder chains, depth limiting, folder selection checkboxes, and structural merge of same-named folders across branches
- feat: import options UI in ImportWizard preview step — collapsible panel with four toggleable options, live-updating folder/request counts, and "was X / Y" diff indicator
- fix: empty folders left behind after depth-limiting and folder filtering — moved prune step to run unconditionally as the final pipeline stage
- fix: global name merge incorrectly conflated folders from different categories (e.g. "USAT" under "Action Shots" merged with "USAT" under "Player Headshots") — switched to relative-path merge keys that preserve category context
- feat: merged folders renamed to full relative path (e.g. "USAT" becomes "Action Shots / USAT") so names are self-describing without parent context

## [0.18.18] - 2026-04-01

- feat: auto-save mapping editor with debounced writes and saving/saved status indicator
- feat: save-to-file button on Monaco editors in fetch response, intercept detail, and mapping body views
- fix: hide size, type, and time columns in intercept table at tablet width (<768px)
- feat: inject app version into window title via Vite build plugin
- refactor: replace manual save button in mapping editor with `silentSave` store action and dirty-flag pattern

## [0.18.17] - 2026-04-01

### Story 15.16: Proxy-Triggered Mapping Chain Execution

- Mappings with `use_chain=true` now trigger Stitch chain execution when the proxy intercepts a matching request
- Proxy pauses the response, emits `mapping:chain-execute` event to the frontend with intercepted request data (status, headers, body)
- Frontend listener loads chain from DB, executes the mapping container node, and sends the result back via `resume_chain` command
- Chain result (status, headers, body, content-type) replaces the response; static mapping rules are skipped when chain is active
- Configurable chain execution timeout (default 30s); on timeout/error the proxy falls through to the original response
- `ChainRegistryRef` and `ChainTimeoutRef` added to Rust proxy state (same oneshot pattern as breakpoint pause/resume)
- New `chain_commands.rs` with `resume_chain` Tauri command
- `useChainExecutionListener` hook mounted globally in AppTabs (always active, not just when Stitch tab is visible)
- `syncMappingsToProxy` now includes `use_chain` and `chain_id` fields in the proxy sync payload
- Mapping activity log shows "chain" override type (W icon, yellow) when chain-based mapping fires
- 4 new Rust tests: chain event serialization, MappingRule with/without chain fields, chain registry round-trip
- 4 new frontend tests: listener registration, successful chain execution, chain error fallback, missing mapping node fallback

## [0.18.16] - 2026-03-31

### Story 15.15: Mapping Chain Node (Revised — Mapper-Bound)

- Mapping chains are created from the mapper editor via "Use Chain" toggle, not from Add Node menu
- Removed mapping from AddNodeMenu and canvas context menu
- Changed mapping node colors from teal to yellow
- "Use Chain" toggle in mapper editor Match tab creates bound Stitch chain with mapping container + entry/exit nodes
- `use_chain` and `chain_id` fields added to Mapping DB/type; `mapping_id` added to StitchChain
- DB migration 012: adds use_chain, chain_id to mappings table and mapping_id to stitch_chains
- Mapper-bound chains show Workflow badge in Stitch sidebar entries
- MappingRow shows Workflow icon when use_chain is active
- Chain 1:1 bound to mapper via mappingId

## [0.18.15] - 2026-03-31

### Story 15.15: Mapping Chain Node

- New container-style "Mapping" node (teal color, `Globe` icon) with enforced Entry and Exit child nodes
- Entry node outputs `status`, `headers`, `body` from intercepted request data (keyed output ports)
- Exit node editor: status code, headers KV list, body with `{{key}}` interpolation, content type
- Mapping container editor: URL pattern input with match type selector (exact/partial/wildcard/regex)
- `StitchMappingNode` container component following `StitchLoopNode` pattern — dynamic bounds, no child limit
- `computeMappingChildPositions` layout utility: entry pinned left, exit pinned right, user nodes between
- `executeMappingNode` engine: sorts children topologically, runs entry → chain → exit, returns exit output
- Entry/exit nodes undeletable; deleting container removes all children
- Container drag moves all children; containment check supports both loop and mapping containers
- 5 new engine tests: entry passthrough, exit interpolation, container execution, input propagation

## [0.18.14] - 2026-03-31

### Story 15.14: Conditional Branching Node

- New "Condition" node type evaluates JS expression against input, routes to `true` or `false` output port
- `executeConditionNode` using `new Function('input', ...)` with boolean coercion
- `computeSkippedNodes` DFS-based reachability analysis: skips nodes exclusively on the inactive branch, preserves convergence points
- Branch skipping integrated into `executeChain` via dynamic `skippedNodeIds` set
- Skipped nodes logged with 'skipped' status but not executed
- `ConditionNodeEditor` with Monaco JS expression editor and input hint
- Condition node renders with two named output ports (true/false) in orange color scheme
- Debug log: "→ true" / "→ false" badge on condition entries, dimmed styling for skipped entries
- `resolveNodeInputs` gracefully skips missing source outputs (from skipped branches)
- 9 new tests: condition evaluation, branch skipping, convergence, chained conditions, computeSkippedNodes

## [0.18.13] - 2026-03-31

### Story 15.13: Parallel Branch Execution & Merge Node

- Parallel execution: nodes at the same topological depth with no inter-dependencies run via `Promise.all`
- Error isolation in parallel branches: failed branch stores `null` output, other branches continue
- `groupByDepth` function computes topological depth for parallel grouping
- New "Merge" node type collects all incoming connections into a single keyed object (key = source label or ID)
- `MergeNodeEditor` with key mode toggle (label vs ID naming)
- Merge node added to all type maps, menus, and canvas context menu (indigo color scheme)
- Debug log shows "parallel" badge on concurrent execution entries
- `parallel` flag added to `ExecutionLogEntry` type
- 6 new tests: groupByDepth, parallel execution, error isolation, merge node (label + ID modes)

## [0.18.12] - 2026-03-31

### Story 15.12: Chain Persistence & Management

- Extracted sidebar into dedicated `StitchSidebar` + `StitchSidebarEntry` components
- Chain list sorted by most recently updated, with date display and active indicator
- Context menu (right-click / kebab) with Rename, Duplicate, Delete actions
- Inline rename via double-click on chain name in sidebar and header bar
- Delete confirmation dialog; auto-loads next chain after deletion
- `duplicateChain` db helper using `withTransaction()` for atomic deep copy with remapped node/connection IDs
- `useStitchAutoSave` hook: debounced 1000ms safety-net persist + Cmd+S immediate save with "Saving..." indicator
- Chain header bar showing active chain name (editable) and save status
- `StitchEmptyState` component for no-chain and no-nodes states with create CTA
- 8 new sidebar tests covering list rendering, sorting, active highlight, delete dialog, collapsed state

## [0.18.11] - 2026-03-31

### Story 15.11: Node Result Preview

- Eye icon button on each StitchNode title bar opens last execution output in a read-only Monaco JSON panel
- Button enabled/disabled based on whether execution output exists for the node
- `StitchPreviewPanel` component with formatted JSON display, node label in header, and close button
- Toggle behavior: clicking preview while already previewing switches back to editor mode
- "No results yet — run the chain to see output" empty state when no execution data exists
- `formatNodeOutput` utility for JSON.stringify with null/error handling
- Store additions: `previewNodeId`, `setPreviewNode()`, `clearPreview()` in stitchStore
- Preview auto-clears on node selection and execution start
- 12 new tests: 7 for formatNodeOutput, 5 for StitchPreviewPanel

## [0.18.9] - 2026-03-31

### Story 15.9: Chain Execution Engine

- `stitchEngine.ts` execution engine with topological sort (Kahn's algorithm), cycle detection, and sequential node execution with callbacks
- Four node executors: JSON Object (parse), JS Snippet (`new Function` sandbox), Request (Tauri `send_request` with `{{key}}` interpolation), Sleep (fixed/random delay with cancellation check)
- Input resolution maps connection source outputs to downstream node inputs
- `ExecutionContext` tracks per-node outputs, timestamped logs, and error state
- Cancellation support via shared ref checked between node executions
- Store wiring: `startExecution()` resolves env vars and runs chain, `cancelExecution()` sets flag
- 23 unit tests covering topo sort, input resolution, all node executors, and chain integration

### Story 15.10: Play Mode & Debug Interface

- Play/Stop toolbar buttons in StitchCanvas with state-dependent visibility
- Node execution highlighting: pulsing blue border (running), green border (success), red border (error) via CSS animations
- `StitchDebugLog` panel with timestamped entries, collapsible input/output JSON, auto-scroll, and error highlighting
- Bottom panel switches between node editor and debug log based on execution state
- Debug log dismissible via close button or node selection
- 9 new component tests for debug log rendering, error display, and user interactions

## [0.18.7] - 2026-03-31

### Story 15.8: Node Editor Panel

- `StitchEditorPanel` unified container with header (type icon + label + close button) and type-based editor routing
- Removed duplicate headers from individual editors (JsonObjectEditor, JsSnippetEditor, RequestNodeEditor, SleepNodeEditor)
- Sleep editor polished: centered layout with human-readable duration preview ("1.5 seconds", "0.5 – 2.0 seconds")
- Panel height transition smoothed with CSS `transition-[height]`
- StitchView simplified — delegates all editor rendering to StitchEditorPanel
- 6 new tests for panel routing, header rendering, and close behaviour

## [0.18.6] - 2026-03-31

### Story 15.7: Node Connection System

- Drag-to-connect wiring: drag from output ports to input slots creates persisted connections with bezier curves
- `ConnectionLine` SVG component with cubic bezier, four visual states (active/preview/selected/broken), and wide hit area for click targeting
- `ConnectionLayer` SVG overlay renders all connections aligned with canvas pan/zoom transform
- `StitchConnectionDragProvider` React context manages transient drag state (source, cursor position)
- `connectionValidator` rejects self-connections, duplicates, and cycles (DFS-based cycle detection)
- `getNodeOutputKeys` unified resolver delegates to type-specific extractors for broken connection detection
- Connection selection (click), deletion (Delete key or right-click), and broken connection indicators (dashed red lines when source key removed)
- Output ports enlarge on hover with crosshair cursor; input slots glow green when a valid drag is in progress
- Store extended with `selectedConnectionId` and `selectConnection` action
- 22 new tests across validator, nodeOutputKeys, ConnectionLine, ConnectionLayer, and StitchNode

## [0.18.5] - 2026-03-31

### Story 15.6: Sleep / Delay Node

- `SleepNodeConfig` type with fixed/random modes, duration, min/max milliseconds
- Sleep nodes display duration summary on canvas body (`1000ms` or `500–2000ms`) in purple monospace
- `SleepNodeEditor` panel with Fixed/Random mode toggle, numeric inputs with validation (min ≤ max, 0–60000ms cap)
- Editor panel routing now opens for all node types (simplified `showEditor` logic)
- 7 new tests for editor modes, validation, and mode switching

## [0.18.4] - 2026-03-31

### Story 15.5: Request Node

- `RequestNodeConfig` type with method, URL, headers, query params, body, and body type fields
- Request nodes display a coloured method badge (GET=green, POST=blue, etc.) and truncated URL preview on the canvas
- Static output ports (`status`, `headers`, `body`) with blue-tinted port indicators
- `RequestNodeEditor` panel reusing Fetch tab's `KeyValueRows` and `HighlightedUrlInput` — no new custom components, no Fetch tab modifications
- Tabbed editor: Headers, Query Params, Body (with body type selector and Monaco editor)
- `{{variable}}` highlighting shows both connected input keys and active environment variables
- 9 new tests for editor panel and output port resolver

## [0.18.3] - 2026-03-31

### Story 15.4: JS Snippet Node with Real-Time Key Export

- `JsSnippetNodeConfig` type with default transform template code
- `extractReturnKeys()` static analysis — regex-based extraction of top-level keys from `return { ... }` statements (handles shorthand, spread, nested, quoted keys)
- `resolveInputShape()` utility derives available input keys from incoming connections (shared infra for all node types)
- JS Snippet nodes display extracted return keys as amber-tinted output port indicators
- `JsSnippetEditor` panel with input shape bar, Monaco JS editor (debounced 300ms), and live exports summary
- Editor panel routing in StitchView — type-based switch renders `JsonObjectEditor` or `JsSnippetEditor`
- StitchNode body/port rendering generalised — both json-object and js-snippet use unified dynamic port logic with type-specific colours
- 24 new tests (key extractor, input shape resolver, editor panel)

## [0.18.2] - 2026-03-31

### Story 15.3: JSON Object Seed Node

- `JsonObjectNodeConfig` type with default `{ json: '{\n  "key": "value"\n}' }` seed content
- `extractJsonKeys()` utility parses JSON and extracts top-level object keys with error reporting
- JSON Object nodes display extracted keys as labelled output port indicators with green-tinted badges
- Invalid JSON shows an inline red error indicator on the node; ports clear until JSON is valid
- `JsonObjectEditor` panel with Monaco JSON editor (debounced 300ms), live "Exports" key summary
- Bottom editor panel split in StitchView — appears when a JSON Object node is selected
- 15 new tests (key extractor, editor panel, node port rendering)

## [0.18.1] - 2026-03-31

### Story 15.2: Node Canvas with Drag & Positioning

- CSS transform-based canvas with pan (click-drag) and zoom (scroll wheel, 25%–200%) for spatial node arrangement
- `StitchNode` component with type-specific icons and colour coding, inline label editing (double-click), selection highlight, and port indicators
- Node dragging via pointer events on title bar with zoom-corrected position math and SQLite persistence
- `AddNodeMenu` dropdown for creating Request, JS Snippet, JSON Object, and Sleep nodes with auto-incremented labels
- Node deletion via right-click context menu or Delete/Backspace key
- Canvas toolbar with Add Node button and zoom in/out/reset controls
- Chain sidebar now loads and highlights the active chain; selecting a chain renders its canvas

## [0.18.0] - 2026-03-31

### Story 15.1: Stitch Data Model, Store & Tab Shell

- SQLite migration `010_stitch.sql` creates `stitch_chains`, `stitch_nodes`, and `stitch_connections` tables with cascade deletes
- TypeScript types and raw DB row interfaces in `src/types/stitch.ts`
- DB helper functions (`loadChains`, `loadChainWithNodes`, CRUD for chains/nodes/connections) in `src/lib/stitch.ts`
- Zustand + Immer store (`useStitchStore`) with full chain/node/connection state management and SQLite persistence
- "Stitch" tab added to top-level tab bar between Intercept and Debug, rendering a placeholder canvas view with chain list sidebar
- Chains load from SQLite on StitchView mount

## [0.17.7] - 2026-03-31

- feat: small tweaks and visual improvements to splash screen.

## [0.17.6] - 2026-03-30

### Improvements

- Breakpoint editor: contextual match type descriptions below the selector buttons; debounced history match counter invokes Rust `match_breakpoint_url` against intercepted requests
- Urgency progress bar fixed — `!editMode` guard removed so the bar appears during pauses; bar now fills left-to-right with a thicker 6px track
- "Add Breakpoint" button conditionally hidden in `RequestDetailView` when `pauseState !== 'idle'`; paused container uses `rounded` + `overflow-hidden` instead of `rounded-lg`
  - Files changed: `BreakpointEditor.tsx`, `PausedRequestDetail.tsx`, `RequestDetailView.tsx`, `InterceptView.tsx`
  - Breaking changes: no

## [0.17.5] - 2026-03-30

### Improvements

- GitHub release version check via `fetchLatestRelease()` in `appVersion.ts` — semver comparison drives button state in GeneralSettings (idle/checking/up-to-date/available/error) and update banner in WhatsNewModal
- Auth fields (`token`, `username`, `password`, `key`, `value`) now interpolated through `applyEnv()` in `useSendRequest.ts` before being sent to Rust, fixing 401s when credentials use `{{variable}}` placeholders
- Debug events emitted from `useSendRequest.ts` at every stage of the fetch lifecycle (send, resolve, pre-request script, response, cancel, timeout, error) with source `"fetch"`
- Breakpoints and mappings tree headers (`BreakpointsTree.tsx`, `MappingsTree.tsx`) restyled to match collection tree — green Create icons, import section commented out with TODO
- `Collection-Generation-Prompt.md` updated: asks for API reference before generating, documents `secret` field, protocol auto-prepend behaviour, and environment round-tripping
  - Files changed: `appVersion.ts`, `GeneralSettings.tsx`, `WhatsNewModal.tsx`, `useSendRequest.ts`, `BreakpointsTree.tsx`, `MappingsTree.tsx`, `ImportWizard.tsx`, `Collection-Generation-Prompt.md`
  - Breaking changes: no

## [0.17.2] - 2026-03-28

### Epic 15: Pre-request Scripts

- QuickJS WASM sandbox executes JavaScript before each request with `fb.env`, `fb.request`, and `fb.utils` API (uuid, timestamps, base64, sha256, hmacSha256)
- New "Scripts" tab in Request Details with Monaco JS editor, enable/disable toggle, and inline API cheatsheet
- Postman v2.1/v1 importers now extract pre-request scripts; FetchBoy export/import round-trips script fields
- DB migration `009`: `pre_request_script` and `pre_request_script_enabled` columns on requests

## [0.17.0] - 2026-03-27

### Epic 14: Bug Fixes, UX Refinements & Collection Import

- Hardened proxy shutdown with port-release verification, "Stopping..." UI state, and fixed disabled breakpoints/mappings not syncing to backend
- Import wizard for Postman (v1, v2.0, v2.1) and Insomnia (v4) collections with environment extraction, collection-environment binding, and version-specific format selection
- Environment variable validation indicators (green/red ring) on header and query param inputs, plus clickable quick-add for unresolved `{{variables}}` from the URL bar
- "Open in Fetch" info banner in Request Details, cursor-pointer audit across intercept sidebar, and reorganised collection header actions
- DB migration: `default_environment_id` on collections — auto-switches environment when loading requests from a bound collection

## [0.16.0] - 2026-03-27

### Epic 13: Code Quality & Architecture Remediation

- Split proxy, MainPanel, RequestDetailView, InterceptSidebar, and CollectionTreeState into modular files; unified breakpoints/mappings DB layer and store CRUD patterns
- Created shared utilities (`arrayHelpers`, `constants`, `useTauriListener`, `validators`, `dbHelpers`) reducing duplication across stores and hooks
- Type safety hardening: type guards replacing unsafe `as` casts, strict null checks in `useActiveTabState` and `requestSnapshotUtils`
- Error boundaries wrapping all major panels, toast notification system, and SQLite transaction helper (`withTransaction`)
- Removed legacy dual event emission from proxy handler; virtualised debug tables for performance

## [0.15.12] - 2026-03-27

### Improvements

- **Story 13.12**: TabBar selector optimization with `useShallow`; removed dead `buildSnapshotFromHistory`; added `name` field to `BreakpointRule` — pause events now show actual breakpoint names
  - Files changed: `TabBar.tsx`, `requestSnapshotUtils.ts`, `breakpoints.ts` (frontend); `types.rs`, `handler.rs` (Rust)
  - Breaking changes: no

## [0.15.11] - 2026-03-27

### Refactoring

- **Story 13.11**: Removed legacy dual event emission — deleted `InterceptEvent` struct, `EmitFn` type, and all combined event emissions from proxy handler; removed `intercept:request` listener from frontend
  - Files changed: `types.rs`, `handler.rs`, `server.rs`, `lib.rs`, `proxy_commands.rs` (Rust); `useInterceptEvents.ts` (frontend)
  - Breaking changes: no (split events were already the primary path)

## [0.15.10] - 2026-03-27

### Improvements

- **Story 13.10**: Error boundaries wrapping Fetch/Intercept/Debug/Sidebar panels; toast notification system; SQLite transaction for collection import; `withTransaction()` DB helper
  - Files changed: `ErrorBoundary.tsx`, `ToastContainer.tsx`, `toastStore.ts` (new); `dbHelpers.ts`, `importExport.ts`, `AppTabs.tsx`, `AppShell.tsx` (modified)
  - Breaking changes: no

## [0.15.9] - 2026-03-27

### Refactoring

- **Story 13.9**: Type safety hardening — created `validators.ts` with type guards; fixed non-null assertions in `useActiveTabState`; replaced unsafe `as` casts in `requestSnapshotUtils`, `AuthPanel`
  - Files changed: `validators.ts` (new); `useActiveTabState.ts`, `requestSnapshotUtils.ts`, `AuthPanel.tsx` (modified)
  - Breaking changes: no

## [0.15.8] - 2026-03-27

### Refactoring

- **Story 13.8**: Created shared utilities — `arrayHelpers.ts` (addWithMaxSize), `constants.ts` (max entries), `useTauriListener.ts` hook; updated 3 stores and reduced `useInterceptEvents` from 111→45 lines
  - Files changed: 3 new utilities; `debugStore.ts`, `mappingLogStore.ts`, `historyStore.ts`, `useInterceptEvents.ts` (modified)
  - Breaking changes: no

## [0.15.7] - 2026-03-27

### Refactoring

- **Story 13.7**: Split `useCollectionTreeState` (459 lines) into `useCollectionDragDrop`, `useCollectionInlineEdit`, `useCollectionCrud` — composition hook reduced to 84 lines
  - Files changed: `useCollectionTreeState.ts` (modified); 3 new hooks
  - Breaking changes: no

## [0.15.6] - 2026-03-27

### Refactoring

- **Story 13.6**: Unified store CRUD patterns — created `crudStoreHelpers.ts` with `saveEntity` and form→DB serializers; breakpointsStore 267→161 lines, mappingsStore 233→168 lines; added error rollback to toggle actions
  - Files changed: `crudStoreHelpers.ts` (new); `breakpointsStore.ts`, `mappingsStore.ts` (modified)
  - Breaking changes: no

## [0.15.5] - 2026-03-27

### Refactoring

- **Story 13.5**: Unified breakpoints/mappings DB layer — created `dbHelpers.ts` with `buildUpdate`, `insertOne`, `parseJsonField`, `syncToProxy`; replaced if-chain update patterns and unsafe JSON.parse casts across 5 files
  - Files changed: `dbHelpers.ts` (new); `breakpoints.ts`, `mappings.ts`, `collections.ts`, `importExport.ts` (modified)
  - Breaking changes: no

## [0.15.4] - 2026-03-27

### Refactoring

- **Story 13.4**: Refactored `RequestDetailView.tsx` (442→162) and `InterceptSidebar.tsx` (425→128); extracted shared `statusColors.ts`, `RequestDetailHeaders`, `RequestDetailBody`, `CertificateManagement`, `ProxyPortConfig` sub-components
  - Files changed: `RequestDetailView.tsx`, `InterceptSidebar.tsx`, `ResponseViewer.tsx`, `HistoryPanel.tsx` (modified); `statusColors.ts`, 4 new sub-components
  - Breaking changes: no

## [0.15.3] - 2026-03-27

### Refactoring

- **Story 13.3**: Refactored `MainPanel.tsx` from 1,019 to 219 lines — extracted `urlUtils.ts`, `useSendRequest` hook, `useProgressBar` hook, and `RequestDetailsAccordion` sub-component
  - Files changed: `MainPanel.tsx` (modified), `urlUtils.ts`, `useSendRequest.ts`, `useProgressBar.ts`, `RequestDetailsAccordion.tsx` (all new)
  - Breaking changes: no

## [0.15.2] - 2026-03-27

### Refactoring

- **Story 13.2**: Split `lib.rs` (947 lines) into 6 command modules + `platform.rs`; generic `make_emit<T>` factory replaces 5 `app_handle` clones; `lib.rs` reduced to 321 lines
  - Files changed: `src-tauri/src/lib.rs` (modified), `platform.rs`, `commands/mod.rs`, `commands/{proxy,cert,os,breakpoint,mapping,app}_commands.rs` (all new)
  - Breaking changes: no

## [0.15.1] - 2026-03-27

### Refactoring

- **Story 13.1**: Split `proxy.rs` (1,565 lines) into focused modules (`types.rs`, `url_matching.rs`, `handler.rs`, `server.rs`) with regex/wildcard pattern caching via `LazyLock<Mutex<HashMap>>`
  - Files changed: `src-tauri/src/proxy.rs` (deleted), `src-tauri/src/proxy/mod.rs`, `types.rs`, `url_matching.rs`, `handler.rs`, `server.rs` (all new)
  - Breaking changes: no
