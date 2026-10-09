import type { Event, Filter } from "nostr-tools";
import { describe, expect, it } from "vitest";
import { AuthorRelayResolver, parseRelayList } from "@/nostr/relay-list";

function event(kind: number, createdAt: number, tags: string[][]): Event {
	return {
		id: `${createdAt}`.padStart(64, "0"),
		pubkey: "a".repeat(64),
		created_at: createdAt,
		kind,
		tags,
		content: "",
		sig: "b".repeat(128),
	};
}

describe("NIP-65 relay lists", () => {
	it("separates read/write markers and tolerates malformed URLs", () => {
		expect(
			parseRelayList(
				event(10_002, 1, [
					["r", "wss://both.example"],
					["r", "wss://write.example", "write"],
					["r", "wss://read.example", "read"],
					["r", "https://invalid.example"],
				])
			)
		).toEqual({
			writeRelayUrls: ["wss://both.example", "wss://write.example"],
			readRelayUrls: ["wss://both.example", "wss://read.example"],
		});
	});

	it("uses the latest usable relay list then falls back to bootstrap relays", async () => {
		const events = [
			event(10_002, 1, [["r", "wss://old.example", "write"]]),
			event(10_002, 2, [["r", "wss://new.example", "write"]]),
		];
		const gateway = {
			relayUrls: ["wss://bootstrap-one.example", "wss://bootstrap-two.example"],
			queryEvents: async (_filter: Filter) => events,
		};
		const resolver = new AuthorRelayResolver(gateway);

		await expect(resolver.resolve("a".repeat(64))).resolves.toMatchObject({
			writeRelayUrls: ["wss://new.example"],
			source: "nip-65",
		});

		const fallbackResolver = new AuthorRelayResolver({ ...gateway, queryEvents: async () => [] });
		await expect(fallbackResolver.resolve("b".repeat(64))).resolves.toMatchObject({
			writeRelayUrls: gateway.relayUrls,
			source: "fallback",
		});
	});
});
