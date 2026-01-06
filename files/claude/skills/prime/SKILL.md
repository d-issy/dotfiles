---
name: prime
description: Prime the conversation by understanding the project context. Use this when user says "prime" or starting work on an unfamiliar project or codebase.
model: claude-haiku-4-5
allowed-tools: Read, Glob, Grep, Bash(git ls-files:*)
---

# Prime

## Purpose

Execute the `Workflow` and `Report` sections to prime your understanding of the project.

## Workflow

1. Run `git ls-files` to get the project file list and understand the structure
2. Read `AGENTS.md` and `README.md` in parallel if they exist

## Report

Summarize your understanding of the codebase.
