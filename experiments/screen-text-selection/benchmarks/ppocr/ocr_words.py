"""Return PP-OCRv6 word boxes for the experimental Quickshell overlay."""

import contextlib
import json
import math
import os
from pathlib import Path
import sys
from time import perf_counter

from run import ROOT
from word_groups import group_lines


@contextlib.contextmanager
def quiet_stdout():
    sys.stdout.flush()
    original = os.dup(1)
    hidden = os.open(os.devnull, os.O_WRONLY)
    os.dup2(hidden, 1)
    try:
        yield
    finally:
        sys.stdout.flush()
        os.dup2(original, 1)
        os.close(original)
        os.close(hidden)


def word_result(result, width, height):
    groups, ambiguous = group_lines(result["text_word"], result["text_word_boxes"])
    words = []
    for group in groups:
        x, y, right, bottom = group["box"]
        if not all(map(math.isfinite, (x, y, right, bottom))):
            continue
        if x < 0 or y < 0 or right > width or bottom > height or right <= x or bottom <= y:
            continue
        words.append({
            "text": group["text"],
            "x": x,
            "y": y,
            "width": right - x,
            "height": bottom - y,
        })
    return words, ambiguous


def main(image, tier):
    if tier not in ("tiny", "small", "medium"):
        print(json.dumps({"error": "Unknown PP-OCRv6 tier.", "words": []}))
        return 2
    paths = [ROOT / "models" / f"PP-OCRv6_{tier}_{kind}_infer" for kind in ("det", "rec")]
    if not Path(image).is_file() or not all(path.is_dir() for path in paths):
        print(json.dumps({"error": "PP-OCRv6 image or model is unavailable.", "words": []}))
        return 2

    started = perf_counter()
    with quiet_stdout():
        from paddleocr import PaddleOCR
        from PIL import Image

        model = PaddleOCR(
            text_detection_model_name=f"PP-OCRv6_{tier}_det",
            text_detection_model_dir=str(paths[0]),
            text_recognition_model_name=f"PP-OCRv6_{tier}_rec",
            text_recognition_model_dir=str(paths[1]),
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            device="cpu",
            cpu_threads=4,
        )
        width, height = Image.open(image).size
        result = model.predict(str(image), return_word_box=True)[0].json["res"]

    words, ambiguous = word_result(result, width, height)
    print(json.dumps({
        "words": words,
        "elapsedMs": round((perf_counter() - started) * 1000),
        "modelLabel": f"PP-OCRv6_{tier}",
        "wordGrouping": "whitespace-v1",
        "ambiguousFragments": ambiguous,
    }, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: ocr_words.py IMAGE tiny|small|medium", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
