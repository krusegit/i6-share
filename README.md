# i6-share

Send files between an **Android phone** and a **Linux computer** over your local network.
The phone is an installed PWA. The computer runs a **self-contained .NET 10 Native AOT hub**
with a local browser dashboard. No account, relay, cloud storage, desktop Chrome, or installed
.NET runtime is required.

* Phone app: <https://krusegit.github.io/i6-share/>
* Linux setup guide: <https://krusegit.github.io/i6-share/setup/>

The TypeScript phone app uses Effect for I/O and lifecycle work. C# DTOs define the wire
contract; the build generates readonly TypeScript types and Effect schemas from them.
The native backend uses source-generated JSON serialization, so its published executable
requires no runtime code generation or reflection-based serializer.

## How it works

```text
Android phone PWA                        Native Linux hub
GitHub Pages → cached offline code      .NET 10 / Kestrel / filesystem
        │                                      │
        └──── HTTP over LAN, encrypted bodies ──┘
                   TCP port 47616
                                               │
                                   Local browser dashboard
                                   loopback + admin token
```

The phone initiates every network connection. It uploads chunks to the hub and polls for files
sent back from the computer. The hub writes received files directly to the chosen directory.
The dashboard is available locally on the computer running the hub; administration requires
an ephemeral token printed in the local dashboard URL when the process starts.

GitHub Pages serves the phone app and downloadable releases. File contents, paired-device
secrets, and transfers stay on your network. The application protocol is described in
[docs/PROTOCOL.md](docs/PROTOCOL.md).

## Install on Android

