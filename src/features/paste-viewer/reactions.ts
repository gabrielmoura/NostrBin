import type { Event } from "nostr-tools";
import type { HexPubkey } from "@/nostr/types";

const POSITIVE_REACTIONS = new Set(["+", "👍", "❤️", "🤙"]);
const NEGATIVE_REACTIONS = new Set(["-", "👎", "💔️"]);

export type ReactionDirection = "positive" | "negative";

export function reactionCount(events: readonly Event[], direction: ReactionDirection): number {
	const acceptedContents = direction === "positive" ? POSITIVE_REACTIONS : NEGATIVE_REACTIONS;
	return events.filter((event) => acceptedContents.has(event.content)).length;
}

export function hasReacted(events: readonly Event[], publicKey: HexPubkey | null): boolean {
	return publicKey !== null && events.some((event) => event.pubkey === publicKey);
}
