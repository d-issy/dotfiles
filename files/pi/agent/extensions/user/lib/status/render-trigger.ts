export type RequestRender = () => void;

/**
 * Holds the footer's latest render callback so pi events can re-render it.
 * The footer registers itself via `set`; event handlers call `trigger`.
 */
export type RenderTrigger = {
	trigger(): void;
	set(next: RequestRender | undefined): void;
};

export function createRenderTrigger(): RenderTrigger {
	let request: RequestRender | undefined;
	return {
		trigger() {
			request?.();
		},
		set(next) {
			request = next;
		},
	};
}
