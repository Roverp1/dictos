# Technical Plan: Screen Entry and Description Generation

**Parent Spec**: [spec.md](./spec.md) | **Status**: Draft

## 1. Architectural Strategy

Build the overlay as a Quickshell client in `apps/overlay`, starting from the [warm OCR experiment](../../experiments/screen-text-selection/README.md). Keep its focused-monitor screenshot, image-to-screen coordinate transform, word/symbol selection, independent highlights, handles, and Alt-drag crop retry. Move and harden the [C++ Tesseract helper](../../experiments/screen-text-selection/session/ocr-server.cpp). It links libtesseract and Leptonica, initializes once alongside screen capture, keeps the image for the session, and serves full and crop requests over a private Unix socket. The development launcher starts and stops this companion process with the overlay. Tesseract stays outside Quickshell, and selections do not start fresh Tesseract processes. Packaging and deployment are deferred.

Use Caelestia shell as the visual reference without depending on it at runtime. Adapt its bottom-launcher reveal, tokens, and useful control behavior into local QML components. The frozen screenshot **must receive pointer input across the entire monitor** for Entry and Description selection. Caelestia's click-through window mask would send clicks to live applications behind it. Keep the prototype's full-screen overlay-layer window and managed keyboard focus. Route drawer events to its controls; outside a pinned drawer, screenshot gestures dismiss the drawer or select text as appropriate. The bottom-attached drawer always shows the center and right columns; the Senses column appears on demand. Defer final error placement until the visual pass, but provide a readable Notification and Copy drafts action from the start.

Use the Command Client between QML and Dictos data. Add three provisional overlay operations: Sense suggestions, unsaved Description Generation, and atomic reviewed save. Exchange one JSON request and response through stdin/stdout, keeping multiline Entry, Description, and Instruction text out of process arguments. Keep the existing human-facing `description generate <description-id>` unchanged. Put validation and Model eligibility in `packages/core`, provider calls and structured response validation in `@dictos/ai-sdk`, local state in `@dictos/fs-storage`, and the save transaction in `@dictos/db-core`. Generation uses the Model/Provider graph without opening or writing the Dictionary; listing saved Instructions still reads it. Extend the [first-class Command Client](../../docs/adr/0006-first-class-command-client.md) without adding a local server. CLI spelling stays provisional until the planned redesign.

### Source reuse, narrowed to useful pieces

| Source                                                                                                                                                             | Use in Dictos                                                                                                                                                | Boundary                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `experiments/screen-text-selection/full/selection.js`, `full/shell.qml:27-119,326-513`, `session/ocr-server.cpp`, `session/client.ts`, `run-warm.sh`               | Port selection/coordinate code and the warm OCR session into `apps/overlay`; separate selection state from QML rendering.                                    | Keep word/symbol boxes in screenshot coordinates and each field's source OCR snapshot across crop retries. Rework the editor and gestures instead of copying the experimental UI.        |
| `tmp/shell/modules/launcher/Wrapper.qml`, `modules/drawers/Panels.qml`, `components/Anim.qml`, `plugin/src/Caelestia/Config/tokens.hpp`                            | Adapt bottom-edge offset/opacity reveal and local tokens: 4 to 48 spacing/rounding scale, font roles, about 500 ms spatial motion and 150 to 200 ms effects. | Leave out `ScreenState`, Caelestia's C++ config singleton, launcher services, and its drawer window.                                                                                     |
| `tmp/shell/components/controls/{ButtonBase,TextButton,TextFieldBase,StyledTextField}.qml`, `components/StateLayer.qml`, `components/containers/StyledListView.qml` | Adapt focused fields, button feedback, picker triggers, and scrollable Sense/result lists where useful.                                                      | Controls reference `Tokens`, `StyledRect`, other components, and sometimes Qt Shapes. Port only needed dependencies with local styling; keep applicable upstream notices on copied code. |
| `tmp/omarchy/shell/Ui/{PanelKeyCatcher,PointerMoveGate}.qml`, `shell/plugins/panels/network/Panel.qml`, `shell/plugins/panels/dropbox/Panel.qml`                   | Adapt semantic keys, real-pointer-motion gating, a shared mouse/keyboard cursor, dynamic-section repair, and scroll-to-cursor.                               | Add Dictos's Ctrl-column, Ctrl-drawer, and Ctrl-r redo shortcuts. Block key interception during editing; restore navigation focus afterward.                                             |
| `tmp/omarchy-abematv/Panel.qml`, `tmp/xbmc/xbmc/input/actions/ActionTranslator.cpp`                                                                                | Consult for horizontal scroll-to-selection and semantic actions.                                                                                             | Reference only; leave out Kodi C++ UI code and the full Omarchy panel.                                                                                                                   |
| `tmp/qocr/shell/Selector.qml`, `tmp/rustylens/src/ui.rs`                                                                                                           | Consult if rotated boxes, whitespace ordering, or image scaling break the warm selection model.                                                              | Keep the text-range UX; qocr's rectangle intersection and RustyLens's GTK viewer do not replace the overlay.                                                                             |

