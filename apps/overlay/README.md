# Dictos overlay

The overlay is a development-only Quickshell client for Wayland/Hyprland. It freezes one monitor, recognizes text with a warm native Tesseract helper, and sends reviewed text to the Command Client. Installation, packaging, and an installed hotkey are deferred.

## Run from the checkout

Run `bun install` at the repository root, then launch from your graphical session:

```bash
devenv --profile overlay shell -- bun run dev:overlay
```

`run.sh` chooses Hyprland's focused monitor (or the first monitor), captures it once with `grim`, and starts Quickshell from project paths. It builds `native/ocr-server` if missing or older than its C++ source. The helper initializes once per session and serves full-image and crop OCR over a private Unix socket. Normal shutdown stops it and removes the temporary screenshot, socket, and helper logs.

For a repeatable image or a specific monitor:

```bash
devenv --profile overlay shell -- bash apps/overlay/run.sh --image apps/overlay/tests/fixture.png --output DP-1
```

Replace `DP-1` with your monitor name. `--image PNG` uses an existing image instead of taking a screenshot; the source image is retained on exit. `--output MONITOR` selects the display and avoids focused-monitor discovery. Both flags are optional.

The normal hardware renderer failed in the recorded Wayland smoke run; Qt's software renderer worked. If graphics initialization fails in your session, try:

```bash
QT_QUICK_BACKEND=software devenv --profile overlay shell -- bun run dev:overlay
```

The smoke run did not verify overall UI polish, mixed-scale alignment, or paid AI behavior. Notification placement and sizing remain provisional.

## Native build and checks

The overlay profile supplies Quickshell, screenshot tools, a C++ compiler, `pkg-config`, Tesseract/Leptonica, and Qt test tools. OCR defaults to `eng+pol`; check installed language data with `tesseract --list-langs`. Set `DICTOS_OCR_LANG=eng` (or another installed language combination) before launching to override it.

From the repository root, run each check inside the profile:

```bash
devenv --profile overlay shell -- bun run --cwd apps/overlay build:native
devenv --profile overlay shell -- bun run --cwd apps/overlay test
devenv --profile overlay shell -- bun run --cwd apps/overlay test:native
```

`build-native.sh` uses `${CXX:-c++}` and `pkg-config` to link Tesseract and Leptonica. `test` runs Bun checks and an offscreen QML workflow with software rendering. `test:native` builds the helper, then runs Bun integration tests against its real Unix socket and the OCR client process. Automated checks do not replace a graphical-session review.

Qt tests need imports and plugins from the same Qt version as `qmltestrunner`. If inherited desktop paths produce a Qt private-API or plugin-version error, run with the profile's paths:

```bash
devenv --profile overlay shell -- bash -c '
  qml="$(pkg-config --variable=prefix Qt6Quick)/lib/qt-6/qml"
  shell="$(command -v qs)"
  plugins="$(pkg-config --variable=prefix Qt6Core)/lib/qt-6/plugins"
  env QML_IMPORT_PATH="$qml:${shell%/bin/qs}/lib/qt-6/qml" \
      QML2_IMPORT_PATH="$qml:${shell%/bin/qs}/lib/qt-6/qml" \
      QT_PLUGIN_PATH="$plugins" \
      QT_QPA_PLATFORM_PLUGIN_PATH="$plugins/platforms" \
      bun run --cwd apps/overlay test
'
```

## Select and edit

- Plain left-click selects a whole recognized word as Entry text; plain right-click selects it as a captured Description. Left- and right-drag select ranges for their corresponding fields, including multiline text. Their highlights stay independent.
- Hold Ctrl while dragging for precise symbol selection where OCR supplies usable symbol boxes. Drag the active selection's end handles to adjust it.
- Alt-drag retries OCR on a crop of the same frozen image with 20-pixel padding clipped to the image edges. Existing text and highlights remain. Only the active crop result shows light recognized-word outlines; Full OCR hides them. An empty crop keeps the previous usable OCR result and reports the failure.
- Left-double-click clears only the Entry highlight; right-double-click clears only the Description highlight. Each field retains the text it had before the double-click, including manual corrections.

The compact bottom bar edits the active field directly. `Ctrl+h` switches to Entry and `Ctrl+l` to Description. `Ctrl+k` opens and pins the drawer in navigation mode. Hover at the bottom-center edge reveals it temporarily; interaction pins it. Outside click or `Ctrl+j` collapses it.

The center configuration and right editor columns are always available; the suggested-Senses column appears on the left when requested. All columns are 460 logical pixels wide. The non-scrollable center content determines drawer height, and the suggestion and Description lists scroll within that height. Sense cards wrap their full name and preview without elision. The drawer catches input across its background and dividers, so those clicks cannot select screenshot text.

In the expanded drawer:

