# Project Spec: Fetch Boy — Lightweight API Client

## Overview

**Project Name:** Fetch Boy  
**Type:** Standalone Desktop Application  
**Version:** 1.0 (MVP)  
**Target Platforms:** Windows, macOS, Linux

Fetch Boy is a lightweight, cross-platform API client designed as a focused alternative to Postman. It strips away enterprise complexity in favour of a clean, fast, and intuitive experience for individual developers and small teams. The application runs entirely offline and stores all data locally.

---

## Problem Statement

Existing API clients like Postman have become bloated with team collaboration features, cloud sync requirements, and paywalled functionality that many developers don't need. Developers want a fast, no-account-required tool that lets them build, test, and organise HTTP requests without friction.

---

## Goals

- Provide a native-feeling, cross-platform desktop app with a minimal install footprint
- Allow developers to send HTTP requests and inspect responses with zero configuration
- Organise requests into collections for reuse across projects
- Support environment variables to allow switching between dev/staging/prod contexts
- Persist all data locally with no account or cloud dependency
- Ship an installer under 15MB

---

## Non-Goals (MVP)

- Team collaboration or shared workspaces
- Cloud sync or cloud storage of any kind
- GraphQL or gRPC support (post-MVP)
- Automated test runners or CI/CD integration (post-MVP)
- Mock server functionality (post-MVP)
- Plugin or extension system (post-MVP)

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| App shell | Tauri (Rust) | Native webview, tiny bundle, no Chromium |
| HTTP engine | `reqwest` (Rust) | Native requests, no CORS, full TLS control |
| Frontend | React + TypeScript | Component model, strong ecosystem |
| Build tool | Vite | Fast HMR, Tauri-native integration |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| UI components | shadcn/ui | Accessible, unstyled-by-default components |
| State management | Zustand + Immer | Lightweight, no boilerplate |
| Local database | SQLite via `tauri-plugin-sql` | Reliable local persistence |
| Code editor | Monaco Editor | Syntax highlighting for JSON/XML/HTML bodies |

---

## Core Features (MVP)

### 1. Request Builder
- HTTP method selector: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- URL bar with environment variable interpolation (e.g. `{{base_url}}/users`)
- Tabs for: Headers, Query Params, Body (raw/JSON/form-data/x-www-form-urlencoded), Auth
- Auth types: None, Bearer Token, Basic Auth, API Key (header or query)
- Send button triggers native Rust HTTP call via Tauri command

### 2. Response Viewer
- Status code, response time, and response size displayed prominently
- Body viewer with syntax highlighting (Monaco, read-only mode)
- Auto-detect and format JSON responses
- Headers tab showing all response headers
- Copy response body to clipboard

### 3. Collections
- Tree-based sidebar showing collections and nested requests
- Create / rename / delete collections and folders
- Save current request to a collection
- Drag-and-drop reordering of requests and folders
- Import/export collections as JSON

### 4. Environments
- Create named environments (e.g. Development, Staging, Production)
- Define key-value variable pairs per environment
- Active environment selector in the top bar
- Variables interpolated in URL, headers, and body at send time
- Export/import environments as JSON

### 5. Request History
- Automatic log of all sent requests (last 200 entries)
- Displays method, URL, status code, and timestamp
- Click any history entry to restore it as the current request
- Clear history option

### 6. Application Settings
- Theme toggle: light / dark / system
- Default request timeout (ms)
- SSL certificate verification toggle (disable for local dev)
- Font size for editor panels

---

## Data Models

### Request
```
id: string (uuid)
collection_id: string | null
folder_id: string | null
name: string
method: string
url: string
headers: KeyValuePair[]
query_params: KeyValuePair[]
body_type: 'none' | 'raw' | 'json' | 'form-data' | 'urlencoded'
body_content: string
auth_type: 'none' | 'bearer' | 'basic' | 'api-key'
auth_config: object
created_at: timestamp
updated_at: timestamp
```

### Collection
```
id: string (uuid)
name: string
description: string
created_at: timestamp
updated_at: timestamp
```

### Environment
```
id: string (uuid)
name: string
variables: KeyValuePair[]
is_active: boolean
created_at: timestamp
```

### HistoryEntry
```
id: string (uuid)
method: string
url: string
status_code: number
response_time_ms: number
request_snapshot: Request
sent_at: timestamp
```

