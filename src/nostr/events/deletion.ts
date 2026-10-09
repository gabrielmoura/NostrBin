import type { EventTemplate } from "nostr-tools";
import type { EventId } from "@/nostr/types";

export const DELETION_KIND = 5;

export function createDeletionTemplate(
	eventId: EventId,
	targetKind: number,
	reason = "",
	now = new Date()
): EventTemplate {
	return {
		kind: DELETION_KIND,
		content: reason.trim(),
		created_at: Math.floor(now.getTime() / 1_000),
		tags: [
			["e", eventId],
			["k", String(targetKind)],
		],
	};
}
