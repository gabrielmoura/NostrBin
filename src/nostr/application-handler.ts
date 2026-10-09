import type { Event } from "nostr-tools";
import { SNIPPET_KIND } from "@/nostr/types";
import { normalizeRelayUrl } from "@/nostr/validation";

export const APPLICATION_HANDLER_KIND = 31_990;

export interface ApplicationHandlerReference {
	/** A complete signed kind:31990 event, manually copied after it is published. */
	event: Event;
	/** Relay where the exact handler event can be retrieved by other clients. */
	relayHint: string;
}

/**
 * Replace `null` with the signed NostrBin kind:31990 descriptor after publishing it manually.
 * This application never signs or publishes the descriptor with a user's key.
 */
export const NOSTRBIN_APPLICATION_HANDLER: ApplicationHandlerReference | null = null;

export type ClientTag = readonly [
	tag: "client",
	name: "NostrBin",
	address: string,
	relayHint: string,
];

export function getNostrBinClientTag(
	handler: ApplicationHandlerReference | null = NOSTRBIN_APPLICATION_HANDLER
): ClientTag | null {
	if (!handler || handler.event.kind !== APPLICATION_HANDLER_KIND) {
		return null;
	}

	const identifier = handler.event.tags.find((tag) => tag[0] === "d")?.[1]?.trim();
	const supportsSnippets = handler.event.tags.some(
		(tag) => tag[0] === "k" && tag[1] === String(SNIPPET_KIND)
	);
	if (!identifier || !supportsSnippets) {
		return null;
	}

	try {
		const relayHint = normalizeRelayUrl(handler.relayHint);
		return [
			"client",
			"NostrBin",
			`${APPLICATION_HANDLER_KIND}:${handler.event.pubkey}:${identifier}`,
			relayHint,
		];
	} catch {
		return null;
	}
}
