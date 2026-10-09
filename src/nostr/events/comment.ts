import type { EventTemplate } from "nostr-tools";
import type { EventId, HexPubkey } from "@/nostr/types";

export const COMMENT_KIND = 1111;

export interface RootCommentTarget {
	eventId: EventId;
	pubkey: HexPubkey;
	kind: number;
	relayHint?: string;
}

export function createRootCommentTemplate(
	target: RootCommentTarget,
	content: string,
	now = new Date()
): EventTemplate {
	const normalizedContent = content.trim();
	if (!normalizedContent) {
		throw new Error("A comment cannot be empty.");
	}

	const relayHint = target.relayHint ?? "";
	return {
		kind: COMMENT_KIND,
		content: normalizedContent,
		created_at: Math.floor(now.getTime() / 1_000),
		tags: [
			["E", target.eventId, relayHint, target.pubkey],
			["K", String(target.kind)],
			["P", target.pubkey, relayHint],
			["e", target.eventId, relayHint, target.pubkey],
			["k", String(target.kind)],
			["p", target.pubkey, relayHint],
		],
	};
}
