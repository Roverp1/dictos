# PP-OCRv6 tiny/small isolated CPU benchmark

Run from the repository root. Requires Python 3.13 with `venv`, internet access for the first setup, and the two existing ignored screenshots. No screenshot or dense OCR transcript is copied or saved. All wheel caches, model archives, extracted models, and the virtual environment stay under `/tmp/opencode/dictos-ppocr-v6`. Repository scripts write only sanitized benchmark JSONL records. The game-only `--inspect-game` command prints public game OCR to the terminal; never use it on the dense image.

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

`run.py setup` fetches the four tiny/small [PaddleOCR-documented inference models](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/OCR.en.md) by default; `--include-medium` verifies or fetches medium too. `fetch_medium.py` handles medium separately. All are fetched from `https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/`, checked against the recorded SHA-256 hashes and tar members, and extracted locally. No model is implicitly fetched at inference time: both detector and recognizer directories are supplied explicitly; orientation, unwarping, and line-orientation models are disabled. Project licenses: PaddleOCR, PaddleX and PaddlePaddle are Apache-2.0 (GitHub license API); the model documentation does not state a separate license for these archives. The checked artifacts:

| Artifact (`_infer.tar`) |      Bytes | SHA-256                                                            |
| ----------------------- | ---------: | ------------------------------------------------------------------ |
| `PP-OCRv6_tiny_det`     |  1,955,840 | `33a23c5e18d83208f9eeeccd00ed789af891786ac9255c83aeb2495b3db9ce63` |
| `PP-OCRv6_tiny_rec`     |  4,597,760 | `54403af57bc53981d3dce091c6c80dfc5ae30d58495541777126a54bac450604` |
| `PP-OCRv6_small_det`    | 10,055,680 | `bfb7c1e59f0faa6b540ebdca93aea3f4b1f2477805b389fbee117820d68fe9f5` |
| `PP-OCRv6_small_rec`    | 21,442,560 | `da460f968ce9f88325ac3a34fa302077d6e9b0dcefb16ba3137cd7796f879d06` |
| `PP-OCRv6_medium_det`   | 62,279,680 | `144d0621e059566e5086e228829171591c144c2deb07b2dad4962214fbabfcf7` |
| `PP-OCRv6_medium_rec`   | 76,851,200 | `4eecc1c6a4623765042e6fc15446da0da110b7d875b6b72b2d351d2b2dbd4da6` |

