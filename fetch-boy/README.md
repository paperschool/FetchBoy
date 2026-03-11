# Fetch Boy

A lightweight, open source API client built with Tauri and React.

## Installation

### macOS

Download the `.dmg` from the [releases page](https://github.com/dominicjomaa/fetch-boy/releases), open it, and drag Fetch Boy to your Applications folder.

**Important:** Fetch Boy is not yet signed with an Apple Developer certificate. macOS will show a "damaged" error when you first try to open it. Run this command in Terminal to fix it:

```bash
xattr -cr /Applications/Fetch\ Boy.app
```

Then launch the app normally. You only need to do this once.

### Windows

Download and run the `.msi` or `.exe` installer from the [releases page](https://github.com/dominicjomaa/fetch-boy/releases).

### Linux

Download the `.deb` package or `.AppImage` from the [releases page](https://github.com/dominicjomaa/fetch-boy/releases).

**AppImage:**
```bash
chmod +x "Fetch Boy_x.x.x_amd64.AppImage"
./"Fetch Boy_x.x.x_amd64.AppImage"
```

**Debian/Ubuntu:**
```bash
sudo dpkg -i "Fetch Boy_x.x.x_amd64.deb"
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/)
- [Yarn](https://yarnpkg.com/)

**Linux only:** Install system dependencies:
```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### Running locally

```bash
cd fetch-boy
yarn install
yarn tauri dev
```

### Running tests

```bash
yarn test
```

### Building

```bash
yarn tauri build
```

## Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/dominicjomaa/fetch-boy).