The user has checked the project's licensing arrangement for adapting Caelestia's GPL-3.0 and Omarchy's MIT sources. Preserve copied-file notices and record separately licensed fonts or icons if included. All licence nototes should be written in centralized `THIRD_PARTY_NOTICES.md` inside the specific monorepo package, instead of repeating the same licence notice across multiple files. Example of such notice can be seen in `packages/ai-sdk/THIRD_PARTY_NOTICES.md`. Use a Dictos-local token layer for visual and motion fidelity; upstream shell modules still need adaptation.

### Development shape

`apps/overlay` owns the QML surface, local components, navigation controller, launcher, and native OCR helper source. In `devenv`, a development command builds the C++ helper against Tesseract/Leptonica, launches Quickshell, and cleans up its private screenshot, socket, and helper on exit. Extend the existing `devenv` environment with an overlay profile containing Quickshell, screenshot tools, compiler/build metadata, and the prototype's English/Polish OCR data. Check the helper binary and language initialization in that shell. Use Qt's software renderer only when the normal renderer fails. Installation, Nix package outputs, and a distro-neutral binary release are deferred.

## 2. Data Model & State Changes

### Dictionary records

Reuse `entries`, `senses`, `descriptions`, `folders`, and `activities` from `packages/db-core/src/schema/schema.ts`. No new Turso table or migration is required:

- Entry: derive the existing deterministic UUIDv5 from exact Entry text and the root Folder ID. Reuse an existing Entry with that identity.
- Center Save: save an optional nonempty captured Description as one `misc` Description with `senseId: null`; omit Sense and right-column drafts.
- Right Save: create one Sense for the Entry and insert every nonempty typed Description under it. The inclusive variant also inserts the captured Description as `misc` under that Sense. Never silently reuse a same-named Sense; identity determines grouping.
- Activity: increment the successful Entry-save action once, including when the Entry already exists, in the same transaction as the chosen records.

Use the same Entry ID and Activity ID derivation as `SqliteEntryRepository`. Extract shared transaction/identity helpers instead of duplicating UUID namespaces or nesting repository `save()` calls. Validate the root Folder, nonblank Entry, required Sense, Description Types, and at least one nonempty right-column Description (for right Save) **before** writing. Skip empty optional captured text and empty Description editors; preserve reviewed nonempty text exactly. In one transaction, insert or read the Entry, insert the optional Sense, captured Description, and typed Descriptions, then update Activity. Returning an Error value from a transaction callback after writes begin can commit partial rows. Roll back SQL failures and post-write invariant failures before returning a `DbError` at the adapter boundary. Keep the existing saved-Description proposal commit contract.

### Overlay-local state and draft state

