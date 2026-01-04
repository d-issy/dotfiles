# Skill File Format

## Frontmatter

| Field           | Required | Description                                          |
| --------------- | -------- | ---------------------------------------------------- |
| `name`          | Yes      | Skill name (lowercase, hyphens)                      |
| `description`   | Yes      | Description + "Use this when ..." trigger conditions |
| `allowed-tools` | No       | Restrict tools (e.g., `Read, Write, Bash(mkdir:*)`)  |
| `argument-hint` | No       | Hint for arguments, accessible as `$1`, `$2`, etc.   |

## Sections

| Section      | Level | Required | Description                      |
| ------------ | ----- | -------- | -------------------------------- |
| Heading      | `#`   | Yes      | Skill name                       |
| Purpose      | `##`  | Yes      | Execution instruction            |
| Variables    | `##`  | No       | Variables used in the skill      |
| Instructions | `##`  | No       | Additional details for execution |
| Workflow     | `##`  | Yes      | Steps to execute                 |
| Report       | `##`  | Yes      | Output after execution           |

### Heading

`# [Skill Name]`

### Purpose

Execution instruction:

```markdown
## Purpose

Execute the `Workflow` and `Report` sections to [action].
```

### Variables

Define variables using `key: value` format. Indent conditional values:

```markdown
## Variables

- KEY: `value`
- KEY: $1 (when using argument-hint)
- KEY:
  - if condition-a then `value-a`
  - if condition-b then `value-b`
```

### Instructions

Additional details, focus areas, or context for execution:

```markdown
## Instructions

- Focus on [specific area]
- Consider [important points]
```

### Workflow

Numbered list of steps. Be specific and actionable. Use if-then for branching:

```markdown
1. First step
2. Execute based on condition:
   - If **condition**, then:
     - Do something
```

### Report

What to output after execution. Describe format and content.

## File Organization

For complex skills, split content into multiple files.

- Claude loads linked files on-demand via Markdown links: `[file.md](file.md)`
- Keep SKILL.md under 500 lines
- Split when: detailed reference, templates, examples

## Template

See [basic-structure.md](basic-structure.md) for skill template and directory structure.
