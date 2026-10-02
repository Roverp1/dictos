# Session-scoped Tesseract OCR and timing probe

## Warm overlay launcher

Build the runnable helper from the repository root using official Tesseract/Leptonica packages:

```sh
nix-shell -p tesseract leptonica pkg-config --run 'c++ -std=c++17 -O2 -Wall -Wextra experiments/screen-text-selection/session/ocr-server.cpp -o experiments/screen-text-selection/session/ocr-server $(pkg-config --cflags --libs tesseract lept)'
bash experiments/screen-text-selection/run-warm.sh full
# Or avoid screen capture for a fixture:
bash experiments/screen-text-selection/run-warm.sh full --image /path/to/fixture.png --output YOUR_MONITOR
```

The second launcher starts `TessBaseAPI` initialization before calling `grim`, so model loading and PNG capture overlap. It waits for both to finish before showing the full overlay. OCR starts once the overlay loads that image. Alt+drag retries a padded crop with the same API and decoded image; all word/symbol boxes are screenshot-relative. Each request uses one Unix socket connection and returns one JSON line through the Bun client. A private session directory owns the socket and optional screenshot. Closing the overlay reaps the helper and removes those files; a supplied fixture is never deleted. `DICTOS_OCR_LANG` (default `eng+pol`), `DICTOS_OCR_FULL_PSM` (default `3`), and `DICTOS_OCR_RETRY_PSM` (default `6`) work as in the regular launcher. The helper executable may be overridden via `DICTOS_OCR_WARM_SERVER`.

On a generated 800×300 English-text fixture on this host, `eng+pol` initialization measured 250 ms; the same session's FULL (PSM 3), CROP (PSM 6), FULL took 10.3, 7.9, 10.2 ms inside the helper. Fixture OCR timings do not predict dense-screen OCR or overlay/capture latency. Fixture-mode overlay startup reported 260 ms initialization; the overlay loaded before an 8-second timeout closed it.

One live launch measured **209 ms** for `grim` capture and **263 ms** for `eng+pol` model initialization. Initialization ran during capture, leaving **61 ms** of waiting after capture. The helper was ready about **270 ms** after launch, rather than paying capture and initialization sequentially. These are one-run timings, not a latency guarantee; full-screen recognition still runs after that and dominates dense screens. The temporary capture and OCR process were both removed when the test overlay exited. The sanitized record is in [`../benchmarks/stages-results.jsonl`](../benchmarks/stages-results.jsonl).

Verify the real helper, transport, crop coordinates and reuse with a generated image (requires `magick`, `bun`, and the built helper):

```sh
python3 -m unittest discover -s experiments/screen-text-selection/session -p 'test_ocr_server.py' -v
bash -n experiments/screen-text-selection/run-warm.sh
```

## Timing-only probe

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
