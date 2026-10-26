#!/usr/bin/env bash
# i6-share Hub installer for Debian 13 (trixie).
#
#   curl -fsSL https://krusegit.github.io/i6-share/install.sh | bash
#
# Options (pass after `bash -s --`):
#   --yes            don't ask; close Google Chrome automatically if it is open
#   --no-firewall    leave nftables/iptables alone
#   --no-autostart   don't start the hub when you log in
#   --no-launch      don't open the hub at the end
#
# What it does:
#   1. installs Google Chrome (Google's .deb, which also adds Google's apt repo)
#   2. enables the two Chrome flags Isolated Web Apps need (same as chrome://flags)
#   3. downloads the signed hub bundle, checks its SHA-256 and installs it in Chrome
#   4. starts the hub at login and opens it now
#   5. opens TCP port 47616 if nftables/iptables rules would block it
#
# Run it as your normal desktop user from a terminal inside your desktop session.
# It uses sudo only for apt and the firewall.

main() {
  set -euo pipefail

  local BASE_URL="${I6_BASE_URL:-https://krusegit.github.io/i6-share}"
  local PORT=47616
  local APP_ID=jijddeenooofgclmjgcfmgeggbnmbgoa   # Chrome's id for isolated-app://co7xx…aaic
  local CHROME_DEB=https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb

  local ASSUME_YES=0 FIREWALL=1 AUTOSTART=1 LAUNCH=1
  for arg in "$@"; do
    case "$arg" in
      -y|--yes) ASSUME_YES=1 ;;
      --no-firewall) FIREWALL=0 ;;
      --no-autostart) AUTOSTART=0 ;;
      --no-launch) LAUNCH=0 ;;
      -h|--help) sed -n '2,22p' "${BASH_SOURCE[0]:-/dev/null}" 2>/dev/null || true; return 0 ;;
      *) die "unknown option: $arg" ;;
    esac
  done

  local CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"
  local DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
  local CHROME_DIR="$CONFIG/google-chrome"
  local I6_DIR="$DATA/i6-share"
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

  # Chrome must be closed: its settings file is rewritten on exit, and the
  # install switch is ignored when Chrome is already running.
  local pid
  if pid="$(chrome_pid "$CHROME_DIR")"; then
    if [ "$ASSUME_YES" = 1 ] || confirm "Google Chrome is open. Close it now? (tabs come back next time)"; then
      info "Closing Chrome"
      kill -TERM "$pid" 2>/dev/null || true
      for _ in $(seq 1 30); do chrome_pid "$CHROME_DIR" >/dev/null || break; sleep 0.5; done
      ! chrome_pid "$CHROME_DIR" >/dev/null || die "Chrome is still running. Close it and run the installer again."
    else
      die "Close Google Chrome, then run the installer again."
    fi
  fi

  # ---------------------------------------------------------------- flags
  step "Enabling Isolated Web Apps"
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

  # ---------------------------------------------------------------- hub bundle
  step "Downloading the hub"
  local meta version sha bundle="$I6_DIR/i6-share-hub.swbn"
  meta="$(curl -fsSL "$BASE_URL/hub/version.json")" || die "Could not reach $BASE_URL"
  version="$(json_get "$meta" version)"
  sha="$(json_get "$meta" sha256)"
  info "Latest version: $version"
  local installed=""
  [ -f "$I6_DIR/installed-version" ] && installed="$(cat "$I6_DIR/installed-version")"

  if [ -f "$DESKTOP_FILE" ] && [ -n "$installed" ]; then
    if [ "$installed" = "$version" ]; then
      info "i6-share Hub $installed is already installed and up to date."
    else
      curl -fL --progress-bar -o "$bundle.tmp" "$BASE_URL/hub/i6-share-hub.swbn"
      check_sha "$bundle.tmp" "$sha"
      mv "$bundle.tmp" "$bundle"
      warn "i6-share Hub $installed is installed; $version is available."
      warn "Chrome can't replace a file-installed app from the command line. To update while keeping your pairings:"
      warn "  open chrome://web-app-internals (Chrome 153 and older) or chrome://iwa-dev (154+),"
      warn "  choose \"Perform update now\" / \"Update\" for i6-share Hub and pick $bundle"
    fi
  else
    curl -fL --progress-bar -o "$bundle.tmp" "$BASE_URL/hub/i6-share-hub.swbn"
    check_sha "$bundle.tmp" "$sha"
    mv "$bundle.tmp" "$bundle"

    step "Installing the hub into Chrome"
    local log="$I6_DIR/install.log"
    : > "$log"
    local first_run=()
    if [ ! -e "$CHROME_DIR/First Run" ]; then
      if [ "$ASSUME_YES" = 1 ]; then
        # Skip Chrome's welcome dialog now and later (it would block the hub window).
        first_run=(--no-first-run)
        touch "$CHROME_DIR/First Run"
      else
        info "Chrome is starting for the first time: answer its welcome dialog to continue."
      fi
    fi
    setsid google-chrome "${first_run[@]}" --enable-logging=stderr --install-isolated-web-app-from-file="$bundle" >"$log" 2>&1 </dev/null &
    local result=""
    for _ in $(seq 1 600); do
      result="$(grep -o 'command line installation [a-z]*[^"]*' "$log" 2>/dev/null | head -1 || true)"
      [ -n "$result" ] && break
      sleep 0.5
    done
    case "$result" in
      *successful*) info "Installed i6-share Hub $version" ;;
      *"already installed"*) info "i6-share Hub was already installed in Chrome" ;;
      "") die "Chrome did not report an install result. See $log" ;;
      *) die "Chrome said: $result (see $log)" ;;
    esac
    echo "$version" > "$I6_DIR/installed-version"
    for _ in $(seq 1 20); do [ -f "$DESKTOP_FILE" ] && break; sleep 0.5; done
  fi

  # ---------------------------------------------------------------- autostart + launch
  local exec_line="google-chrome --profile-directory=Default --app-id=$APP_ID"
  if [ -f "$DESKTOP_FILE" ]; then
    exec_line="$(sed -n 's/^Exec=//p' "$DESKTOP_FILE" | head -1)"
  fi
  if [ "$AUTOSTART" = 1 ]; then
    step "Starting the hub at login"
    mkdir -p "$CONFIG/autostart"
    cat > "$CONFIG/autostart/i6-share-hub.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=i6-share Hub
