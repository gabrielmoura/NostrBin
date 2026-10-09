import type { Event } from "nostr-tools";
import { describe, expect, it } from "vitest";
import { getNostrBinClientTag } from "@/nostr/application-handler";

const descriptor = {
	id: "a".repeat(64),
	pubkey: "b".repeat(64),
	created_at: 1,
	kind: 31_990,
	content: '{"name":"NostrBin"}',
	tags: [
		["d", "nostrbin"],
		["k", "1337"],
		["web", "https://nostrbin.example/snippet/<bech32>", "nevent"],
	],
	sig: "c".repeat(128),
} satisfies Event;

describe("NIP-89 application handler", () => {
	it("creates a complete client tag only from a valid snippet handler", () => {
		expect(getNostrBinClientTag({ event: descriptor, relayHint: "wss://relay.example" })).toEqual([
			"client",
			"NostrBin",
			`31990:${descriptor.pubkey}:nostrbin`,
			"wss://relay.example",
		]);
	});

	it("does not emit a client tag for incomplete descriptors", () => {
		expect(getNostrBinClientTag(null)).toBeNull();
		expect(
			getNostrBinClientTag({
				event: { ...descriptor, tags: [["d", "nostrbin"]] },
				relayHint: "wss://relay.example",
			})
		).toBeNull();
	});
});
