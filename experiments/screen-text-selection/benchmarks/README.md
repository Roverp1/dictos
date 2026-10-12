# OCR benchmarks

Run from the repository root with an existing image from the ignored
`tmp/screeshoots/` directory. The runner does not capture or save screenshots.
It starts a fresh process for each repetition and appends one sanitized JSON
record per attempt to `benchmarks/results.jsonl`. stdout prints the same records.

```sh
bun experiments/screen-text-selection/benchmarks/run.ts --image tmp/screeshoots/500-words.png --sample-id dense-500 --engine cli --language eng+pol --psm 3 --repeat 2
bun experiments/screen-text-selection/benchmarks/run.ts --image tmp/screeshoots/the-witcher-screenshoots/swappy-20260930_230506.png --sample-id witcher-1 --engine native --language eng+pol --psm 3 --repeat 2 --omp-thread-limit 4 --model-label installed-default
```

`cli` runs `ocr.ts` through Bun. `native` uses the `symbols/ocr-symbols`
binary; see [`../symbols/README.md`](../symbols/README.md) to build it. Both
need Tesseract language data. The CLI and image-dimension lookup also need
ImageMagick (`magick`). PSM can be 3, 6, or 11. Repetitions range from 1 to 100;
the optional OMP thread limit ranges from 1 to 256.

The optional model label is supplied by the user; the runner does not detect
model versions. IDs and labels accept short alphanumeric strings with limited
punctuation. Do not put sensitive names in them. `--output` must name a `.jsonl`
file in an existing repository directory. Failed OCR attempts are recorded and
the runner continues; setup and write errors stop it.

## JSONL schema v1

- `schemaVersion`, `timestamp`: `1`, ISO 8601 start time of attempt.
- `sampleId`, `imageSha256`, `dimensions`: sanitized ID, image hash, width and height in pixels.
- `engine`, `language`, `psm`, `ompThreadLimit`, `modelLabel`: OCR configuration. Optional values are `null`.
- `repetition`, `processStart`, `warmState`: 1-based repetition, fresh process; warm state is not measured by this runner.
- `wallElapsedMs`, `engineElapsedMs`: outer subprocess time and engine-reported time. Neither includes preflight hashing or dimension lookup. The helpers do not report finer stages.
- `wordCount`, `symbolCount`: recognized counts; CLI does not report symbols.
- `exitCode`, `status`, `failureKind`: exit status and fixed failure category, without raw OCR errors.

Records contain no OCR words, transcripts, stderr, raw image paths, or
unsanitized engine messages. Image hashes may still identify known public
images, so store the results accordingly. For model comparisons, use a distinct
`--model-label` and keep the image, sample ID, language, and PSM fixed. Helpers
may measure `engineElapsedMs` differently; use wall time to compare complete
invocations.

Run focused checks with `bun test experiments/screen-text-selection/benchmarks`.

Other experiments use the same saved screenshots and write separate records:

- [`ppocr/results.jsonl`](./ppocr/results.jsonl) compares PP-OCRv6 tiny, small, and medium, with line output and estimated word boxes. Records marked `wordGrouping=whitespace-v1` count reconstructed words. Older `returnWordBox=true` records without that field count raw recognition fragments. [`ppocr/comparison.jsonl`](./ppocr/comparison.jsonl) compares text and box overlap with Tesseract; it does not measure ground-truth accuracy.
- [`rapidocr/results.jsonl`](./rapidocr/results.jsonl) contains the RapidOCR 3.9.2 comparison using its bundled PP-OCRv6 small models through ONNX Runtime CPU. It did not use a GPU.
- [`session-results.jsonl`](./session-results.jsonl) separates fresh and reused Tesseract timings for image decode, model initialization, recognition, and word/symbol extraction. The center-screen crop is a timing sample, not a tuned text crop.
- [`stages-results.jsonl`](./stages-results.jsonl) records standalone `grim` captures and one live warm-launch run with model initialization overlapping capture. It stores no screenshot or OCR transcript.

Prediction time, time to the first selectable word, process startup, and capture
measure different parts of the flow. Compare the same timing field and image
hash across models. PP-OCRv6 estimates word boxes; it does not provide the symbol
boxes used for precise Ctrl+drag.
