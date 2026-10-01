# Session-scoped Tesseract timing probe

Build from the repository root with official libtesseract and Leptonica headers:

```sh
nix-shell -p tesseract leptonica pkg-config --run 'c++ -std=c++17 -O2 -Wall -Wextra experiments/screen-text-selection/session/session-probe.cpp -o experiments/screen-text-selection/session/session-probe $(pkg-config --cflags --libs tesseract lept)'
```

Run a session on a fixed screenshot (stdin remains open for more requests):

```sh
experiments/screen-text-selection/session/session-probe tmp/screeshoots/500-words.png eng
# Send FULL, CROP 100 100 400 300, FULL, QUIT, one command per line.
```

The first newline-terminated JSON record is `ready` (`width`, `height`, `decodeMs` for `pixRead`, `initMs` for `api.Init`). Subsequent commands are `FULL [PSM]` (default 3), `CROP X Y WIDTH HEIGHT [PSM]` (default 6), and `QUIT`. PSM accepts 3, 6, or 11. Invalid commands produce a JSON `error` record and leave the process ready for another command. EOF or `QUIT` ends the process and frees the API and image. No daemon, network service, or transcript is produced.

Each `result` record reports `setImageMs` (including page segmentation mode), `setRectangleMs`, `recognizeMs`, `wordsMs`, `symbolsMs`, `wordCount`, `symbolCount`, and arrays of `[x,y,width,height]` boxes. Word and symbol iteration are timed independently after explicit `Recognize`. Each request resets `SetImage` on the **same decoded PIX**; crops then apply `SetRectangle` to a rectangle padded by 20 pixels on each side and clipped to the screenshot. `region` is the actual padded rectangle. Tesseract's iterator boxes with `SetRectangle` are already screenshot-relative, so **no crop-origin offset is added**; the probe's test checks the crop boxes lie in the padded rectangle and that `FULL` after `CROP` restores identical full boxes. Coordinates are integer screenshot pixels with top-left origin. These are bounding boxes only, with no recognized text or pairing of symbols to words.

Reproduce the measurements and coordinate check:

```sh
python3 -m unittest discover -s experiments/screen-text-selection/session -p 'test_*.py' -v
python3 experiments/screen-text-selection/session/bench.py tmp/screeshoots/500-words.png --repeats 3
python3 experiments/screen-text-selection/session/bench.py tmp/screeshoots/the-witcher-screenshoots/swappy-20260930_230327.png --repeats 2
# Save a comparable bilingual run without storing OCR text or absolute image paths:
python3 experiments/screen-text-selection/session/bench.py tmp/screeshoots/500-words.png --language eng+pol --sample-id dense-500 --repeats 3 --record experiments/screen-text-selection/benchmarks/session-results.jsonl
```

`bench.py` emits one JSON summary with median/min/max milliseconds. Cold FULL and CROP each start a fresh process; `cold*WallMs` includes launch, decode, init, request, JSON transport and parsing. A warm cycle starts one process and sends FULL, CROP, FULL; only the first FULL and CROP are included in warm timings. `warm*WallMs` includes request/JSON transport and parsing but excludes launch/decode/init. The second FULL exercises reset. `decodeMs`, `initMs`, and the per-stage timings are internal `steady_clock` measurements. The crop used by the benchmark is the middle half of each screenshot, not a manually selected text area.

Measured on this host (Tesseract 5.5.2, Leptonica 1.87.0; medians in ms; runs on 2026-10-01):

| Image          | Repeats | Cold ready | Cold FULL | Warm FULL | Cold CROP | Warm CROP | Decode | Init | FULL recognize | CROP recognize |
| -------------- | ------: | ---------: | --------: | --------: | --------: | --------: | -----: | ---: | -------------: | -------------: |
| 500-words.png  |       3 |        131 |      2542 |      2402 |       903 |       747 |     36 |   90 |           2364 |            739 |
| Witcher 230327 |       2 |        141 |       247 |       108 |       267 |       107 |     48 |   87 |             85 |            105 |
| Witcher 230506 |       2 |        149 |       294 |       156 |       373 |       214 |     49 |   94 |            133 |            212 |
| Witcher 230535 |       2 |        148 |       255 |       104 |       540 |       387 |     49 |   93 |             81 |            384 |

The cold-to-warm improvement is roughly the launch/decode/init cost (about 130–150 ms here); it matters much more on sparse frames than on the dense screenshot. Starting the worker alongside screenshot capture can hide some startup latency, but this probe does **not** time capture or the overlay, so it cannot establish actual end-to-end overlap. Image decoding still requires the finished screenshot. Crop recognition remains expensive and varies by content/PSM. Tesseract/Leptonica may log resolution estimates or image warnings to stderr; stdout stays JSON-only. The two later Witcher runs were benchmarked concurrently, so use the script for isolated measurements before treating small differences as meaningful.

Separate **`eng+pol`** runs are recorded in [`../benchmarks/session-results.jsonl`](../benchmarks/session-results.jsonl). On the dense frame, fresh FULL took a median **3810 ms** versus **3526 ms** with one initialized instance; model initialization took **236 ms**, PNG decoding **36 ms**, and `Recognize` still took **3489 ms**. On the sparse Witcher frame, fresh FULL took **399 ms** versus **107 ms** when reused; initialization took **238 ms**, PNG decoding **49 ms**. The benchmark's crop is the middle half of each screenshot, not a tuned subtitle crop, so its noisy game boxes say nothing about subtitle accuracy. `grim` PNG capture to memory was independently measured at **284–299 ms** on the focused monitor; these timings were not run concurrently, so startup overlap remains a hypothesis.
