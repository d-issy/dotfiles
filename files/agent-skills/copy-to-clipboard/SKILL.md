---
name: copy-to-clipboard
description: Use when the user explicitly asks to copy text to the system clipboard on macOS, Linux, Windows, or WSL.
---

# Copy to Clipboard

Copy the requested content without rewording it. Choose the clipboard command for the user's host platform rather than assuming it matches the execution environment. Do not attempt clipboard access over plain SSH unless the terminal supports OSC 52.

Pass multiline content through a quoted heredoc:

| Platform | Command |
| --- | --- |
| macOS | `pbcopy` |
| Linux X11 | `xclip -selection clipboard` |
| Linux Wayland | `wl-copy` |
| Windows / WSL | `powershell.exe -NoProfile -Command "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; Set-Clipboard -Value ([Console]::In.ReadToEnd().TrimEnd())"` |

```sh
<command> <<'CLIPBOARD_END'
<content>
CLIPBOARD_END
```

On WSL, use the PowerShell command. Do not use `clip.exe` or pipe through `printf`, which can corrupt non-ASCII text.
