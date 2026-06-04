---
name: pi-project-tools
description: Use only when the user explicitly mentions Pi project tools, .pi/settings.user.json tools, or asks to add/change/remove/review a Pi tool definition.
---

# Project Tools

Pi is the coding agent. A Pi project tool is a tool definition written by a repository in `.pi/settings.user.json` under `tools`.

Use this skill only when the user explicitly asks about one of these things:

- Pi project tools
- `.pi/settings.user.json` `tools`
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
- Use `executionMode: "parallel"` only when the project tool is safe to run concurrently with other tool calls.
- Prefer structured `command` + `arguments` over free-form shell strings.
- Put fixed subcommands in `arguments`, not in `command`.
- Use parameter placeholders only as whole arguments, e.g. `"{{path}}"`; do not embed them inside larger strings.
- Parameter values are shell-quoted by the extension and are passed as single arguments. Do not add extra quoting around `"{{param}}"`.

## Settings shape

Add or update `.pi/settings.user.json`:

```json
{
  "tools": {
    "lint": {
      "description": "Run project lint and type checks.",
      "allowedModes": ["read", "write"],
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
  }
}
```

Tool config fields:

- `description` required; explain what the tool does.
- `allowedModes` required; non-empty array. Use `read` and/or `write` for normal project tools.
- `commands` required; non-empty array. Commands run in parallel within one project tool call.
- `parameters` optional; object of LLM-provided parameters for this tool.
- `executionMode` optional; `sequential` or `parallel`. Defaults to `sequential`. Use `parallel` only when this project tool is safe to run concurrently with other tool calls.
- `cwd` optional; relative path inside the project root. Omit `cwd` when running from the project root.
- `timeoutSeconds` optional; default timeout for commands.
- `promptSnippet` optional; one-line LLM-facing tool summary.
- `promptGuidelines` optional; bullets that must name the tool explicitly.

Parameter fields (`tools.<name>.parameters.<paramName>`):

- `type` required; one of `string`, `number`, or `boolean`.
- `description` optional but recommended; explain what value the LLM should provide.
- `required` optional; defaults to `false`. Set `true` for required parameters.

Command fields:

- `command` required; executable/program name as a single command token, e.g. `"brain"`, `"pnpm"`, or `"nix"`.
- `arguments` optional; ordered array of fixed arguments, parameter placeholders, flags, and options.
- `label` optional; display label in tool output.
- `cwd` optional; relative path inside the project root. Omit `cwd` when running from the project root.
- `timeoutSeconds` optional; overrides the tool default.

Argument entries:

- Fixed argument: `"rule"`
- Parameter argument: `"{{path}}"`
  - References a `string`, `number`, or `boolean` parameter.
  - If the parameter is optional and omitted, this argument is omitted.
  - Empty string `""` is treated as provided and passed as an empty argument.
- Boolean flag: `{ "flag": "--detail", "when": "detail" }`
  - `when` must reference a `boolean` parameter.
  - The flag is included only when the parameter is `true`.
- Value option: `{ "option": "--top", "value": "{{top}}" }`
  - `value` must reference a `string` or `number` parameter.
  - If the parameter is optional and omitted, both option name and value are omitted.

## Naming

- Tool names must match `^[a-z][a-z0-9_-]*$`.
- Parameter names must start with a letter or `_` and then use letters, numbers, `_`, or `-`.
- Use concise names like `lint`, `test`, `format`, `check_types`, `homemanager_switch`, `brain_rule_match`.
- Do not conflict with built-in or extension tools.

## Examples

Read-only check:

```json
{
  "tools": {
    "lint": {
      "description": "Run lint and type checks.",
      "allowedModes": ["read", "write"],
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
      "executionMode": "parallel",
      "commands": [
        { "label": "types", "command": "pnpm", "arguments": ["lint"], "timeoutSeconds": 120 },
        { "label": "nix", "command": "nix", "arguments": ["flake", "check"], "timeoutSeconds": 600 }
      ]
    }
  }
}
```

Parameterized path command:

```json
{
  "tools": {
    "brain_rule_match": {
      "description": "Show brain rules that apply to a path.",
      "allowedModes": ["read"],
      "parameters": {
        "path": {
          "type": "string",
          "description": "Path to check.",
          "required": true
        }
      },
      "commands": [
        {
          "label": "brain rule match",
          "command": "brain",
          "arguments": ["rule", "match", "{{path}}"]
        }
      ]
    }
  }
}
```

Flags and value options in a specific order:

```json
{
  "tools": {
    "brain_token_stats_count": {
      "description": "Count approximate brain tokens.",
      "allowedModes": ["read"],
      "parameters": {
        "detail": {
          "type": "boolean",
          "description": "Show detailed output."
        },
        "top": {
          "type": "number",
          "description": "Number of top entries to show."
        }
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
  }
}
```

## Workflow

1. Inspect existing `.pi/settings.user.json` before editing.
2. Preserve unrelated settings and unrelated `tools` entries.
3. Add, rename, remove, or modify only the requested `tools` entries.
4. Keep each tool's `description`, `allowedModes`, `executionMode`, `parameters`, and `commands` consistent with the command behavior.
5. Validate that `.pi/settings.user.json` remains valid JSON.
6. Summarize the changed tool names, commands, parameters, execution mode, and allowed modes.
