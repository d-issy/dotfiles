---
name: pi-agent-user-settings
description: Use only when the user explicitly mentions Pi agent user settings, .pi/settings.user.json, project user settings, or asks to add/change/remove/review Pi project tools or project-local focus settings.
---

# Pi Agent User Settings

Pi agent user settings are project-local settings in `.pi/settings.user.json` consumed by the user extension. They are separate from Pi's native `.pi/settings.json` and `~/.pi/agent/settings.json`.

Use this skill only for:

- Pi agent user settings
- `.pi/settings.user.json`
- project user settings for Pi
- adding, editing, renaming, removing, reviewing, or explaining `tools` or `focuses` in `.pi/settings.user.json`

Do not use this skill for ordinary shell commands, lint/test/format requests, Pi's native settings files, or non-Pi configuration.

## Workflow

1. Inspect existing `.pi/settings.user.json` before editing.
2. Preserve unrelated settings and unrelated `tools` / `focuses` entries.
3. Change only the requested settings.
4. If adding a tool that should be available to AI, add it to an appropriate `.pi/settings.user.json` `focuses` entry.
5. Validate JSON after editing.
6. Summarize changed setting keys, tool names, commands, parameters, execution mode, and focus availability.

## Safety and style

- Treat `.pi/settings.user.json` as project-controlled configuration.
- Treat project tools as project-controlled command execution.
- Project tools do not declare focus access themselves.
- Focus access is controlled by `.pi/settings.user.json` `focuses.<name>.tools`.
- Keep tools deterministic and scoped to the repository.
- Avoid commands that read secrets, access credentials, or modify paths outside the project.
- Set `timeoutSeconds` for commands that might hang.
- Use `executionMode: "parallel"` only when safe to run concurrently with other tool calls.
- Prefer structured `command` + `arguments` over free-form shell strings.
- Put fixed subcommands in `arguments`, not in `command`.
- Use parameter placeholders only as whole arguments, e.g. `"{{path}}"`.
- Parameter values are shell-quoted and passed as single arguments; do not add extra quotes.
- For variable-length inputs, use an `array` parameter with a `values` entry; do not invent fixed `path1`, `path2`, `path3` parameters.
- Do not define a project tool with the same name as a built-in or extension tool.

## Settings shape

```json
{
  "tools": {
    "lint": {
      "description": "Run project lint and type checks.",
      "executionMode": "parallel",
      "commands": [
        {
          "label": "lint",
          "command": "pnpm",
          "arguments": ["lint"],
          "timeoutSeconds": 120
        }
      ]
    }
  },
  "focuses": {
    "verify": {
      "tools": ["lint"],
      "prompt": "For this project, use lint to verify changes."
    }
  }
}
```

## Top-level fields

Currently supported project user settings include:

- `tools`: repository-defined tool definitions callable only for that project.
- `focuses`: project-local focus additions or overrides for user-extension focuses.

## Tool fields

`tools.<name>`:

- `description` required; explain what the tool does.
- `commands` required; non-empty array.
- `parameters` optional; object of LLM-provided parameters.
- `executionMode` optional; `sequential` or `parallel`. Defaults to `sequential`.
- `cwd` optional; relative path inside the project root.
- `timeoutSeconds` optional; default timeout for commands.
- `promptSnippet` optional; one-line LLM-facing tool summary.
- `promptGuidelines` optional; bullets that must name the tool explicitly.

## Focus fields

`focuses.<name>`:

- Existing focus names merge into user-extension focuses.
- New focus names create project-local focuses.
- `tools` are additive only.
- Existing focus `transition` cannot be changed by project settings.
- New focus `transition` defaults to `confirm` when omitted.

Common focus fields:

- `description` required for new focuses.
- `prompt` required for new focuses; appended when merging an existing focus.
- `tools` required for new focuses; additive when merging.
- `transition` optional for new focuses: `auto`, `confirm`, or `manual`.
- `color` optional: `accent`, `positive`, `caution`, `alert`, or `muted`.

## Parameter fields

`tools.<name>.parameters.<paramName>`:

- `type` required; `string`, `number`, `boolean`, `array`, or shorthand `string[]`, `number[]`, `boolean[]`.
- `items` required only for `array`; object with `type` of `string`, `number`, or `boolean`.
- `description` optional but recommended.
- `required` optional; defaults to `false`.

Example:

```json
"parameters": {
  "path": { "type": "string", "description": "Path to check.", "required": true },
  "paths": { "type": "string[]", "description": "Paths to check." },
  "detail": { "type": "boolean", "description": "Show detailed output." },
  "top": { "type": "number", "description": "Number of entries." }
}
```

## Command fields

- `command` required; executable as a single token, e.g. `"brain"`, `"pnpm"`, `"nix"`.
- `arguments` optional; ordered fixed args, placeholders, flags, options, and array expansions.
- `label` optional; display label in output.
- `cwd` optional; relative path inside the project root.
- `timeoutSeconds` optional; overrides the tool default.

## Argument entries

- Fixed argument: `"rule"`
- Scalar parameter: `"{{path}}"`
  - References a `string`, `number`, or `boolean` parameter.
  - Optional omitted values are omitted.
  - Empty string `""` is passed as an empty argument.
  - Array parameters cannot use this form; use `values` with `style`.
- Boolean flag: `{ "flag": "--detail", "when": "detail" }`
  - `when` must reference a `boolean` parameter.
  - Included only when the parameter is `true`.
- Value option: `{ "option": "--top", "value": "{{top}}" }`
  - `value` must reference a `string` or `number` parameter.
  - Optional omitted values omit both option and value.
- Array repeat option: `{ "option": "--path", "values": "{{paths}}", "style": "repeat" }`
  - Expands to `--path a --path b --path c`.
- Array positional spread: `{ "values": "{{paths}}", "style": "spread" }`
  - Expands to `a b c`.
- Array join: `{ "option": "--paths", "values": "{{paths}}", "style": "join", "separator": "," }`
  - Expands to `--paths a,b,c`; without `option`, expands to `a,b,c`.
  - `separator` is required for `join`.
- For every `values` entry, `style` is required and `values` must reference an `array` parameter.
- Optional omitted arrays and empty arrays expand to no arguments.

## Naming

- Tool names must match `^[a-z][a-z0-9_-]*$`.
- Focus names must match `^[a-z][a-z0-9_-]*$`.
- Parameter names must start with a letter or `_`, then use letters, numbers, `_`, or `-`.
- Do not conflict with built-in tools (`read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`, `mv`, `rm`) or extension tools (`search_focus`, `enter_focus`, `leave_focus`).

## Examples

Project lint tool exposed through verify focus:

```json
{
  "tools": {
    "lint": {
      "description": "Run lint and type checks.",
      "executionMode": "parallel",
      "commands": [
        { "label": "lint", "command": "pnpm", "arguments": ["lint"], "timeoutSeconds": 120 }
      ]
    }
  },
  "focuses": {
    "verify": { "tools": ["lint"] }
  }
}
```

Parameterized command with flag and option:

```json
{
  "tools": {
    "brain_token_stats_count": {
      "description": "Count approximate brain tokens.",
      "parameters": {
        "detail": { "type": "boolean", "description": "Show detailed output." },
        "top": { "type": "number", "description": "Number of top entries." }
      },
      "commands": [
        {
          "label": "brain token-stats count",
          "command": "brain",
          "arguments": [
            "token-stats",
            "count",
            { "flag": "--detail", "when": "detail" },
            { "option": "--top", "value": "{{top}}" }
          ]
        }
      ]
    }
  },
  "focuses": {
    "inspect": { "tools": ["brain_token_stats_count"] }
  }
}
```
