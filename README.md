<p align="center">
  <img src="./src-tauri/icons/fetch-boi-logo.svg" alt="Fetch Boy Logo" width="150px" height="150px" style="scale: 1.5;" />
</p>

<h1 align="center">Fetch Boy</h1>

<table>
  <tr>
    <td>
      <img src="screenshots/main.png" alt="Fetch Boy Main Interface" width="100%" />
    </td>
    <td>
      <img src="screenshots/main-2.png" alt="Fetch Boy Main Interface" width="100%" />
    </td>
  </tr>
</table>

A lightweight, cross-platform API client — a focused alternative to Postman that strips away enterprise complexity in favour of a clean, fast, and intuitive experience.

Runs entirely offline. No account required. All data stored locally.

---

## Features

### Request Building & Execution

- Construct HTTP requests with full control over headers, body, query parameters, and authentication
- Organize requests into collections with folders and drag-and-drop ordering
- Use environment variables with `{{variable}}` interpolation across requests
- View and edit request/response bodies in a syntax-highlighted Monaco editor

### HTTP Interception & Debugging

- Intercept HTTP/HTTPS traffic through a local MITM proxy
- Set breakpoints on requests and modify them before forwarding
- Override status codes, response headers, and response bodies on the fly
- Block specific requests or simulate timeouts

### User Experience & Productivity

- Work in multiple tabs simultaneously with per-tab state isolation
- Use keyboard shortcuts (Cmd/Ctrl+Enter to send, ? for shortcuts overlay)
- Customize the application theme (light/dark/system)
- Import and export collections and environments as JSON

### History & Persistence

- View history of all sent requests with quick replay
- Automatic persistence of collections and settings to SQLite

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

The frontend lives in `./` (a Vite project). Tauri wraps it, exposing Rust commands (e.g. `send_request`) via the IPC bridge. All persistence is SQLite in the platform data directory.

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

cd FetchBoyApp

yarn install

yarn tauri dev
```

---

## Installation

### windows

After downloading bundle, windows defender may prompt you not to run the unsigned application, this is normal. In the "Don't Run" screen, click to see more details and then run it. 

> ⚠️ **Disclaimer:** Fetch Boy is currently in **early development**. The app has not been signed or notarized by Windows App Store (or associated partners) yet, which means Windows Defender may show warnings when trying to run it. This can be bypassed as above by ignoring the warning when launching the application. Once the app reaches a more stable release, proper signing and notarization will be set up.

### macOS

After downloading or building the `.app` bundle, you may need to remove the extended attribute quarantine flag to run the app:

```bash
xattr -cr /Applications/Fetch\ Boy.app
```

Then open the app from Applications as usual.

> ⚠️ **Disclaimer:** Fetch Boy is currently in **early development**. The app has not been signed or notarized by Apple yet, which means Gatekeeper may show warnings when trying to run it. Use the `xattr` command above to bypass these restrictions. Once the app reaches a more stable release, proper signing and notarization will be set up.

### Linux

Haven't tested the builds yet, if testing please raise any issues in the issues section!

---

## Known Issues

1. UI speed seems quite sluggish on Windows 11 - Not sure why.

## Project Structure

```
FetchBoyApp/
├── ./              # Vite + React frontend + Tauri config
│   ├── src/                # React components, stores, hooks
│   ├── src-tauri/          # Rust source, tauri.conf.json, icons
│   └── package.json
```

## Author

<div align="center">

**Connect with the me:**

Dominic Jomaa • [LinkedIn](https://www.linkedin.com/in/dominicjomaa/) • [Instagram](https://www.instagram.com/ono.sendai.runner/)

</div>