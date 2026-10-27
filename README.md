# i6-share

Send photos and files from your **Android phone** to your **Linux PC** (and back) over your
**local network**. It's like LocalSend or PairDrop, but simpler: pair once by scanning a QR code,
and from then on **Share → i6-share** in any app saves the files straight into a folder on your
PC, with no prompts.

No servers, no accounts, no cloud. Nothing leaves your network. The application is written in strict TypeScript with Effect. Browser dependencies are bundled
locally, so the installed apps need no CDN or remote runtime.

* Phone app: <https://krusegit.github.io/i6-share/>
* Linux setup guide: <https://krusegit.github.io/i6-share/setup/>

## How it works

```
 ┌──────────────────────────────┐   HTTP over LAN (encrypted bodies)   ┌──────────────────────────────┐
 │ Phone: installed PWA         │ ───────────────────────────────────▶ │ Linux: i6-share Hub (IWA)    │
 │ https://krusegit.github.io/  │   fetch("http://192.168.x.y:47616")  │ Direct Sockets TCPServerSocket│
 │ i6-share/  (GitHub Pages)    │ ◀─────────────────────────────────── │ tiny HTTP/1.1 server on :47616│
 │ share target, QR pairing     │   responses / long-poll / pulls      │ saves files to a folder       │
 └──────────────────────────────┘                                      └──────────────────────────────┘
```

* **Phone:** a Progressive Web App served by GitHub Pages. Once installed it appears in Android's
  share sheet. Its service worker caches the code, so after the first visit it works offline on
  your LAN.
