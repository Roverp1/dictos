# Screen text capture: UX notes

Notes from the discussion around [issue #42](https://github.com/roverp1/dictos/issues/42). They describe a desired interaction, not the current application contract or an approved Specification.

## Why this exists

The screen-region script saves Tesseract's result as an Entry immediately. If OCR is wrong, the user has to edit or delete the Entry afterward. A selection across wrapped lines can also include unwanted text. Description Generation starts from an existing Description, so a captured Entry cannot use it until the user writes a Description first.

The target is closer to Android's Circle to Search: recognize text on a frozen screen, let the user select an Entry and optional surrounding text, review and edit them, then choose what to save or generate.

## Screen and text selection

- A Hyprland keybind opens a fullscreen overlay that stays open until dismissed. `SUPER+O` was an example, not a chosen shortcut.
- Capture one image **before** showing the overlay. Keep it frozen and use it for OCR so the highlights remain aligned. OCR returns text and geometry for blocks, lines, and words. Symbol boxes would allow finer adjustments.
- Keep each monitor's screenshot and OCR coordinates separate. Map physical screenshot pixels to logical overlay positions on scaled or mixed-DPI displays.
- Run full-screen OCR in the background. Show a spinner or "Recognizing text…" until selection is ready. Ordinary selection changes should not trigger another OCR pass.
- Let the user drag across text, snapping to recognized words and allowing selections across lines. Hit targets should find the nearest reasonable text position, even when the drag misses the glyphs. Releasing the mouse keeps the overlay and selection open.
- Put handles at both ends of the selection. A handle can adjust an endpoint within a word **or extend it past the original selection**, including onto another line. Holding Ctrl on the first drag starts precise selection. If symbol boxes are missing, use whole-word selection; the user can still edit the field.
- A new drag replaces the selection for the active field. Keep Entry and surrounding-text selections independent and visually distinct.
- OCR can miss text, misread it, or place boxes over scenery. The user can type or edit the result at any time.

In hands-on tests, whole-screen OCR first worked much better than the region-first prototype. Ordinary Polish text is recognized well. Some Witcher subtitles are missed, misread, or confused with the background.

### Optional OCR retry

- Hold Alt and drag a rough rectangle to run a **targeted OCR retry** on the same frozen screenshot. Use this when full-screen OCR misses text; it is not the main selection mode.
- A retry can use a padded crop, another page-segmentation mode, or image adjustments such as upscaling and contrast. Test changes against the same screenshots. Cropping leaves texture behind the letters, and the original image remains visible in the overlay.
- A retry must not overwrite an Entry or surrounding-text field the user has edited. Keep the other recognized text and selections available.

## Bottom field and save gestures

After the first selection, show the proposed **Entry** in a bottom input field, as in the reference image from the discussion. The user can edit or redact the text before it enters Dictos.

| Gesture or action                              | Proposed effect                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Swipe the Entry field right to left            | Switch to the surrounding-text field.                                                     |
| Select more text from the frozen screen        | Fill the surrounding-text field, for example with a sentence or two containing the Entry. |
| Click either field                             | Edit the OCR result directly.                                                             |
| Swipe the Entry field left to right            | Save the Entry and close the overlay.                                                     |
| Swipe the surrounding-text field left to right | Save the Entry and its surrounding text as a `misc` Description, then close.              |
| Drag either bottom field upward                | Open a larger panel for Description Generation.                                           |
| Escape                                         | Close without saving unsaved work.                                                        |

An earlier sketch suggested Ctrl+C to copy the selection and Enter to send it to Dictos. How these shortcuts fit with editing and swipe-to-save is still undecided. Gesture handling must distinguish a swipe from clicking or selecting text in an input.

Other shortcut ideas included double-clicking to select a word, line, or sentence, Ctrl+A to select all recognized text, and keys such as S for search or T for translation. These are not commitments to add search or translation. Keyboard actions also need defined behavior when an input field has focus.

## Expanded panel and Description Generation

The upward-drag panel contains editable Entry and surrounding-text fields, plus an Instruction field:

1. Choose an existing Instruction from the dropdown, or type a directive for this request. Whether custom text can be saved as a reusable Instruction is undecided.
2. Press **Generate examples**. Use the surrounding text to guide suggestions when it is present; otherwise, use the Entry alone. "Examples" here means suggested Senses and Descriptions, not necessarily the `example` Description Type.
3. Review candidate Senses and Descriptions. Choose a candidate and the Description Types, then request the final Descriptions.
4. Review generated content before accepting it. Until accepted, it remains a proposal and does not write to the Dictionary. Keep the existing Description-based workflow where it is useful.
5. Swipe the bottom bar or expanded panel left to right to save approved information and exit. The Specification must define what happens to accepted generated content.

The current implementation generates from a saved Description and prompts only when it suspects a duplicate Sense. Entry-based generation, surrounding text, intermediate suggestions, custom Instructions, and review of every proposal are proposed changes.

## Possible client boundary

The initial Linux/Hyprland design used a Quickshell overlay for rendering, input, highlights, and gestures, plus a separate OCR helper working from the same screenshot. `grim` can capture the image. Tesseract is the prototype engine; qocr's Chrome Screen AI approach was also investigated. Dictos should receive approved text without bringing Quickshell into the Dictionary domain. A local IPC socket, stdin, and a CLI command were discussed as handoff options, but none was selected.

## Interaction and OCR questions for the eventual Specification

- How long can the user wait after opening the overlay before text is selectable? Dense captures took about four seconds; sparse game frames took under one second.
- Which retry modes or image adjustments recover missed subtitles without adding false boxes? A retry should leave the full-screen result available.
- Can one Tesseract pass return word and symbol geometry without a noticeable delay? Normal drags use words; precise handles and Ctrl+drag use symbols. If the extra geometry is costly, test a symbol pass only when the user adjusts a selection precisely.
- How many suggestion and generation calls should the expanded panel make? What does choosing a suggested Sense mean, and how do Instructions and Description Types affect each call?
- What happens if generation is skipped, rejected, or fails after the user chooses to save an Entry or `misc` Description? Define cancel and commit behavior.
- Set keyboard equivalents and gesture thresholds during interaction design. The prototype tests the OCR-first selection idea; its visual design is still open.

The glossary defines Description Generation as starting from a selected Description. If the Entry-based flow is approved, update `CONTEXT.md` and the Description Generation Documentation Module to cover it.
