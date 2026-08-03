---
name: pi-agent-user-settings
description: Use only when the user explicitly mentions Pi project user settings, .pi/settings.user.json, or asks to change project tools, tool sets, or project-local focuses.
---

# Pi Agent User Settings

Treat `.pi/settings.user.json` as project-controlled configuration consumed by the Pi user extension, not as Pi's native settings.

- Preserve unrelated entries.
- Read [Settings Schema](references/settings-schema.md) before changing `tools`, `toolSets`, or `focuses`.
- Keep commands deterministic and scoped to the repository; never read secrets or modify external paths.
