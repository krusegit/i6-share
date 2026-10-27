#!/usr/bin/env bash
# Install/update the native i6-share Hub for the current Linux user.
# curl -fsSL https://krusegit.github.io/i6-share/install.sh | bash
# No browser configuration, system packages, firewall rules, or login services are changed.
set -euo pipefail

die() { printf 'i6-share: %s\n' "$*" >&2; exit 1; }
main() (
  local base_url="${I6_BASE_URL:-https://krusegit.github.io/i6-share}"
  local data_dir="${XDG_DATA_HOME:-$HOME/.local/share}/i6-share"
  local bin_dir="${I6_BIN_DIR:-$HOME/.local/bin}"
  local rollback=false
  for option in "$@"; do
    case "$option" in
      --rollback) rollback=true ;;
      --yes|-y|--no-firewall) ;; # accepted for compatibility; installation never prompts or edits a firewall
      --help|-h)
        printf '%s\n' 'Usage: install.sh [--rollback] [--yes] [--no-firewall]' \
          'Installs a native Linux hub into your account; run i6-share-hub --open afterward.' \
          '--rollback selects the previous installed executable; user data is unchanged.'
        return ;;
      *) die "unknown option: $option" ;;
    esac
  done
  [ "$(uname -s)" = Linux ] || die 'The installer supports Linux. Build from source on other operating systems.'
  [ "$(id -u)" -ne 0 ] || die 'Run the installer as your normal user, not root.'
  local rid
  case "$(uname -m)" in
    x86_64|amd64) rid=linux-x64 ;;
    aarch64|arm64) rid=linux-arm64 ;;
    *) die 'Supported architectures are x64 and ARM64.' ;;
  esac
  for dependency in curl python3; do command -v "$dependency" >/dev/null || die "Install the required tool first: $dependency"; done
  umask 077
  mkdir -p "$data_dir/releases" "$bin_dir" "${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  local stage
  stage="$(mktemp -d "$data_dir/.install.XXXXXX")"
  trap 'rm -rf -- "$stage"' EXIT
  local previous current
  current="$(readlink "$data_dir/current" || true)"
  if [ "$rollback" = true ]; then
    previous="$(readlink "$data_dir/previous" || true)"
    [ -n "$previous" ] && [ -x "$data_dir/$previous/i6-share-hub" ] || die 'No previous native installation is available.'
    ln -s "$previous" "$stage/current"
    python3 -c 'import os, sys; os.replace(sys.argv[1], sys.argv[2])' "$stage/current" "$data_dir/current"
    if [ -n "$current" ]; then ln -s "$current" "$stage/previous"; python3 -c 'import os, sys; os.replace(sys.argv[1], sys.argv[2])' "$stage/previous" "$data_dir/previous"; fi
    printf '%s\n' 'Previous version selected. Restart the hub to use it.'
    return
  fi
  curl -fsSL "${base_url%/}/downloads/version.json" -o "$stage/version.json"
  local version sha archive size
  IFS=$'\t' read -r version sha archive size < <(python3 - "$stage/version.json" "$rid" <<'PY'
import json, re, sys
with open(sys.argv[1], encoding='utf-8') as source:
    metadata = json.load(source)
version = metadata['version']
artifact = metadata['artifacts'][sys.argv[2]]
name, digest, size = artifact['file'], artifact['sha256'], artifact['size']
if not isinstance(version, str) or re.fullmatch(r'[0-9]+(?:\.[0-9]+)*', version) is None:
    raise SystemExit('Invalid release version')
if name != 'i6-share-hub-' + sys.argv[2] + '.tar.gz':
    raise SystemExit('Unexpected archive name')
if not isinstance(digest, str) or re.fullmatch(r'[a-fA-F0-9]{64}', digest) is None:
    raise SystemExit('Invalid archive SHA-256')
if type(size) is not int or size <= 0:
    raise SystemExit('Invalid archive size')
print(version, digest.lower(), name, size, sep='\t')
PY
  ) || die 'Release metadata is invalid.'
  curl -fL --progress-bar "${base_url%/}/downloads/$archive" -o "$stage/archive.tar.gz"
  python3 - "$stage/archive.tar.gz" "$stage/content" "$sha" "$size" <<'PY'
import hashlib, os, pathlib, sys, tarfile
archive, destination, expected_hash, expected_size = sys.argv[1:]
if os.path.getsize(archive) != int(expected_size):
    raise SystemExit('Archive size does not match release metadata')
with open(archive, 'rb') as source:
    hasher = hashlib.sha256()
    for chunk in iter(lambda: source.read(1024 * 1024), b''):
        hasher.update(chunk)
    digest = hasher.hexdigest()
if digest != expected_hash:
    raise SystemExit('Archive SHA-256 does not match release metadata')
with tarfile.open(archive, 'r:gz') as bundle:
    members = bundle.getmembers()
    for entry in members:
        relative = pathlib.PurePosixPath(entry.name)
        if relative.is_absolute() or '..' in relative.parts or not (entry.isfile() or entry.isdir()):
            raise SystemExit('Unsafe archive entry: ' + entry.name)
        if relative.parts and relative.parts[0] not in ('i6-share-hub', 'wwwroot'):
            raise SystemExit('Unexpected archive entry: ' + entry.name)
    # Every entry was checked above; links and special files are forbidden.
    bundle.extractall(destination, members=members)
if not os.path.isfile(os.path.join(destination, 'i6-share-hub')) or not os.path.isfile(os.path.join(destination, 'wwwroot', 'index.html')):
    raise SystemExit('Archive is missing the hub executable or dashboard')
PY
  chmod 700 "$stage/content/i6-share-hub"
  local release="releases/$version-$rid-${sha:0:12}"
  if [ ! -d "$data_dir/$release" ]; then mv "$stage/content" "$data_dir/$release"; fi
  if [ -n "$current" ] && [ "$current" != "$release" ]; then
    ln -s "$current" "$stage/previous"
    python3 -c 'import os, sys; os.replace(sys.argv[1], sys.argv[2])' "$stage/previous" "$data_dir/previous"
  fi
  ln -s "$release" "$stage/current"
  python3 -c 'import os, sys; os.replace(sys.argv[1], sys.argv[2])' "$stage/current" "$data_dir/current"
  {
    printf '#!/usr/bin/env bash\nset -euo pipefail\n'
    printf 'exec %q --web-root %q "$@"\n' "$data_dir/current/i6-share-hub" "$data_dir/current/wwwroot"
  } > "$stage/launcher"
  chmod 700 "$stage/launcher"
  mv -f "$stage/launcher" "$bin_dir/i6-share-hub"
  python3 - "$bin_dir/i6-share-hub" "${XDG_DATA_HOME:-$HOME/.local/share}/applications/i6-share-hub.desktop" <<'PY'
import sys
launcher = sys.argv[1].replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$').replace('%', '%%')
with open(sys.argv[2], 'w', encoding='utf-8') as output:
    output.write('[Desktop Entry]\nType=Application\nName=i6-share Hub\nComment=Share files over your local network\nExec="' + launcher + '" --open\nTerminal=true\nCategories=Network;FileTransfer;\n')
PY
  printf 'Installed i6-share Hub %s (%s).\nStart: %s --open\n' "$version" "$rid" "$bin_dir/i6-share-hub"
  printf '%s\n' 'Keep a dashboard tab open to receive files. Closing the last tab stops the hub; Ctrl+C also stops it.' \
    'Existing processes must be restarted after an update. Nothing starts automatically at login.'
)
main "$@"
