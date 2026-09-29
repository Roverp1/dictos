# Dictos Command Client

Run `bun install` from the repo root, then use the CLI directly:

```bash
bun run dev:cli entry create --text "hello"
```

## Screen Region to Entry (Linux)

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
