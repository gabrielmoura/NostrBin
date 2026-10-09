import type { Event, EventTemplate } from "nostr-tools";
import { describe, expect, it } from "vitest";
import { publishSnippet, type SnippetPublisher } from "@/features/snippet-editor/publish";
import { parsePasteReference } from "@/nostr/events/paste";
import type { NostrSigner } from "@/nostr/types";
import { asHexPubkey } from "@/nostr/validation";

const snippetEvent = {
	id: "a".repeat(64),
	pubkey: "b".repeat(64),
	created_at: 1,
	kind: 1337,
	tags: [["name", "hello.ts"]],
	content: "console.log('hello')",
	sig: "c".repeat(128),
} satisfies Event;

const signer: NostrSigner = {
	getPublicKey: async () => asHexPubkey("b".repeat(64)),
	signEvent: async () => snippetEvent,
};

describe("publishSnippet", () => {
	it("publishes a C0 event to selected relays and returns a preferred note reference", async () => {
		let receivedTemplate: EventTemplate | undefined;
		let receivedRelayUrls: readonly string[] | undefined;
		const publisher: SnippetPublisher = {
			publish: async (template, _signer, options) => {
				receivedTemplate = template;
				receivedRelayUrls = options.relayUrls;
				return {
					event: snippetEvent,
					relays: [
						{ relayUrl: "wss://accepted.example", accepted: true },
						{ relayUrl: "wss://rejected.example", accepted: false, message: "rejected" },
					],
				};
			},
		};

		const publication = await publishSnippet(
			{ name: "hello.ts", content: "console.log('hello')", language: "typescript" },
			publisher,
			signer,
			["wss://write.example"]
		);

		expect(receivedTemplate?.kind).toBe(1337);
		expect(receivedTemplate?.tags).toContainEqual(["l", "typescript"]);
		expect(receivedRelayUrls).toEqual(["wss://write.example"]);
		expect(parsePasteReference(publication.reference)).toMatchObject({
			eventId: snippetEvent.id,
			relayHints: [],
		});
	});
});
