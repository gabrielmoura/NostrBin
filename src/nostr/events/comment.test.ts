import { describe, expect, it } from "vitest";
import { COMMENT_KIND, createRootCommentTemplate } from "@/nostr/events/comment";
import { asEventId, asHexPubkey } from "@/nostr/validation";

describe("NIP-22 root comments", () => {
	it("uses uppercase root tags and lowercase parent tags", () => {
		const template = createRootCommentTemplate(
			{
				eventId: asEventId("a".repeat(64)),
				pubkey: asHexPubkey("b".repeat(64)),
				kind: 1337,
				relayHint: "wss://relay.example",
			},
			"Useful snippet",
			new Date("2026-10-08T12:00:00Z")
		);
		expect(template).toMatchObject({ kind: COMMENT_KIND, content: "Useful snippet" });
		expect(template.tags).toEqual([
			["E", "a".repeat(64), "wss://relay.example", "b".repeat(64)],
			["K", "1337"],
			["P", "b".repeat(64), "wss://relay.example"],
			["e", "a".repeat(64), "wss://relay.example", "b".repeat(64)],
			["k", "1337"],
			["p", "b".repeat(64), "wss://relay.example"],
		]);
	});
});
