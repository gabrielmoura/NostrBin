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
export const NOSTRBIN_APPLICATION_HANDLER: ApplicationHandlerReference | null = {
	event: {
		"id": "eb29370867813bede6113b702a220002272c2b7ecdd7c794afabb71dc6934f43",
		"pubkey": "7ab124c84351506938f502bdf14a91431d9c0f5788dad8aff735aa6c8ccc99ca",
		"created_at": 1791561853,
		"kind": 31990,
		"tags": [
			[
				"d",
				"nostrbin"
			],
			[
				"k",
				"1337"
			],
			[
				"web",
				"https://nostr-bin.vercel.app/snippet/\u003cbech32\u003e",
				"note"
			],
			[
				"web",
				"https://nostr-bin.vercel.app/snippet/\u003cbech32\u003e",
				"nevent"
			],
			[
				"web",
				"https://nostr-bin.vercel.app/u/\u003cbech32\u003e",
				"npub"
			]
		],
		"content": "{\"name\":\"NostrBin\",\"about\":\"Decentralized, relay-aware code snippets on Nostr\",\"picture\":\"https://nostr-bin.vercel.app/logo.webp\",\"website\":\"https://nostr-bin.vercel.app\"}",
		"sig": "7f8e29df28f27ede369547d917fa9e0ae18fe0b9453ab44142fab141304f2abd2b1f4e4009fa1bf7b0b01029e22db350f7ed4bb31b9a997fe9c2bc21574341d4"
	},
	relayHint: 'wss://relay.damus.io'
};

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
