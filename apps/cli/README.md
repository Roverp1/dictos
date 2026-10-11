# Dictos Command Client

Run `bun install` from the repo root, then use the CLI directly:

```bash
bun run dev:cli entry create --text "hello"
```

## Overlay command protocol (development)

Launch the review overlay from the repository root in a Wayland/Hyprland session:

```bash
devenv --profile overlay shell -- bun run dev:overlay
```

See the [overlay README](../overlay/README.md) for fixtures, native OCR builds, language data, renderer fallback, and controls. This is a checkout-based development client; packaging and an installed hotkey are deferred. The command names below are provisional.

### Provider and picker setup

Configure a Provider Connection through the CLI's hidden credential prompt, then select a Model listed for that configured Provider:

```bash
bun run dev:cli provider available
bun run dev:cli provider connect openai
bun run dev:cli models --json
bun run dev:cli model select openai/MODEL_ID
bun run dev:cli model current --json
bun run dev:cli instruction list --json
```

Replace `openai/MODEL_ID` with an ID returned by `models`. The Model picker lists eligible catalog Models for configured Provider Connections, without a free-text input. Listing does not probe account access. Credentials and Selected Model stay device-local. Manual overlay saves need neither a Model nor a saved Instruction; suggestions and generation require a usable Selected Model. A blank inline Instruction adds no user directive.

Picker commands return the same envelope shape as overlay commands. Their success `data` is:

| Command                       | Data                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| `instruction list --json`     | Array of `{id, name, text}`; `name` can be null              |
| `models [provider-id] --json` | Array of `{id, name, status}` for eligible configured Models |
| `model current --json`        | `{id}` or null when no Model is selected                     |

`models --json` writes catalog provenance to stderr. `model select <provider/model>` retains plain output and has no `--json` flag. Model listing/selection do not open the Dictionary; saved Instruction listing does and can fail if another client holds its lock. A stale current Model returns `MODEL_UNAVAILABLE`.

### Request framing and results

`overlay suggest`, `overlay generate`, and `overlay save` read one UTF-8 JSON line from stdin, including in human-output mode. With `--json`, stdout is exactly one newline-terminated envelope for success or a handled failure:

```json
{"ok":true,"data":{"senses":[{"name":"greeting","definition":"A word used to greet someone."}]}}
{"ok":false,"error":{"code":"OPERATION_FAILED","message":"Operation failed"}}
```

These are two separate example responses. Send one serialized object followed by a literal newline, not pretty-printed JSON or a stream of requests. Encode newlines inside text as JSON `\n`; the request limit is 1 MiB before the delimiter. An EOF without the newline is invalid. This keeps multiline text out of CLI process arguments. JSON stdout contains no progress messages, ANSI codes, logs, credentials, or raw Provider responses; stderr is separate and is not the response channel.

From the repository root, examples using shell `printf` to add the delimiter:

```bash
printf '%s\n' '{"entryText":"cześć","descriptionText":"Cześć!\nJak się masz?","instructionText":""}' |
  bun run dev:cli overlay suggest --json

printf '%s\n' '{"entryText":"cześć","descriptionText":null,"instructionText":"","senseName":null,"descriptions":[],"targetTypes":["definition","translation"]}' |
  bun run dev:cli overlay generate --json
```

Suggestions return `{senses:[{name,definition}]}`, with at most 20 distinct candidates. Generation returns `{senseName,descriptions:[{type,text}]}`. It uses nonempty supplied Descriptions as context and requests every selected Type, even when supplied drafts of that Type have text. Types are `definition`, `translation`, `example`, and `misc`. A supplied nonblank Sense is preserved; when it is blank or null, generation proposes a Sense name. Both operations use Provider-only dependencies and return unsaved text without opening or writing the Dictionary. Existing `description generate <description-id>` keeps its saved-Description workflow.

The CLI returns drafts without applying them to an editor. In the overlay, explicit Generate replaces all checked-Type drafts as one undoable action. Choosing a suggested Sense retains manual or edited text and clears only unedited generated text. New output fills empty slots before adding cards; completed results remain available for redo.

### Reviewed saves

The following examples write to the Dictionary. The CLI supplies the root Folder; there is no Folder picker in this flow.

```bash
printf '%s\n' '{"kind":"entry","entryText":"cześć","descriptionText":"Captured context"}' |
  bun run dev:cli overlay save --json

printf '%s\n' '{"kind":"sense","entryText":"cześć","descriptionText":"Captured context","includeDescription":false,"senseName":"greeting","descriptions":[{"type":"definition","text":"An informal greeting."}]}' |
  bun run dev:cli overlay save --json

printf '%s\n' '{"kind":"sense","entryText":"cześć","descriptionText":"Captured context","includeDescription":true,"senseName":"greeting","descriptions":[{"type":"definition","text":"An informal greeting."}]}' |
  bun run dev:cli overlay save --json
```

- `kind: "entry"` is center Save Entry: save the Entry and optional nonempty captured Description as unassigned `misc`. Ignore the Sense and right-column drafts.
- `kind: "sense", includeDescription: false` is Save Sense: save the Entry, a new Sense, and every nonempty typed Description; exclude captured text.
- `kind: "sense", includeDescription: true` is Save All: also save nonempty captured text as `misc` under that Sense.

Sense saves require a nonblank Sense and at least one nonempty typed Description. Empty editors are omitted, and nonempty reviewed text is preserved exactly. Save reuses an Entry with the same exact text in the root Folder and creates a new Sense even if one already has that name. It commits the chosen records and one Activity increment atomically. An Entry renamed under its old deterministic identity produces a conflict without new records. Success `data` is `{entryId,senseId,capturedDescriptionId,descriptionIds}`; optional IDs are null.

