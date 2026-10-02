# Screen text selection experiments

These Wayland/Hyprland overlays compare OCR selection approaches for Dictos.
Each captures the focused monitor, then keeps that image fixed while you select
text. Both modes have separate, editable Entry and context fields. They do not
write Dictionary records.

Run from the repository root, in your graphical session:

```sh
bash experiments/screen-text-selection/run.sh full
bash experiments/screen-text-selection/run.sh region
```

The warm Tesseract launcher initializes its model during screen capture and
keeps the same session for Alt retries. See [`session/README.md`](./session/README.md)
for setup, and [`summary.md`](./summary.md) for results and limits:

```sh
bash experiments/screen-text-selection/run-warm.sh full
```

`full` OCRs the whole monitor, then lets you drag across recognized words. In
`region`, drag a rough rectangle to OCR that area, then refine the selection
over its recognized words. Choose **Context** to select another passage from
the same image. Edit either field to correct OCR. **Close** or Escape exits and
removes the temporary screenshot. These experiments do not save entries or
generate content.

In `full`, normal drags select whole words. With the native word-and-symbol
helper configured, hold Ctrl while dragging to select symbols, or adjust the
end handles after selecting a word. Words without usable symbol boxes still
snap to whole words. Build the helper using [`symbols/README.md`](./symbols/README.md),
then run:

```sh
DICTOS_OCR_NATIVE_HELPER="$PWD/experiments/screen-text-selection/symbols/ocr-symbols" \
  bash experiments/screen-text-selection/run.sh full
```

Hold Alt and drag a rectangle in `full` to OCR a padded crop of the same
screenshot. The retry uses PSM 6 by default; set `DICTOS_OCR_RETRY_PSM=11` to
change it. The new word boxes are selectable without changing either field.
Choose **Full OCR** to return to the full-screen result. The native helper also
returns symbol boxes for crop retries; the CLI fallback returns whole-word boxes
only.

To compare both modes on exactly the same image, supply a PNG with `--image`:

```sh
bash experiments/screen-text-selection/run.sh full --image /path/to/screen.png
bash experiments/screen-text-selection/run.sh region --image /path/to/screen.png
```

`--output NAME` selects a monitor. Set `DICTOS_OCR_LANG` to change the installed
Tesseract languages (default: `eng+pol`). Full-screen OCR uses PSM 3; try
`DICTOS_OCR_FULL_PSM=11` for scattered text and check the word order. Region OCR
uses PSM 6 by default; set `DICTOS_OCR_REGION_PSM=11` for mixed regions.

The graphical session needs `bun`, `qs`, `grim`, `hyprctl`, `magick`, and
`tesseract` on `PATH`. The launcher uses Qt's software renderer because this
session could not create an OpenGL context. The displayed OCR time does not
include screen capture or overlay startup.

Try a word, a phrase across lines, and text beside another column in both modes.
Note the field contents before editing, missed or wrong words, neighboring text
selected by mistake, and how the interaction feels. Tesseract's reading order
can produce a bad range in a busy layout even when it recognizes each word
correctly. If its recognition or box positions get in the way, Chrome Screen AI
is another engine to test. See [`findings.md`](./findings.md) for screenshot
comparisons and native word/symbol timings.

Run the local helper checks with:

```sh
bun test experiments/screen-text-selection
```
