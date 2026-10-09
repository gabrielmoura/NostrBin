import type { Event } from "nostr-tools";
import { describe, expect, it } from "vitest";
import { hasReacted, reactionCount } from "@/features/paste-viewer/reactions";
import { asHexPubkey } from "@/nostr/validation";

function reaction(content: string, pubkey = "a".repeat(64)): Event {
	return {
		id: "b".repeat(64),
		pubkey,
		created_at: 1,
		kind: 7,
		tags: [],
		content,
		sig: "c".repeat(128),
	};
}

describe("paste reactions", () => {
	it("counts the legacy text and emoji variants", () => {
		const events = [reaction("+"), reaction("👍"), reaction("-"), reaction("other")];

		expect(reactionCount(events, "positive")).toBe(2);
		expect(reactionCount(events, "negative")).toBe(1);
	});

	it("only treats the current account as having reacted", () => {
		const events = [reaction("+", "a".repeat(64))];

		expect(hasReacted(events, null)).toBe(false);
		expect(hasReacted(events, asHexPubkey("a".repeat(64)))).toBe(true);
	});
});
