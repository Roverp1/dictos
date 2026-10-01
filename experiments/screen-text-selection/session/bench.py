#!/usr/bin/env python3
"""Measure cold launches against repeated requests to one OCR session."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import re
import statistics
import subprocess
import time
from pathlib import Path


def read(process):
    line = process.stdout.readline()
    if not line:
        raise RuntimeError(f"probe exited early ({process.poll()})")
    response = json.loads(line)
    if response["type"] == "error":
        raise RuntimeError(response["reason"])
    return response


def start(binary, image, language):
    started = time.perf_counter()
    process = subprocess.Popen(
        [binary, image, language],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
    )
    ready = read(process)
    return process, ready, (time.perf_counter() - started) * 1000


def request(process, command):
    started = time.perf_counter()
    process.stdin.write(command + "\n")
    process.stdin.flush()
    result = read(process)
    return result, (time.perf_counter() - started) * 1000


def stop(process):
    process.stdin.write("QUIT\n")
    process.stdin.flush()
    process.communicate(timeout=10)
    if process.returncode:
        raise RuntimeError(f"probe exited with {process.returncode}")


def stats(samples):
    return {"median": round(statistics.median(samples), 2),
            "min": round(min(samples), 2), "max": round(max(samples), 2)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image")
    parser.add_argument("--binary", default=str(Path(__file__).with_name("session-probe")))
    parser.add_argument("--language", default="eng")
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--sample-id")
    parser.add_argument("--record", type=Path)
    args = parser.parse_args()
    if args.repeats < 1:
        parser.error("--repeats must be positive")
    sample_id = args.sample_id or Path(args.image).stem
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}", sample_id):
        parser.error("sample ID must be a short safe identifier")
    samples = {name: [] for name in (
        "coldReadyWallMs", "coldFullWallMs", "coldCropWallMs",
        "warmFullWallMs", "warmCropWallMs", "decodeMs", "initMs",
        "fullSetImageMs", "fullRecognizeMs", "fullWordsMs", "fullSymbolsMs",
        "cropSetImageMs", "cropSetRectangleMs", "cropRecognizeMs",
        "cropWordsMs", "cropSymbolsMs")}

    process, ready, _ = start(args.binary, args.image, args.language)
    width, height = ready["width"], ready["height"]
    crop = f"CROP {width // 4} {height // 4} {width // 2} {height // 2}"
    stop(process)
    last = {}
    for _ in range(args.repeats):
        for mode, command in (("Full", "FULL"), ("Crop", crop)):
            process, ready, startup = start(args.binary, args.image, args.language)
            result, wall = request(process, command)
            stop(process)
            if mode == "Full":
                samples["coldReadyWallMs"].append(startup)
                samples["decodeMs"].append(ready["decodeMs"])
                samples["initMs"].append(ready["initMs"])
            samples[f"cold{mode}WallMs"].append(startup + wall)
        process, _, _ = start(args.binary, args.image, args.language)
        for index, (mode, command) in enumerate((("Full", "FULL"), ("Crop", crop), ("Full", "FULL"))):
            result, wall = request(process, command)
            if index == 2:
                continue
            samples[f"warm{mode}WallMs"].append(wall)
            last[mode] = {"wordCount": result["wordCount"],
                          "symbolCount": result["symbolCount"]}
            for key in ("setImageMs", "recognizeMs", "wordsMs", "symbolsMs"):
                sample_key = f"{mode.lower()}{key[0].upper()}{key[1:]}"
                samples[sample_key].append(result[key])
            if mode == "Crop":
                samples["cropSetRectangleMs"].append(result["setRectangleMs"])
        stop(process)
    record = {
        "schemaVersion": 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sampleId": sample_id,
        "imageSha256": hashlib.sha256(Path(args.image).read_bytes()).hexdigest(),
        "dimensions": {"width": width, "height": height},
        "engine": "tesseract-session-cpp",
        "language": args.language,
        "fullPsm": 3,
        "cropPsm": 6,
        "repeats": args.repeats,
        "cropRegion": crop,
        "counts": last,
        "timingsMs": {key: stats(value) for key, value in samples.items()},
    }
    if args.record:
        root = Path(__file__).resolve().parents[1] / "benchmarks"
        if (not args.record.parent.is_dir() or args.record.suffix != ".jsonl"
                or not args.record.resolve().is_relative_to(root.resolve())
                or args.record.is_symlink()):
            parser.error("record path must be a regular JSONL file in benchmarks")
        with args.record.open("a") as output:
            output.write(json.dumps(record) + "\n")
    print(json.dumps(record, separators=(",", ":")))


if __name__ == "__main__":
    main()
