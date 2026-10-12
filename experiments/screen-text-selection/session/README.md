# Session-scoped Tesseract OCR and timing probe

## Warm overlay launcher

Build the helper from the repository root with Tesseract and Leptonica:

```sh
nix-shell -p tesseract leptonica pkg-config --run 'c++ -std=c++17 -O2 -Wall -Wextra experiments/screen-text-selection/session/ocr-server.cpp -o experiments/screen-text-selection/session/ocr-server $(pkg-config --cflags --libs tesseract lept)'
bash experiments/screen-text-selection/run-warm.sh full
# Or avoid screen capture for a fixture:
bash experiments/screen-text-selection/run-warm.sh full --image /path/to/fixture.png --output YOUR_MONITOR
```

The launcher starts `TessBaseAPI` before `grim`, overlapping model setup with
screen capture. It shows the overlay when both are ready. QML loads the image,
then the first OCR request decodes it. Alt+drag retries reuse the API and image
with a padded crop. Word and symbol boxes use screenshot coordinates. The Bun
client sends each request over a local Unix socket and reads one JSON line.

A private session directory holds the socket and, for screen captures, the
temporary PNG. Closing the overlay stops the helper and removes those files; a
fixture image is left in place. Set `DICTOS_OCR_LANG` (default `eng+pol`),
`DICTOS_OCR_FULL_PSM` (default `3`), or `DICTOS_OCR_RETRY_PSM` (default `6`) to
change the OCR settings. Set `DICTOS_OCR_WARM_SERVER` to use a different helper
binary.

On this host, `eng+pol` initialization took 250 ms with a generated 800×300
English-text fixture. FULL (PSM 3), CROP (PSM 6), FULL took 10.3, 7.9, and
10.2 ms inside the helper. These fixture timings do not predict dense-screen OCR
or capture and overlay startup. Fixture-mode startup reported 260 ms to
initialize; Quickshell loaded before an 8-second timeout closed it.

One live launch took **209 ms** to capture and **263 ms** to initialize the
`eng+pol` model. Initialization overlapped capture, leaving **61 ms** of wait
after capture. The helper was ready about **270 ms** after launch. This is one
run, and it does not include overlay rendering or OCR. Dense-screen recognition
still takes about 3.5 seconds. The launcher removed the temporary capture and
helper when the test overlay exited. The sanitized timings are in
[`../benchmarks/stages-results.jsonl`](../benchmarks/stages-results.jsonl).

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

Each `result` includes `setImageMs`, `setRectangleMs`, `recognizeMs`,
`wordsMs`, `symbolsMs`, word and symbol counts, and `[x,y,width,height]` boxes.
Word and symbol iteration are timed after `Recognize`. Each request resets
`SetImage` on the same decoded `PIX`; a crop then applies `SetRectangle` to a
20-pixel-padded region clipped to the screenshot. `region` reports that padded
rectangle. Tesseract's iterator boxes are already screenshot-relative, so the
probe adds no crop-origin offset. Tests check that crop boxes stay in the
region and that FULL after CROP restores the original full boxes. Coordinates
are integer pixels from the screenshot's top-left. The probe returns boxes
only, without recognized text or symbol-to-word pairing.

Reproduce the measurements and coordinate check:

```sh
python3 -m unittest discover -s experiments/screen-text-selection/session -p 'test_*.py' -v
python3 experiments/screen-text-selection/session/bench.py tmp/screeshoots/500-words.png --repeats 3
python3 experiments/screen-text-selection/session/bench.py tmp/screeshoots/the-witcher-screenshoots/swappy-20260930_230327.png --repeats 2
# Save a comparable bilingual run without storing OCR text or absolute image paths:
python3 experiments/screen-text-selection/session/bench.py tmp/screeshoots/500-words.png --language eng+pol --sample-id dense-500 --repeats 3 --record experiments/screen-text-selection/benchmarks/session-results.jsonl
```

`bench.py` emits one JSON summary with median, minimum, and maximum times.
Cold FULL and CROP each start a fresh process. `cold*WallMs` includes launch,
decode, initialization, request, transport, and parsing. A warm cycle starts
one process and sends FULL, CROP, FULL; the first FULL and CROP supply the warm
timings. `warm*WallMs` includes the request, transport, and parsing, but not
launch, decode, or initialization. The final FULL checks that a crop did not
change the next result. `decodeMs`, `initMs`, and stage timings come from the
helper's `steady_clock`. The benchmark crops the middle half of each screenshot;
it does not use a manually selected text area.

Measured on this host (Tesseract 5.5.2, Leptonica 1.87.0; medians in ms; runs on 2026-10-01):

| Image          | Repeats | Cold ready | Cold FULL | Warm FULL | Cold CROP | Warm CROP | Decode | Init | FULL recognize | CROP recognize |
| -------------- | ------: | ---------: | --------: | --------: | --------: | --------: | -----: | ---: | -------------: | -------------: |
| 500-words.png  |       3 |        131 |      2542 |      2402 |       903 |       747 |     36 |   90 |           2364 |            739 |
| Witcher 230327 |       2 |        141 |       247 |       108 |       267 |       107 |     48 |   87 |             85 |            105 |
| Witcher 230506 |       2 |        149 |       294 |       156 |       373 |       214 |     49 |   94 |            133 |            212 |
| Witcher 230535 |       2 |        148 |       255 |       104 |       540 |       387 |     49 |   93 |             81 |            384 |

Cold-to-warm savings roughly match process startup, decode, and initialization
(about 130 to 150 ms here). That matters more on sparse frames than on the dense
image. This timing probe does not measure capture or overlay startup; the
separate live measurement is in
[`../benchmarks/stages-results.jsonl`](../benchmarks/stages-results.jsonl).
Image decoding still needs a completed screenshot. Crop times vary with the
image and PSM. Tesseract and Leptonica may write resolution estimates or image
warnings to stderr; stdout remains JSON. The two later Witcher runs overlapped,
so rerun them separately before comparing small timing differences.

Separate `eng+pol` results are in
[`../benchmarks/session-results.jsonl`](../benchmarks/session-results.jsonl). On
the dense frame, fresh FULL took a median **3810 ms**, compared with **3526 ms**
using an initialized instance. Model setup took **236 ms**, image decode **36
ms**, and recognition **3489 ms**. On the sparse Witcher frame, fresh FULL took
**399 ms**, compared with **107 ms** when reused; setup took **238 ms** and
decode **49 ms**. These benchmarks use a center crop, not a subtitle crop, so
the game boxes do not show subtitle accuracy. `grim` capture to memory took
**284 to 299 ms** in a separate test. The live warm-launch run confirms capture
and initialization overlapped once, but does not measure time to an overlay
selection.
