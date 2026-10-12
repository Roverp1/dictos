# PP-OCRv6 tiny/small isolated CPU benchmark

Run from the repository root with Python 3.13, `venv`, internet access for the
initial setup, and the two ignored screenshots. The scripts save no screenshots
or dense OCR transcripts. Wheel caches, model archives, extracted models, and
the virtual environment stay under `/tmp/opencode/dictos-ppocr-v6`. Scripts
write only sanitized JSONL records. `--inspect-game` prints OCR from the public
game image to the terminal; use it only for that image.

```sh
mkdir -p /tmp/opencode/dictos-ppocr-v6
python3 -m venv /tmp/opencode/dictos-ppocr-v6/venv
export HOME=/tmp/opencode/dictos-ppocr-v6
export XDG_CACHE_HOME=$HOME/cache PIP_CACHE_DIR=$HOME/pip-cache
export PADDLE_PDX_CACHE_HOME=$HOME/models PADDLE_PDX_MODEL_SOURCE=BOS
export OMP_NUM_THREADS=4
/tmp/opencode/dictos-ppocr-v6/venv/bin/python -m pip install --only-binary=:all: 'paddlepaddle==3.2.2' 'paddleocr==3.7.0'
python3 experiments/screen-text-selection/benchmarks/ppocr/run.py setup
# On this NixOS host, PyPI wheels also need these shared libraries at runtime:
export LD_LIBRARY_PATH="$(nix-instantiate --eval --raw -E '(import <nixpkgs> {}).stdenv.cc.cc.lib.outPath')/lib:$(nix-instantiate --eval --raw -E '(import <nixpkgs> {}).libglvnd.outPath')/lib:$(nix-instantiate --eval --raw -E '(import <nixpkgs> {}).glib.out.outPath')/lib"
/tmp/opencode/dictos-ppocr-v6/venv/bin/python experiments/screen-text-selection/benchmarks/ppocr/run.py tiny
/tmp/opencode/dictos-ppocr-v6/venv/bin/python experiments/screen-text-selection/benchmarks/ppocr/run.py small
# Compare estimated word geometry as a separate configuration:
/tmp/opencode/dictos-ppocr-v6/venv/bin/python experiments/screen-text-selection/benchmarks/ppocr/run.py tiny --word-boxes
/tmp/opencode/dictos-ppocr-v6/venv/bin/python experiments/screen-text-selection/benchmarks/ppocr/run.py small --word-boxes
# Benchmark medium only after fetching and pinning its official archives:
python3 experiments/screen-text-selection/benchmarks/ppocr/fetch_medium.py
/tmp/opencode/dictos-ppocr-v6/venv/bin/python experiments/screen-text-selection/benchmarks/ppocr/run.py medium --word-boxes
```

`run.py setup` downloads the four tiny and small models listed in the
[PaddleOCR model documentation](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/OCR.en.md).
Use `--include-medium` to verify or fetch medium models; `fetch_medium.py`
handles those separately. The scripts download from
`https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/`,
check SHA-256 hashes and archive members, then extract the models locally.
Inference receives explicit detector and recognizer paths, so it does not fetch
models. Orientation, unwarping, and line-orientation models are disabled.

PaddleOCR, PaddleX, and PaddlePaddle are Apache-2.0 licensed according to their
GitHub license files. The model documentation does not give a separate license
for these archives. Checked artifacts:

| Artifact (`_infer.tar`) |      Bytes | SHA-256                                                            |
| ----------------------- | ---------: | ------------------------------------------------------------------ |
| `PP-OCRv6_tiny_det`     |  1,955,840 | `33a23c5e18d83208f9eeeccd00ed789af891786ac9255c83aeb2495b3db9ce63` |
| `PP-OCRv6_tiny_rec`     |  4,597,760 | `54403af57bc53981d3dce091c6c80dfc5ae30d58495541777126a54bac450604` |
| `PP-OCRv6_small_det`    | 10,055,680 | `bfb7c1e59f0faa6b540ebdca93aea3f4b1f2477805b389fbee117820d68fe9f5` |
| `PP-OCRv6_small_rec`    | 21,442,560 | `da460f968ce9f88325ac3a34fa302077d6e9b0dcefb16ba3137cd7796f879d06` |
| `PP-OCRv6_medium_det`   | 62,279,680 | `144d0621e059566e5086e228829171591c144c2deb07b2dad4962214fbabfcf7` |
| `PP-OCRv6_medium_rec`   | 76,851,200 | `4eecc1c6a4623765042e6fc15446da0da110b7d875b6b72b2d351d2b2dbd4da6` |

