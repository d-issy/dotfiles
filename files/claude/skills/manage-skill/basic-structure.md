# Basic Structure

## Skill Template

```markdown
---
name: skill-name
description: What this skill does. Use this when [trigger conditions].
allowed-tools: Read, Write, Glob
---

# Skill Name

## Purpose

Execute the `Workflow` and `Report` sections to [action].

## Workflow

1. First step
2. Second step

## Report

What to output after execution.
```

## Directory Structure (Multi-file)

```
skill-name/
├── SKILL.md           # Main workflow (under 500 lines)
├── format.md          # Specifications
└── reference.md       # Additional references
```

## Linking Files

Reference supporting files from SKILL.md using Markdown links:

```markdown
## Workflow

1. Follow the format in [format.md](format.md)
2. See [reference.md](reference.md) for details
```

Claude loads linked files on-demand when following the link.
