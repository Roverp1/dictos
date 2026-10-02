#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: bash %s full [--image PNG] [--output MONITOR]\n' "$0" >&2
  exit 2
}

[[ $# -ge 1 && "$1" == full ]] || usage
shift
image=''
output=''
while (($#)); do
  case "$1" in
    --image|--output)
      (($# >= 2)) || usage
      if [[ "$1" == --image ]]; then image="$2"; else output="$2"; fi
      shift 2
      ;;
    *) usage ;;
  esac
done

for tool in bun qs; do
  command -v "$tool" >/dev/null 2>&1 || { printf 'Missing tool: %s\n' "$tool" >&2; exit 1; }
done
if [[ -z "$image" ]]; then
  command -v grim >/dev/null 2>&1 || { printf 'Missing tool: grim\n' >&2; exit 1; }
fi
if [[ -z "$output" ]]; then
  command -v hyprctl >/dev/null 2>&1 || { printf 'Missing tool: hyprctl\n' >&2; exit 1; }
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
helper="${DICTOS_OCR_WARM_SERVER:-$script_dir/session/ocr-server}"
[[ -x "$helper" ]] || { printf 'Build the warm OCR server first: %s\n' "$helper" >&2; exit 1; }
if [[ -z "$output" ]]; then
  output="$(hyprctl monitors -j | bun -e '
    const monitors = await Bun.stdin.json();
    const monitor = monitors.find(m => m.focused) ?? monitors[0];
    if (!monitor?.name) process.exit(1);
    process.stdout.write(monitor.name);
  ')"
fi
[[ -n "$output" ]] || { printf 'Could not identify a monitor.\n' >&2; exit 1; }

if [[ -n "$image" ]]; then
  [[ -f "$image" ]] || { printf 'Screenshot does not exist: %s\n' "$image" >&2; exit 1; }
  image="$(realpath -- "$image")"
fi

umask 077
session_dir="$(mktemp -d "${XDG_RUNTIME_DIR:-/tmp}/dictos-ocr.XXXXXX")"
server_pid=''
cleanup() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -f -- "$session_dir/capture.png" "$session_dir/socket" "$session_dir/ready" "$session_dir/server.log"
  rmdir -- "$session_dir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ -z "$image" ]]; then image="$session_dir/capture.png"; fi
export DICTOS_OCR_LANG="${DICTOS_OCR_LANG:-eng+pol}"
export DICTOS_OCR_SOCKET="$session_dir/socket"
export DICTOS_OCR_WARM_CLIENT="$script_dir/session/client.ts"
export DICTOS_OCR_OUTPUT="$output"
export DICTOS_OCR_IMAGE="$image"
export DICTOS_OCR_IMAGE_URL="$(bun -e '
  import { pathToFileURL } from "node:url";
  process.stdout.write(pathToFileURL(process.argv[1]).href);
' "$image")"
export DICTOS_OCR_HELPER="$script_dir/ocr.ts"
export QT_QUICK_BACKEND="${QT_QUICK_BACKEND:-software}"

# Initialize while grim captures the original screenshot.
started_us="${EPOCHREALTIME/./}"
"$helper" "$session_dir/socket" "$image" "$DICTOS_OCR_LANG" >"$session_dir/ready" 2>"$session_dir/server.log" &
server_pid=$!
if [[ "$image" == "$session_dir/capture.png" ]]; then grim -o "$output" "$image"; fi
captured_us="${EPOCHREALTIME/./}"
for ((attempt = 0; attempt < 500; attempt++)); do
  if [[ -S "$session_dir/socket" && -s "$session_dir/ready" ]]; then break; fi
  if ! kill -0 "$server_pid" 2>/dev/null; then break; fi
  sleep 0.01
done
if [[ ! -S "$session_dir/socket" || ! -s "$session_dir/ready" ]]; then
  printf 'Warm OCR failed to initialize for %s.\n' "$DICTOS_OCR_LANG" >&2
  exit 1
fi
if ! IFS= read -r ready <"$session_dir/ready" || [[ "$ready" != \{\"ready\":true,* ]]; then
  printf 'Warm OCR server failed to initialize.\n' >&2
  exit 1
fi
rm -f -- "$session_dir/ready"
printf 'Warm OCR initialized: %s\n' "$ready" >&2
if [[ "$image" == "$session_dir/capture.png" ]]; then
  ready_us="${EPOCHREALTIME/./}"
  printf 'Capture: %d ms; wait for model after capture: %d ms\n' \
    "$(((captured_us - started_us) / 1000))" "$(((ready_us - captured_us) / 1000))" >&2
fi
qs -p "$script_dir/full"