The environment used the [paddlepaddle 3.2.2 wheel](https://pypi.org/project/paddlepaddle/3.2.2/)
for cp313 Linux x86_64 (189,281,004 bytes, SHA-256
`c4f485596a686ea72ab0ddffc9e41178f456314a99d4538f5d181a0156a927fa`) and the
[paddleocr 3.7.0 wheel](https://pypi.org/project/paddleocr/3.7.0/)
(146,750 bytes, SHA-256
`c0f0a81ad4112727f30c6fcf986ac0ef6a120d31ee0991a01fae0357ee32d338`). The
resolver also installed paddlex 3.7.2 (SHA-256
`f1678bf650bbaccfd8f0d4e49d0ae631b4685c829fdae6e802ccd90d4fcb9a7f`) and other
PyPI binary dependencies. `pip check` passed.

Before medium was fetched, the venv used 1.3 GiB, the pip cache 337 MiB, the
extracted models 37 MiB, and the archives about 37 MiB. Medium adds 139 MB of
archives and extracted files under `/tmp/opencode`. These are disk-usage
figures, not download sizes. We did not measure install time; the first
archive-fetch attempt timed out after 120 seconds and succeeded on retry. Model
load times do not include installation. The medium hashes come from the
official HTTPS archives and are checked by `fetch_medium.py` and `run.py setup`.
We found no hashes published upstream.

## Measurements (1919×1079 images; Paddle CPU, four threads)

Each tier runs in a fresh Python process. The process imports the libraries,
initializes both local models, then predicts dense, game, dense, game. In the
JSONL, `wallElapsedMs` measures the synchronous `predict()` call, including
image read, detection, recognition, and postprocessing. It excludes process
startup and model setup; `engineElapsedMs` is null. The first game prediction
uses initialized models and follows a dense prediction. Capture and UI rendering
are not measured.

| Tier  | Import + model init | Dense first / warm predict | Game first / warm predict | First line box on fresh dense process* |
| ----- | ------------------: | -------------------------: | ------------------------: | -------------------------------------: |
| tiny  |        784 + 961 ms |             1403 / 1133 ms |              332 / 315 ms |                                3149 ms |
| small |       784 + 1176 ms |             4313 / 3882 ms |              577 / 551 ms |                                6273 ms |

*Sum of measured import, initialization, and first `predict()`; excludes Python interpreter startup, image hashing, screenshot capture, and drawing an overlay. These baseline runs did not request word geometry.

The baseline returns one axis-aligned `rec_boxes` and one quadrilateral
`rec_polys` per recognized line. Tiny returned 91 lines on the dense image, 56
with multiple words, and 3 on the game image. Small returned 88 dense lines, 50
with multiple words, and 4 game lines. Both tiers read the speaker and subtitle
exactly on the public game image. No private transcript or ground-truth score is
stored.

With `return_word_box=True`, the result also includes per-line `text_word`
fragments and estimated screenshot-coordinate `text_word_boxes`. These are not
character boxes. Fragments split Polish words around diacritics and
punctuation. The `whitespace-v1` experiment joins fragments up to whitespace
and unions their boxes. It reconstructed the public game text as `Podróżny`
and `Oj, coś mnie rwie.` with plausible-looking boxes. A dense fragment with
an internal space still has no reliable per-word geometry.

| With word grouping | Raw fragments / grouped words on dense | First / warm dense predict | Fresh first word-box estimate* |
| ------------------ | -------------------------------------: | -------------------------: | -----------------------------: |
| tiny               |                              963 / 503 |             1218 / 1117 ms |                        2879 ms |
| small              |                              951 / 495 |             3966 / 3516 ms |                        5883 ms |
| medium             |                              945 / 488 |           13268 / 13132 ms |                       15122 ms |

*Import, model initialization, and first prediction. Excludes Python startup,
capture, and overlay rendering. Similar word counts do not establish equal
accuracy. Dense word-box quality has not been measured against ground truth.
The result has no symbol geometry for precise Ctrl+drag or end handles; that
would need another source or a tested local refinement. To inspect the public
game image only, run `.../venv/bin/python experiments/screen-text-selection/benchmarks/ppocr/run.py tiny --word-boxes --inspect-game`.

`compare.py` uses native Tesseract word boxes as a reference, not ground truth.
It stores only overlap counts and timing in `comparison.jsonl`:

```sh
/tmp/opencode/dictos-ppocr-v6/venv/bin/python experiments/screen-text-selection/benchmarks/ppocr/compare.py tiny
/tmp/opencode/dictos-ppocr-v6/venv/bin/python experiments/screen-text-selection/benchmarks/ppocr/compare.py small
python3 -m unittest discover -s experiments/screen-text-selection/benchmarks/ppocr -p 'test_*.py'
```

On the dense image, tiny produced 503 reconstructed words. Of Tesseract's 502
words, **456 (90.8%)** had the same case-insensitive text in an overlapping
box (median IoU 0.573). Small matched the same 456 and took about 3.9 seconds
per prediction, compared with 1.2 seconds for tiny. Medium matched 461 (91.8%)
and took about 13.3 seconds. On the game frame where Tesseract missed the
subtitle, tiny produced five visually aligned boxes for `Podróżny` and
`Oj, coś mnie rwie.` Small added two groups; medium returned the same five
subtitle and speaker groups as tiny at much higher cost. These comparisons
cannot tell us which engine got the other dense words right. None returns
symbol boxes.

For a trial of the user's **untouched-input replacement rule**, selecting each of tiny's 503 dense word groups individually found a geometrically overlapping Tesseract word for 493. The transcript would change in **37** of those fields, and **10** had no matching candidate. On the Witcher frame, tiny's five correctly read words had no matching word in the full-screen Tesseract output, so they would remain untouched. The comparison uses overlap, not confidence gating; a changed field is not necessarily an improved field.

To try the broad-selection overlay, run
`bash experiments/screen-text-selection/benchmarks/ppocr/try-overlay.sh --image tmp/screeshoots/500-words.png`.
It defaults to **small** for comparison with Tesseract. Set
`DICTOS_OCR_PP_TIER=tiny` or `medium` to change tiers. Without the native
helper, Alt retries use the word-only Tesseract CLI. PP-OCRv6 has no symbol
boxes, so Ctrl+drag and handles snap to whole words. The QML config loaded in a
brief Wayland test; selection feel still needs a desktop check.

The optional **two-pass experiment** starts PP-OCRv6 small, then runs native
Tesseract on the full screen. Set `DICTOS_OCR_PP_TIER=tiny` to try the faster
first pass:

```sh
bash experiments/screen-text-selection/benchmarks/ppocr/try-progressive.sh --image tmp/screeshoots/500-words.png
```

The first selection keeps its PP word boxes and handles. The second pass may
replace text only in unedited Entry or context fields, and only when a
Tesseract box overlaps the selection. If no word overlaps, the field stays as
is and counts as unmatched. Editing a field blocks replacement; a new
selection fills it from native word and symbol data. Alt crop still works.
This is an experiment, not the default workflow. The serial full-screen passes
can take several seconds even though the first result is already selectable.

The JSONL follows benchmark schema v1 where its fields apply. It also records
`importMs`, `initMs`, line and word-box counts, and time to the first selectable
line or word. Older `returnWordBox=true` records without `wordGrouping` count
raw fragments in `wordCount`. Later `wordGrouping=whitespace-v1` records count
reconstructed words and keep the fragment count in `rawWordUnitCount`.
`symbolCount` and `psm` are null. `processStart` marks the first image in each
tier's process as `fresh`; `warmState=first-predict` applies per image.
OpenVINO/HPI was not measured.
