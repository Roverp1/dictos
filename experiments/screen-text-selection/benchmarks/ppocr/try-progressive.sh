#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_dir="$(realpath -- "$script_dir/../../../..")"
native="$repo_dir/experiments/screen-text-selection/symbols/ocr-symbols"

[[ -x "$native" ]] || {
  printf 'Build the native symbol helper first. See experiments/screen-text-selection/symbols/README.md\n' >&2
  exit 1
}

export DICTOS_OCR_PROGRESSIVE=1
export DICTOS_OCR_NATIVE_HELPER="$native"
export DICTOS_OCR_PP_TIER="${DICTOS_OCR_PP_TIER:-small}"
exec bash "$script_dir/try-overlay.sh" "$@"
