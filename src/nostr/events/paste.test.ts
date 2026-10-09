import { describe, expect, it } from "vitest";
import {
	createPasteTemplate,
	encodePasteReference,
	getPasteFilename,
	parsePasteReference,
} from "@/nostr/events/paste";
import { asEventId } from "@/nostr/validation";

describe("paste event helpers", () => {
	it("preserves the legacy paste event contract", () => {
		const template = createPasteTemplate(
			{ filename: " README.md ", content: "# nostrbin" },
			new Date("2026-10-07T12:00:00Z")
		);

		expect(template).toEqual({
			kind: 1050,
			content: "# nostrbin",
			created_at: 1_791_374_400,
			tags: [
				["filename", "README.md"],
				["client", "nostrbin"],
			],
		});
	});

	it("prefers a note reference when encoding a paste", () => {
		const eventId = asEventId("a".repeat(64));
		const reference = encodePasteReference(eventId, ["wss://relay.example", "wss://relay.example"]);

		expect(parsePasteReference(reference)).toEqual({
			eventId,
			relayHints: [],
		});
	});

	it("extracts the filename safely", () => {
		expect(getPasteFilename([["client", "nostrbin"]])).toBeNull();
		expect(getPasteFilename([["filename", "a.txt"]])).toBe("a.txt");
	});
});
