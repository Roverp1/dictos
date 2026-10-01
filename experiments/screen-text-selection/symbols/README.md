# Word and symbol OCR probe

Build with official nixpkgs development libraries (no repo dependency changes):

```sh
nix-shell -p tesseract leptonica pkg-config --run 'c++ -std=c++17 -O2 -Wall -Wextra experiments/screen-text-selection/symbols/ocr-symbols.cpp -o experiments/screen-text-selection/symbols/ocr-symbols $(pkg-config --cflags --libs tesseract lept)'
experiments/screen-text-selection/symbols/ocr-symbols tmp/screeshoots/500-words.png eng+pol 3
```

Arguments match `ocr.ts`: PNG path, language, and PSM (3, 6, or 11). An optional `X Y WIDTH HEIGHT` recognizes a padded rectangle on the original screenshot, for example `ocr-symbols image.png pol 6 910 440 175 39`. In that mode stdout includes the actual padded `region` and `coordinateSpace: "screenshot"`; both word and symbol boxes already use screenshot pixels. No crop origin needs to be added. stdout also reports `elapsedMs` (image load, initialization, one recognition, and extraction), image `width`/`height`, `symbolCount`, and `words`. Each word has `text`, `x`, `y`, `width`, `height`, `block`, `line`, `confidence`, and `symbols`; each symbol has its own `text`, box, and confidence. Failures print to stderr with nonzero exit status. `line` uses the same `block:paragraph:line` shape as `ocr.ts`, with sequential iterator counters, not necessarily TSV IDs. Symbols are Tesseract recognition units, not Unicode grapheme clusters; a symbol's text can contain multiple code points. UTF-8 is retained intact in JSON. Some recognized words may have no usable symbol boxes; their `symbols` array is empty.
