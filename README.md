# i6-share

Send photos and files from your **Android phone** to your **Linux PC** (and back) over your
**local network**. It's like LocalSend or PairDrop, but simpler: pair once by scanning a QR code,
and from then on **Share → i6-share** in any app saves the files straight into a folder on your
PC, with no prompts.

No servers, no accounts, no cloud. Nothing leaves your network. Plain vanilla JavaScript with no
runtime dependencies.

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

1. Install Google Chrome (tested with 151 on Debian 13; Debian's own `chromium` 156 package
   could not install signed IWAs in our tests):
   ```sh
   wget -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
   sudo apt install -y /tmp/google-chrome.deb
   ```
2. Enable `chrome://flags/#enable-isolated-web-apps` and
   `chrome://flags/#enable-isolated-web-app-dev-mode`, then relaunch.
3. Download [`hub/i6-share-hub.swbn`](https://krusegit.github.io/i6-share/hub/i6-share-hub.swbn).
4. Quit Chrome completely, then install it from the command line (tested):
   ```sh
   google-chrome --enable-features=IsolatedWebApps,IsolatedWebAppDevMode \
     --install-isolated-web-app-from-file="$HOME/Downloads/i6-share-hub.swbn"
   ```
   Alternatives: `chrome://iwa-dev` (Chrome 154+) or `chrome://web-app-internals`
   (Chrome 120–153) → install from signed web bundle or from the update manifest
   `https://krusegit.github.io/i6-share/hub/update.json`.
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
  no telemetry. GitHub Pages only serves the static code.
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

Requirements: Node.js ≥ 22.13 (for the build tools only; browser code has no dependencies).

```sh
npm install          # wbn + wbn-sign (dev dependencies, used only by the hub build)
npm run dev          # serves public/ on http://localhost:8080 (PORT=…, HOST=0.0.0.0 for LAN)
npm run dev:hub      # serves the hub on http://localhost:5193 for the IWA Dev Mode Proxy
npm run build:hub    # builds and signs public/hub/i6-share-hub.swbn (+ version.json, update.json)
npm run build:icons  # re-renders public/icons/*.png from the SVG sources (needs rsvg-convert)
npm test             # end-to-end tests
```

* **Phone app on a real phone:** service workers and the share target need a secure context. Use
  USB debugging with `adb reverse tcp:8080 tcp:8080` and open `http://localhost:8080/` on the
  phone, or push to a branch and use GitHub Pages.
* **Hub with live reload:** with the flags enabled, run `npm run dev:hub`, then
  `chrome://iwa-dev` → **Install** → **Dev Mode Proxy** → `http://localhost:5193` (older Chrome:
  `chrome://web-app-internals` → *Install IWA via Dev Mode Proxy*). Edit files in `hub/` or
  `public/lib/` and reload the app window. The dev server serves the same files as the bundle
  (`hub/` at the root plus `/lib/`, `/style.css`, `/icons/`, and the manifest at
  `/.well-known/manifest.webmanifest`) with the COOP/COEP/CORP headers IWAs need.
* **Building the bundle:** `npm run build:hub` signs with
  `~/.config/i6-share/hub-signing-key.pem` (or `I6_SIGNING_KEY=/path/key.pem`). If the key
  doesn't exist, the build creates a new Ed25519 key there.
  > ⚠️ **Back up the signing key.** It defines the app's identity
  > (`isolated-app://<Web Bundle ID>/`). A different key produces a *different app*: users would
  > have to install it again and re-pair. Never commit it (`*.pem` is git-ignored).
* The manifest `version` in `hub/manifest.webmanifest` is required. Bump it for every release.
  Commit the rebuilt `public/hub/` files; Pages serves them.

Layout: `public/` is the Pages site (phone PWA, `setup/` wizard, shared `lib/`, `style.css`,
`icons/`, built `hub/` bundle), `hub/` holds the hub IWA source, and `tools/` holds Node build
and dev scripts. See [docs/PROTOCOL.md](docs/PROTOCOL.md).

## GitHub Pages

Source code lives on `dev`. The workflow in `.github/workflows/pages.yml` copies `public/` to the
root of the `gh-pages` branch on every push to `dev` (or when run manually).

1. Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch →
   `gh-pages` / `(root)`**.
2. The site will be at `https://<user>.github.io/<repo>/`.
3. **Forks:** change `APP_URL` in [`public/lib/proto.js`](public/lib/proto.js) to your Pages
   URL (the hub's QR codes link to it), and build the hub with your own signing key.

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
