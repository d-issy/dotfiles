#!/bin/bash
input=$(cat)

# Colors
DIM='\033[2m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
CYAN='\033[36m'
RESET='\033[0m'

format_k() {
	awk -v n="$1" 'BEGIN { printf "%.1fK", n/1000 }'
}

format_tokens() {
	awk -v n="$1" 'BEGIN {
    if (n == 1000000) { printf "1M" }
    else if (n >= 1000000) { printf "%.1fM", n/1000000 }
    else if (n >= 1000) { printf "%.0fK", n/1000 }
    else { printf "%d", n }
  }'
}

# Format a Unix epoch (seconds) as local HH:MM. Tries BSD date (macOS) first,
# then GNU date (Linux). Prints nothing if neither understands the input.
fmt_reset() {
	date -r "$1" +%H:%M 2>/dev/null || date -d "@$1" +%H:%M 2>/dev/null
}

# Render a usage-limit segment as "<label><remaining>%", colored by remaining.
# When not green (remaining < 50%) and a reset epoch is given, append "→HH:MM"
# so the recovery time is visible exactly when the limit starts to matter.
# Prints nothing when the percentage is absent (non-subscribers / pre-first-call).
usage_seg() {
	local used="$1" label="$2" reset="$3" remain color seg at
	[[ -z "$used" ]] && return
	remain=$(awk -v u="$used" 'BEGIN { printf "%.0f", 100 - u }')
	if awk -v r="$remain" 'BEGIN { exit !(r >= 50) }'; then
		color="$GREEN"
	elif awk -v r="$remain" 'BEGIN { exit !(r >= 20) }'; then
		color="$YELLOW"
	else
		color="$RED"
	fi
	seg="${DIM}${label}${RESET}${color}${remain}%${RESET}"
	if [[ "$color" != "$GREEN" && -n "$reset" ]]; then
		at=$(fmt_reset "$reset")
		[[ -n "$at" ]] && seg+=" ${color}${at}${RESET}"
	fi
	printf '%b' "$seg"
}

MODEL=$(echo "$input" | jq -r '.model.display_name // "Unknown"')
EFFORT=$(echo "$input" | jq -r '.effort.level // empty')
CWD=$(echo "$input" | jq -r '.workspace.current_dir // "."')
CWD_SHORT="${CWD##*/}"

TOTAL_INPUT_TOKENS=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0')
TOTAL_OUTPUT_TOKENS=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0')
CONTEXT_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')

# Current context usage (not cumulative totals)
CURRENT_INPUT=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // 0')
CACHE_CREATE=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0')
CACHE_READ=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0')

TOTAL_USED=$((CURRENT_INPUT + CACHE_CREATE + CACHE_READ))
REMAINING=$(awk -v used="$TOTAL_USED" -v size="$CONTEXT_SIZE" 'BEGIN { printf "%.1f", 100 - (used * 100 / size) }')

INPUT_K=$(format_k "$TOTAL_INPUT_TOKENS")
OUTPUT_K=$(format_k "$TOTAL_OUTPUT_TOKENS")

# Usage limits (Pro/Max subscribers only, after the first API response)
FIVE_HOUR_USED=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
SEVEN_DAY_USED=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
FIVE_HOUR_RESET=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
SEVEN_DAY_RESET=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

# Git branch
GIT_BRANCH=""
if git rev-parse --git-dir >/dev/null 2>&1; then
	BRANCH=$(git branch --show-current 2>/dev/null)
	if [[ -n "$BRANCH" ]]; then
		GIT_BRANCH="${DIM}:${RESET}${CYAN}${BRANCH}${RESET}"
	fi
fi

# Build output
MODEL_DISPLAY="${MODEL}"
if [[ -n "$EFFORT" ]]; then
	MODEL_DISPLAY+="${DIM}:${RESET}${EFFORT}"
fi
OUTPUT="${MODEL_DISPLAY} ${DIM}|${RESET} $CWD_SHORT${GIT_BRANCH}"

if [[ "$TOTAL_INPUT_TOKENS" != "0" || "$TOTAL_OUTPUT_TOKENS" != "0" ]]; then
	OUTPUT+=" ${DIM}|${RESET} ${DIM}↑${RESET}${GREEN}${INPUT_K}${RESET} ${DIM}↓${RESET}${YELLOW}${OUTPUT_K}${RESET}"
fi

if [[ "$TOTAL_USED" != "0" ]]; then
	USED_FMT=$(format_tokens "$TOTAL_USED")
	# Color based on remaining context percentage
	if awk -v r="$REMAINING" 'BEGIN { exit !(r >= 50) }'; then
		CTX_COLOR="$GREEN"
	elif awk -v r="$REMAINING" 'BEGIN { exit !(r >= 20) }'; then
		CTX_COLOR="$YELLOW"
	else
		CTX_COLOR="$RED"
	fi
	OUTPUT+=" ${CTX_COLOR}${USED_FMT} (${REMAINING}%)${RESET}"
fi

FIVE_SEG=$(usage_seg "$FIVE_HOUR_USED" "5h " "$FIVE_HOUR_RESET")
SEVEN_SEG=$(usage_seg "$SEVEN_DAY_USED" "7d " "$SEVEN_DAY_RESET")
if [[ -n "$FIVE_SEG" || -n "$SEVEN_SEG" ]]; then
	OUTPUT+=" ${DIM}|${RESET}"
	[[ -n "$FIVE_SEG" ]] && OUTPUT+=" ${FIVE_SEG}"
	[[ -n "$SEVEN_SEG" ]] && OUTPUT+=" ${SEVEN_SEG}"
fi

echo -e "$OUTPUT"
