import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type HerdrBlockedEvent = {
	readonly active: boolean;
	readonly label?: string;
};

type EventEmitter = Pick<ExtensionAPI["events"], "emit">;

const HERDR_BLOCKED_EVENT = "herdr:blocked";
const HERDR_ENV = "HERDR_ENV";

let events: EventEmitter | undefined;
let activeBlockers = 0;
let installed = false;

function emitBlocked(event: HerdrBlockedEvent): void {
	events?.emit(HERDR_BLOCKED_EVENT, event);
}

function clearActiveBlockers(): void {
	while (activeBlockers > 0) {
		activeBlockers -= 1;
		emitBlocked({ active: false });
	}
}

function isHerdrSession(): boolean {
	return process.env[HERDR_ENV] === "1";
}

export function installHerdrAgentStateBridge(pi: ExtensionAPI): void {
	if (!isHerdrSession()) return;
	installed = true;
	events = pi.events;
	pi.on("session_shutdown", () => clearActiveBlockers());
}

export function beginHerdrBlocked(label: string): () => void {
	if (!installed) return () => undefined;
	let released = false;
	activeBlockers += 1;
	emitBlocked({ active: true, label });
	return () => {
		if (released) return;
		released = true;
		activeBlockers = Math.max(0, activeBlockers - 1);
		emitBlocked({ active: false, label });
	};
}

export async function withHerdrBlocked<T>(
	label: string,
	fn: () => Promise<T>,
): Promise<T> {
	const release = beginHerdrBlocked(label);
	try {
		return await fn();
	} finally {
		release();
	}
}

export function resetHerdrAgentStateBridgeForTests(): void {
	events = undefined;
	activeBlockers = 0;
	installed = false;
}
