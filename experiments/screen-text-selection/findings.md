# OCR prototype findings

All measurements use saved screenshots in the ignored `tmp/screeshoots/`
directory. Treat them as prototype results, not quality guarantees or product
defaults. The dense screenshot and its OCR transcript are not stored here.

## Dense screen

`500-words.png` is about 1920 pixels wide and produced roughly 500 word boxes,
including application UI. Each interval below covers two runs of `ocr.ts` and
includes image-dimension lookup and OCR. It excludes screen capture and
Quickshell startup.

| Language  | PSM | Words |     OCR time |
| --------- | --: | ----: | -----------: |
| `eng+pol` |   3 |   502 | 4053-4141 ms |
| `eng+pol` |  11 |   487 | 3627-3676 ms |
| `eng`     |   3 |   502 | 2709-2792 ms |
| `pol`     |   3 |   501 | 2686-2690 ms |

Single-language OCR was faster on this frame. Dictos cannot know which language
a captured screen contains, though. PSM 11 split the image into more blocks;
its small timing gain did not improve range selection. `OMP_THREAD_LIMIT=1` or
`2` made this frame slower than the default or four-thread runs.

## Game screens

Whole-screen `eng+pol` PSM 3 read the subtitle in
`swappy-20260930_230506.png` and missed it in
`swappy-20260930_230535.png`. A padded PSM 6 crop recovered the latter subtitle
once, with false boxes over the scenery. A larger crop badly misread the final
word. Keep crop retries optional and preserve the full-screen result.

A 2× upscale recovered the subtitle in one cropped frame, with extra false
positives. Grayscale, thresholding, contrast, and inversion did not help in the
modes tested. One game scene is not enough to make these global preprocessing
defaults.

## Word and symbol geometry

The standalone [`symbols/ocr-symbols.cpp`](./symbols/ocr-symbols.cpp) prototype
reads word and symbol boxes from one Tesseract recognition pass. On the dense
frame with `eng+pol` and PSM 3, one run returned 502 words and 2554 symbols in
3919 ms. The word-only helper took 3917 ms, with matching text and word boxes.
Symbol boxes aligned for a Polish word containing `ś` and for a path-like word.
Some words had no symbol boxes and must stay whole-word selections. One timing
comparison cannot establish typical performance.

The full overlay selects whole words by default. With the native helper, Ctrl+drag
and end handles use symbol boxes, and Alt+drag OCRs a padded crop of the frozen
screenshot. The user confirmed precise selection and Alt crop in the desktop
session. A fixed game crop returned screenshot-relative boxes, including three
symbols for `coś`, so `co` could be selected on its own. The native crop path
misread the first subtitle word as `0j,` instead of `Oj,`. The CLI fallback
returns words only. The warm launch's Alt gesture still needs a separate
hands-on check.

## Later model comparisons

Records, model hashes, and configurations are in [`benchmarks/`](./benchmarks/README.md).
PP-OCRv6's `return_word_box=True` returns recognition fragments with estimated
screen boxes. Joining fragments up to whitespace gives broad whole-word
selections. The model returns no symbol boxes for precise handles.

| CPU OCR                    | Dense fresh to word boxes* |     Dense warm prediction |      Reconstructed words | Public Witcher subtitle                     |
| -------------------------- | -------------------------: | ------------------------: | -----------------------: | ------------------------------------------- |
| Tesseract `eng+pol`, PSM 3 |                     ~4.0 s | ~3.5 s with session reuse | 502 in one-shot baseline | Missed in one frame                         |
| PP-OCRv6 tiny              |                     ~2.9 s |                    ~1.1 s |                      503 | Read exactly, with plausible boxes          |
| PP-OCRv6 small             |                     ~5.9 s |                    ~3.5 s |                      495 | Read exactly, plus false groups             |
| PP-OCRv6 medium            |                    ~15.1 s |                   ~13.1 s |                      488 | Read exactly, but too slow for a quick pass |

*Tesseract's one-shot time includes a fresh helper process. PP-OCRv6 timing adds
Python import, model initialization, and the first prediction, but excludes
Python startup, capture, and UI rendering. Compare the timings with that
difference in mind. On the dense image, tiny matched the text and location of
**456 of Tesseract's 502 words**. Tesseract is a selection reference, not ground
truth. Tiny read the public game subtitle that whole-screen Tesseract missed.
Small and medium added little for selection and took much longer on this machine.

RapidOCR 3.9.2 with its bundled PP-OCRv6 **small** models took **4501 ms** on
the first dense prediction and **4252 ms warm** through ONNX Runtime CPU. Import
and initialization added **493 ms**. It returned 494 word entries and read the
public game subtitle, but was no faster than Tesseract on this machine. The
runtime exposed no CUDA provider, so we did not test the NVIDIA GPU. Corrected
records are in [`benchmarks/rapidocr/results.jsonl`](./benchmarks/rapidocr/results.jsonl).

The optional two-pass launcher shows the PP word selection first, then lets
Tesseract update only **unedited fields** whose boxes overlap that selection.
Editing a field protects it. Of 503 single-word selections on the dense frame,
493 had an overlapping Tesseract word. The replacement text differed 37 times;
10 selections had no candidate. A different transcript may still be wrong. The
two-pass interaction needs hands-on validation.

## Startup and reuse

The timing probe measured **236 ms** to initialize bilingual Tesseract models,
**36 ms** to decode the dense PNG, and **3489 ms** to recognize it. Cold FULL
took **3810 ms**; reuse took **3526 ms**. The optional [`run-warm.sh`](./run-warm.sh)
starts model initialization alongside live `grim` capture. One run measured
**209 ms** to capture, **263 ms** to initialize, and **61 ms** of waiting after
capture. It did not time overlay rendering or OCR. The launcher removes the
helper and screenshot when the overlay exits. See the [summary](./summary.md)
for what works and what still needs testing.