Store overlay state in owner-only `<dataDir>/overlay-capture/state.json`. Keep device identity and Selected Model in `local-state.json`. Persist only:

```typescript
type OverlayCaptureLocalState = {
  version: 1;
  instructionText: string;
  selectedTypes: DescriptionType[];
};
```

`FsOverlayCaptureStateRepository.read()` returns `{ version: 1, instructionText: "", selectedTypes: ["definition"] }` if the file is absent. Malformed files return `StorageError` without replacing the user's text. `replace()` validates Types, serializes concurrent changes, and writes an owner-only temporary file before atomic rename. Debounce changes and flush pending state on exit, including Cancel. A blank Instruction clears the previous text. A small machine-readable CLI helper in the overlay command namespace reads and writes this state without touching the Dictionary or adding a Sense/generate/save operation. Do not persist undo snapshots, screenshots, raw model output, or database Instructions here.

Keep other state in memory for the session:

```typescript
type TypedDescriptionDraft = {
  key: string;
  type: DescriptionType;
  text: string;
  edited: boolean;
};
type DraftSnapshot = {
  entryText: string;
  descriptionText: string;
  instructionText: string;
  senseName: string;
  descriptions: TypedDescriptionDraft[];
};
type DraftHistoryAction = {
  before: DraftSnapshot;
  after: DraftSnapshot;
  requestRevision: number | null;
  generated: {
    senseName: string;
    descriptions: { type: DescriptionType; text: string }[];
  } | null;
};
type OverlayState = {
  entry: {
    text: string;
    selection: TextRange | null;
    sourceWords: OcrWord[];
    edited: boolean;
  };
  capturedDescription: {
    text: string;
    selection: TextRange | null;
    sourceWords: OcrWord[];
    edited: boolean;
  };
  instructionText: string;
  selectedTypes: DescriptionType[];
  senseName: string;
  descriptions: TypedDescriptionDraft[];
  suggestions: SenseCandidate[];
  activeField: "entry" | "description";
  activeNodeId: string | null;
  drawer: "compact" | "hover" | "pinned";
  mode: "compact-edit" | "navigation" | "editing" | "popup";
  generationRevision: number;
  activeGenerationActionRevision: number | null;
  undo: DraftHistoryAction[];
  redo: DraftHistoryAction[];
};
```

`TextRange`, `OcrWord`, `TypedDescriptionDraft`, and history actions belong to the overlay. `SenseCandidate` is a core-owned output DTO shared with it. None is a Dictionary table. Keep each range's source words so an Alt crop cannot shift earlier highlights. Store OCR geometry in screenshot pixels and transform it for rendering and pointer hits. Switching Sense records one history action, clears right-column Descriptions, and starts generation with that action's revision. Undo restores `before` and marks the action inactive. If its request later succeeds with the same inputs, cache the output on that history action without applying it. Redo restores `after`, reactivates the action, and uses its cached output or waits for the original pending request. For direct Generate and suggestions, apply responses only while `generationRevision` and inputs still match; input changes increment the revision and deactivate any older action. QML text-editor undo remains separate from navigation-mode `u`/`Ctrl+z` and `Ctrl+Shift+z`/`Ctrl+r` draft history.

## 3. Interface Contracts & Boundaries

### Core generation contracts

Keep `DescriptionGenerationService.createProposal({ sourceDescriptionId, instructionId, ... })` and `commitProposal()` for the existing saved-Description command. Add an input-text path: a blank Instruction adds no user directive; the adapter still supplies fixed task/JSON instructions. As in the existing service, core rechecks Model eligibility and loads the configured Provider Connection rather than trusting a catalog entry alone.

