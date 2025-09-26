#!/bin/bash

# AGENTS.md Files Auto-Context Addition Script for Claude Code
# This script finds AGENTS.md files in the current project and provides pre-work context
# This is a workaround solution until Claude Code officially supports AGENTS.md

# Find all AGENTS.md files in current directory and subdirectories
# Excluding common directories that shouldn't contain project-level AGENTS.md
agents_files=$(find "$CLAUDE_PROJECT_DIR" -name "AGENTS.md" -type f \
    -not -path "*/.git/*" \
    -not -path "*/node_modules/*" \
    -not -path "*/target/*" \
    -not -path "*/build/*" \
    -not -path "*/dist/*" \
    -not -path "*/.next/*" \
    -not -path "*/.nuxt/*" \
    -not -path "*/vendor/*" \
    -not -path "*/__pycache__/*" \
    -not -path "*/.venv/*" \
    -not -path "*/venv/*" 2>/dev/null)

if [[ -n "$agents_files" ]]; then
    file_count=$(echo "$agents_files" | wc -l)
    echo "📋 Found $file_count AGENTS.md file(s) in project:"
    echo "$agents_files" | while read -r file; do
        echo "  • @$file"
    done
    echo ""
    echo "💡 These files contain project-specific instructions for AI coding agents."
    echo "   Consider reviewing them before starting work on this project."
    echo ""
fi