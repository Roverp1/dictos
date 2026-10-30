# Dictos overlay

The overlay is a development-only Quickshell client for Wayland/Hyprland. It freezes one monitor, recognizes text with a warm native Tesseract helper, and sends reviewed text to the Command Client. Installation, packaging, and an installed hotkey are deferred.

## Run from the checkout

Run `bun install` at the repository root, then launch from your graphical session:

```bash
devenv --profile overlay shell -- bun run dev:overlay
```

`run.sh` delegates to the shared `launch.sh` coordinator. Before capture or OCR startup, it runs CLI bootstrap to initialize missing `config.toml`, `cli.toml`, and `overlay.toml` starters and resolve shared → CLI → Overlay settings. Starters have local editor-schema directives and commented examples; existing files are never rewritten. Bootstrap needs no Dictionary, credentials, device identity, or network access. See the [configuration reference](../../docs/configuration.md) for locations, allowed overrides, precedence, and editor setup.

The launcher then chooses Hyprland's focused monitor (or the first monitor), captures it once with `grim`, and starts Quickshell from project paths. It builds `native/ocr-server` if missing or older than its C++ source. The helper initializes once per session and serves full-image and crop OCR over a private Unix socket. Normal shutdown stops it and removes the temporary screenshot, socket, and helper logs.

Each opening keeps its resolved configuration. The internal process-local `DICTOS_OVERLAY_CONFIG_SNAPSHOT` variable carries that snapshot through Quickshell to every CLI child. It is not a user preference. Children retain the opening's settings, including the CLI logging threshold inherited from shared/CLI files, without rereading or creating TOML files or reapplying environment overrides. File edits take effect on the next opening; bootstrap always reads fresh files even if a parent snapshot exists. An invalid inherited snapshot fails with exit 5 without falling back to disk. The CLI logging setting does not control QML warnings, launcher output, or native OCR diagnostics.

For a repeatable image or a specific monitor:

```bash
devenv --profile overlay shell -- bash apps/overlay/run.sh --image apps/overlay/tests/fixture.png --output DP-1
```

Replace `DP-1` with your monitor name. `--image PNG` uses an existing image instead of taking a screenshot; the source image is retained on exit. `--output MONITOR` selects the display and avoids focused-monitor discovery. Both flags are optional.

The normal hardware renderer failed in the recorded Wayland smoke run; Qt's software renderer worked. If graphics initialization fails in your session, try:

```bash
QT_QUICK_BACKEND=software devenv --profile overlay shell -- bun run dev:overlay
```

Reported manual checks cover TOML LSP support (editor not reported), Default Model setup, CLI use without a Default Model, and switching OCR from English to Polish. The full interactive Wayland workflow, mixed-scale/multimonitor alignment, live paid generation, and browser/WASM behavior remain unverified. Notification placement and sizing remain provisional.

## Native build and checks

The overlay profile supplies Quickshell, screenshot tools, a C++ compiler, `pkg-config`, Tesseract/Leptonica, and Qt test tools. OCR defaults to English (`["eng"]`). To choose languages, edit `overlay.toml`:

```toml
[ocr]
languages = ["eng", "pol"]
```

Check installed language data with `tesseract --list-langs`. Each array element is one identifier. A nonempty `DICTOS_OCR_LANG=pol` or `DICTOS_OCR_LANG=eng+pol` replaces the complete configured list for that opening; it does not append languages or edit the file. Unset or empty means no environment override.

The native helper must load every requested language before publishing readiness. Missing or partially loaded language data stops startup without opening Quickshell or falling back to English. Launcher stderr names confirmed missing identifiers before cleanup; when the cause is unknown, it names the requested languages and gives setup guidance. Raw helper stderr is not the user-facing error protocol.

From the repository root, run each check inside the profile:

```bash
devenv --profile overlay shell -- bun run --cwd apps/overlay build:native
devenv --profile overlay shell -- bun run --cwd apps/overlay test
devenv --profile overlay shell -- bun run --cwd apps/overlay test:native
```

`build-native.sh` uses `${CXX:-c++}` and `pkg-config` to link Tesseract and Leptonica. `test` runs Bun checks and an offscreen QML workflow with software rendering. `test:native` builds the helper, then runs Bun integration tests against its real Unix socket and the OCR client process. It also exercises the launch coordinator → Quickshell → `CliCommandRunner` → `CommandJob` → CLI handoff, including inherited configuration after file edits and malformed-snapshot failure without replacement files. The headless fixture shares production command components but does not instantiate the production screen root. Root tests alone do not cover this native process suite, and automated checks do not replace a graphical-session review.

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

`version: 1` identifies the file format. Empty text clears the remembered Instruction. Writes replace complete snapshots through an instance-local queue and atomic rename; across processes, the last completed replacement wins. Corrupt state reports a failure and is not silently replaced. Screenshots, draft text, undo history, and Selected Model are not persisted there. The separate device-local `local-state.json` stores device identity.

Set up Provider credentials and a file-based Default Model through the [CLI workflow](../cli/README.md#configuration-and-models). On opening, the Overlay initializes its Selected Model from the resolved default, inheriting the CLI default unless `overlay.toml` overrides it. There is no built-in default or automatic fallback. Choosing an eligible Model from the picker changes only this opening; separate overlays keep independent selections. Closing and reopening, including after Cancel, starts from the configured default. Picker changes preserve editor text and never write configuration or remembered state.

Each Suggest Senses or Generate request carries the current Selected Model explicitly. Catalog eligibility does not guarantee account access; generation checks the actual Model and Provider Connection when used. Manual editing and Save need no Model. Suggestions and generation return unsaved drafts and do not open or write the Dictionary.

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

OCR, local-state, picker, generation, and Save failures show a Notification. Configuration failures before opening reach launcher stderr with a safe source/key/reason summary; CLI children return `CONFIGURATION_ERROR` with exit 5 and supplemental structured issues. Notifications display the response message directly, without relying on stderr or decoding the issue list, and preserve draft text. Invalid loaded configuration stops the operation rather than substituting defaults.

Copy drafts copies labeled Entry, captured Description, Instruction, Sense, and nonempty typed Descriptions to the system clipboard. There is no dedicated Retry button: correct the problem and invoke the action again. If local-state flushing fails, the overlay stays open; an explicit exit afterward may lose the latest remembered Instruction/Type changes.

A successful Save retries dirty local state even after an earlier preference write failed. It closes only after that flush succeeds; another failure keeps the saved session open without repeating the Dictionary write.

QML uses native JavaScript exception handling at parsing/process boundaries, then reports safe structured failures through Notifications. TypeScript commands and adapters use `errore` Error-value unions. See Qt's [JavaScript host environment](https://doc.qt.io/qt-6/qtqml-javascript-hostenvironment.html) for the QML runtime boundary.

See the CLI README for the provisional newline-delimited JSON protocol. [`quick-entry.sh`](../cli/quick-entry.sh) remains the older immediate-save shortcut with no review drawer.
