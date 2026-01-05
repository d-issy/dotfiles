#!/bin/bash
input=$(cat)

# Colors
DIM='\033[2m'
FAINT='\033[2;90m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
CYAN='\033[36m'
RESET='\033[0m'

format_k() {
  awk -v n="$1" 'BEGIN { printf "%.1fK", n/1000 }'
}

MODEL=$(echo "$input" | jq -r '.model.display_name // "Unknown"')
CWD=$(echo "$input" | jq -r '.workspace.current_dir // "."')
CWD_SHORT="${CWD##*/}"

INPUT_TOKENS=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0')
OUTPUT_TOKENS=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0')
CACHE_CREATE=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0')
CACHE_READ=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0')
CONTEXT_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')

TOTAL_USED=$((INPUT_TOKENS + CACHE_CREATE + CACHE_READ))
REMAINING=$(awk -v used="$TOTAL_USED" -v size="$CONTEXT_SIZE" 'BEGIN { printf "%.1f", 100 - (used * 100 / size) }')

INPUT_K=$(format_k "$INPUT_TOKENS")
OUTPUT_K=$(format_k "$OUTPUT_TOKENS")

LINES_ADDED=$(echo "$input" | jq -r '.cost.total_lines_added // 0')
LINES_REMOVED=$(echo "$input" | jq -r '.cost.total_lines_removed // 0')

# Build output
OUTPUT="${DIM}[${RESET}${MODEL}${DIM}]${RESET} $CWD_SHORT"

if [[ "$INPUT_TOKENS" != "0" || "$OUTPUT_TOKENS" != "0" ]]; then
  OUTPUT+=" ${DIM}|${RESET} ${DIM}↑${RESET}${GREEN}${INPUT_K}${RESET} ${DIM}↓${RESET}${YELLOW}${OUTPUT_K}${RESET}"
fi

if [[ "$REMAINING" != "0.0" && "$REMAINING" != "100.0" ]]; then
  OUTPUT+=" ${CYAN}${REMAINING}%${RESET}"
fi

if [[ "$LINES_ADDED" != "0" || "$LINES_REMOVED" != "0" ]]; then
  OUTPUT+=" ${DIM}|${RESET} ${GREEN}+${LINES_ADDED}${RESET} ${RED}-${LINES_REMOVED}${RESET}"
fi

echo -e "$OUTPUT"
