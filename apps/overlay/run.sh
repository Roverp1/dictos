#!/usr/bin/env bash
set -euo pipefail

overlay_dir="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
source "$overlay_dir/launch.sh"
run_overlay "$overlay_dir/qml" "$@"
