# Dispatch

A lightweight, cross-platform API client — a focused alternative to Postman that strips away enterprise complexity in favour of a clean, fast, and intuitive experience.

Runs entirely offline. No account required. All data stored locally.

---

## Features

- **Request Builder** — method selector, URL bar, headers, query params, raw body, and auth tabs
- **Monaco Editor** — syntax highlighting and JSON auto-formatting for request/response bodies
- **Collections** — tree-based sidebar with nested folders, CRUD, and drag-and-drop reordering
- **Save & Load Requests** — persist requests to collections and reload them from the sidebar
- **Request History** — auto-populated log of the last 200 sent requests
- **Environments** — named key-value variable stores with `{{variable}}` interpolation at send time *(planned)*
- **Auth Schemes** — Bearer Token, Basic Auth, and API Key injection *(planned)*
- **Light / Dark / System Theme** — persisted across restarts *(planned)*
- **Import / Export** — collections and environments as JSON *(planned)*
- **Cross-platform Installers** — macOS, Windows, Linux under 15MB *(planned)*

---

## Architecture and Stack

| Layer            | Technology                    |
| ---------------- | ----------------------------- |
| App shell        | Tauri v2 (Rust)               |
| HTTP engine      | `reqwest` (Rust)              |
| Frontend         | React 18 + TypeScript         |
| Build tool       | Vite                          |
| Styling          | Tailwind CSS v4               |
| UI components    | shadcn/ui                     |
| State management | Zustand + Immer               |
| Local database   | SQLite via `tauri-plugin-sql` |
| Code editor      | Monaco Editor                 |
| Testing          | Vitest + Testing Library      |

The frontend lives in `dispatch/` (a Vite project). Tauri wraps it, exposing Rust commands (e.g. `send_request`) via the IPC bridge. All persistence is SQLite in the platform data directory.

---

## Pre-requisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Tauri CLI prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# macOS — Xcode Command Line Tools
xcode-select --install
```

---

## Getting Started

```bash
# Clone and install
git clone <repo-url>
cd PostmanClone/dispatch
yarn install
```

---

## Scripts

All scripts run from the `dispatch/` directory.

| Command              | Description                                        |
| -------------------- | -------------------------------------------------- |
| `yarn tauri dev`     | Start the app in development mode (hot-reload)     |
| `yarn tauri build`   | Build a release installer for the current platform |
| `yarn dev`           | Run the Vite frontend only (no Tauri shell)        |
| `yarn build`         | Type-check and build the frontend bundle           |
| `yarn test`          | Run the unit test suite once                       |
| `yarn test:watch`    | Run tests in watch mode                            |
| `yarn test:coverage` | Run tests with coverage report                     |
| `yarn typecheck`     | Type-check without emitting output                 |

```bash
# Start development
cd dispatch
yarn tauri dev
```

---

## Project Structure

```
PostmanClone/
├── dispatch/               # Vite + React frontend + Tauri config
│   ├── src/                # React components, stores, hooks
│   ├── src-tauri/          # Rust source, tauri.conf.json, icons
│   └── package.json
├── _bmad-output/
│   ├── api-client-spec.md          # Full product spec
│   ├── planning-artifacts/         # Epics (epic-1 through epic-4)
│   └── implementation-artifacts/  # Stories + sprint-status.yaml
└── docs/
```

---

## Author

- **Ono**
