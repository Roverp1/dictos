# Screen text capture: UX notes

Rough notes from the discussion around [issue #42](https://github.com/roverp1/dictos/issues/42). These describe the desired interaction, not the current application contract or a finished Specification.

## Why this exists

The current screen-region script saves whatever Tesseract reads as an Entry immediately. A bad OCR result requires editing or deleting the Entry later, and selecting a sentence wrapped across lines can pull in unwanted text. Current Description Generation also requires an existing Description, so a newly captured Entry cannot go straight to useful generated Descriptions without the user writing one first.

The desired feel is closer to Android's Circle to Search: recognize the frozen screen as text, let the user pick the Entry and optional surrounding text, review and correct both, then decide what to save or generate.

## Screen and text selection

- A Hyprland keybind opens a persistent fullscreen overlay. `SUPER+O` was an illustrative binding, not a final shortcut.
- Capture one image **before** showing the overlay. Display that same frozen image and use it for OCR, so the highlights stay aligned. An OCR result contains text plus geometry for blocks, lines, and words; symbol geometry is desirable for precise adjustments.
- Treat each monitor's screenshot and OCR coordinates separately. Map physical screenshot pixels to logical overlay positions on scaled or mixed-DPI displays.
- Run full-screen OCR in the background. A spinner or "Recognizing text…" state is visible until selection is ready. OCR should not rerun for ordinary selection changes.
- Drag from the start to the end of text. Normal selection snaps to whole recognized words and can cross lines. Forgiving hit targets should find the nearest sensible text position rather than require a perfect drag across glyph pixels. Releasing the mouse keeps the overlay and selection open.
- Show handles at the selected range's ends. Dragging a handle can refine an endpoint within a word **or extend it past the original selection**, including onto another line. Holding Ctrl on the first drag starts precise selection directly. If usable symbol positions are missing, fall back to whole-word selection; the editable field still allows correction.
- A new drag can replace the selection for the active field. Entry and surrounding-text selections remain independent and visually distinguishable.
- OCR might omit text, misread it, or return boxes over scenery. The user can always type or edit the result instead of being stuck with the OCR output.

The whole-screen OCR-first prototype was a clear winner in hands-on testing. The region-first prototype felt much worse. Ordinary Polish text works well; some Witcher subtitles are missed, misread, or mistaken for parts of the background.

### Optional OCR retry

- Holding Alt and dragging a rough rectangle requests a **targeted OCR retry** on that part of the same frozen screenshot. This is an escape hatch when the full-screen pass misses text, not the main selection mode.
- A retry may use a padded crop, a suitable page-segmentation mode, or image adjustments such as upscaling or contrast. Test such treatments against unchanged screenshots; cropping does not remove texture immediately behind letters. The original screenshot remains the visible background.
- Results from a retry should not silently replace an already edited Entry or surrounding-text field. Keep other recognized text and selections available.

## Bottom field and save gestures

After the first selection, show its proposed **Entry** text in a bottom input field, similar to the reference image from the discussion. The user can click the field to correct or redact the exact text before it enters Dictos.

| Gesture or action                              | Proposed effect                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Swipe the Entry field right to left            | Switch to the surrounding-text field.                                                     |
| Select more text from the frozen screen        | Fill the surrounding-text field, for example with a sentence or two containing the Entry. |
| Click either field                             | Edit the OCR result directly.                                                             |
| Swipe the Entry field left to right            | Save the Entry and close the overlay.                                                     |
| Swipe the surrounding-text field left to right | Save the Entry and its surrounding text as a `misc` Description, then close.              |
| Drag either bottom field upward                | Open a larger panel for Description Generation.                                           |
| Escape                                         | Close without saving unsaved work.                                                        |

An earlier sketch also suggested Ctrl+C to copy the selected text and Enter to send it to Dictos. How those shortcuts coexist with editing and the later swipe-to-save design remains open. Gesture recognition should distinguish a swipe from clicking or selecting text inside an input.

Other exploratory shortcuts included double-clicking to select a word, line, or sentence, Ctrl+A to select all recognized text, and keys such as S for search or T for translation. These were ideas, not commitments to add search or translation. Keyboard actions should also have clear behavior while an input field has focus.

## Expanded panel and Description Generation

The upward-drag panel contains the editable Entry and surrounding-text fields plus an Instruction field:

1. Use the dropdown beside the Instruction field to select an existing Instruction, or type a custom directive for this invocation. Whether that custom text becomes a reusable Instruction is undecided.
2. Press a button the user called **Generate examples**. If the surrounding-text field has content, use it to guide the suggestions; otherwise generate from the Entry alone. Here "examples" meant suggested Senses and Descriptions, not necessarily the `example` Description Type.
3. Show candidate Senses and Descriptions for review. The user picks a useful candidate and chooses the Description Types they want, then requests the final Descriptions.
4. Review generated content before accepting it. Generated content stays a proposal until accepted; rejecting it does not write that content to the Dictionary. Keep the existing Description-based generation workflow available where useful.
5. Swiping the bottom bar or expanded panel left to right saves the information approved so far and exits. Define the precise save boundary for accepted generated content in the Specification.

The current implementation generates from a saved source Description and only prompts when it suspects a duplicate Sense. Entry-based generation, optional surrounding text, intermediate suggestions, custom Instruction text, and review of every proposal are desired changes, not existing behavior.

## Possible client boundary

The initial Linux/Hyprland direction was a Quickshell overlay for rendering, input, highlights, and gestures, plus a separate OCR helper using the same screenshot. `grim` can supply that image; Tesseract is the current prototype engine, while qocr's Chrome Screen AI approach was investigated as an alternative. Dictos should receive approved text without depending on Quickshell inside the Dictionary domain. A local IPC socket, stdin, and a CLI command were mentioned as possible handoff mechanisms, not selected contracts.

## Interaction and OCR questions for the eventual Specification

- What is the acceptable delay between opening the overlay and selectable text? Dense full-screen captures have taken about four seconds in the prototype, while sparse game frames can take under a second.
- When a game subtitle is missed, which targeted retry modes and image adjustments actually help without adding false word boxes? Keep the full-screen flow intact even if a retry is needed.
- Can word and symbol geometry be collected from one Tesseract recognition pass without noticeably increasing latency? Normal drags use words; precise handles and Ctrl+drag use symbols. If not, compare a lazy symbol pass triggered by precise adjustment.
- Decide how many suggestion/generation calls the expanded panel makes, what choosing a suggested Sense means, and how the Instruction and Description Types affect each call.
- Decide what happens if generation is skipped, rejected, or fails after the user has already chosen to save an Entry or `misc` Description. Keep cancel and commit behavior explicit.
- Set the keyboard equivalents and final gesture thresholds during interaction design. The prototype confirms the OCR-first selection concept, but it is not the final visual design.

The existing glossary defines Description Generation as starting from a selected Description. Once the Entry-based path is agreed upon, `CONTEXT.md` and the Description Generation Documentation Module need to describe the broader workflow.
