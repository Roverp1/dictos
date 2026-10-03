#!/usr/bin/env bash
set -euo pipefail

overlay_dir="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
"${CXX:-c++}" -std=c++17 -O2 -Wall -Wextra -Wpedantic \
  "$overlay_dir/native/ocr-server.cpp" \
  $(pkg-config --cflags --libs tesseract lept) \
  -o "$overlay_dir/native/ocr-server"
