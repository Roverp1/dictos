# OCR benchmarks

Run from the repository root. Supply an existing image in the ignored `tmp/screeshoots/` directory. This runner does not capture or save screenshots. It launches a fresh process for every repetition and appends one JSON object per attempt to `benchmarks/results.jsonl` by default. stdout prints the same sanitized records.

```sh
bun experiments/screen-text-selection/benchmarks/run.ts --image tmp/screeshoots/500-words.png --sample-id dense-500 --engine cli --language eng+pol --psm 3 --repeat 2
bun experiments/screen-text-selection/benchmarks/run.ts --image tmp/screeshoots/the-witcher-screenshoots/swappy-20260930_230506.png --sample-id witcher-1 --engine native --language eng+pol --psm 3 --repeat 2 --omp-thread-limit 4 --model-label installed-default
```

`cli` runs the existing `ocr.ts` through Bun; `native` runs the existing `symbols/ocr-symbols` binary (build instructions in `../symbols/README.md`). Both need Tesseract language data; `cli` and dimension lookup also need ImageMagick (`magick`). Accepted PSM values: 3, 6, 11. Repeat: 1–100; optional OMP thread limit: 1–256. The optional model label is a **user-supplied identifier**, not an automatically detected model/version. IDs and labels accept only short alphanumeric strings with limited punctuation; do not put sensitive names in them. Optional `--output experiments/screen-text-selection/benchmarks/other.jsonl` must name a `.jsonl` file in an existing repository directory. Failed OCR attempts are recorded and later repetitions continue; setup or write failures stop the run.

## JSONL schema v1

- `schemaVersion`, `timestamp`: `1`, ISO 8601 start time of attempt.
- `sampleId`, `imageSha256`, `dimensions`: sanitized ID, image hash, width and height in pixels.
- `engine`, `language`, `psm`, `ompThreadLimit`, `modelLabel`: OCR configuration. Optional values are `null`.
- `repetition`, `processStart`, `warmState`: 1-based repetition, fresh process; warm state is not measured by this runner.
- `wallElapsedMs`, `engineElapsedMs`: outer subprocess time and engine-reported time. Neither includes preflight hashing or dimension lookup. The helpers do not report finer stages.
- `wordCount`, `symbolCount`: recognized counts; CLI does not report symbols.
- `exitCode`, `status`, `failureKind`: exit status and fixed failure category, without raw OCR errors.

No OCR words, transcripts, stderr, raw image paths, or unsanitized engine messages are written. Image hashes may still identify known public images. Keep result files in a suitable location for your data. To compare later models, use a distinct validated `--model-label` and retain the same sample image, ID, language, and PSM. `engineElapsedMs` is reported by the helpers and may use different timing boundaries; compare wall times for the full invocation.

Run focused checks with `bun test experiments/screen-text-selection/benchmarks`.

Additional experiments use the same saved screenshots but separate records:

- [`ppocr/results.jsonl`](./ppocr/results.jsonl) compares PP-OCRv6 tiny, small, and medium, both with line-only output and with estimated word boxes. Its `wordGrouping=whitespace-v1` records report reconstructed whole-word counts; older `returnWordBox=true` records without that field count raw recognition fragments. [`ppocr/comparison.jsonl`](./ppocr/comparison.jsonl) records text-and-box overlap against the Tesseract baseline, not ground-truth accuracy.
- [`rapidocr/results.jsonl`](./rapidocr/results.jsonl) records the bounded ONNX CPU comparison using RapidOCR 3.9.2's bundled PP-OCRv6 small models. Only corrected native word-result counts are retained; the earlier fragment-regrouping attempt was invalid. This run did not use a GPU.
- [`session-results.jsonl`](./session-results.jsonl) times fresh and reused Tesseract instances, separating decode, model initialization, recognition, and word/symbol extraction. Its center-screen crop is only a timing sample.
- [`stages-results.jsonl`](./stages-results.jsonl) records three `grim` captures to memory without saving or revealing their images. These capture timings were not run concurrently with OCR.

Prediction time, time until the first selectable **word**, process initialization, and image capture are distinct numbers. Compare the same field and image hash across models before drawing a speed conclusion. PP-OCRv6 word boxes are estimated and do not provide the symbol geometry used by precise Ctrl+drag.
