import { homedir } from "node:os";
import { basename } from "node:path";
import type { Color } from "../theme";
import { colors } from "../theme";

const HOME = homedir();

export function formatCount(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "0";
	if (value >= 1_000_000)
		return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
	if (value >= 1_000)
		return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
	return `${Math.round(value)}`;
}

export function formatPercent(value: number): string {
	return `${value.toFixed(1)}%`;
}

export function formatCwd(cwd: string): string {
	if (cwd === HOME) return "~";
	const name = basename(cwd);
	return name || cwd;
}

export function formatHomeCwdSegment(): string {
	return HOME;
}

export function pickRemainingColor(remaining: number): Color {
	if (remaining >= 50) return colors.positive;
	if (remaining >= 20) return colors.caution;
	return colors.alert;
}
