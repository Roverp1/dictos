# Screen text selection experiments

Two minimal Wayland/Hyprland overlays compare OCR selection approaches for
Dictos. They capture the focused monitor before showing the overlay and display
that same frozen image throughout the session. Both modes have independent,
editable Entry and context fields. No Dictionary records are written.

Run from the repository root, in your graphical session:

```sh
bash experiments/screen-text-selection/run.sh full
bash experiments/screen-text-selection/run.sh region
```

The first command OCRs the entire captured monitor, then lets you drag from the
first to the last recognized word. The second opens immediately: drag a rough
rectangle to OCR it, then drag across the recognized words to refine it. Select
**Context** to make another independent selection from the same image. Edit
either field to correct OCR. **Close** or Escape exits and removes the temporary
screenshot. There are no save or generation actions in these experiments.

In the full-screen mode, normal drags select whole words. If the native
word-and-symbol helper is configured, hold Ctrl from the start of a drag to
select symbols, or drag the end handles after an ordinary selection. Words
without usable symbol boxes still snap to whole words. To build the optional
native helper, see [`symbols/README.md`](./symbols/README.md), then run:

```sh
DICTOS_OCR_NATIVE_HELPER="$PWD/experiments/screen-text-selection/symbols/ocr-symbols" \
  bash experiments/screen-text-selection/run.sh full
```

Hold Alt and drag a rough rectangle inside the full-screen mode to re-run OCR
on that area of the **same screenshot**. The retry uses a padded crop and PSM 6
by default (`DICTOS_OCR_RETRY_PSM=11` is also available). The new word boxes
are selectable without changing either editable field; **Full OCR** returns
to the original recognition. Precise symbol boundaries are currently only
available from the original full-screen recognition, not from a crop retry.

To compare both modes on exactly the same image, supply a PNG with `--image`:

```sh
bash experiments/screen-text-selection/run.sh full --image /path/to/screen.png
bash experiments/screen-text-selection/run.sh region --image /path/to/screen.png
```

`--output NAME` selects a monitor instead of the focused one. Set
`DICTOS_OCR_LANG=eng+pol` to change the installed Tesseract languages. The
whole-screen mode defaults to Tesseract page segmentation mode 3; try
`DICTOS_OCR_FULL_PSM=11` for scattered application text and compare the word
order. The region mode defaults to mode 6; `DICTOS_OCR_REGION_PSM=11` is also
available for mixed regions. These prototypes require `bun`, `qs`, `grim`,
`hyprctl`, `magick`, and `tesseract` on the graphical session's PATH. The launcher defaults to Qt's software renderer
because the shell session used for these experiments could not create an
OpenGL context. The displayed OCR time excludes screen capture and starting
the overlay.

Compare a word, a phrase spanning lines, and text beside another column on
both modes. Record the unedited fields, incorrect or missed words, accidental
neighboring text, and how long the interaction feels. Word order follows
Tesseract's recognition order; a busy layout can produce a bad range even when
individual words are recognized correctly. Chrome Screen AI is a possible follow-up if
Tesseract's measured word positions or recognition block the interaction.
The controlled screenshot comparisons and native word/symbol timings are in
[`findings.md`](./findings.md).

Run the local helper checks with:

```sh
bun test experiments/screen-text-selection
```
