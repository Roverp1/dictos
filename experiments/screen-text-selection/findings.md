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

The full overlay can now select words by default, use symbol positions for Ctrl+drag and end handles when the optional native helper is configured, and request a padded crop on the same frozen screenshot with Alt+drag. The new gesture behavior still needs hands-on validation on the user's desktop.
