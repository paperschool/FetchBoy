# FetchBoy 🦴

FetchBoy is a powerful, open-source desktop HTTP client designed for developers who need a lightweight yet feature-rich alternative to traditional API testing tools. Built with modern web technologies including Tauri, React, and Monaco Editor, FetchBoy combines the flexibility of a web-based REST client with the performance and system integration of a native desktop application. Whether you're debugging APIs, testing endpoints, or intercepting and modifying HTTP traffic in real-time, FetchBoy provides an intuitive interface that streamlines your development workflow.

## Features

### Epic: Request Building & Execution

- **As a** developer, **I want to** construct HTTP requests with full control over headers, body, query parameters, and authentication, **so that** I can test any API endpoint with precision.

- **As a** developer, **I want to** organize my requests into collections with folders and drag-and-drop ordering, **so that** I can manage complex API projects efficiently.

- **As a** developer, **I want to** use environment variables with interpolation, **so that** I can seamlessly switch between development, staging, and production configurations.

- **As a** developer, **I want to** view request and response bodies in a syntax-highlighted editor, **so that** I can easily work with JSON, XML, and other formats.

### Epic: HTTP Interception & Debugging

- **As a** developer, **I want to** intercept HTTP/HTTPS traffic through a local proxy, **so that** I can debug and analyze all network activity between clients and servers.

- **As a** developer, **I want to** set breakpoints on specific requests and modify them before forwarding, **so that** I can test edge cases and simulate different server responses.

- **As a** developer, **I want to** override status codes, response headers, and response bodies on the fly, **so that** I can mock API responses without modifying the backend.

- **As a** developer, **I want to** block specific requests or simulate timeouts, **so that** I can test error handling and loading states in my applications.

### Epic: User Experience & Productivity

- **As a** developer, **I want to** work in multiple tabs simultaneously, **so that** I can compare requests and responses side by side.

- **As a** developer, **I want to** use keyboard shortcuts for common actions, **so that** I can work faster without reaching for the mouse.

- **As a** developer, **I want to** customize the application theme (light/dark/system), **so that** I can work comfortably in any environment.

- **As a** developer, **I want to** import and export collections and environments, **so that** I can share my work with teammates or backup my configurations.

### Epic: History & Persistence

- **As a** developer, **I want to** view a history of all sent requests, **so that** I can quickly replay or reference past API calls.

- **As a** developer, **I want to** save my collections and settings persistently, **so that** I don't lose my work between sessions.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Desktop**: Tauri v2 (Rust)
- **UI**: Tailwind CSS v4, Radix UI
- **State Management**: Zustand with Immer
- **Editor**: Monaco Editor
- **Database**: SQLite (via tauri-plugin-sql)
- **Testing**: Vitest, Testing Library

## Getting Started

### Prerequisites

- Node.js 18+
- Rust (latest stable)
- Yarn or npm
- For macOS: Xcode Command Line Tools

### Installation

1. Clone the repository:
```bash
git clone https://github.com/paperschool/FetchBoy.git
cd fetch-boy
```

2. Install dependencies:
```bash
yarn install
```

3. Run in development mode:
```bash
yarn tauri dev
```

### Building

To build the desktop application:

```bash
yarn tauri build
```

This will generate platform-specific installers in `src-tauri/target/release/bundle/`.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our commit message conventions and release process.

## License

MIT License - see the LICENSE file for details.

---

<div align="center">

**Connect with the developer:**

[LinkedIn](https://www.linkedin.com/in/dominicjomaa/) • [Instagram](https://www.instagram.com/ono.sendai.runner/)

</div>
