# OCR experiment summary

## Try the warm launcher

This launcher keeps one Tesseract session open for the overlay:

```sh
bash experiments/screen-text-selection/run-warm.sh full
```

See [`session/README.md`](./session/README.md) for build and fixture
instructions. The checked-in launcher is `experiments/screen-text-selection/run-warm.sh`.

## What it does

The launcher starts Tesseract model initialization before `grim` captures the
monitor. One live run took **209 ms** to capture and **263 ms** to initialize the
model. The server was ready about **270 ms** after launch, with **61 ms** left
after capture. That run confirms the work overlapped; it is only one measurement.

Each overlay run starts a native helper and initializes one Tesseract API. The
helper decodes the screenshot on the first OCR request, then reuses the API and
image for full OCR and Alt+drag crop retries. Crops include 20 pixels of padding;
word and symbol boxes remain in screenshot coordinates. A Bun client sends
requests over a local Unix socket.

Tests run FULL, CROP, then FULL again to check reuse and recovery from invalid
crops. Another test splits Polish UTF-8 text across socket reads. The launcher
stops its helper and removes the socket and captured screenshot when the overlay
exits. Supplied fixture images stay in place; no OCR process keeps running.

## What the measurements show

On the dense 1919×1079 image, Tesseract took about **3.5 seconds** to recognize
the full screen. A fresh request took about **3.8 seconds**, compared with
**3.5 seconds** using the same initialized session. Reuse saves startup time;
dense-screen recognition still takes seconds. On a sparse game frame, reused
full OCR took about **107 ms**. Tesseract missed a subtitle in one full-screen
pass; a focused crop recovered it once, with some false-positive boxes.

PP-OCRv6 tiny was faster, around **1.1 seconds warm**, and read the public game
subtitle. In hands-on review, its dense-screen text and box alignment were poor
for selection. It matched 456 of Tesseract's 502 words by text and overlapping
box. Small and medium were slower. RapidOCR's bundled PP-OCRv6 small models
took about **4.25 seconds warm** through ONNX Runtime CPU. That runtime had no
CUDA provider, so we did not test GPU inference. Tesseract is a reference for
these comparisons, not ground truth.

The comparison overlay defaults to PP-OCRv6 small because the user found tiny's
boxes poorly aligned. That choice is for hands-on evaluation. The warm
Tesseract launcher is the usable session-reuse prototype.

## What remains unproven

- We measured capture/init overlap once. We did not time overlay rendering or the first selectable OCR word.
- The warm overlay loaded in a desktop smoke test, and synthetic-image tests cover crop handling. Alt+drag still needs a hands-on test in the warm overlay.
- Dense-screen Tesseract OCR takes about 3.5 seconds even when the API is warm.
- The screenshots have no manually labeled text or boxes. Reading one subtitle exactly does not show which engine is more accurate overall.
- RapidOCR ran on CPU only; the installed ONNX Runtime had no CUDA provider.

Detailed records and setup notes are in [`findings.md`](./findings.md), [`benchmarks/`](./benchmarks/README.md), and [`session/README.md`](./session/README.md).