```typescript
type SenseCandidate = { name: string; definition: string }; // preview, not a saved Description
type GenerationDraft = {
  senseName: string;
  descriptions: { type: DescriptionType; text: string }[];
};
type ScreenGenerationFailure =
  | ValidationError
  | NotFoundError
  | ModelCatalogError
  | StorageError
  | DescriptionGenerationError
  | InvalidGenerationResponseError;

interface ScreenEntryGenerationPort {
  suggestSenses(input: {
    connection: ProviderConnectionWithCredential;
    modelId: string;
    entryText: string;
    descriptionText: string | null;
    instructionText: string;
    limit: 20;
  }): Promise<
    | SenseCandidate[]
    | DescriptionGenerationError
    | InvalidGenerationResponseError
  >;
  generateDescriptions(input: {
    connection: ProviderConnectionWithCredential;
    modelId: string;
    entryText: string;
    descriptionText: string | null;
    senseName: string | null;
    existingDescriptions: { type: DescriptionType; text: string }[];
    instructionText: string;
    targetTypes: DescriptionType[];
  }): Promise<
    | GenerationDraft
    | DescriptionGenerationError
    | InvalidGenerationResponseError
  >;
}

class ScreenEntryGenerationService {
  suggestSenses(input: {
    entryText: string;
    descriptionText: string | null;
    instructionText: string;
    model: SelectedModel;
  }): Promise<SenseCandidate[] | ScreenGenerationFailure>;
  generateDescriptions(input: {
    entryText: string;
    descriptionText: string | null;
    senseName: string | null;
    existingDescriptions: { type: DescriptionType; text: string }[];
    instructionText: string;
    model: SelectedModel;
    targetTypes: DescriptionType[];
  }): Promise<GenerationDraft | ScreenGenerationFailure>;
}
```

`ScreenEntryGenerationService` validates the nonblank Entry and unique known target Types. Request only selected Types lacking a nonempty draft; disable Generate when none remain to preserve user work. The adapter makes two bounded, non-streaming structured-output calls through existing fixed Provider routes with sanitized failure handling. Suggestions have at most 20 distinct, nonblank Sense names with short nonblank `definition` previews and are not stored. Generation must preserve a supplied Sense and cover every requested missing Type; without a Sense, it proposes a nonblank name. Validate output Types and nonblank Description text before returning a draft. Manual Descriptions and the captured Description provide context without changing the output schema or Provider routing. Neither operation calls or writes the database; existing provider SDK retry limits apply.

### Reviewed save contract

`packages/core` owns validation and the save port; `@dictos/db-core` implements one transaction. Save uses the **current** editor text, so manual edits and omissions determine the records written. This flow has no persisted generation proposal ID.

```typescript
type ScreenEntrySaveInput =
  | {
      kind: "entry";
      folderId: string;
      entryText: string;
      descriptionText: string | null;
    }
  | {
      kind: "sense";
      folderId: string;
      entryText: string;
      descriptionText: string | null;
      includeDescription: boolean;
      senseName: string;
      descriptions: { type: DescriptionType; text: string }[];
    };

type ScreenEntrySaveResult = {
  entry: Entry;
  sense: Sense | null;
  capturedDescription: Description | null;
  descriptions: Description[];
};

interface ScreenEntrySaveRepository {
  commit(input: ScreenEntrySaveInput): Promise<ScreenEntrySaveResult | DbError>;
}

class ScreenEntrySaveService {
  save(
    input: ScreenEntrySaveInput
  ): Promise<ScreenEntrySaveResult | ValidationError | DbError>;
}
```

The CLI resolves the root Folder ID before calling `save`. For noninclusive right Save, the service ignores `descriptionText`; it validates Types before filtering empty right-column editors and sends no empty rows to the adapter. The adapter checks that an existing Entry belongs to the requested Folder, never matches Sense by name, and returns committed IDs. A failed transaction returns an Error value without partial Dictionary changes. Only a confirmed success closes the overlay. Failures keep every field, including right-column text excluded from center Save. A child-process crash or unreadable response leaves an **unknown save outcome**: keep drafts visible, show the uncertainty, and do not auto-retry.

