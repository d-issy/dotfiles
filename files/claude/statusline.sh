#!/bin/bash
input=$(cat)

# Colors
DIM='\033[2m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
CYAN='\033[36m'
RESET='\033[0m'

format_tokens() {
	awk -v n="$1" 'BEGIN {
    if (n == 1000000) { printf "1M" }
    else if (n >= 1000000) { printf "%.1fM", n/1000000 }
    else if (n >= 1000) { printf "%.0fK", n/1000 }
    else { printf "%d", n }
  }'
}

# Format a Unix epoch (seconds) with a strftime format. Tries BSD date (macOS)
# first, then GNU date (Linux). Prints nothing if neither understands the input.
date_fmt() {
	date -r "$1" "+$2" 2>/dev/null || date -d "@$1" "+$2" 2>/dev/null
}

# Local reset time as HH:MM, prefixed with the weekday when it is not today —
# the 7d window resets days out, where a bare clock time is ambiguous.
# The weekday is mapped by hand rather than via %a: LANG here is en_US, and
# ja_JP.UTF-8 is not guaranteed to exist on Linux, so %a is not dependable.
fmt_reset() {
	local wdays=(日 月 火 水 木 金 土) wday
	if [[ "$(date_fmt "$1" %F)" == "$(date +%F)" ]]; then
		date_fmt "$1" %H:%M
	else
		wday=$(date_fmt "$1" %w)
		[[ -z "$wday" ]] && return
		printf '%s %s' "${wdays[$wday]}" "$(date_fmt "$1" %H:%M)"
	fi
}

# Render a usage-limit segment as "<label><used>%", colored by usage.
# When not green (used > 50%) and a reset epoch is given, append "→HH:MM"
# so the recovery time is visible exactly when the limit starts to matter.
# Prints nothing when the percentage is absent (non-subscribers / pre-first-call).
usage_seg() {
	local used="$1" label="$2" reset="$3" color seg at
	[[ -z "$used" ]] && return
	used=$(awk -v u="$used" 'BEGIN { printf "%.0f", u }')
	if awk -v u="$used" 'BEGIN { exit !(u <= 50) }'; then
		color="$GREEN"
	elif awk -v u="$used" 'BEGIN { exit !(u <= 80) }'; then
		color="$YELLOW"
	else
		color="$RED"
	fi
	seg="${DIM}${label}${RESET}${color}${used}%${RESET}"
	if [[ "$color" != "$GREEN" && -n "$reset" ]]; then
		at=$(fmt_reset "$reset")
		[[ -n "$at" ]] && seg+=" ${color}${at}${RESET}"
	fi
	printf '%b' "$seg"
}

MODEL=$(echo "$input" | jq -r '.model.display_name // "Unknown"')
# "Opus 5 (1M context)" -> "Opus 5 (1M)"; the window size alone is unambiguous
MODEL="${MODEL/ context)/)}"
EFFORT=$(echo "$input" | jq -r '.effort.level // empty')

CONTEXT_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')

# Current context usage (not cumulative totals)
CURRENT_INPUT=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // 0')
CACHE_CREATE=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0')
CACHE_READ=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0')

TOTAL_USED=$((CURRENT_INPUT + CACHE_CREATE + CACHE_READ))
USED_PCT=$(awk -v used="$TOTAL_USED" -v size="$CONTEXT_SIZE" 'BEGIN { printf "%.1f", used * 100 / size }')

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
		GIT_BRANCH=" ${DIM}|${RESET} ${CYAN}${BRANCH}${RESET}"
	fi
fi

# Build output
MODEL_DISPLAY="${MODEL}"
if [[ -n "$EFFORT" ]]; then
	MODEL_DISPLAY+="${DIM}:${RESET}${EFFORT}"
fi
OUTPUT="${MODEL_DISPLAY}${GIT_BRANCH}"

if [[ "$TOTAL_USED" != "0" ]]; then
	USED_FMT=$(format_tokens "$TOTAL_USED")
	# Color based on used context percentage
	if awk -v u="$USED_PCT" 'BEGIN { exit !(u <= 50) }'; then
		CTX_COLOR="$GREEN"
	elif awk -v u="$USED_PCT" 'BEGIN { exit !(u <= 80) }'; then
		CTX_COLOR="$YELLOW"
	else
		CTX_COLOR="$RED"
	fi
	OUTPUT+=" ${DIM}|${RESET} ${CTX_COLOR}${USED_FMT}${RESET}${DIM}/$(format_tokens "$CONTEXT_SIZE")${RESET} ${CTX_COLOR}(${USED_PCT}%)${RESET}"
fi

FIVE_SEG=$(usage_seg "$FIVE_HOUR_USED" "5h " "$FIVE_HOUR_RESET")
SEVEN_SEG=$(usage_seg "$SEVEN_DAY_USED" "7d " "$SEVEN_DAY_RESET")
if [[ -n "$FIVE_SEG" || -n "$SEVEN_SEG" ]]; then
	OUTPUT+=" ${DIM}|${RESET}"
	[[ -n "$FIVE_SEG" ]] && OUTPUT+=" ${FIVE_SEG}"
	[[ -n "$SEVEN_SEG" ]] && OUTPUT+=" ${SEVEN_SEG}"
fi

echo -e "$OUTPUT"