* **PC:** the **i6-share Hub**, an [Isolated Web App](https://github.com/WICG/isolated-web-apps)
  (IWA) for Chrome/Chromium. It runs a tiny HTTP server on TCP port **47616** using the
  [Direct Sockets API](https://github.com/WICG/direct-sockets) and writes received files into
  a folder you choose.

**Why the Linux side has to be an IWA:** a normal web page can't listen on a port, can't do
mDNS/UDP broadcast discovery, and can't accept incoming connections. Without a native helper,
two browsers on a LAN can't find or reach each other. Direct Sockets (`TCPServerSocket`) is the
one web API that can listen, and Chrome only exposes it to Isolated Web Apps: signed, offline
bundles with a strict CSP. So the PC runs the hub as an IWA, and the phone, an ordinary PWA,
always starts the connection with `fetch()` to `http://<pc-ip>:47616`. Chrome allows that under
**Local Network Access** once you grant permission.

The full wire protocol is in [docs/PROTOCOL.md](docs/PROTOCOL.md).

## Install on Android

1. Open <https://krusegit.github.io/i6-share/> in **Chrome**.
2. Tap **⋮ → Install app** (or *Add to home screen*).
3. Share anything: in Gallery, Files and other apps, tap **Share → i6-share**.

The first time, Chrome asks to let i6-share **access devices on your local network**. Tap **Allow**.

## Install on Linux

Follow the step-by-step guide at **[`/setup/`](https://krusegit.github.io/i6-share/setup/)**.
It checks your browser and includes a "Test connection" button. In short:

Target platform: **Debian 13 (trixie)** with **Google Chrome**.

**One-line install** (run as your normal user in a terminal inside your desktop session):

```sh
curl -fsSL https://krusegit.github.io/i6-share/install.sh | bash
```

[`install.sh`](public/install.sh) runs without questions: it installs Google Chrome (Google's
`.deb`, which also adds Google's apt repository), enables the two Isolated Web App flags in
Chrome's `Local State` (exactly what `chrome://flags` does), opens TCP 47616 when
nftables/iptables rules would block it (`/etc/nftables.conf` is backed up to `.i6bak` before
it's edited), downloads the hub bundle, checks its SHA-256 and installs it into Chrome. If
Chrome is running it is closed for this and started again afterwards; at the end the hub
window opens. On a brand-new Chrome profile answer Chrome's welcome dialog (or pass `--yes`
to skip it).

**To update, run the same command again.** Chrome can't update a file-installed IWA from the
command line, so the script replaces Chrome's stored copy of the bundle
(`~/.config/google-chrome/<profile>/iwa/<id>/main.swbn`, found by the hub's Web Bundle ID) with
the new signed one while Chrome is closed; the old copy goes to
`~/.local/share/i6-share/backup/` (last 3 kept). Pairings and settings are kept. Caveats:
`chrome://web-app-internals` keeps showing the originally installed version (the badge in the
hub's corner shows the real one), and changes to the app manifest (name, icons, permissions
policy) only take effect after a fresh install.

**Nothing starts automatically** – no login autostart, no background service. The hub only
listens on port 47616 while you have its window open: start "i6-share Hub" from the app
menu when you want to receive, close the window to stop. Options: `--no-firewall`, `--yes`
(`curl … | bash -s -- --no-firewall`).
Chrome shows an "unsupported feature flag: IsolatedWebAppDevMode" bar, which is expected:
developer mode is the only way to install IWAs outside managed ChromeOS today (policy
installs on Linux are restricted to Google's allowlist).

Manual steps:


1. Install Google Chrome (tested with 151 on Debian 13; Debian's own `chromium` 156 package
   could not install signed IWAs in our tests):
   ```sh
   wget -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
   sudo apt install -y /tmp/google-chrome.deb
   ```
2. Enable `chrome://flags/#enable-isolated-web-apps` and
   `chrome://flags/#enable-isolated-web-app-dev-mode`, then relaunch.
3. Install the hub from its **update manifest** (Chrome then checks for updates by itself and
   your pairings survive updates):
   `https://krusegit.github.io/i6-share/hub/update.json`
   * Chrome 120–153: `chrome://web-app-internals` → **Install IWA from Update Manifest** →
     paste the URL → **Fetch** → **Install**.
   * Chrome 154+: `chrome://iwa-dev` → **Install** → **Update Manifest** tab → same URL.
   * To update immediately: **Perform update now** / **Update** on that page while the hub
     window is closed.
4. Alternative: download [`hub/i6-share-hub.swbn`](https://krusegit.github.io/i6-share/hub/i6-share-hub.swbn),
   quit Chrome completely and run
   ```sh
   google-chrome --enable-features=IsolatedWebApps,IsolatedWebAppDevMode \
     --install-isolated-web-app-from-file="$HOME/Downloads/i6-share-hub.swbn"
   ```
   (this is what `install.sh` does; Chrome doesn't update file installs by itself and
   installing a newer file over it fails with "App is already installed" – re-run
   `install.sh` to update instead).
5. Firewall: a fresh Debian 13 has no rules (`sudo nft list ruleset` prints nothing) — then skip
   this. Otherwise allow TCP 47616:
   ```sh
   sudo nft insert rule inet filter input tcp dport 47616 accept          # nftables (Debian default)
   sudo iptables -I INPUT -p tcp --dport 47616 -j ACCEPT                   # or iptables
   sudo ip6tables -I INPUT -p tcp --dport 47616 -j ACCEPT
   ```
   To persist with nftables, add `tcp dport 47616 accept` to `chain input` in
   `/etc/nftables.conf` and `sudo systemctl enable --now nftables`.
6. Launch **i6-share Hub** from your app launcher (or `chrome://apps`) and pick a save folder.
   The hub only receives while its window is open (minimised is fine).

## Updates

The hub shows a banner when a newer version is published. To update, run the installer again:
`curl -fsSL https://krusegit.github.io/i6-share/install.sh | bash` – it closes Chrome, installs the
new version in place, keeps your pairings and settings, and reopens the hub. Hubs installed from
the update link also update automatically within a few hours (applied once the hub window is
closed); to force it use `chrome://iwa-dev` (Chrome 154+) or `chrome://web-app-internals`
(Chrome 153 and older) → **Update** / **Perform update now**. The phone app updates itself on
the next launch after a deploy.

## Pairing & auto-trust

The hub shows a QR code. Scan it with the phone's camera app or with the scanner in i6-share.
The QR contains a link to the phone app with a **one-time pairing token** (valid 10 minutes,
single use), the hub's ID, its LAN addresses and its name. The phone uses the token to fetch a
**per-device 32-byte secret** from the hub. From then on the phone is trusted: transfers are
accepted and saved automatically, without prompts. Unpair any device from the hub to revoke it.

If you share something before pairing, i6-share asks you to scan the QR first and then sends the
queued files automatically.

## Security model

* **LAN only.** The phone talks directly to the PC's private IP address. No relay, no STUN/TURN,
  no telemetry. GitHub Pages only serves the static code. The one other request: the hub fetches
  `hub/version.json` from GitHub Pages at start and every 6 hours to show an "update available"
  banner (no data is sent; when offline nothing happens).
* **Encrypted and authenticated.** Every request and response body except the public
  `GET /i6/hello` (hub ID and name) is sealed with **AES-256-GCM** under a key derived (HKDF-SHA-256)
  from the per-device secret. The request's IV is bound into the response, so responses can't
  be swapped or replayed into another request. Unknown or tampered requests are rejected.
* **Pairing** happens only through the short-lived one-time token in the QR code. Someone who
  can scan your screen while the QR is valid could pair, so treat it like a password. It expires
  after 10 minutes or one use, and you can forget unknown devices in the hub.
* **The hub is a signed IWA:** Chrome verifies the bundle signature, the app runs offline from
  the bundle, under a strict CSP and Trusted Types, with no remote code.
* Plain HTTP is used on the LAN by necessity (an IWA can't get a TLS certificate for a private
  IP). Confidentiality and integrity come from the application-level encryption above. Metadata
  such as IP addresses, timing and sizes is visible to others on your network.

## Reliability

* Transfers are chunked (4 MiB) and **resume** where they stopped after Wi-Fi drops, app switches
  or the screen turning off. Re-sent chunks are harmless.
* Queued files are stored on the phone (IndexedDB), so they survive the app being killed and are
  sent on the next launch.
* Every request has a timeout and retries with exponential backoff and jitter. Coming back online
  or reopening the app retries immediately.
* **IP address changed?** The phone tries the known addresses, then scans the local /24 subnet
  for its paired hub and re-learns the address.
* A screen wake lock is held during transfers.

## Development

Requirements: Node.js 24 (the version used by CI) and npm. TypeScript and Effect are compiled
into browser ES modules with esbuild; Node is only needed for development and builds.

```sh
npm ci               # install the locked runtime and development dependencies
npm run dev          # build + serve the phone app on http://localhost:8080
npm run dev:hub      # build + serve the IWA Dev Mode Proxy on http://localhost:5193
npm run build        # compile browser apps into dist/public and dist/hub
npm run build:hub    # sign dist/public/hub/i6-share-hub.swbn (local test build)
npm run build:icons  # re-render PNG icons from SVG sources (requires rsvg-convert)
npm test             # unit, integration, browser-adapter, and end-to-end tests
npm run test:e2e     # real TCP transfers with dropped connections and a hub restart
npm run check        # strict types, ESLint, 100% type/test coverage, build, and E2E
```

* **Phone app on a real phone:** service workers and the share target need a secure context. Use
  USB debugging with `adb reverse tcp:8080 tcp:8080` and open `http://localhost:8080/` on the
  phone, or push to a branch and use GitHub Pages.
* **Hub with live reload:** with the flags enabled, run `npm run dev:hub`, then
  `chrome://iwa-dev` → **Install** → **Dev Mode Proxy** → `http://localhost:5193` (older Chrome:
  `chrome://web-app-internals` → *Install IWA via Dev Mode Proxy*). Edit files in `hub/` or
  `public/lib/` and reload the app window; requests rebuild the compiled assets. The dev server serves the same files as the bundle
  (`hub/` at the root plus `/lib/`, `/style.css`, `/icons/`, and the manifest at
  `/.well-known/manifest.webmanifest`) with the COOP/COEP/CORP headers IWAs need.
* **Local test build:** `npm run build:hub` signs with `~/.config/i6-share/hub-signing-key.pem`
  (or `I6_SIGNING_KEY=/path/key.pem`; output dir `I6_OUT_DIR`, default `dist/public/hub/`). The output
  is git-ignored and is **not** what users get – releases are built and signed by CI (below).
  If the key file doesn't exist, the build creates a *new* Ed25519 key there (= a different app).

Layout: `public/` holds the phone PWA, setup wizard, shared TypeScript modules, and static
assets. `hub/` holds the hub IWA source; `tools/` holds TypeScript build and development tools.
The browser build writes `dist/public/` and `dist/hub/`; only compiled assets are published.
See [docs/PROTOCOL.md](docs/PROTOCOL.md).

Application services are factory functions with explicit dependencies. Pure protocol and data
transformations are separate from Effect programs for cryptography, storage, network operations,
and lifecycle work. Browser and Node adapters expose Promise APIs where the platform requires
them. Runtime validation treats persisted data and network messages as unknown until decoded.

`tsconfig.json` enables strict checking, checked indexed access, exact optional properties,
unused-code checks, and declaration checking. ESLint applies the strict type-aware rules and
rejects `any`, type assertions, TypeScript suppression comments, classes, and `this`.
`type-coverage --strict` requires 100% typed identifiers. Vitest requires 100% statements,
branches, functions, and lines per production TypeScript file, including browser adapters and
build tools. Coverage includes files that tests do not import; the only exclusions are type
declarations. Pull requests and deployment run the same checks.

### Releasing the hub

1. Bump `version` in [`hub/manifest.webmanifest`](hub/manifest.webmanifest) (dot-separated
   numbers, e.g. `1.0.5`; it must be higher than the published one).
2. Push to `dev`. The Pages workflow builds and signs the bundle with the repository secret
   `I6_HUB_SIGNING_KEY`, checks that the Web Bundle ID is still
   `co7xxoa6ugc4opuhmvki265in2w5vxbayrvah6sni4vnkrg6jhiaaaic`, and publishes `hub/i6-share-hub.swbn`,
   `hub/version.json` and `hub/update.json` to gh-pages. The job log shows version, commit and SHA-256.
3. Hubs installed from the update manifest (`…/hub/update.json`) are updated by Chrome
   automatically (or at once via **Perform update now**); `.swbn` file installs must be updated by hand.

The hub is only rebuilt when the manifest `version` differs from the published
`hub/version.json`; otherwise the published `hub/` is carried over byte-for-byte, so unrelated
pushes never change the bundle and Chrome never sees two bundles with the same version. The job
fails – leaving gh-pages untouched – if the version went down, if the secret is missing, or if
the key yields a different Web Bundle ID.

### Signing key

The Ed25519 key (unencrypted PKCS8 PEM) **is** the hub's identity (`isolated-app://<Web Bundle ID>/`).
A different key produces a *different app*: users would have to install it again and re-pair.
Never commit it (`*.pem` is git-ignored).

* **Primary copy:** repository secret `I6_HUB_SIGNING_KEY` (Settings → Secrets and variables →
  Actions) holding the PEM file contents. Secrets can't be read back, so keep the backup.
* **Backup:** the maintainer's local copy `~/.config/i6-share/hub-signing-key.pem` (mode 600);
  keep a further offline copy (e.g. password manager).
* **Restore** (secret lost or deleted): `gh secret set I6_HUB_SIGNING_KEY < ~/.config/i6-share/hub-signing-key.pem`
  (or paste the file contents in the web UI). Check it with a local build:
  `npm run build:hub` must print the Web Bundle ID above.
* **Rotate** only if the key is compromised – it creates a new app. Create a new key with
  `I6_SIGNING_KEY=~/.config/i6-share/hub-signing-key-new.pem npm run build:hub` (generates the
  file if it doesn't exist and prints the new Web Bundle ID), store it in the secret and as the
  backup, update `EXPECTED_WEB_BUNDLE_ID` in `.github/workflows/pages.yml` and the ID in this
  README, bump the hub version and push. Every user must install the new hub and re-pair their
  phones; the old app gets no further updates.

## GitHub Pages

Source code lives on `dev`. Publishing is just a push to `dev` (or a manual run): the workflow in
`.github/workflows/pages.yml` validates the source, compiles `dist/public/`, copies it to the
root of the `gh-pages` branch, writes build metadata, and adds `hub/` – rebuilt and signed when the hub version changed, otherwise
carried over from the previous gh-pages commit (see [Releasing the hub](#releasing-the-hub)).

1. Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch →
   `gh-pages` / `(root)`**.
2. The site will be at `https://<user>.github.io/<repo>/`.
3. **Forks:** change `APP_URL` in [`public/lib/proto.ts`](public/lib/proto.ts) to your Pages
   URL (the hub's QR codes link to it), set your own `I6_HUB_SIGNING_KEY` secret and
   `EXPECTED_WEB_BUNDLE_ID` in the workflow (a fresh gh-pages branch builds the hub on first push).

## Limitations

* **Linux needs Chrome's IWA developer-mode flags today.** Isolated Web Apps aren't generally
  available on desktop yet, so you install from a file with developer mode turned on.
* **Local Network Access** must be allowed in Chrome on Android. If you deny it, the phone can't
  reach the PC. Re-enable it in site settings.
* **PC → phone delivery** only works while the phone app is open: the phone polls the hub
  because a web page can't listen for connections.
* The hub only runs while its window is open.
* **Guest Wi-Fi / AP (client) isolation**, and some VPNs or corporate networks, block
  device-to-device traffic. i6-share can't work there.
* Chrome/Chromium only on the PC. Windows, macOS and ChromeOS should work in principle but are
  untested.
