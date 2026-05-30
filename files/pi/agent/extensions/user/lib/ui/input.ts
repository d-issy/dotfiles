/**
 * Decoding of raw terminal input bytes into typed characters, independent of
 * any particular widget. Currently just printable-character extraction, but
 * this is the natural home for further key/escape-sequence decoding helpers.
 */
import { decodeKittyPrintable } from "@earendil-works/pi-tui";

/**
 * Return the single printable character a raw input chunk represents, or
 * `undefined` if it is a control/navigation key. Handles the Kitty keyboard
 * protocol first, then falls back to a lone ASCII printable (space..~).
 */
export function decodePrintableInput(data: string): string | undefined {
	return (
		decodeKittyPrintable(data) ??
		(data.length === 1 && data >= " " && data <= "~" ? data : undefined)
	);
}
