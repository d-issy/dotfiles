---
name: pi-project-tools
description: Use only when the user explicitly mentions Pi project tools, .pi/settings.json tools, or asks to add/change/remove/review a Pi tool definition.
---

# Project Tools

Pi is the coding agent. A Pi project tool is a tool definition written by a repository in `.pi/settings.json` under `tools`.

Use this skill only when the user explicitly asks about one of these things:

- Pi project tools
- `.pi/settings.json` `tools`
- adding, editing, renaming, removing, reviewing, or explaining a Pi tool definition

Do not use this skill for general shell commands, ordinary lint/test/format requests, or non-Pi tool configuration.

Project tools become callable Pi tools for that project only.

## Safety

- Treat project tools as project-controlled command execution.
- Prefer `allowedModes: ["read"]` for non-mutating checks.
- Use `allowedModes: ["write"]` only for commands that modify the working tree, such as formatters.
- Keep `allowedModes` to `read` and/or `write` unless the user explicitly requests otherwise.
- Keep commands deterministic and scoped to the repository.
- Avoid commands that read secrets, access credentials, or modify paths outside the project.
- Set `timeoutSeconds` for commands that might hang.

## Settings shape

Add or update `.pi/settings.json`:

```json
{
  "tools": {
    "lint": {
      "description": "Run project lint and type checks.",
      "allowedModes": ["read", "write"],
      "commands": [
        { "label": "lint", "command": "pnpm lint", "timeoutSeconds": 120 }
      ]
    }
  }
}
```

Tool config fields:

- `description` required; explain what the tool does.
- `allowedModes` required; non-empty array. Use `read` and/or `write` for normal project tools.
- `commands` required; non-empty array. Commands run in parallel.
- `cwd` optional; relative path inside the project root. Omit `cwd` when running from the project root.
- `timeoutSeconds` optional; default timeout for commands.
- `promptSnippet` optional; one-line LLM-facing tool summary.
- `promptGuidelines` optional; bullets that must name the tool explicitly.

Command fields:

- `command` required; shell command to run.
- `label` optional; display label in tool output.
- `cwd` optional; relative path inside the project root. Omit `cwd` when running from the project root.
- `timeoutSeconds` optional; overrides the tool default.

## Naming

- Tool names must match `^[a-z][a-z0-9_.-]*$`.
- Use concise names like `lint`, `test`, `format`, `check.types`, `homemanager.switch`.
- Do not conflict with built-in or extension tools.

## Examples

Read-only check:

```json
{
  "tools": {
    "lint": {
      "description": "Run lint and type checks.",
      "allowedModes": ["read", "write"],
      "commands": [
        { "label": "lint", "command": "pnpm lint", "timeoutSeconds": 120 }
      ]
    }
  }
}
```

Formatter:

```json
{
  "tools": {
    "format": {
      "description": "Format the project in place.",
      "allowedModes": ["write"],
      "commands": [
        { "label": "treefmt", "command": "treefmt", "timeoutSeconds": 120 }
      ]
    }
  }
}
```

Multiple parallel checks:

```json
{
  "tools": {
    "check": {
      "description": "Run project checks in parallel.",
      "allowedModes": ["read", "write"],
      "commands": [
        { "label": "types", "command": "pnpm lint", "timeoutSeconds": 120 },
        { "label": "nix", "command": "nix flake check", "timeoutSeconds": 600 }
      ]
    }
  }
}
```

## Workflow

1. Inspect existing `.pi/settings.json` before editing.
2. Preserve unrelated settings and unrelated `tools` entries.
3. Add, rename, remove, or modify only the requested `tools` entries.
4. Keep each tool's `description`, `allowedModes`, and `commands` consistent with the command behavior.
5. Validate that `.pi/settings.json` remains valid JSON.
6. Summarize the changed tool names, commands, and allowed modes.
