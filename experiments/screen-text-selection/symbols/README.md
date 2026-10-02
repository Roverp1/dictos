# Word and symbol OCR probe

Build with official nixpkgs development libraries (no repo dependency changes):

```sh
nix-shell -p tesseract leptonica pkg-config --run 'c++ -std=c++17 -O2 -Wall -Wextra experiments/screen-text-selection/symbols/ocr-symbols.cpp -o experiments/screen-text-selection/symbols/ocr-symbols $(pkg-config --cflags --libs tesseract lept)'
experiments/screen-text-selection/symbols/ocr-symbols tmp/screeshoots/500-words.png eng+pol 3
```

Arguments match `ocr.ts`: PNG path, language, and PSM (3, 6, or 11). Add
`X Y WIDTH HEIGHT` to recognize a padded crop of the original screenshot. For
example: `ocr-symbols image.png pol 6 910 440 175 39`.

Cropped output includes the padded `region` and
`coordinateSpace: "screenshot"`. Word and symbol boxes already use screenshot
pixels, so do not add the crop origin. The JSON also includes `elapsedMs` (image
load, initialization, recognition, and extraction), image `width` and `height`,
`symbolCount`, and `words`. Each word has text, a box, block, line, confidence,
and symbols. Each symbol has its own text, box, and confidence. Failures go to
stderr and return a nonzero exit status.

`line` uses the `block:paragraph:line` format from `ocr.ts`, with sequential
iterator counters rather than TSV IDs. Tesseract symbols are recognition units,
not Unicode grapheme clusters, and their text can contain multiple code points.
JSON keeps the UTF-8 intact. Some words have no usable symbol boxes; their
`symbols` array is empty.
