# RapidOCR PP-OCRv6 small CPU comparison

This CPU comparison uses ONNX Runtime and the same dense and Witcher screenshots
as the Tesseract and Paddle runs. It saves no screenshots or OCR transcripts.
The `rapidocr==3.9.2` wheel bundles the PP-OCRv6 **small** detector and
recognizer. `return_word_box=True` returns estimated word boxes, and
`word_results` already contains whole words. RapidOCR therefore does not need
the fragment grouping used by the Paddle pipeline. This is the same model
family as the Paddle run, not an independent recognizer. The experiment did not
test Tesseract-style symbol boxes.

The wheel and ONNX Runtime live in the isolated
`/tmp/opencode/dictos-rapidocr-v6-small/venv`. The wheel needs `libstdc++`,
`libGL`, GLib, zlib, and libxcb on this NixOS host. The pinned nixpkgs has
RapidOCR 3.8.1, so the test used the official PyPI 3.9.2 wheel. OmegaConf 2.3.0
came from cached Nix packages because pip selected an incompatible version.
Nothing was installed globally, and no GPU runtime or extra model was added.
ONNX Runtime exposed CPU and Azure providers, not CUDA, so the NVIDIA GPU was
not tested.

From the repo root, rerun the local measurements using:

```sh
bash experiments/screen-text-selection/benchmarks/rapidocr/bench.sh
```

[`results.jsonl`](./results.jsonl) contains four corrected records with image
hashes, package versions, model hashes, timings, word counts, and a check for an
exact match on the public game subtitle. It contains no dense OCR text. On the
1919×1079 dense frame, prediction took **4501 ms on the first run and 4252 ms
warm**. Import and initialization added **493 ms** before the first result.
That was no faster than bilingual Tesseract on this machine. RapidOCR read the
game subtitle, but the run does not show that its word boxes are better. Compare
with the Tesseract and Paddle results in [`../README.md`](../README.md) and
[`../ppocr/README.md`](../ppocr/README.md).