### Command Client and QML transport

Provide three provisional `dictos overlay` commands:

```text
dictos overlay suggest --json   < one JSON request on stdin
dictos overlay generate --json  < one JSON request on stdin
dictos overlay save --json      < one JSON request on stdin
```

Manual use can default to human-readable output. With `--json`, stdout contains exactly one newline-delimited envelope, including handled failures, with no progress text, logs, ANSI codes, raw provider response, or credentials. A Bun handler reads and validates one bounded JSON line from stdin. Quickshell `Process` enables stdin, writes `JSON.stringify(request) + "\n"` after launch, collects one response, and matches its process instance to the UI request revision. It checks exit status and malformed or empty output. Line framing needs no EOF signal and keeps Unicode and multiline text out of argv.

```typescript
type OverlayCliResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

type SuggestRequest = {
  entryText: string;
  descriptionText: string | null;
  instructionText: string;
};
type SuggestResult = { senses: SenseCandidate[] };
type GenerateRequest = {
  entryText: string;
  descriptionText: string | null;
  senseName: string | null;
  descriptions: { type: DescriptionType; text: string }[];
  instructionText: string;
  targetTypes: DescriptionType[];
};
type GenerateResult = GenerationDraft;
type SaveRequest =
  | { kind: "entry"; entryText: string; descriptionText: string | null }
  | {
      kind: "sense";
      entryText: string;
      descriptionText: string | null;
      includeDescription: boolean;
      senseName: string;
      descriptions: { type: DescriptionType; text: string }[];
    }; // CLI supplies root Folder
type SaveResult = {
  entryId: string;
  senseId: string | null;
  capturedDescriptionId: string | null;
  descriptionIds: string[];
};
```

Resolve Selected Model for suggestion/generation through the existing device-local selection service. A missing or stale choice returns a safe handled error; manual saving remains available. Use the existing expected-failure exit code for domain/Provider errors and the database-in-use code where applicable, even with a JSON error body. Provider/Model listing already works without the database. Add JSON listing to existing `instruction list`, `models`, and `model current` as needed for pickers; use `model select` to change the device-local Selected Model. These support reading and selection, not additional generation or save operations. Add `dictos overlay state read|write --json` helpers backed by `FsOverlayCaptureStateRepository` without opening the Dictionary. Revisit scope and names during the planned CLI overhaul.

### QML interaction and process lifecycle

Use a full-screen `PanelWindow` on the focused monitor's overlay layer, as in the warm prototype. The screenshot image, transparent selection layer, compact editor, and drawer share captured pixel coordinates. Accept left and right mouse buttons over the screenshot. A plain left single-click selects the whole recognized word as an Entry; a plain right single-click selects it as a captured Description. Left- and right-drag select ranges for the corresponding field. Distinguish clicks and double-clicks from drags by a movement threshold; Alt-left-drag triggers the existing padded OCR retry. Render only selected ranges for whole-screen OCR, without recognized-word boxes. For the active crop result, render light one-pixel recognized-word outlines separately from Entry and Description highlights. Returning to Full OCR hides these guidance boxes and preserves both selections. A left double-click clears only the Entry highlight; a right double-click clears only the captured Description highlight. Preserve each field's text from before the double-click, including any edit that its first click would otherwise replace. Each field keeps its OCR result snapshot, and retries preserve manually edited text. The drawer blocks screenshot selection within its hit area. Hover reveals an unpinned drawer; genuine interaction or `Ctrl+k` pins it. Outside click or `Ctrl+j` collapses it. After keyboard collapse, a stationary pointer in the hot zone must not reopen it.

Give every drawer column the same fixed width of 460 logical pixels. The center configuration column does not scroll, and its content fully determines drawer height. Constrain the left Senses column and right editor column to that available height; their content scrolls without increasing drawer height. Sense candidate cards wrap the entire name and definition preview without truncation or elision and grow as needed within their list.