1. Open the [phone app](https://krusegit.github.io/i6-share/) in Chrome.
2. Choose **Install app** or **Add to home screen** from the browser menu.
3. Share files using **Share → i6-share**, or open the app and choose **Send files**.

Allow **local network access** when Chrome asks. The first transfer requires pairing with the
computer by scanning its dashboard QR code or entering its pairing link.

## Install on Linux

Run as your normal desktop user:

```sh
curl -fsSL https://krusegit.github.io/i6-share/install.sh | bash
~/.local/bin/i6-share-hub --open
```

Published Linux archives are built on Ubuntu 24.04 and target modern glibc-based systems,
including Debian 13 and Ubuntu 24.04 or newer. Older distributions and Alpine Linux need a
compatible build from source.

The installer requires `curl` and Python 3. It selects Linux x64 or ARM64, downloads
the matching release, verifies its size and SHA-256 against release metadata fetched over
HTTPS, and installs into your account. It does not install system packages or change browser
settings, firewall rules, or login services. A checksum checks download integrity; it is not
an independent publisher signature.

Installation layout:

| Path | Purpose |
|---|---|
| `~/.local/share/i6-share/releases/` | Versioned executable and dashboard files |
| `~/.local/share/i6-share/current` | Atomically selected release |
| `~/.local/share/i6-share/previous` | Previous release for rollback |
| `~/.local/bin/i6-share-hub` | Command-line launcher |
| `~/.local/share/applications/i6-share-hub.desktop` | Manual app-menu shortcut |

`XDG_DATA_HOME` replaces `~/.local/share` when set. The hub's default persistent data directory
is `~/.local/share/i6-share`; the default receive directory is `~/Downloads/i6-share`. Use
`--data-dir` and `--receive-dir` to choose different locations.

**Nothing starts automatically at login.** Launch the hub from your app menu or run the command
above when you want to receive files. Keep at least one local dashboard tab open. **Closing the last dashboard tab or window stops
the backend automatically** after a short grace period that allows reloading. Multiple tabs
keep it alive while any one is connected. **Ctrl+C** also stops it.

The `--open` flag opens the token-bearing dashboard URL in your normal browser. The terminal
also prints the URL. Open it locally before the startup grace period expires; the backend
exits if no dashboard connects. A local browser session is required. Keep the URL private: its token grants local administrative access for that
process lifetime.

If your firewall blocks inbound traffic, allow **TCP 47616 from your trusted local network**
using your firewall's settings. The installer leaves that policy to you. Guest Wi-Fi isolation
and VPN routing can prevent the phone from reaching the hub.

Manual download is also available under [downloads/](https://krusegit.github.io/i6-share/downloads/version.json):
choose `i6-share-hub-linux-x64.tar.gz` or `i6-share-hub-linux-arm64.tar.gz`, verify its checksum,
and extract the archive. Keep `wwwroot/` beside `i6-share-hub`, then run `./i6-share-hub --open`.

## Updating and rollback

Stop the running hub with Ctrl+C, run the installer command again, then restart it. Persistent
identity, pairings, and transfer history are separate from versioned executable files. An
already-running process keeps its previous executable until restarted.

To select the previous installed executable:

```sh
curl -fsSL https://krusegit.github.io/i6-share/install.sh | bash -s -- --rollback
~/.local/bin/i6-share-hub --open
```

Rollback changes the executable selection, not your data. The installer accepts the old
`--yes` and `--no-firewall` options for compatibility; neither changes native installation
behavior because installation does not prompt or edit the firewall.

When moving from the former browser-hosted hub, **pair the phone again once**. The native hub
creates its own persistent identity. Browser IndexedDB cannot be imported automatically; the
installer leaves the old browser application and its storage untouched. The encrypted v1 wire
protocol is compatible with existing phone clients.

## Pairing and transfers

The dashboard creates a one-time pairing code, valid for ten minutes. Scanning it lets the
phone obtain a per-device 32-byte secret. Subsequent transfers are accepted automatically.
Revoke a device in the dashboard to remove its trust.

Files use 4 MiB chunks and resume after interrupted network connections. Already completed
files are recorded so a hub restart does not duplicate them; partial in-memory sessions may
restart their current file. Queued phone uploads live in IndexedDB. Hub outbox files are
copied into durable hub storage until the phone acknowledges delivery.

Hub → phone delivery requires the phone app to be open. The dashboard lets you queue local
file paths for a paired phone, choose the receive directory, inspect transfers and history,
and revoke devices. Browser uploads do not grant access to arbitrary native paths: only the
local authenticated dashboard can request native file operations.

## Security model

* **Encrypted bodies:** HKDF-SHA-256 derives AES-256-GCM keys from per-device secrets. Every
  authenticated response is bound to the request IV, preventing response substitution.
* **Pairing trust:** possession of the short-lived QR token authorizes pairing. Keep the QR and
  pairing link private until used or expired.
* **Local administration:** the dashboard and admin API are restricted to loopback requests
  and expected local host names. Administrative calls require a process-local bearer token;
  the admin API does not expose cross-origin access.
* **Native storage:** the hub runs as your user, with your filesystem permissions. Received
  names are sanitized and partial files are finalized atomically.
* **HTTP on the LAN:** encryption is applied at the application layer. Addresses, timing, and
  transfer sizes remain visible to network observers. The public `/i6/hello` response contains
  hub discovery metadata.

## Development

Requirements: Node.js ≥ 22.13, .NET SDK 10, and a native compiler toolchain for AOT publishing.
On Linux, install the distribution's `clang` and zlib development packages. On macOS, use the
Xcode command-line tools. Native AOT publishing targets the current operating system; Linux
releases are built on Linux runners for the matching architecture.
macOS publishes keep native debug symbols inside the executable to avoid extracting
symbol files that reference unavailable vendor Clang module caches; warnings remain errors.

```sh
npm ci
npm run contracts:generate  # generate TypeScript DTOs/schemas from C# contracts
npm run dev                # phone app on http://localhost:8080
npm run dev:hub            # native backend and local dashboard
npm run build              # browser bundles in dist/public and dist/hub
npm run build:hub          # publish/package the native hub
npm test                   # TypeScript tests
npm run native:lint        # C# formatting/analyzers and 300-line source limit
npm run check              # contract drift, strict types/lint, tests, coverage and builds
```

Run `npm run native:test` for the native test suite and `npm run contracts:check` to check generated DTO drift. To publish directly after building browser assets:

```sh
dotnet publish native/I6Share.Hub/I6Share.Hub.csproj -warnaserror -c Release -r linux-x64 -o dist/native/linux-x64
mkdir -p dist/native/linux-x64/wwwroot
cp -R dist/hub/. dist/native/linux-x64/wwwroot/
```

CLI options include `--host`, `--port`, `--data-dir`, `--receive-dir`, `--web-root`, `--name`,
`--open`, and `--help`. Development and production use the same native protocol implementation.
A phone needs a secure PWA context; USB debugging with
`adb reverse tcp:8080 tcp:8080` lets Android open the local development site as `localhost`.

| Path | Contents |
|---|---|
| `native/I6Share.Contracts/` | Authoritative immutable DTOs and JSON source-generation context |
| `native/I6Share.TypeGen/` | Build-time C# → TypeScript type/schema generator |
| `native/I6Share.Hub/` | Native host, encrypted protocol, durable storage, and transfer services |
| `native/*Tests/` | Native contract, cryptography, storage, and backend tests |
| `public/` | Phone PWA, setup guide, shared browser helpers, static assets |
| `public/generated/contracts.ts` | Generated contracts; regenerate instead of editing |
| `hub/` | Local browser dashboard and QR encoder |
| `tools/` | TypeScript/Effect build, development, and release tooling |
| `tests/` | Browser, protocol, generated-contract, and integration tests |

TypeScript remains strict, with no `any` or assertion/suppression escapes. Test coverage gates
include every executable production TypeScript module. Native builds enable nullable checking,
AOT compatibility analysis, source-generated serialization, and warnings as errors. C# uses the
SDK's `latest-all` analyzer set with compiler and analyzer warnings treated as errors.
`npm run native:lint` verifies all configured style rules and formatting (including IDE-only rules)
and enforces a maximum of 300 physical lines per C# file, including tests, comments, and blank
lines. Only generated build output under `bin/` and `obj/` is omitted from the line-count gate.
Both checks run in `npm run check` and CI. Native
coverage requires 100% lines and branches across the hub, contracts, and generator assemblies;
only compiler-generated files under `obj/` are excluded. Generated TypeScript validators remain
fully covered. CI checks contract drift and runs the transfer and dashboard-lifetime tests
against the published Native AOT executable before releasing it.

## Releases

CI builds the phone app for GitHub Pages and native Linux archives for x64 and ARM64. Release
metadata at `downloads/version.json` lists the version, archive file names, byte sizes, and
SHA-256 digests. Native packages contain the executable plus `wwwroot/`; there are no browser
bundle signing keys or desktop-browser flags to maintain.

The GitHub Pages workflow publishes compiled files, not TypeScript sources. Repository Pages
settings should serve the `gh-pages` branch root. See the workflow files under `.github/workflows/`
for build and release triggers.
