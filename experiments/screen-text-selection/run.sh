#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: bash %s full|region [--image PNG] [--output MONITOR]\n' "$0" >&2
  exit 2
}

[[ $# -ge 1 ]] || usage
mode="$1"
shift
[[ "$mode" == full || "$mode" == region ]] || usage

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

for tool in bun grim hyprctl qs magick tesseract; do
  command -v "$tool" >/dev/null 2>&1 || { printf 'Missing tool: %s\n' "$tool" >&2; exit 1; }
done

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if [[ -z "$output" ]]; then
  output="$(hyprctl monitors -j | bun -e '
    const monitors = await Bun.stdin.json();
    const monitor = monitors.find(m => m.focused) ?? monitors[0];
    if (!monitor?.name) process.exit(1);
    process.stdout.write(monitor.name);
  ')"
fi
[[ -n "$output" ]] || { printf 'Could not identify a monitor.\n' >&2; exit 1; }

if [[ -z "$image" ]]; then
  capture_dir="$(mktemp -d "${XDG_RUNTIME_DIR:-/tmp}/dictos-ocr.XXXXXX")"
  trap 'rm -rf -- "$capture_dir"' EXIT
  image="$capture_dir/capture.png"
  grim -o "$output" "$image"
else
  [[ -f "$image" ]] || { printf 'Screenshot does not exist: %s\n' "$image" >&2; exit 1; }
  image="$(realpath -- "$image")"
fi

export DICTOS_OCR_OUTPUT="$output"
export DICTOS_OCR_IMAGE="$image"
export DICTOS_OCR_IMAGE_URL="$(bun -e '
  import { pathToFileURL } from "node:url";
  process.stdout.write(pathToFileURL(process.argv[1]).href);
' "$image")"
export DICTOS_OCR_HELPER="$script_dir/ocr.ts"
export DICTOS_OCR_LANG="${DICTOS_OCR_LANG:-eng+pol}"
export QT_QUICK_BACKEND="${QT_QUICK_BACKEND:-software}"

qs -p "$script_dir/$mode"
