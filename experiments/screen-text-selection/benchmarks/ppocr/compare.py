"""Compare PP-OCRv6 word locations with the already tested Tesseract overlay."""

import hashlib
import json
from pathlib import Path
import statistics
import subprocess
from time import perf_counter

from run import IMAGES, ROOT
from word_groups import group_lines


NATIVE = Path(__file__).resolve().parents[2] / "symbols/ocr-symbols"
RESULTS = Path(__file__).with_name("comparison.jsonl")


def normalized(text):
    return text.casefold().strip().strip(".,!?():;[]{}\"'“”")


def overlap(first, second):
    left = max(first[0], second[0])
    top = max(first[1], second[1])
    right = min(first[2], second[2])
    bottom = min(first[3], second[3])
    intersection = max(0, right - left) * max(0, bottom - top)
    area_first = (first[2] - first[0]) * (first[3] - first[1])
    area_second = (second[2] - second[0]) * (second[3] - second[1])
    union = area_first + area_second - intersection
    return intersection / union if union > 0 else 0


def matched_words(reference, candidates):
    used = set()
    scores = []
    for word in reference:
        text = normalized(word["text"])
        if not text:
            continue
        bounds = [word["x"], word["y"], word["x"] + word["width"], word["y"] + word["height"]]
        matches = [
            (overlap(bounds, candidate["box"]), index)
            for index, candidate in enumerate(candidates)
            if index not in used and normalized(candidate["text"]) == text
        ]
        if not matches:
            continue
        score, index = max(matches)
        if score >= 0.15:
            scores.append(score)
            used.add(index)
    return len(scores), round(statistics.median(scores), 3) if scores else None


def replacement_stats(reference, selected):
    matched = 0
    changed = 0
    for group in selected:
        box = group["box"]
        area = (box[2] - box[0]) * (box[3] - box[1])
        nearby = []
        for word in reference:
            native = [word["x"], word["y"], word["x"] + word["width"], word["y"] + word["height"]]
            native_area = word["width"] * word["height"]
            width = max(0, min(box[2], native[2]) - max(box[0], native[0]))
            height = max(0, min(box[3], native[3]) - max(box[1], native[1]))
            if area > 0 and native_area > 0 and (width * height) / min(area, native_area) >= 0.3:
                nearby.append(word["text"])
        if nearby:
            matched += 1
            if normalized(" ".join(nearby)) != normalized(group["text"]):
                changed += 1
    return {
        "replacementCandidateCount": matched,
        "replacementTextChangedCount": changed,
        "replacementUnmatchedCount": len(selected) - matched,
    }


def compare(tier):
    from paddleocr import PaddleOCR

    version = subprocess.run(["tesseract", "--version"], capture_output=True,
                             text=True, check=True).stdout.splitlines()[0].split()[1]
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
    for sample, image in IMAGES.items():
        native = subprocess.run(
            [str(NATIVE), str(image), "eng+pol", "3"],
            capture_output=True, text=True, check=True,
        )
        reference = json.loads(native.stdout)["words"]
        start = perf_counter()
        result = ocr.predict(str(image), return_word_box=True)[0].json["res"]
        predict_ms = round((perf_counter() - start) * 1000, 2)
        groups, ambiguous = group_lines(result["text_word"], result["text_word_boxes"])
        matched, median_iou = matched_words(reference, groups)
        record = {
            "sampleId": sample,
            "imageSha256": hashlib.sha256(image.read_bytes()).hexdigest(),
            "modelLabel": f"PP-OCRv6_{tier}",
            "configuration": "paddle-cpu-4threads-whitespace-v1",
            "predictMs": predict_ms,
            "reference": f"Tesseract-{version}-eng+pol-psm3",
            "referenceWordCount": len(reference),
            "groupedWordCount": len(groups),
            "ambiguousFragments": ambiguous,
            "sameTextAndLocationCount": matched,
            "sameTextAndLocationPercent": round(100 * matched / len(reference), 1) if reference else None,
            "medianBoxIoU": median_iou,
            **replacement_stats(reference, groups),
            "gameSubtitleExact": (
                [item["text"] for item in groups if 900 <= item["box"][0] <= 1080 and 390 <= item["box"][1] <= 480]
                == ["Podróżny", "Oj,", "coś", "mnie", "rwie."]
            ) if sample == "witcher-535" else None,
        }
        with RESULTS.open("a") as output:
            output.write(json.dumps(record) + "\n")
        print(json.dumps(record), flush=True)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tier", choices=("tiny", "small", "medium"))
    compare(parser.parse_args().tier)
