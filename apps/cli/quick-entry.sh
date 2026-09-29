#!/usr/bin/env bash
set -uo pipefail

usage() {
  printf 'Usage: %s [--lang LANG] [--folder FOLDER_ID] [--verbose] [--notify-success]\n' "${0##*/}"
}

notify() {
  if command -v notify-send >/dev/null 2>&1; then
    notify-send -a Dictos "$1" "$2" >/dev/null 2>&1 || :
  fi
}

fail() {
  printf 'quick-entry: %s\n' "$1" >&2
  notify 'Dictos Entry failed' "$1"
  exit "${2:-1}"
}

lang="${DICTOS_OCR_LANG:-eng}"
folder_args=()
verbose=false
notify_success=false

while (($#)); do
  case "$1" in
    --lang|--folder)
      if (($# < 2)) || [[ -z "$2" ]]; then
        fail "$1 needs a value" 2
      fi
      if [[ "$1" == --lang ]]; then
        lang="$2"
      else
        folder_args=(--folder "$2")
      fi
      shift 2
      ;;
    --verbose)
      verbose=true
      shift
      ;;
    --notify-success)
      notify_success=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1" 2
      ;;
  esac
done

for tool in slurp grim tesseract bun; do
  command -v "$tool" >/dev/null 2>&1 || fail "Missing executable: $tool"
done

# slurp reports Escape on stderr, as it does display/protocol failures.
if selection="$(slurp </dev/null 2>&1)"; then
  region="${selection##*$'\n'}"
  [[ -n "$region" ]] || fail 'No screen region selected'
elif [[ "$selection" == *'selection cancelled' ]]; then
  exit 0
else
  fail "Screen selection failed: $selection"
fi

if text="$(grim -g "$region" - | tesseract stdin stdout -l "$lang" --psm 6 quiet | tr -s '[:space:]' ' ' | sed 's/^ //; s/ $//')"; then
  [[ -n "$text" ]] || fail 'No text recognized in the selected region'
else
  fail 'Screenshot or OCR failed'
fi

cli_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)" || fail 'Cannot locate the Dictos CLI'
if entry_id="$(bun --cwd "$cli_dir" src/index.ts entry create "${folder_args[@]}" --text "$text")"; then
  if [[ "$verbose" == true ]]; then
    printf '%s\n%s\n' "$text" "$entry_id"
  fi
  if [[ "$notify_success" == true ]]; then
    notify 'Dictos Entry saved' "$text"
  fi
else
  status=$?
  fail "Could not save Entry (CLI exited $status)" "$status"
fi
