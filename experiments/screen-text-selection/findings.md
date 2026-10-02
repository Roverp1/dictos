# OCR prototype findings

Measured on the same saved screenshots in the ignored `tmp/screeshoots/` directory. These are experimental observations, not quality guarantees or accepted product defaults. Screenshot contents and OCR transcripts from the dense frame are not stored here.

## Dense screen

`500-words.png` is 1920-ish pixels wide and produced about 500 OCR word boxes, including application UI. Each interval below is two runs of the existing `ocr.ts` helper, including image dimension lookup and OCR, but excluding capture and Quickshell startup.

| Language  | PSM | Words |     OCR time |
| --------- | --: | ----: | -----------: |
| `eng+pol` |   3 |   502 | 4053–4141 ms |
| `eng+pol` |  11 |   487 | 3627–3676 ms |
| `eng`     |   3 |   502 | 2709–2792 ms |
| `pol`     |   3 |   501 | 2686–2690 ms |

Single-language OCR helped this frame, but Dictos cannot assume which language a captured screen uses. PSM 11 split the image into more blocks, so a small timing gain does not establish better range selection. Setting `OMP_THREAD_LIMIT` to 1 or 2 made the dense frame slower than its default or 4-thread runs.

## Game screens

The two raw frames with visible Polish subtitles behaved differently with whole-screen `eng+pol` PSM 3: `swappy-20260930_230506.png` recognized the subtitle, while `swappy-20260930_230535.png` missed it. A padded crop around the latter subtitle using PSM 6 recovered the full text in one test, alongside false word boxes over scenery. A larger crop produced a badly misread final word in another test. The crop's bounds matter; a retry should stay optional and keep the original whole-screen result available.

A 2× upscale of a cropped game frame recovered the subtitle with extra false positives. Grayscale/threshold and contrast/inversion trials did not recover it under the modes tested. These changes should not become global preprocessing defaults based on one game scene.

## Word and symbol geometry

The standalone [`symbols/ocr-symbols.cpp`](./symbols/ocr-symbols.cpp) prototype calls Tesseract recognition once, then reads word and symbol boxes from that result. On the dense frame with `eng+pol` and PSM 3, one run produced 502 words and 2554 symbols in 3919 ms, compared with 3917 ms for a word-only helper run. Word text and boxes matched in that comparison. A Polish word with `ś` and a path-like word had aligned symbol boxes; a few words had none and must remain whole-word selectable. One timing comparison does not establish a universal speed guarantee.

The full overlay selects words by default, uses symbol positions for Ctrl+drag and end handles when the optional native helper is configured, and requests a padded crop on the same frozen screenshot with Alt+drag. The user confirmed that native precise selection and Alt crop work in the desktop session. A later prototype change sends Alt crop through the native helper too when it is configured. A fixed game crop returned screenshot-relative symbol boxes; its three-symbol `coś` permitted selecting only `co`. Native crop gestures still need a fresh hands-on check; the CLI fallback still has only words. On that crop, the native pass transcribed the first subtitle word as `0j,` instead of `Oj,`.

## Later model comparisons

Records, model hashes and exact configurations are in [`benchmarks/`](./benchmarks/README.md). PP-OCRv6's `return_word_box=True` emits recognition fragments with estimated screen boxes; joining fragments until whitespace yields broad whole-word selections. It does **not** emit symbol boxes for precise handles.

| CPU OCR                    | Dense fresh to word boxes* |     Dense warm prediction |      Reconstructed words | Public Witcher subtitle                     |
| -------------------------- | -------------------------: | ------------------------: | -----------------------: | ------------------------------------------- |
| Tesseract `eng+pol`, PSM 3 |                     ~4.0 s | ~3.5 s with session reuse | 502 in one-shot baseline | Missed in one frame                         |
| PP-OCRv6 tiny              |                     ~2.9 s |                    ~1.1 s |                      503 | Read exactly, with plausible boxes          |
| PP-OCRv6 small             |                     ~5.9 s |                    ~3.5 s |                      495 | Read exactly, plus false groups             |
| PP-OCRv6 medium            |                    ~15.1 s |                   ~13.1 s |                      488 | Read exactly, but too slow for a quick pass |

*Tesseract one-shot wall timing includes a fresh helper process. PP-OCRv6 timing sums Python import, model initialization and its first prediction, but excludes Python process creation, screenshot capture and UI rendering. These are not identical timing boundaries. On the dense image, tiny matched the text and location of **456 of Tesseract's 502 words**; Tesseract is a working selection reference, not ground-truth transcription. The public game subtitle was read correctly by tiny even where full-screen Tesseract missed it. Small and medium added little for this use at much higher latency on this machine.

RapidOCR 3.9.2 running its bundled PP-OCRv6 **small** models through ONNX Runtime CPU took **4501 ms** on the first dense prediction and **4252 ms warm**; importing and initializing added another **493 ms** before the first prediction. It returned 494 word entries and read the public game subtitle, but the CPU route did not improve speed over Tesseract on this machine. Its ONNX Runtime installation exposed no CUDA provider, so the NVIDIA GPU was not benchmarked. The earlier RapidOCR result reporting 80 words was a grouping bug; only the corrected records remain in [`benchmarks/rapidocr/results.jsonl`](./benchmarks/rapidocr/results.jsonl).

The user-requested two-pass rule is now available behind an experimental launcher: the first PP word selection retains its boxes and handles; a later Tesseract pass may update an **unedited input field** without moving that selection. A manual edit protects the field. For 503 single-word selections on the dense frame, 493 had a geometrically overlapping Tesseract replacement, 37 replacement texts differed, and 10 had no candidate; a changed value is not necessarily an improvement. The resulting UI flow still needs hands-on validation.

## Startup and reuse

The bilingual Tesseract session probe measured **236 ms** to initialize its models, **36 ms** to decode the PNG, and **3489 ms** to recognize the dense frame. Cold FULL took **3810 ms**, versus **3526 ms** using the same initialized instance. An independent `grim` PNG capture to memory took **284–299 ms** on the focused monitor. Starting model initialization alongside capture might hide part of its cost, but concurrent capture/OCR and Quickshell delivery have not been timed together. The probe is not an overlay-owned background service; its current input requires a completed screenshot before starting. A permanent daemon has not been added.
