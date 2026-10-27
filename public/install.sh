#!/usr/bin/env bash
# i6-share Hub installer and updater for Debian 13 (trixie).
#
#   curl -fsSL https://krusegit.github.io/i6-share/install.sh | bash
#
# Options (pass after `bash -s --`):
#   --no-firewall    leave nftables/iptables alone
#   --yes            also skip Chrome's first-run welcome dialog on a new profile
#
# What it does (no questions asked):
#   1. installs Google Chrome (Google's .deb, which also adds Google's apt repo)
#   2. enables the two Chrome flags Isolated Web Apps need (same as chrome://flags)
#   3. opens TCP port 47616 if nftables/iptables rules would block it
#   4. downloads the signed hub bundle, checks its SHA-256 and installs it in Chrome –
#      or, when the hub is already installed, updates it in place (pairings and
#      settings are kept)
#   5. starts Chrome again if it was open, and opens the hub
# Chrome is closed for steps 2 and 4 when it is running. Run it again to update.
#
# Nothing starts at login. The hub only listens while its window is open – start it
# from the app menu ("i6-share Hub") whenever you want to receive.
#
# Run it as your normal desktop user from a terminal inside your desktop session.
# It uses sudo only for apt and the firewall.

main() {
  set -euo pipefail

  local BASE_URL="${I6_BASE_URL:-https://krusegit.github.io/i6-share}"
  local PORT=47616
  local APP_ID=jijddeenooofgclmjgcfmgeggbnmbgoa   # Chrome's id for isolated-app://co7xx…aaic
  local BUNDLE_ID=co7xxoa6ugc4opuhmvki265in2w5vxbayrvah6sni4vnkrg6jhiaaaic
  local CHROME_DEB=https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb

  local SKIP_WELCOME=0 FIREWALL=1
  for arg in "$@"; do
    case "$arg" in
      -y|--yes) SKIP_WELCOME=1 ;;
      --no-firewall) FIREWALL=0 ;;
      -h|--help) sed -n '2,24p' "${BASH_SOURCE[0]:-/dev/null}" 2>/dev/null || true; return 0 ;;
      *) die "unknown option: $arg" ;;
    esac
  done

  local CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"
  local DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
  local CHROME_DIR="$CONFIG/google-chrome"
  local I6_DIR="$DATA/i6-share"
  local MARKER="$I6_DIR/installed-version"
  local DESKTOP_FILE="$DATA/applications/chrome-$APP_ID-Default.desktop"
  mkdir -p "$I6_DIR"

  # ---------------------------------------------------------------- checks
  step "Checking the system"
  [ "$(id -u)" -ne 0 ] || die "Run this as your normal user, not root (it calls sudo when needed)."
  command -v apt-get >/dev/null || die "This installer is for Debian (apt) systems."
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    [ "${VERSION_ID:-}" = "13" ] || warn "Made for Debian 13; you are on ${PRETTY_NAME:-unknown}. Continuing anyway."
  fi
  [ "$(dpkg --print-architecture)" = amd64 ] || die "Google Chrome for Linux is only available for amd64."
  [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] || die "No desktop session found. Run this in a terminal on your desktop."
  local need=()
  command -v curl >/dev/null || need+=(curl)
  command -v python3 >/dev/null || need+=(python3)
  if [ ${#need[@]} -gt 0 ]; then
    info "Installing ${need[*]}"
    sudo apt-get update -qq && sudo apt-get install -y -qq "${need[@]}"
  fi

  # ---------------------------------------------------------------- Chrome
  step "Google Chrome"
  if command -v google-chrome >/dev/null; then
    info "Already installed: $(google-chrome --version 2>/dev/null || echo google-chrome)"
  else
    local deb
    deb="$(mktemp --suffix=.deb)"
    info "Downloading Google Chrome"
    curl -fL --progress-bar -o "$deb" "$CHROME_DEB"
    info "Installing (sudo)"
    sudo apt-get install -y "$deb"
    rm -f "$deb"
  fi

  # ---------------------------------------------------------------- what to do
  step "i6-share Hub"
  local meta latest sha
  meta="$(curl -fsSL "$BASE_URL/hub/version.json")" || die "Could not reach $BASE_URL"
  latest="$(json_get "$meta" version)"
  sha="$(json_get "$meta" sha256)"
  info "Latest version: $latest"

  # Chrome keeps each installed IWA as <chrome dir>/<profile>/iwa/<random>/main.swbn.
  local bundles=() f
  while IFS= read -r f; do bundles+=("$f"); done < <(
    find "$CHROME_DIR" -mindepth 4 -maxdepth 4 -path '*/iwa/*/main.swbn' -type f 2>/dev/null |
      while IFS= read -r f; do if grep -qaF "$BUNDLE_ID" "$f"; then printf '%s\n' "$f"; fi; done)
  local installed="" action
  if [ ${#bundles[@]} -gt 0 ]; then
    installed="$(bundle_version "${bundles[0]}")"
    [ -n "$installed" ] || installed="$(cat "$MARKER" 2>/dev/null || true)"
    if [ "$installed" = "$latest" ]; then
      action=current
      info "Installed: $installed – up to date."
    elif [ -n "$installed" ] && version_gt "$installed" "$latest"; then
      action=current
      info "Installed: $installed – newer than the published version, leaving it."
    else
      action=update
      info "Installed: ${installed:-unknown version} – updating to $latest (pairings and settings are kept)."
    fi
  elif [ -f "$DESKTOP_FILE" ]; then
    action=unknown
    warn "i6-share Hub is installed in Chrome, but its files weren't found in $CHROME_DIR/*/iwa/,"
    warn "so this script can't update it. If you installed it from the update link"
    warn "($BASE_URL/hub/update.json), Chrome updates it by itself; to update right away use"
    warn "\"Perform update now\" / \"Update\" on chrome://web-app-internals (Chrome 153 and older)"
    warn "or chrome://iwa-dev (154+) while the hub window is closed."
  else
    action=install
    info "Not installed yet."
  fi

  # Chrome must be closed to change its flags (it rewrites "Local State" on exit),
  # to install (the install switch is ignored while it runs) and to swap the bundle.
  local was_running=0 flags_ok=0 pid
  if flags_enabled "$CHROME_DIR/Local State"; then flags_ok=1; fi
  if pid="$(chrome_pid "$CHROME_DIR")"; then
    if [ "$flags_ok" = 0 ] || [ "$action" = install ] || [ "$action" = update ]; then
      was_running=1
      info "Closing Google Chrome (it is started again at the end)"
      close_chrome "$CHROME_DIR" "$pid" || die "Chrome did not quit. Close it and run the installer again."
    fi
  fi

  # ---------------------------------------------------------------- flags
  step "Enabling Isolated Web Apps"
  if [ "$flags_ok" = 1 ]; then
    info "chrome://flags → Isolated Web Apps + Developer Mode: already enabled"
  else
    mkdir -p "$CHROME_DIR"
    python3 - "$CHROME_DIR/Local State" <<'PY'
import json, os, sys
path = sys.argv[1]
try:
    with open(path) as f:
        state = json.load(f)
except FileNotFoundError:
    state = {}
browser = state.setdefault('browser', {})
flags = [f for f in browser.get('enabled_labs_experiments', [])
         if not f.startswith(('enable-isolated-web-apps@', 'enable-isolated-web-app-dev-mode@'))]
flags += ['enable-isolated-web-apps@1', 'enable-isolated-web-app-dev-mode@1']
browser['enabled_labs_experiments'] = flags
tmp = path + '.i6tmp'
with open(tmp, 'w') as f:
    json.dump(state, f)
os.replace(tmp, path)
PY
    info "chrome://flags → Isolated Web Apps + Developer Mode: Enabled"
  fi

  # Older versions of this installer added a login autostart entry: remove it.
  local old_autostart="$CONFIG/autostart/i6-share-hub.desktop"
  if [ -f "$old_autostart" ] && grep -q '^Name=i6-share Hub' "$old_autostart"; then
    rm -f "$old_autostart"
    info "Removed the old login autostart entry ($old_autostart)."
  fi

  # ---------------------------------------------------------------- firewall
  if [ "$FIREWALL" = 1 ]; then
    step "Firewall (TCP $PORT)"
    open_firewall "$PORT"
  fi

  # ---------------------------------------------------------------- hub
  local bundle="$I6_DIR/i6-share-hub.swbn"
  if [ "$action" = install ] || [ "$action" = update ]; then
    step "Downloading the hub $latest"
    curl -fL --progress-bar -o "$bundle.tmp" "$BASE_URL/hub/i6-share-hub.swbn"
    check_sha "$bundle.tmp" "$sha"
    mv "$bundle.tmp" "$bundle"
  fi
  case "$action" in
    install) install_hub ;;
    update) update_hub ;;
  esac

  # ---------------------------------------------------------------- start again
  if [ "$was_running" = 1 ] && ! chrome_pid "$CHROME_DIR" >/dev/null; then
    step "Starting Google Chrome again"
    launch_chrome
    for _ in $(seq 1 40); do chrome_pid "$CHROME_DIR" >/dev/null && break; sleep 0.5; done
    sleep 2   # let it finish starting before asking it for the hub window
  fi
  step "Opening i6-share Hub"
  if [ "$was_running" = 0 ] && hub_listening "$PORT"; then
    info "It is already open."   # a second window would only wait for the first one
  else
    launch_chrome --profile-directory=Default --app-id="$APP_ID"
    info "google-chrome --profile-directory=Default --app-id=$APP_ID"
  fi

  # ---------------------------------------------------------------- done
  local ip
  # Source address of the default route (no packet is sent).
  ip="$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -1 || true)"
  printf '\n\033[1;32m✓ Done.\033[0m The hub window is open.\n'
  echo "  It listens${ip:+ on $ip:$PORT} only while its window is open; close it to stop."
  echo "  Nothing starts at login: open \"i6-share Hub\" from your app menu when you want to receive."
  echo "  To update later, run the same command again – pairings and settings are kept."
  if [ "$action" = install ]; then
    echo "  First start: name the computer and pick a folder for received files."
    echo "  On your Android phone open $BASE_URL/ in Chrome, install it,"
    echo "  then scan the QR code shown by the hub. After that, Share → i6-share just works."
  fi
}

# ------------------------------------------------------------------ install / update
# (these use main's locals)

install_hub() {
  step "Installing the hub into Chrome"
  local first_run=()
  if [ ! -e "$CHROME_DIR/First Run" ]; then
    if [ "$SKIP_WELCOME" = 1 ]; then
      first_run=(--no-first-run)   # skip Chrome's welcome dialog now and later
      touch "$CHROME_DIR/First Run"
    else
      info "Chrome is starting for the first time: answer its welcome dialog to continue."
    fi
  fi
  local log="$I6_DIR/install.log"
  : > "$log"
  setsid google-chrome "${first_run[@]}" --enable-logging=stderr --install-isolated-web-app-from-file="$bundle" >"$log" 2>&1 </dev/null &
  local result=""
  for _ in $(seq 1 600); do
    result="$(grep -o 'command line installation [a-z]*[^"]*' "$log" 2>/dev/null | head -1 || true)"
    [ -n "$result" ] && break
    sleep 0.5
  done
  case "$result" in
    *successful*) info "Installed i6-share Hub $latest" ;;
    *"already installed"*) info "i6-share Hub was already installed in Chrome" ;;
    "") die "Chrome did not report an install result. See $log" ;;
    *) die "Chrome said: $result (see $log)" ;;
  esac
  echo "$latest" > "$MARKER"
  for _ in $(seq 1 20); do [ -f "$DESKTOP_FILE" ] && break; sleep 0.5; done
  # Close the Chrome started for the install (it logs into $log); it is started normally below.
  local cpid
  if cpid="$(chrome_pid "$CHROME_DIR")"; then
    close_chrome "$CHROME_DIR" "$cpid" || true
  fi
}

