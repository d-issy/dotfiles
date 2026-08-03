# Pi Agent User Settings Schema

## Contents

- [Settings shape](#settings-shape)
- [Top-level fields](#top-level-fields)
- [Tools](#tools)
- [Tool sets](#tool-sets)
- [Focuses](#focuses)
- [Parameters and arguments](#parameters-and-arguments)
- [Naming](#naming)
- [Example](#example)

## Settings shape

```json
{
  "enabled": true,
  "tools": {
    "lint": {
      "description": "Run project checks.",
      "executionMode": "parallel",
      "commands": [
        {
          "command": "pnpm",
          "arguments": ["lint"],
          "timeoutSeconds": 120
        }
      ]
    }
  },
  "toolSets": {
    "verify": ["lint"]
  },
  "focuses": {
    "edit": {
      "toolSets": ["verify"],
      "prompt": "Use lint to verify edits when appropriate."
    }
  }
}
```
## Top-level fields

- `enabled`: set to `false` to disable the user extension for this project; omission keeps it enabled.
- `tools`: project-defined tool definitions.
- `toolSets`: reusable groups of tool or tool-set names.
- `focuses`: project-local focus additions or overrides.

## Tools

Each `tools.<name>` requires:

- `description`: explain the tool's effect.
- `commands`: a non-empty array.

Optional fields:

- `parameters`: LLM-provided parameter definitions.
- `executionMode`: `sequential` or `parallel`; it controls both tool-call execution and command scheduling. Omission behaves as parallel.
- `cwd`: relative path inside the project.
- `timeoutSeconds`: default command timeout.
- `promptSnippet`: one-line model-facing summary.
- `promptGuidelines`: model-facing bullets that name the tool explicitly.

Command fields:

- `command`: required executable as one token, such as `pnpm` or `nix`.
- `arguments`: ordered fixed arguments and parameter expansions.
- `label`, `cwd`, and `timeoutSeconds`: optional; command values override tool defaults.

Prefer structured `command` and `arguments`. Put fixed subcommands in `arguments`, set timeouts for commands that may hang, and use parallel execution only when concurrent runs are safe.

## Tool sets

- Values are arrays of tool or tool-set names and expand recursively.
- Built-ins are `file_read` (`read`, `grep`, `find`, `ls`) and `file_write` (`write`, `edit`, `mv`, `rm`).
- A project tool set with a built-in name overrides that built-in.
- Avoid giving a tool set the same name as a tool.
- Unknown or circular tool-set references cause the consuming focus to be ignored with a warning.

## Focuses

- Existing focus definitions merge; new names create project-local focuses.
- For an existing focus, `prompt` is appended to the built-in prompt. Write it as a project-specific supplement.
- `tools` and `toolSets` are additive.
- Existing `transition` and `exitMode` values cannot be changed.
- New focuses require `description`, `prompt`, and either `tools` or `toolSets`.
- New `transition` defaults to `confirm`; valid values are `auto`, `confirm`, and `manual`.
- New `exitMode` defaults to `single-turn`; valid values are `single-turn` and `explicit`.
- `color` may be `accent`, `positive`, `caution`, `alert`, or `muted`.

Project tools do not grant their own focus access. Add them under `focuses.<name>.tools` or through a referenced tool set. The same rule applies to built-in and extension tools.

## Parameters and arguments

Parameter fields:

- `type`: required; `string`, `number`, `boolean`, `array`, or shorthand `string[]`, `number[]`, `boolean[]`.
- `items`: required for `array`, with item type `string`, `number`, or `boolean`.
- `description`: optional but recommended.
- `required`: optional, default `false`.

Argument entries:

- Fixed: `"rule"`
- Scalar: `"{{path}}"`; it must occupy the whole argument.
- Boolean flag: `{ "flag": "--detail", "when": "detail" }`
- Scalar option: `{ "option": "--top", "value": "{{top}}" }`
- Repeated array option: `{ "option": "--path", "values": "{{paths}}", "style": "repeat" }`
- Positional array: `{ "values": "{{paths}}", "style": "spread" }`
- Joined array: `{ "option": "--paths", "values": "{{paths}}", "style": "join", "separator": "," }`

Parameter values are shell-quoted and passed as single arguments; do not add quotes. Optional omitted scalars omit their argument or option pair. Optional omitted or empty arrays expand to nothing. Every `values` entry requires an array parameter and a `style`.

## Naming

- Tool, tool-set, and focus names: `^[a-z][a-z0-9_-]*$`
- Parameter names: start with a letter or `_`, then use letters, numbers, `_`, or `-`.
- Do not conflict with built-in tools (`read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`, `mv`, `rm`) or the `enter_focus` extension tool.

## Example

```json
{
  "tools": {
    "brain_token_stats_count": {
      "description": "Count approximate brain tokens.",
      "parameters": {
        "detail": { "type": "boolean", "description": "Show details." },
        "top": { "type": "number", "description": "Number of entries." }
      },
      "commands": [
        {
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
