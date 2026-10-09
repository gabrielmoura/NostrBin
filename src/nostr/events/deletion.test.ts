import { describe, expect, it } from "vitest";
import { createDeletionTemplate, DELETION_KIND } from "@/nostr/events/deletion";
import { asEventId } from "@/nostr/validation";

describe("NIP-09 deletion requests", () => {
	it("references the event and includes its kind", () => {
		expect(
			createDeletionTemplate(
				asEventId("a".repeat(64)),
				1337,
				"obsolete",
				new Date("2026-10-08T12:00:00Z")
			)
		).toEqual({
			kind: DELETION_KIND,
			content: "obsolete",
			created_at: 1_791_460_800,
			tags: [
				["e", "a".repeat(64)],
				["k", "1337"],
			],
		});
	});
});
