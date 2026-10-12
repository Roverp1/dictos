"""Isolated PP-OCRv6 CPU comparison; never persists recognition text."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import tarfile
from time import perf_counter
from datetime import datetime, timezone

from word_groups import group_lines

ROOT = Path("/tmp/opencode/dictos-ppocr-v6")
MODELS = {
    "PP-OCRv6_tiny_det": "33a23c5e18d83208f9eeeccd00ed789af891786ac9255c83aeb2495b3db9ce63",
    "PP-OCRv6_tiny_rec": "54403af57bc53981d3dce091c6c80dfc5ae30d58495541777126a54bac450604",
    "PP-OCRv6_small_det": "bfb7c1e59f0faa6b540ebdca93aea3f4b1f2477805b389fbee117820d68fe9f5",
    "PP-OCRv6_small_rec": "da460f968ce9f88325ac3a34fa302077d6e9b0dcefb16ba3137cd7796f879d06",
    "PP-OCRv6_medium_det": "144d0621e059566e5086e228829171591c144c2deb07b2dad4962214fbabfcf7",
    "PP-OCRv6_medium_rec": "4eecc1c6a4623765042e6fc15446da0da110b7d875b6b72b2d351d2b2dbd4da6",
}
BASE = "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/"
HERE = Path(__file__).resolve().parent
IMAGES = {
    "dense-500": HERE.parents[3] / "tmp/screeshoots/500-words.png",
    "witcher-535": HERE.parents[3] / "tmp/screeshoots/the-witcher-screenshoots/swappy-20260930_230535.png",
}


def setup(include_medium=False):
    import urllib.request

    ROOT.mkdir(exist_ok=True, parents=True)
    model_root = ROOT / "models"
    model_root.mkdir(exist_ok=True)
    for name, expected in MODELS.items():
        if "_medium_" in name and not include_medium:
            continue
        archive = ROOT / f"{name}_infer.tar"
        if not archive.exists():
            urllib.request.urlretrieve(BASE + archive.name, archive)
        actual = hashlib.sha256(archive.read_bytes()).hexdigest()
        if actual != expected:
            print(f"Checksum mismatch: {name}", file=sys.stderr)
            return 1
        target = model_root / f"{name}_infer"
        if target.exists():
            continue
        with tarfile.open(archive) as bundle:
            members = bundle.getmembers()
            if any(not (m.name == target.name or m.name.startswith(target.name + "/")) or not (m.isfile() or m.isdir()) for m in members):
                print(f"Unexpected archive entries: {name}", file=sys.stderr)
                return 1
            bundle.extractall(model_root, filter="data")
        print(f"Verified {name}: {archive.stat().st_size} bytes, sha256 {actual}")
    return 0


def run(tier, inspect=False, word_boxes=False):
    import_start = perf_counter()
    from paddleocr import PaddleOCR
    from PIL import Image
    import_ms = round((perf_counter() - import_start) * 1000, 2)

    t0 = perf_counter()
    ocr = PaddleOCR(
        text_detection_model_name=f"PP-OCRv6_{tier}_det",
        text_detection_model_dir=str(ROOT / "models" / f"PP-OCRv6_{tier}_det_infer"),
        text_recognition_model_name=f"PP-OCRv6_{tier}_rec",
        text_recognition_model_dir=str(ROOT / "models" / f"PP-OCRv6_{tier}_rec_infer"),
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        device="cpu",
        cpu_threads=4,
    )
    init_ms = round((perf_counter() - t0) * 1000, 2)
    for cycle in range(1 if inspect else 2):
        for sample, image in ({"witcher-535": IMAGES["witcher-535"]} if inspect else IMAGES).items():
            size = Image.open(image).size
            digest = hashlib.sha256(image.read_bytes()).hexdigest()
            start = perf_counter()
            results = ocr.predict(str(image), return_word_box=word_boxes)
            elapsed = round((perf_counter() - start) * 1000, 2)
            res = results[0].json["res"]
            boxes = res.get("rec_boxes", [])
            polys = res.get("rec_polys", [])
            texts = res.get("rec_texts", [])
            word_box_lines = res.get("text_word_boxes", [])
            word_text_groups = res.get("text_word", [])
            raw_word_units = sum(len(group) for group in word_box_lines)
            word_boxes_aligned = word_boxes and len(word_box_lines) == len(word_text_groups) == len(texts) and all(
                len(boxes) == len(words) for boxes, words in zip(word_box_lines, word_text_groups)
            )
            grouped, ambiguous = group_lines(word_text_groups, word_box_lines) if word_boxes else ([], 0)
            word_count = len(grouped)
            if inspect:
                if word_boxes:
                    for word in grouped:
                        print(json.dumps(word), flush=True)
                else:
                    for text, box in zip(texts, boxes):
                        print(json.dumps({"text": text, "box": list(box)}), flush=True)
                return
            # Spaces inside a recognized line have no independently located boundaries.
            spaced_lines = sum(bool(t.strip()) and len(t.split()) > 1 for t in texts)
            record = {
                "schemaVersion": 1,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "sampleId": sample,
                "imageSha256": digest,
                "dimensions": {"width": size[0], "height": size[1]},
                "engine": "ppocr-paddle-cpu",
                "language": "multilingual-default",
                "psm": None,
                "ompThreadLimit": 4,
                "modelLabel": f"PP-OCRv6_{tier}",
                "returnWordBox": word_boxes,
                "repetition": cycle + 1,
                "processStart": "fresh" if cycle == 0 and sample == "dense-500" else "reused",
                "warmState": "first-predict" if cycle == 0 else "warm",
                "wallElapsedMs": elapsed,
                "engineElapsedMs": None,
                "wordCount": word_count if word_boxes else None,
                "rawWordUnitCount": raw_word_units if word_boxes else None,
                "ambiguousWordUnitCount": ambiguous if word_boxes else None,
                "wordGrouping": "whitespace-v1" if word_boxes else None,
                "symbolCount": None,
                "exitCode": 0,
                "status": "ok",
                "failureKind": None,
                "initMs": init_ms if cycle == 0 and sample == "dense-500" else None,
                "importMs": import_ms if cycle == 0 and sample == "dense-500" else None,
                "lineCount": len(texts),
                "wordBoxLines": len(word_box_lines) if word_boxes else None,
                "wordBoxesAligned": word_boxes_aligned if word_boxes else None,
                "spacedLineCount": spaced_lines,
                "recBoxCount": len(boxes),
                "recPolyCount": len(polys),
                "recBoxShape": list(getattr(boxes[0], "shape", (len(boxes[0]),))) if len(boxes) else None,
                "recPolyShape": list(getattr(polys[0], "shape", (len(polys[0]), len(polys[0][0])))) if len(polys) else None,
                "firstSelectableWordMs": None,
            }
            # Full-image synchronous predict must finish before any box can be shown.
            record["firstSelectableLineMs"] = round(import_ms + init_ms + elapsed, 2) if len(boxes) and cycle == 0 and sample == "dense-500" else elapsed if len(boxes) else None
            if word_boxes and word_count:
                record["firstSelectableWordMs"] = record["firstSelectableLineMs"]
            with (HERE / "results.jsonl").open("a") as output:
                output.write(json.dumps(record) + "\n")
            print(json.dumps({k: record[k] for k in ("sampleId", "modelLabel", "returnWordBox", "warmState", "wallElapsedMs", "lineCount", "wordCount", "rawWordUnitCount", "ambiguousWordUnitCount", "wordBoxesAligned")}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tier", choices=("setup", "tiny", "small", "medium"))
    parser.add_argument("--word-boxes", action="store_true")
    parser.add_argument("--inspect-game", action="store_true")
    parser.add_argument("--include-medium", action="store_true")
    args = parser.parse_args()
    if args.tier == "setup":
        if args.word_boxes or args.inspect_game:
            parser.error("setup does not accept recognition options")
        sys.exit(setup(args.include_medium))
    if args.include_medium:
        parser.error("--include-medium is only for setup")
    run(args.tier, args.inspect_game, args.word_boxes)
