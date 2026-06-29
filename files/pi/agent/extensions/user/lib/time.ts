export function elapsedSeconds(ms: number): number {
	return Math.max(0, Math.floor(ms / 1000));
}

export function formatElapsedSeconds(ms: number): string {
	return `${elapsedSeconds(ms)}s`;
}
export function formatHumanElapsed(ms: number): string {
	const totalSeconds = elapsedSeconds(ms);

	if (ms < 60_000) {
		return formatElapsedSeconds(ms);
	}

	const seconds = totalSeconds % 60;
	const minutes = Math.floor(totalSeconds / 60) % 60;
	const hours = Math.floor(totalSeconds / 3600);

	if (hours > 0) {
		return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
	}

	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}

	return `${seconds}s`;
}

export function formatLiveElapsed(ms: number): string {
	return ms < 60_000 ? `${elapsedSeconds(ms)}s` : formatHumanElapsed(ms);
}

export function formatLiveElapsedDecimal(ms: number): string {
	return ms < 60_000
		? `${Math.max(0, ms / 1000).toFixed(1)}s`
		: formatHumanElapsed(ms);
}
