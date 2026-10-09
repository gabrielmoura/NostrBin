import type { EventTemplate } from "nostr-tools";
import {
	createSnippetTemplate,
	encodeSnippetReference,
	parseSnippet,
} from "@/nostr/events/snippet";
import type { NostrSigner, PublishResult, SnippetDraft } from "@/nostr/types";

export interface SnippetPublisher {
	publish(
		template: EventTemplate,
		signer: NostrSigner,
		options: { relayUrls: readonly string[]; maxWait?: number }
	): Promise<PublishResult>;
}

export interface SnippetPublication {
	result: PublishResult;
	reference: string;
}

export async function publishSnippet(
	draft: SnippetDraft,
	publisher: SnippetPublisher,
	signer: NostrSigner,
	relayUrls: readonly string[]
): Promise<SnippetPublication> {
	const result = await publisher.publish(createSnippetTemplate(draft), signer, { relayUrls });
	const snippet = parseSnippet(result.event);
	if (!snippet) {
		throw new Error("The signer returned an event that is not a code snippet.");
	}

	return {
		result,
		reference: encodeSnippetReference(
			snippet.event,
			result.relays.filter((relay) => relay.accepted).map((relay) => relay.relayUrl)
		),
	};
}