PyPI wheels: [paddlepaddle 3.2.2](https://pypi.org/project/paddlepaddle/3.2.2/) cp313 Linux x86_64, 189,281,004 bytes, SHA-256 `c4f485596a686ea72ab0ddffc9e41178f456314a99d4538f5d181a0156a927fa`; [paddleocr 3.7.0](https://pypi.org/project/paddleocr/3.7.0/), 146,750 bytes, SHA-256 `c0f0a81ad4112727f30c6fcf986ac0ef6a120d31ee0991a01fae0357ee32d338`. Resolver also installed paddlex 3.7.2, SHA-256 `f1678bf650bbaccfd8f0d4e49d0ae631b4685c829fdae6e802ccd90d4fcb9a7f` and other PyPI binary dependencies; `pip check` passed. Before medium was fetched, measured on disk: venv 1.3 GiB, pip cache 337 MiB, extracted models 37 MiB, archives about 37 MiB. Medium adds 139 MB of archives plus extracted files under the same isolated `/tmp/opencode` directory. These figures are disk usage, not download transfer. The initial install/download was not instrumented for wall time; it included a 120 s timeout on the first archive-fetch attempt before a successful retry. Do not treat model-load time as installation time. The medium hashes were recorded from the official HTTPS archives at the URL prefix above and are now checked by `fetch_medium.py` and `run.py setup`; no upstream published hashes were located.

## Measurements (1919×1079 images; Paddle CPU, four threads)

Each tier gets a fresh Python process, imports libraries, initializes both local models, then predicts dense, game, dense, game in the same process. `wallElapsedMs` in the local JSONL is the **synchronous predict call**, including image read, detection, recognition and postprocessing, not subprocess wall time or model setup. `engineElapsedMs` is null. The first game call benefits from already initialized models and one prior dense predict. No capture or UI rendering is measured.

| Tier  | Import + model init | Dense first / warm predict | Game first / warm predict | First line box on fresh dense process* |
| ----- | ------------------: | -------------------------: | ------------------------: | -------------------------------------: |
| tiny  |        784 + 961 ms |             1403 / 1133 ms |              332 / 315 ms |                                3149 ms |
| small |       784 + 1176 ms |             4313 / 3882 ms |              577 / 551 ms |                                6273 ms |

*Sum of measured import, initialization, and first `predict()`; excludes Python interpreter startup, image hashing, screenshot capture, and drawing an overlay. These baseline runs did not request word geometry.

The baseline result provides one axis-aligned `rec_boxes` and one quadrilateral `rec_polys` per recognized **line**. Tiny returned 91 lines on dense (56 contain multiple space-separated words), 3 on game; small returned 88 (50 multiword), 4 on game. On the public game image both tiers read the speaker and subtitle exactly. No private-image transcript or ground-truth accuracy score is stored.

`return_word_box=True` additionally returns per-line `text_word` fragments and estimated screenshot-coordinate `text_word_boxes`. These are **not** character boxes. The fragments split Polish words around diacritics and punctuation; the separate `whitespace-v1` experiment joins adjacent fragments until whitespace and unions their boxes. It reconstructed the public game text as `Podróżny` and `Oj, coś mnie rwie.` with visually plausible boxes. One dense fragment containing an internal space still has no trustworthy separate word geometry.

| With word grouping | Raw fragments / grouped words on dense | First / warm dense predict | Fresh first word-box estimate* |
| ------------------ | -------------------------------------: | -------------------------: | -----------------------------: |
| tiny               |                              963 / 503 |             1218 / 1117 ms |                        2879 ms |
| small              |                              951 / 495 |             3966 / 3516 ms |                        5883 ms |
| medium             |                              945 / 488 |           13268 / 13132 ms |                       15122 ms |

*Import + model init + first prediction, excluding Python interpreter startup, capture, and overlay rendering. Word-box quality on dense text is not yet established; its near-equal count against Tesseract does not prove equal accuracy. The OCR result provides **no symbol geometry** for precise Ctrl+drag or end handles. Those would need another source or a measured local refinement. For optional public game-only inspection: `.../venv/bin/python experiments/screen-text-selection/benchmarks/ppocr/run.py tiny --word-boxes --inspect-game`.

`compare.py` uses the previously tested native Tesseract word boxes as a **reference**, not as ground truth, and stores only overlap counts and timing in `comparison.jsonl`:

```sh
/tmp/opencode/dictos-ppocr-v6/venv/bin/python experiments/screen-text-selection/benchmarks/ppocr/compare.py tiny
/tmp/opencode/dictos-ppocr-v6/venv/bin/python experiments/screen-text-selection/benchmarks/ppocr/compare.py small
python3 -m unittest discover -s experiments/screen-text-selection/benchmarks/ppocr -p 'test_*.py'
```

On the dense image, tiny produced 503 reconstructed word groups. Of Tesseract's 502 words, **456 (90.8%)** had the same case-insensitive text in an overlapping location (median box IoU 0.573). Small matched the same 456 words and took about 3.9 s for the prediction versus tiny's 1.2 s. Medium matched 461 (91.8%) but required about 13.3 s for the same image. On the game frame where whole-screen Tesseract missed the subtitle, tiny grouped `Podróżny` and `Oj, coś mnie rwie.` into five visually aligned word boxes. Small reported two extra groups; medium produced the same five subtitle/speaker groups as tiny at much higher cost. These metrics cannot establish which engine is right on the remaining dense words. Symbol geometry is still absent.

For a trial of the user's **untouched-input replacement rule**, selecting each of tiny's 503 dense word groups individually found a geometrically overlapping Tesseract word for 493. The transcript would change in **37** of those fields, and **10** had no matching candidate. On the Witcher frame, tiny's five correctly read words had no matching word in the full-screen Tesseract output, so they would remain untouched. The comparison uses overlap, not confidence gating; a changed field is not necessarily an improved field.

For an opt-in broad-selection check in the actual overlay, run `bash experiments/screen-text-selection/benchmarks/ppocr/try-overlay.sh --image tmp/screeshoots/500-words.png`. It now uses **small** by default to compare with Tesseract; `DICTOS_OCR_PP_TIER=tiny` or `medium` overrides it. Without a native helper, Alt retries still use the word-only Tesseract CLI. PP-OCRv6 provides no symbol boxes, so Ctrl+drag and handles fall back to whole-word boundaries in this mode. A brief Wayland launch loaded the QML config, but the user must judge selection feel on the real desktop.

An opt-in **two-pass interaction experiment** starts PP-OCRv6 small by default, then runs the native Tesseract full-screen pass after PP returns. Set `DICTOS_OCR_PP_TIER=tiny` to repeat the earlier fast-first-pass experiment:

```sh
bash experiments/screen-text-selection/benchmarks/ppocr/try-progressive.sh --image tmp/screeshoots/500-words.png
```

The first selection retains its original PP word boxes and handles. The second pass tries to replace only text in unedited Entry/context fields, using boxes that overlap the first selection, even when the transcript disagrees. If no second-pass word intersects it, the field is left unchanged and counted as unmatched. A manual edit blocks the replacement; a fresh selection fills the field again, now from the native word/symbol data. Alt crop still works. This is an experimental comparison, not the default workflow; serial full passes can consume several seconds even while the first result is already selectable.

The JSONL uses the existing benchmark schema-v1 keys where applicable, plus `importMs`, `initMs`, line and word-box counts, and first selectable line/word times. Older `returnWordBox=true` records without `wordGrouping` counted **raw fragments** in `wordCount`; later `wordGrouping=whitespace-v1` records count reconstructed words and preserve the old figure in `rawWordUnitCount`. `symbolCount` and `psm` remain null. `processStart` marks only the first image in each tier's process as `fresh`; `warmState=first-predict` is per-image, not per-process. OpenVINO/HPI was not measured.
