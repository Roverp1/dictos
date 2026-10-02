"""Compare bundled RapidOCR PP-OCRv6 small ONNX inference on fixed screens."""

import argparse
from datetime import datetime, timezone
import hashlib
from importlib.metadata import version
import json
from pathlib import Path
import sys
from time import perf_counter

HERE = Path(__file__).resolve().parent

SAMPLES = {
    "dense-500": HERE.parents[3] / "tmp/screeshoots/500-words.png",
    "witcher-535": HERE.parents[3] / "tmp/screeshoots/the-witcher-screenshoots/swappy-20260930_230535.png",
}
RESULTS = HERE / "results.jsonl"


def result_words(result):
    import numpy as np

    words = []
    for line in result.word_results or ():
        for item in line or ():
            if not isinstance(item, (list, tuple)) or len(item) != 3 or not item[0] or item[2] is None:
                continue
            corners = np.asarray(item[2])
            if corners.shape == (4, 2):
                left, top = corners.min(axis=0)
                right, bottom = corners.max(axis=0)
            elif corners.shape == (4,):
                left, top, right, bottom = corners
            else:
                continue
            text = item[0].strip()
            if text and right > left and bottom > top:
                words.append({"text": text, "box": [float(left), float(top), float(right), float(bottom)]})
    return words


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inspect-game", action="store_true")
    args = parser.parse_args()
    started_import = perf_counter()
    import rapidocr
    from rapidocr import RapidOCR
    import onnxruntime
    import_ms = round((perf_counter() - started_import) * 1000, 2)

    if rapidocr.__file__ is None:
        raise RuntimeError("RapidOCR model directory is unavailable")
    model_root = Path(rapidocr.__file__).resolve().parent / "models"
    models = {
        name: hashlib.sha256((model_root / name).read_bytes()).hexdigest()
        for name in ("PP-OCRv6_det_small.onnx", "PP-OCRv6_rec_small.onnx")
    }
    started_init = perf_counter()
    ocr = RapidOCR(params={
        "Global.use_cls": False,
        "Global.return_word_box": True,
        "Global.log_level": "error",
        "EngineConfig.onnxruntime.intra_op_num_threads": 4,
    })
    init_ms = round((perf_counter() - started_init) * 1000, 2)

    for cycle in range(1 if args.inspect_game else 2):
        images = {"witcher-535": SAMPLES["witcher-535"]} if args.inspect_game else SAMPLES
        for sample, image in images.items():
            digest = hashlib.sha256(image.read_bytes()).hexdigest()
            started = perf_counter()
            result = ocr(str(image), use_cls=False, return_word_box=True)
            predict_ms = round((perf_counter() - started) * 1000, 2)
            if args.inspect_game:
                print(json.dumps({
                    "lines": list(result.txts or ()),
                    "wordUnits": [
                        [{"text": item[0], "shape": list(__import__("numpy").asarray(item[2]).shape) if item[2] is not None else None}
                         for item in line or () if isinstance(item, (list, tuple)) and len(item) == 3]
                        for line in result.word_results or ()
                    ],
                    "predictMs": predict_ms,
                }, ensure_ascii=False))
                return
            words = result_words(result)
            lines = result.txts or ()
            record = {
                "schemaVersion": 1,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "sampleId": sample,
                "imageSha256": digest,
                "engine": "rapidocr-onnxruntime-cpu",
                "rapidocrVersion": version("rapidocr"),
                "onnxruntimeVersion": version("onnxruntime"),
                "modelLabel": "PP-OCRv6_small_bundled",
                "modelSha256": models,
                "configuredProvider": "CPUExecutionProvider",
                "useClassification": False,
                "returnWordBox": True,
                "wordGrouping": "rapidocr-native-word-results",
                "repetition": cycle + 1,
                "processStart": "fresh" if cycle == 0 and sample == "dense-500" else "reused",
                "warmState": "first-predict" if cycle == 0 else "warm",
                "importMs": import_ms if cycle == 0 and sample == "dense-500" else None,
                "initMs": init_ms if cycle == 0 and sample == "dense-500" else None,
                "predictMs": predict_ms,
                "firstSelectableWordMs": round(import_ms + init_ms + predict_ms, 2)
                    if cycle == 0 and sample == "dense-500" and words else predict_ms if words else None,
                "lineCount": len(lines),
                "wordCount": len(words),
                "ambiguousFragments": 0,
                "symbolCount": None,
                "gameSubtitleExact": (
                    [word["text"] for word in words if 900 <= word["box"][0] <= 1080 and 390 <= word["box"][1] <= 480]
                    == ["Podróżny", "Oj,", "coś", "mnie", "rwie."]
                ) if sample == "witcher-535" else None,
            }
            with RESULTS.open("a") as output:
                output.write(json.dumps(record) + "\n")
            print(json.dumps({k: record[k] for k in
                ("sampleId", "modelLabel", "warmState", "predictMs", "firstSelectableWordMs", "wordCount", "gameSubtitleExact")}), flush=True)


if __name__ == "__main__":
    main()
