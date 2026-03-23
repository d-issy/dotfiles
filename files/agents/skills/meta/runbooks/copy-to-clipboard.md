# Copy to Clipboard

Guide for copying content to the clipboard across platforms.

## When to Use

- User asks to copy something to the clipboard

## When NOT to Use

- User just wants text output displayed, not copied to the clipboard

## Tips

- **WSL is not Linux.** The clipboard is owned by the Windows host. Do not use `xclip`, `clip.exe`, or `printf | powershell.exe` — all corrupt non-ASCII text. Always use the heredoc pattern.
- **SSH sessions have no clipboard access** unless the terminal supports OSC 52. Do not attempt clipboard commands over plain SSH.
- When unsure of the display server on Linux, check `$XDG_SESSION_TYPE` (`x11` or `wayland`).

## Workflow

### 1. Identify the Target Platform

Do NOT assume the execution environment is the user's host platform. Ask the user or check context (e.g., SSH session vs local terminal, WSL vs native Linux).

### 2. Execute

Do not use `echo`, temporary files, or redirects.

macOS / Linux:

```sh
printf '%b' "line1\nline2" | pbcopy                      # macOS
printf '%b' "line1\nline2" | xclip -selection clipboard  # Linux X11
printf '%b' "line1\nline2" | wl-copy                     # Linux Wayland
```

Windows / WSL — use heredoc to pass content as-is:

```sh
powershell.exe -NoProfile -Command "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; Set-Clipboard -Value ([Console]::In.ReadToEnd().TrimEnd())" <<'CLIPBOARD_END'
line1
line2
CLIPBOARD_END
```
