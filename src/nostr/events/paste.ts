import type { EventTemplate } from "nostr-tools";
import { nip19 } from "nostr-tools";
import { type EventId, PASTE_KIND, type ParsedNevent, type PasteDraft } from "@/nostr/types";
import { asEventId } from "@/nostr/validation";

export function createPasteTemplate(
	{ filename, content }: PasteDraft,
	now = new Date()
): EventTemplate {
	const normalizedFilename = filename.trim();
	if (!normalizedFilename) {
		throw new Error("A filename is required.");
	}

	if (!content) {
		throw new Error("Paste content is required.");
	}

	return {
		kind: PASTE_KIND,
		content,
		created_at: Math.floor(now.getTime() / 1_000),
		tags: [
			["filename", normalizedFilename],
			["client", "nostrbin"],
		],
	};
}

export function getPasteFilename(tags: readonly string[][]): string | null {
	return tags.find(([name]) => name === "filename")?.[1] ?? null;
}

export function parsePasteReference(reference: string): ParsedNevent {
	const normalizedReference = reference.trim();
	if (!normalizedReference.startsWith("n")) {
		return { eventId: asEventId(normalizedReference), relayHints: [] };
	}

	const decoded = nip19.decode(normalizedReference);
	if (decoded.type === "note") {
		return { eventId: asEventId(decoded.data), relayHints: [] };
	}
	if (decoded.type !== "nevent") {
		throw new Error("The supplied identifier is not a note or nevent.");
	}

	return {
		eventId: asEventId(decoded.data.id),
		relayHints: decoded.data.relays ?? [],
	};
}

export function encodePasteReference(eventId: EventId, relayHints: readonly string[]): string {
	void relayHints;
	return nip19.noteEncode(eventId);
}