Adapt Omarchy's key catcher so QML sends semantic `move`, `activate`, `edit`, `back`, `switchColumn`, `openDrawer`, `closeDrawer`, `undo`, and `redo` actions to one navigation controller. It owns stable item IDs, the active column, and edit/popup mode; it repairs the active item when a list changes and scrolls it into view. In compact mode, the selected Entry/Description field keeps text focus. `Ctrl+h/l` switches fields and `Ctrl+k` opens the drawer. In expanded navigation mode, `hjkl` moves relative to the active node and `Ctrl+h/l` switches available columns; `Ctrl+r` is redo, not refresh. Editors block the catcher except for deliberate drawer shortcuts. Leaving editing restores the previous navigation node. Omarchy's pointer-movement gate prevents animation, generated results, or scrolling under a stationary pointer from stealing the shared cursor. Keep Tab fallback and the keyboard alternatives to mouse gestures specified in the spec.

The launcher owns the private screenshot and OCR socket. The C++ helper owns its initialized API and decoded image and returns screenshot-relative word/symbol boxes. Reuse the bounded Unix-socket request client for full/crop OCR. Show OCR and command failures distinctly in a small Notification state; defer the final error-box layout. Copy drafts through `Quickshell.clipboardText`, labeling Entry, captured Description, Instruction, Sense, and typed Description text. Keep the overlay open during saves, disable duplicate Save actions, and exit only after confirmed success or explicit Cancel. On normal exit, stop the OCR helper and remove its temporary screenshot and socket.

## 4. Verification and Documentation

- Verify the native helper with existing full/crop/full protocol cases: Polish UTF-8, missing or unusable symbols, crop offsets, error/timeout recovery, and cleanup. Build from source in the `devenv` overlay shell and confirm Quickshell reaches the initialized helper without manual binary preparation.
- Test core suggestion/generation validation with provider HTTP fakes at the external AI boundary: empty Instruction, absent captured Description, nonblank Sense preservation, at most 20 suggestions, requested-Type coverage, invalid output, missing/stale Model, provider failure, and no Dictionary write before Save.
- Test all three save choices against an isolated Turso database: root Entry creation/reuse, captured `misc` grouping or omission, multiple Descriptions per Type, Activity, empty drafts, failure injected after an initial insert, complete rollback, and unchanged saved-Description generation. Check that a broken or missing CLI response does not report success.
- Exercise CLI JSON framing with multiline/Polish input, success and handled error envelopes, safe stdout/stderr, configured Model listing, saved Instruction listing, local state read/write/cancel persistence, and no database startup for state and provider-only paths. Keep secrets, raw provider responses, and unreviewed draft text out of normal logs.
- Check the warm screenshot graphically in the user's Wayland/Hyprland session: plain left/right single-click whole-word selection, word/symbol range dragging, double-click clearing only the corresponding highlight while preserving pre-double-click text, Alt OCR retry, compact focus, bottom hover/pin, two always-visible columns plus optional left wing, pointer/keyboard handoff, edit-mode shortcuts, undo/redo across delayed AI replies, and readable errors. Check that whole-screen OCR draws only selected ranges, the active crop result adds separate light one-pixel recognized-word outlines, and returning to Full OCR hides those outlines while preserving both selections. Verify equal fixed column widths, drawer height determined entirely by the non-scrollable center content, side-column scrolling without height growth, and full wrapping of Sense candidate names and previews in growing cards. Review the drawer before settling error placement from the rendered layout. CLI and database tests cannot establish visual fidelity or mixed-scale monitor alignment.
- Run focused package tests and maintained workspace typechecks after implementation. Update `CONTEXT.md`'s Description Generation definition and the living Dictionary/Description Generation module docs when the new contracts ship. Document the development launcher and native-helper build in the overlay README. Packaging, an installed hotkey, and broader CLI redesign are deferred.
