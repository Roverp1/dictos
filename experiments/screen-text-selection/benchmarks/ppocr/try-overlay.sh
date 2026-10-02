#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_dir="$(realpath -- "$script_dir/../../../..")"
env_dir=/tmp/opencode/dictos-ppocr-v6

[[ -x "$env_dir/venv/bin/python" ]] || {
  printf 'PP-OCRv6 environment missing. See %s/README.md\n' "$script_dir" >&2
  exit 1
}
command -v nix-instantiate >/dev/null || {
  printf 'nix-instantiate is needed for the isolated wheel runtime.\n' >&2
  exit 1
}

export HOME="$env_dir"
export XDG_CACHE_HOME="$env_dir/cache" PIP_CACHE_DIR="$env_dir/pip-cache"
export PADDLE_PDX_CACHE_HOME="$env_dir/models" PADDLE_PDX_MODEL_SOURCE=BOS
export OMP_NUM_THREADS=4
export LD_LIBRARY_PATH="$(nix-instantiate --eval --raw -E '(import <nixpkgs> {}).stdenv.cc.cc.lib.outPath')/lib:$(nix-instantiate --eval --raw -E '(import <nixpkgs> {}).libglvnd.outPath')/lib:$(nix-instantiate --eval --raw -E '(import <nixpkgs> {}).glib.out.outPath')/lib"
export DICTOS_OCR_PP_PYTHON="$env_dir/venv/bin/python"
export DICTOS_OCR_PP_HELPER="$script_dir/ocr_words.py"
export DICTOS_OCR_PP_TIER="${DICTOS_OCR_PP_TIER:-small}"

exec bash "$repo_dir/experiments/screen-text-selection/run.sh" full "$@"