# Chrome has no command-line update for IWAs, but with Chrome closed its stored copy
# of the signed bundle can be replaced: the app runs the new code on its next start
# and its data (pairings, settings) stays where it is.
update_hub() {
  step "Updating the hub to $latest"
  local backup_dir="$I6_DIR/backup" target tmp
  mkdir -p "$backup_dir"
  for target in "${bundles[@]}"; do
    cp "$target" "$backup_dir/main-${installed:-unknown}-$(date +%Y%m%d-%H%M%S).swbn"
    tmp="$target.i6new"
    cp "$bundle" "$tmp"
    chmod --reference="$target" "$tmp" 2>/dev/null || true
    mv -f "$tmp" "$target"
    info "Replaced ${target#"$CHROME_DIR"/}"
  done
  # Keep the 3 newest backups.
  find "$backup_dir" -maxdepth 1 -name 'main-*.swbn' -printf '%T@ %p\n' | sort -rn | tail -n +4 |
    cut -d' ' -f2- | while IFS= read -r f; do rm -f "$f"; done
  echo "$latest" > "$MARKER"
  info "Updated i6-share Hub ${installed:+$installed → }$latest (old copy in $backup_dir)."
  info "chrome://web-app-internals keeps showing the first installed version; the badge in the hub's corner shows the real one."
}

