#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../../.." && pwd -P)"
env_dir=/tmp/opencode/dictos-rapidocr-v6-small
[[ -x "$env_dir/venv/bin/python" ]] || {
  printf 'RapidOCR isolated environment is missing.\n' >&2
  exit 1
}

export HOME="$env_dir" XDG_CACHE_HOME="$env_dir/cache"
export OC_DISABLE_DOT_ACCESS_WARNING=1
export LD_LIBRARY_PATH="$(nix-instantiate --eval --raw -E '(import <nixpkgs> {}).stdenv.cc.cc.lib.outPath')/lib:$(nix-instantiate --eval --raw -E '(import <nixpkgs> {}).libglvnd.outPath')/lib:$(nix-instantiate --eval --raw -E '(import <nixpkgs> {}).glib.out.outPath')/lib:$(nix-instantiate --eval --raw -E '(import <nixpkgs> {}).zlib.outPath')/lib:$(nix-instantiate --eval --raw -E '(import <nixpkgs> {}).libxcb.outPath')/lib"

mode="${1:-bench}"
[[ "$mode" == bench || "$mode" == inspect-game ]] || {
  printf 'Usage: bash %s [bench|inspect-game]\n' "$0" >&2
  exit 2
}
option=''
if [[ "$mode" == inspect-game ]]; then option='--inspect-game'; fi
nix-shell -p python313Packages.omegaconf --run "'$env_dir/venv/bin/python' '$repo_dir/experiments/screen-text-selection/benchmarks/rapidocr/run.py' $option"
