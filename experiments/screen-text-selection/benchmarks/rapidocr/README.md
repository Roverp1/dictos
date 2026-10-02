# RapidOCR PP-OCRv6 small CPU comparison

An isolated ONNX Runtime CPU comparison against the same ignored dense and Witcher screenshots as the Tesseract and Paddle benchmarks. No screenshot or OCR transcript is written to the repository. The default `rapidocr==3.9.2` wheel bundles the PP-OCRv6 **small** detector and recognizer; `return_word_box=True` returns estimated word geometry. This is still the PP-OCRv6 model family, not an independent recognizer. RapidOCR's `word_results` already contain whole-word entries, so they are not regrouped like the Paddle pipeline's fragments. Precise Tesseract-style symbol geometry is not established by this run.

The wheel and CPU ONNX Runtime are isolated in `/tmp/opencode/dictos-rapidocr-v6-small/venv`. On this NixOS host, the wheel needs `libstdc++`, `libGL`, GLib, zlib, and libxcb at runtime. The pinned project nixpkgs has `rapidocr` 3.8.1, so this comparison uses an isolated official PyPI 3.9.2 wheel instead; OmegaConf 2.3.0 comes from cached Nix packages because pip's all-wheel resolver chose an incompatible old version. No global installation, GPU runtime, or extra model download was involved. ONNX Runtime reported CPU and Azure providers, not CUDA, so this run does not measure the NVIDIA GPU.

From the repo root, rerun the local measurements using:

```sh
bash experiments/screen-text-selection/benchmarks/rapidocr/bench.sh
```

The four valid records in [`results.jsonl`](./results.jsonl) include image hashes, wheel/model versions and hashes, import/init and warm prediction timings, word counts, and a public game-subtitle exact-match check. An initial reporter incorrectly merged already grouped words and has been excluded from that log. There is no dense OCR text. With word boxes enabled on the 1919×1079 dense frame, ONNX CPU took **4501 ms on its first prediction and 4252 ms warm**; import plus initialization added **493 ms** before the first prediction. This offers no speed advantage over bilingual Tesseract on this machine. The public game subtitle was transcribed, but this does not establish better overall word-box placement. Tesseract reference timings and PP-OCRv6 small Paddle timings are under [`../`](../README.md) and [`../ppocr/`](../ppocr/README.md). Benchmarking has stopped here.
