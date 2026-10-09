import type { EventTemplate } from "nostr-tools";
import { REACTION_KIND, type ReactionDraft } from "@/nostr/types";

export function createReactionTemplate(
	{ content, target }: ReactionDraft,
	now = new Date()
): EventTemplate {
	const relayTag = target.relayHint ? [target.relayHint, target.pubkey] : ["", target.pubkey];
	const tags = [
		["e", target.eventId, ...relayTag],
		["p", target.pubkey, target.relayHint ?? ""],
	];

	if (target.kind !== undefined) {
		tags.push(["k", String(target.kind)]);
	}

	return {
		kind: REACTION_KIND,
		content,
		created_at: Math.floor(now.getTime() / 1_000),
		tags,
	};
}
