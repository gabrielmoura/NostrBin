import type { Event, EventTemplate } from "nostr-tools";
import { describe, expect, it } from "vitest";
import { type PastePublisher, publishPaste } from "@/features/paste-editor/publish";
import { parsePasteReference } from "@/nostr/events/paste";
import type { NostrSigner } from "@/nostr/types";
import { asHexPubkey } from "@/nostr/validation";

const publishedEvent = {
	id: "a".repeat(64),
	pubkey: "b".repeat(64),
	created_at: 1,
	kind: 1050,
	tags: [],
	content: "example",
	sig: "c".repeat(128),
} satisfies Event;

const signer: NostrSigner = {
	getPublicKey: async () => asHexPubkey("b".repeat(64)),
	signEvent: async () => publishedEvent,
};

describe("publishPaste", () => {
	it("publishes the kind 1050 template and returns a preferred note reference", async () => {
		let receivedTemplate: EventTemplate | undefined;
		const publisher: PastePublisher = {
			relayUrls: ["wss://relay.example", "wss://relay-two.example"],
			publish: async (template) => {
				receivedTemplate = template;
				return {
					event: publishedEvent,
					relays: [{ relayUrl: "wss://relay.example", accepted: true }],
				};
			},
		};

		const reference = await publishPaste(
			{ filename: "README.md", content: "# nostrbin" },
			publisher,
			signer
		);

		expect(receivedTemplate).toMatchObject({
			kind: 1050,
			content: "# nostrbin",
			tags: [
				["filename", "README.md"],
				["client", "nostrbin"],
			],
		});
		expect(parsePasteReference(reference)).toEqual({
			eventId: publishedEvent.id,
			relayHints: [],
		});
	});
});
