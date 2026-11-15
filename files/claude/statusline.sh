#!/usr/bin/env bash
input=$(cat)

# Colors
DIM=$'\033[2m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
RED=$'\033[31m'
CYAN=$'\033[36m'
RESET=$'\033[0m'

format_tokens() {
	local n="$1" t
	if ((n == 1000000)); then
		printf '1M'
	elif ((n >= 1000000)); then
		t=$(((n + 50000) / 100000))
		printf '%d.%dM' $((t / 10)) $((t % 10))
	elif ((n >= 1000)); then
		printf '%dK' $(((n + 500) / 1000))
	else
		printf '%d' "$n"
	fi
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
	# $used is already rounded to an integer by jq
	if ((used <= 50)); then
		color="$GREEN"
	elif ((used <= 80)); then
		color="$YELLOW"
	else
		color="$RED"
	fi
	seg="${DIM}${label}${RESET}${color}${used}%${RESET}"
	if [[ "$color" != "$GREEN" && -n "$reset" ]]; then
		at=$(fmt_reset "$reset")
		[[ -n "$at" ]] && seg+=" ${color}${at}${RESET}"
	fi
	printf '%s' "$seg"
}

# One jq call for every field; the unit separator keeps empty fields in place
# (tab is IFS whitespace, so `read` would collapse empty tab-separated fields).
IFS=$'\x1f' read -r MODEL EFFORT CONTEXT_SIZE CURRENT_INPUT CACHE_CREATE CACHE_READ \
	FIVE_HOUR_USED SEVEN_DAY_USED FIVE_HOUR_RESET SEVEN_DAY_RESET < <(
		jq -r '[
		(.model.display_name // "Unknown"),
		(.effort.level // ""),
		(.context_window.context_window_size // 200000 | floor),
		(.context_window.current_usage.input_tokens // 0 | floor),
		(.context_window.current_usage.cache_creation_input_tokens // 0 | floor),
		(.context_window.current_usage.cache_read_input_tokens // 0 | floor),
		(.rate_limits.five_hour.used_percentage | if . == null then "" else round end),
		(.rate_limits.seven_day.used_percentage | if . == null then "" else round end),
		(.rate_limits.five_hour.resets_at // ""),
		(.rate_limits.seven_day.resets_at // "")
	] | map(tostring) | join("\u001f")' <<<"$input"
	)
# "Opus 5 (1M context)" -> "Opus 5 (1M)"; the window size alone is unambiguous
MODEL="${MODEL/ context)/)}"

# Current context usage (not cumulative totals)
TOTAL_USED=$((CURRENT_INPUT + CACHE_CREATE + CACHE_READ))
# Used percentage in tenths, rounded; a zero context size cannot be divided by
if ((CONTEXT_SIZE > 0)); then
	PCT10=$(((TOTAL_USED * 1000 + CONTEXT_SIZE / 2) / CONTEXT_SIZE))
else
	PCT10=0
fi
USED_PCT="$((PCT10 / 10)).$((PCT10 % 10))"

# Usage limits (Pro/Max subscribers only, after the first API response)
# FIVE_HOUR_USED / SEVEN_DAY_USED / *_RESET are empty when absent.

# Git branch
GIT_BRANCH=""
BRANCH=$(git branch --show-current 2>/dev/null)
if [[ -n "$BRANCH" ]]; then
	GIT_BRANCH=" ${DIM}|${RESET} ${CYAN}${BRANCH}${RESET}"
fi

# Build output
MODEL_DISPLAY="${MODEL}"
if [[ -n "$EFFORT" ]]; then
	MODEL_DISPLAY+="${DIM}:${RESET}${EFFORT}"
fi
OUTPUT="${MODEL_DISPLAY}${GIT_BRANCH}"

if ((TOTAL_USED != 0)); then
	USED_FMT=$(format_tokens "$TOTAL_USED")
	# Color based on used context percentage
	if ((PCT10 <= 500)); then
		CTX_COLOR="$GREEN"
	elif ((PCT10 <= 800)); then
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

printf '%s\n' "$OUTPUT"