Comment=Receive files from your phone over the local network
Exec=$exec_line
Icon=chrome-$APP_ID-Default
Terminal=false
X-GNOME-Autostart-enabled=true
EOF
    info "$CONFIG/autostart/i6-share-hub.desktop"
  fi

  # ---------------------------------------------------------------- firewall
  if [ "$FIREWALL" = 1 ]; then
    step "Firewall (TCP $PORT)"
    open_firewall "$PORT"
  fi

  if [ "$LAUNCH" = 1 ]; then
    step "Opening i6-share Hub"
    # shellcheck disable=SC2086
    setsid $exec_line >/dev/null 2>&1 </dev/null &
  fi

  # ---------------------------------------------------------------- done
  local ip
  # Source address of the default route (no packet is sent).
  ip="$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -1 || true)"
  printf '\n\033[1;32m✓ Done.\033[0m\n'
  echo "  The hub runs in Chrome as \"i6-share Hub\"${ip:+ and listens on $ip:$PORT}."
  echo "  First start: name the computer and pick a folder for received files."
  echo "  On your Android phone open $BASE_URL/ in Chrome, install it,"
  echo "  then scan the QR code shown by the hub. After that, Share → i6-share just works."
}

# ------------------------------------------------------------------ helpers

step() { printf '\n\033[1;35m==>\033[0m \033[1m%s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '    \033[33m%s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

confirm() {
  local reply
  [ -r /dev/tty ] || return 1
  printf '    %s [Y/n] ' "$1" > /dev/tty
  read -r reply < /dev/tty || return 1
  case "$reply" in [nN]*) return 1 ;; *) return 0 ;; esac
}

# PID of the Chrome instance using this profile directory (via its SingletonLock).
chrome_pid() {
  local target pid
  target="$(readlink "$1/SingletonLock" 2>/dev/null)" || return 1
  pid="${target##*-}"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null || return 1
  echo "$pid"
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
