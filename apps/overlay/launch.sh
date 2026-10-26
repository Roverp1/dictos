#!/usr/bin/env bash

# A subshell keeps traps and the opening's environment local to this session.
run_overlay() (
  set -euo pipefail
  local qml_root="$1"
  shift
  local overlay_dir repo_dir image='' output='' helper snapshot languages session pid=''
  overlay_dir="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
  repo_dir="$(realpath "$overlay_dir/../..")"
  while (($#)); do
    case "$1" in
      --image|--output)
        (($# >= 2)) || { printf 'Missing value for %s\n' "$1" >&2; exit 2; }
        if [[ "$1" == --image ]]; then image="$2"; else output="$2"; fi
        shift 2
        ;;
      *) printf 'Usage: %s [--image PNG] [--output MONITOR]\n' "$0" >&2; exit 2 ;;
    esac
  done
  for tool in bun qs; do
    command -v "$tool" >/dev/null || { printf 'Missing tool: %s. Use devenv --profile overlay shell.\n' "$tool" >&2; exit 1; }
  done
  # Do not combine export and command substitution: export masks a failed bootstrap.
  snapshot="$(bun "$overlay_dir/src/prepare-launch.ts")" || exit $?
  export DICTOS_OVERLAY_CONFIG_SNAPSHOT="$snapshot"
  languages="$(bun "$overlay_dir/src/ocr-startup.ts" languages)" || exit $?
  helper="$overlay_dir/native/ocr-server"
  if [[ ! -x "$helper" || "$overlay_dir/native/ocr-server.cpp" -nt "$helper" ]]; then bash "$overlay_dir/build-native.sh"; fi
  if [[ -z "$output" && "${QT_QPA_PLATFORM:-}" != offscreen ]]; then
    output="$(hyprctl monitors -j | bun -e 'const monitors = await Bun.stdin.json(); const m = monitors.find(m => m.focused) ?? monitors[0]; if (!m) process.exit(1); process.stdout.write(m.name);')"
  fi
  if [[ -n "$image" ]]; then image="$(realpath "$image")"; [[ -f "$image" ]] || exit 2; fi
  umask 077
  session="$(mktemp -d "${XDG_RUNTIME_DIR:-/tmp}/dictos-overlay.XXXXXX")"
  cleanup() {
    if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi
    rm -f -- "$session/capture.png" "$session/socket" "$session/ready" "$session/helper.log"
    rmdir -- "$session"
  }
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  [[ -n "$image" ]] || image="$session/capture.png"
  export DICTOS_OCR_OUTPUT="$output"
  export DICTOS_OCR_IMAGE_URL="$(bun -e 'import {pathToFileURL} from "node:url"; process.stdout.write(pathToFileURL(process.argv[1]).href);' "$image")"
  export DICTOS_OCR_WARM_CLIENT="$overlay_dir/src/ocr-client.ts"
  export DICTOS_OCR_SOCKET="$session/socket"
  export DICTOS_CLI_PATH="$repo_dir/apps/cli/src/index.ts"
  "$helper" "$session/socket" "$image" "$languages" >"$session/ready" 2>"$session/helper.log" &
  pid=$!
  if [[ "$image" == "$session/capture.png" ]]; then grim -o "$output" "$image"; fi
  for ((attempt = 0; attempt < 500; attempt++)); do
    if [[ -s "$session/ready" ]] && IFS= read -r -n 16385 line <"$session/ready"; then break; fi
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.01
  done
  bun "$overlay_dir/src/ocr-startup.ts" check "$session/ready" || exit $?
  if [[ ! -S "$session/socket" ]] || ! kill -0 "$pid" 2>/dev/null; then
    printf 'Could not initialize OCR: helper stopped or its socket is unavailable. Check the overlay devenv shell setup.\n' >&2
    exit 1
  fi
  qs -p "$qml_root"
)