### KeyValuePair
```
key: string
value: string
enabled: boolean
```

---

## Application Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Fetch Boy]   [Environment: Development ▾]        [⚙ Settings] │
├──────────────┬──────────────────────────────────────────────┤
│              │  [GET ▾] [ https://{{base_url}}/api/users  ] [Send] │
│  Collections │                                              │
│  ├─ My API   │  Headers  Params  Body  Auth                 │
│  │  ├─ Auth  │  ┌──────────────────────────────────────┐   │
│  │  └─ Users │  │ (key-value table)                    │   │
│  └─ Other    │  └──────────────────────────────────────┘   │
│              │                                              │
│  ──────────  │  ── Response ──────────────────────────────  │
│              │  200 OK   124ms   1.2kb                      │
│  History     │                                              │
│  ├─ GET /u.. │  Body  Headers                               │
│  └─ POST /.. │  ┌──────────────────────────────────────┐   │
│              │  │ { "users": [...] }                   │   │
│              │  └──────────────────────────────────────┘   │
└──────────────┴──────────────────────────────────────────────┘
```

---

## Project Structure

```

├── src/                        # React frontend
│   ├── components/
│   │   ├── RequestBuilder/     # URL bar, method selector, tabs
│   │   ├── ResponseViewer/     # Body, headers, status strip
│   │   ├── CollectionTree/     # Sidebar tree view
│   │   ├── EnvironmentPanel/   # Environment manager
│   │   ├── HistoryPanel/       # Request history list
│   │   └── Settings/           # Settings modal
│   ├── stores/
│   │   ├── requestStore.ts     # Active request state
│   │   ├── collectionStore.ts  # Collections + folders
│   │   ├── environmentStore.ts # Environments + active env
│   │   └── historyStore.ts     # Request history
│   ├── hooks/
│   │   ├── useRequest.ts       # Send request, handle response
│   │   └── useEnvironment.ts   # Variable interpolation
│   ├── lib/
│   │   ├── interpolate.ts      # {{variable}} substitution
│   │   └── db.ts               # Tauri SQL plugin wrapper
│   └── App.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs             # App entry, Tauri builder
│   │   ├── http.rs             # reqwest HTTP commands
│   │   ├── db.rs               # SQLite schema + migrations
│   │   └── commands.rs         # Tauri command registrations
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

---

## Tauri Commands (Rust → Frontend Bridge)

```
send_request(request: RequestPayload) -> ResponsePayload
  Executes HTTP request via reqwest, returns status, headers, body, timing

get_collections() -> Collection[]
save_collection(collection: Collection) -> void
delete_collection(id: string) -> void

get_requests(collection_id: string) -> Request[]
save_request(request: Request) -> void
delete_request(id: string) -> void

get_environments() -> Environment[]
save_environment(env: Environment) -> void
delete_environment(id: string) -> void
set_active_environment(id: string) -> void

get_history(limit: number) -> HistoryEntry[]
clear_history() -> void
```

---

## MVP Milestones

### Phase 1 — Foundation (Week 1–2)
- [ ] Tauri + React + Vite scaffold
- [ ] SQLite schema and migrations
- [ ] Basic request builder (URL, method, headers, body)
- [ ] Send request via Rust and display raw response

### Phase 2 — Core UX (Week 3–4)
- [ ] Monaco editor for request body and response viewer
- [ ] Collections sidebar with CRUD
- [ ] Save/load requests from collections
- [ ] Request history with restore

### Phase 3 — Environments & Auth (Week 5)
- [ ] Environment manager with variable editor
- [ ] Variable interpolation in URL, headers, body
- [ ] Bearer, Basic, and API Key auth types

### Phase 4 — Polish (Week 6)
- [ ] Light/dark theme
- [ ] Import/export collections and environments (JSON)
- [ ] Settings panel (timeout, SSL toggle, font size)
- [ ] App icon, packaging, and installers for all three platforms

---

## Success Metrics (MVP)

- App installs and launches in under 3 seconds on all three platforms
- Installer size under 15MB
- Can send a request and view a formatted response in under 10 seconds from first launch
- All data persists correctly across app restarts
- Zero required accounts, logins, or network calls on startup