In the overlay, failed saves stay open with drafts intact and duplicate submissions are blocked while saving. A success receipt must match the Save mode, captured-record presence, and typed Description count, with nonblank and distinct typed IDs. Missing, malformed, or contradictory child output leaves an unknown outcome. Do not automatically repeat a Save; inspect the Dictionary first. After confirmed success, the overlay flushes pending local preferences before closing. Notifications and Copy drafts are available with provisional sizing. There is no dedicated Retry button.

### Overlay-local state

These helpers do not open the Dictionary:

```bash
bun run dev:cli overlay state read --json
printf '%s\n' '{"version":1,"instructionText":"","selectedTypes":["definition"]}' |
  bun run dev:cli overlay state write --json
```

Both return the state object in `data`. The example write clears the remembered Instruction and selects `definition`. State lives in owner-only `<dataDir>/overlay-capture/state.json` with schema `{version:1,instructionText:string,selectedTypes:DescriptionType[]}`; `version` identifies the file format. Missing state defaults to empty Instruction text and `["definition"]`; corrupt state returns a failure without replacing the file. Each write replaces the complete snapshot using instance-local queuing and atomic rename. Across processes, the last completed replacement wins; there are no persistent lock directories.

The overlay debounces Instruction/Type changes and flushes on normal exit, including Cancel. Choosing a saved Instruction copies its text; editing it never writes a database Instruction. This file stores no screenshot, other draft text, or undo history. Selected Model stays separately in `local-state.json`.

### Handled failures

Read both the envelope and exit status. Overlay request failures use `INVALID_REQUEST`, `REQUEST_TOO_LARGE`, or `REQUEST_READ_FAILED`. Other handled failures use `OPERATION_FAILED`, or `DATABASE_IN_USE` when the Dictionary is locked. Missing/stale Model and Provider failures in suggest/generate currently use the generic `OPERATION_FAILED` envelope.

| Exit | Meaning                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------- |
| 0    | Success                                                                                         |
| 1    | Unexpected failure; a usable envelope is not guaranteed                                         |
| 2    | Usage or invalid request for suggest/generate/save                                              |
| 3    | Expected operation failure; also all handled state read/write failures, including invalid input |
| 4    | Dictionary already open by another process                                                      |

Picker dependency failures can use exit 1 with a safe envelope. An empty or unusable response is not confirmation of success, especially after Save.

## Retained quick-entry shortcut (Linux)

With [`quick-entry.sh`](./quick-entry.sh), you can use a hotkey to select a screen region on a wlroots Wayland compositor, recognize the text locally, and save it as one Entry. The graphical session's `PATH` must include `bash`, `bun`, `slurp`, `grim`, `tesseract`, `tr`, and `sed`. Install Tesseract language data for the languages you need; check what's available with `tesseract --list-langs`. Run `bun install` in this checkout first. The CLI does not yet have an installed executable.

Try the script in a Wayland session before binding a hotkey:

```bash
devenv --profile cli shell -- apps/cli/quick-entry.sh --verbose
```

The `cli` profile supplies the screenshot, OCR, and notification tools for this trial. If you installed them in your graphical session already, you can also run `/absolute/path/to/dictos/apps/cli/quick-entry.sh --verbose` directly.

Select text with the pointer. Press Escape to cancel without saving. The screenshot goes straight to Tesseract; the script does not write an image file or touch the clipboard. It collapses whitespace and saves the text as one Entry in the root Folder by default, without a review step or Description Generation.

Options:

- `--folder <folder-id>`: Save to a specific Folder ID instead of the root Folder. Find IDs with the CLI's `folder list` command.
- `--lang <language>`: Tesseract language, such as `deu` or `eng+deu`. Defaults to `DICTOS_OCR_LANG` if set, otherwise `eng`.
- `--verbose`: Print the recognized Entry text and its ID on success. Otherwise, success is silent.
- `--notify-success`: Send a success notification with the **full Entry text**, which may appear in your notification history.

On failure, the script writes to stderr, returns a nonzero status (including the CLI's exit status), and tries to notify you through `notify-send` if installed. `notify-send` uses the standard desktop notification service; your configured server, including Quickshell if it hosts notifications, controls how it appears. Notifications are best-effort: if the client or server is unavailable, stderr and the exit status still report the failure. Empty OCR is a failure. Escape cancels silently with a successful status.

### NixOS / Hyprland Example

Keep this checkout in a stable location. With Home Manager, add the tools to the graphical session and bind the repo-local script. Replace the example path:

```nix
{ pkgs, ... }:
{
  home.packages = with pkgs; [ bun grim slurp tesseract libnotify ];

  wayland.windowManager.hyprland.settings.bind = [
    "SUPER SHIFT, E, exec, /home/you/code/dictos/apps/cli/quick-entry.sh"
  ];
}
```

Without Home Manager, add the same packages to NixOS `environment.systemPackages` and add this line to `hyprland.conf`:

```ini
bind = SUPER SHIFT, E, exec, /home/you/code/dictos/apps/cli/quick-entry.sh
```

Hotkeys do not inherit a terminal's `devenv shell`. The compositor's environment must have the dependencies, and a desktop notification server must be running if you want popups.

The helper passes the recognized text to `entry create --text`, briefly exposing it in the CLI process arguments. It uses the same local database as the TUI. If another client holds the database lock, creation fails without queuing or retrying. Saving identical text in the same Folder returns the existing Entry ID.