# ------------------------------------------------------------------ helpers

step() { printf '\n\033[1;35m==>\033[0m \033[1m%s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '    \033[33m%s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

# Starts Chrome detached from this terminal (goes to the running Chrome if there is one).
launch_chrome() {
  setsid google-chrome "$@" >/dev/null 2>&1 </dev/null &
}

# PID of the Chrome instance using this profile directory (via its SingletonLock).
chrome_pid() {
  local target pid
  target="$(readlink "$1/SingletonLock" 2>/dev/null)" || return 1
  pid="${target##*-}"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null || return 1
  echo "$pid"
}

close_chrome() {
  kill -TERM "$2" 2>/dev/null || true
  for _ in $(seq 1 30); do chrome_pid "$1" >/dev/null || return 0; sleep 0.5; done
  ! chrome_pid "$1" >/dev/null
}

flags_enabled() {
  [ -f "$1" ] && python3 - "$1" <<'PY' 2>/dev/null
import json, sys
flags = json.load(open(sys.argv[1])).get('browser', {}).get('enabled_labs_experiments', [])
sys.exit(0 if {'enable-isolated-web-apps@1', 'enable-isolated-web-app-dev-mode@1'} <= set(flags) else 1)
PY
}

# Version recorded inside a hub bundle (its manifest / build info).
bundle_version() {
  grep -aoE '"version": *"[0-9]+(\.[0-9]+)*"' "$1" 2>/dev/null | head -1 | grep -oE '[0-9]+(\.[0-9]+)*' || true
}

# True if a hub answers on this computer (it only listens while its window is open).
hub_listening() {
  curl -fsS -m 2 "http://127.0.0.1:$1/i6/hello" 2>/dev/null | grep -q '"app":"i6-share-hub"'
}

# version_gt A B: true if A is a higher version than B.
version_gt() {
  [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" = "$1" ]
}

json_get() {
  python3 -c 'import json,sys; print(json.loads(sys.argv[1])[sys.argv[2]])' "$1" "$2"
}

check_sha() {
  local got
  got="$(sha256sum "$1" | cut -d' ' -f1)"
  [ "$got" = "$2" ] || { rm -f "$1"; die "Checksum mismatch for the hub bundle (expected $2, got $got)."; }
  info "SHA-256 verified"
}

open_firewall() {
  local port="$1" changed=0 conf="${I6_NFT_CONF:-/etc/nftables.conf}"
  if command -v nft >/dev/null || [ -x /usr/sbin/nft ]; then
    local nft=/usr/sbin/nft rules
    command -v nft >/dev/null && nft=nft
    rules="$(sudo "$nft" list ruleset 2>/dev/null || true)"
    if [ -z "$rules" ]; then
      info "nftables: no rules loaded, nothing blocks port $port."
    elif grep -q "dport $port accept" <<<"$rules"; then
      info "nftables: port $port is already allowed."
    elif sudo "$nft" list chain inet filter input >/dev/null 2>&1; then
      sudo "$nft" insert rule inet filter input tcp dport "$port" accept
      info "nftables: allowed TCP $port in inet filter input."
      changed=1
      if [ -f "$conf" ] && grep -q 'chain input' "$conf" && ! grep -q "dport $port accept" "$conf"; then
        sudo cp "$conf" "$conf.i6bak"
        sudo sed -i "/chain input *{/a\\		tcp dport $port accept  # i6-share" "$conf"
        info "nftables: saved in $conf (backup: $conf.i6bak)."
      fi
    else
      warn "nftables has rules but no 'inet filter input' chain; allow TCP $port in your own ruleset."
    fi
  fi
  if [ "$changed" = 0 ] && command -v iptables >/dev/null; then
    local v4
    v4="$(sudo iptables -S INPUT 2>/dev/null || true)"
    if grep -qE '^-P INPUT (DROP|REJECT)|-j (DROP|REJECT)' <<<"$v4" && ! grep -q -- "--dport $port .*ACCEPT" <<<"$v4"; then
      sudo iptables -I INPUT -p tcp --dport "$port" -j ACCEPT
      sudo ip6tables -I INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || true
      info "iptables: allowed TCP $port (until reboot; use netfilter-persistent to keep it)."
    fi
  fi
  if command -v ufw >/dev/null && sudo ufw status 2>/dev/null | grep -q 'Status: active'; then
    warn "ufw is active: also run  sudo ufw allow $port/tcp"
  fi
  if command -v firewall-cmd >/dev/null && systemctl is-active --quiet firewalld 2>/dev/null; then
    warn "firewalld is active: also run  sudo firewall-cmd --add-port=$port/tcp --permanent && sudo firewall-cmd --reload"
  fi
}

# Everything runs from main so a partially downloaded script never executes.
main "$@"
