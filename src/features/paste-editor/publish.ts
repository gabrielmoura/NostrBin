import type { EventTemplate } from "nostr-tools";
import { createPasteTemplate, encodePasteReference } from "@/nostr/events/paste";
import type { NostrSigner, PasteDraft, PublishResult } from "@/nostr/types";
import { asEventId } from "@/nostr/validation";

export interface PastePublisher {
	readonly relayUrls: readonly string[];
	publish(template: EventTemplate, signer: NostrSigner): Promise<PublishResult>;
}

/** Publishes the legacy kind 1050 contract and returns its canonical NIP-19 route. */
export async function publishPaste(
	draft: PasteDraft,
	publisher: PastePublisher,
	signer: NostrSigner
): Promise<string> {
	const result = await publisher.publish(createPasteTemplate(draft), signer);
	return encodePasteReference(asEventId(result.event.id), publisher.relayUrls);
}