| Key                       | Action                                                                         |
| ------------------------- | ------------------------------------------------------------------------------ |
| `h/j/k/l` or arrow keys   | Move between controls                                                          |
| `Ctrl+h/l`                | Switch available sections/columns                                              |
| Enter                     | Activate the current control or choose a picker item                           |
| `i`                       | Edit the current text field                                                    |
| Esc                       | Leave editing, close a picker, or collapse the drawer; in compact mode, cancel |
| Tab / Shift+Tab           | Move through controls                                                          |
| `d` / Backspace           | Clear the current field in navigation mode                                     |
| `u` / `Ctrl+z`            | Undo a draft action in navigation mode                                         |
| `Ctrl+Shift+z` / `Ctrl+r` | Redo a draft action in navigation mode                                         |

Right-clicking an input outside edit mode also clears its text. Wheel input over read-only Description bodies scrolls the right column and responds to direction changes; in edit mode it scrolls the active editor's text. Editors keep ordinary typing and their own undo/redo. Real pointer movement updates the navigation cursor; a stationary pointer does not steal it during animation.

## Instructions, Models, and drafts

The Instruction picker reads saved Instructions. Choosing one copies its text; subsequent edits never create or update a database Instruction. Blank Instruction text is allowed and adds no user directive to generation.

The last Instruction text and selected Description Types are remembered in owner-only `<dataDir>/overlay-capture/state.json`, including on Cancel. Changes are debounced and pending writes are flushed on normal exit. Missing state defaults to:

```json
{ "version": 1, "instructionText": "", "selectedTypes": ["definition"] }
```

`version: 1` identifies the file format. Empty text clears the remembered Instruction. Writes replace complete snapshots through an instance-local queue and atomic rename; across processes, the last completed replacement wins. Corrupt state reports a failure and is not silently replaced. Screenshots, draft text, and undo history are not persisted there. Selected Model stays in the separate device-local `local-state.json`.

Set up Provider credentials through the [CLI](../cli/README.md#overlay-command-protocol-development), then choose an eligible Model from the picker. Catalog eligibility does not guarantee account access. Manual editing and Save need no Model. Suggest Senses and Generate require a usable Selected Model, return unsaved drafts, and do not open or write the Dictionary.

Suggest Senses offers up to 20 names with short definition previews. Choosing one fills the Sense field and starts generation as an undoable switch. It retains every Description card and all manual or edited text, clearing only unedited generated text from the previous Sense. Output fills existing empty slots before adding cards; if manual text fills every slot of a requested Type, generation appends another card. Same-Type card order is preserved. Previews are not saved automatically.

Explicit Generate replaces all drafts of checked Types, including manual edits and previously generated text, while retaining unchecked Types and the captured center Description. Existing nonempty drafts supply context before the checked slots are cleared. Generate remains available when every checked Type has text. Type controls affect generation only; `+ Type` adds another editor, and right Save includes every nonempty card regardless of those controls.

Sense switches and explicit Generate are single undoable actions. Undo restores the prior Sense and drafts, including after generation fails. Redo reuses a completed result or waits for its pending request when the request-bound inputs still match. Editing inputs before undo/redo cannot reactivate output for the previous text. Changing the Selected Model invalidates pending generation and suggestions. Manual cards, corrections, and cached results survive undo/redo; inactive replies cannot overwrite the current draft. This history lasts only for the current overlay session.

## Save and failures

All Save actions use the root Folder and current reviewed text:

| Button              | Saved records                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Save Entry (center) | Entry and optional captured Description as unassigned `misc`; ignores Sense and right-column drafts |
| Save Sense (right)  | Entry, a new Sense, and every nonempty typed Description; excludes captured Description             |
| Save All (right)    | Save Sense plus captured Description as `misc` under that Sense                                     |

Right-column saves require a nonblank Sense and at least one nonempty typed Description. Empty editors are omitted, and nonempty reviewed text is saved exactly. An existing Entry with the same exact text in the root Folder is reused; a matching Sense name does not reuse a Sense. An Entry renamed under its old deterministic ID returns a conflict without new records. The chosen records and one Activity increment are committed together.

Save blocks duplicate submissions while pending. The overlay validates the returned IDs, captured-record presence, Sense presence, and typed Description count against the submitted Save mode. A valid success receipt blocks further saves and starts the local-state flush before exit. Failed saves keep the overlay open with text intact. A dead child, unreadable response, or contradictory receipt means the outcome is unknown; check the Dictionary before repeating it. There is no automatic Save retry.

OCR, local-state, picker, generation, and Save failures show a Notification. Copy drafts copies labeled Entry, captured Description, Instruction, Sense, and nonempty typed Descriptions to the system clipboard. There is no dedicated Retry button: correct the problem and invoke the action again. If local-state flushing fails, the overlay stays open; an explicit exit afterward may lose the latest remembered Instruction/Type changes.

A successful Save retries dirty local state even after an earlier preference write failed. It closes only after that flush succeeds; another failure keeps the saved session open without repeating the Dictionary write.

QML uses native JavaScript exception handling at parsing/process boundaries, then reports safe structured failures through Notifications. TypeScript commands and adapters use `errore` Error-value unions. See Qt's [JavaScript host environment](https://doc.qt.io/qt-6/qtqml-javascript-hostenvironment.html) for the QML runtime boundary.

See the CLI README for the provisional newline-delimited JSON protocol. [`quick-entry.sh`](../cli/quick-entry.sh) remains the older immediate-save shortcut with no review drawer.
