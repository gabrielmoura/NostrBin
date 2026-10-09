import { type Event, type EventTemplate, nip19 } from "nostr-tools";
import {
	type EventId,
	SNIPPET_KIND,
	type Snippet,
	type SnippetDraft,
	type SnippetEvent,
} from "@/nostr/types";
import { asEventId, asHexPubkey } from "@/nostr/validation";

export const MAX_SNIPPET_BYTES = 48 * 1024;
export const MAX_SNIPPET_TAGS = 32;
export const MAX_DESCRIPTION_LENGTH = 280;
export const MAX_DEPENDENCIES = 10;
export const MAX_TOPICS = 10;

export function createSnippetTemplate(draft: SnippetDraft, now = new Date()): EventTemplate {
	const name = requiredValue(draft.name, "A filename is required.");
	const content = draft.content;
	const sizeBytes = byteLength(content);
	if (!content) {
		throw new Error("Snippet content is required.");
	}
	if (sizeBytes > MAX_SNIPPET_BYTES) {
		throw new Error(`Snippets cannot exceed ${MAX_SNIPPET_BYTES} bytes.`);
	}

	const description = optionalValue(draft.description);
	if (description && description.length > MAX_DESCRIPTION_LENGTH) {
		throw new Error(`Descriptions cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`);
	}

	const licenses = normalizedValues(draft.licenses, "licenses", MAX_TOPICS);
	const dependencies = normalizedValues(draft.dependencies, "dependencies", MAX_DEPENDENCIES);
	const topics = normalizedValues(draft.tags, "tags", MAX_TOPICS);
	const tags = [
		optionalTag("l", normalizeLanguage(draft.language)),
		["name", name],
		optionalTag("extension", normalizeExtension(draft.extension)),
		optionalTag("description", description),
		optionalTag("runtime", optionalValue(draft.runtime)),
		...licenses.map((license) => ["license", license]),
		...dependencies.map((dependency) => ["dep", dependency]),
		optionalTag("repo", optionalValue(draft.repository)),
		...topics.map((topic) => ["t", topic]),
		optionalTag("alt", optionalValue(draft.alt) ?? `Code snippet: ${name}`),
		...(draft.expiresAt ? [["expiration", String(validateExpiration(draft.expiresAt, now))]] : []),
		...(draft.clientTag ? [[...draft.clientTag]] : []),
	].filter((tag): tag is string[] => tag !== null);

	if (tags.length > MAX_SNIPPET_TAGS) {
		throw new Error(`Snippets cannot exceed ${MAX_SNIPPET_TAGS} tags.`);
	}

	return {
		kind: SNIPPET_KIND,
		content,
		created_at: Math.floor(now.getTime() / 1_000),
		tags,
	};
}

function validateExpiration(expiresAt: number, now: Date): number {
	if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now.getTime() / 1_000)) {
		throw new Error("Expiration must be a future Unix timestamp.");
	}
	return expiresAt;
}

export function parseSnippet(event: Event): Snippet | null {
	if (event.kind !== SNIPPET_KIND) {
		return null;
	}

	return {
		event: event as SnippetEvent,
		metadata: {
			language: resolveLanguage(event.tags),
			name: firstTagValue(event.tags, "name"),
			extension: normalizeExtension(firstTagValue(event.tags, "extension")),
			description: firstTagValue(event.tags, "description"),
			runtime: firstTagValue(event.tags, "runtime"),
			licenses: tagValues(event.tags, "license"),
			dependencies: tagValues(event.tags, "dep"),
			repository: firstTagValue(event.tags, "repo"),
			tags: tagValues(event.tags, "t"),
			alt: firstTagValue(event.tags, "alt"),
		},
		sizeBytes: byteLength(event.content),
		lineCount: lineCount(event.content),
	};
}

export function resolveLanguage(tags: readonly string[][]): string {
	return (
		normalizeLanguage(firstTagValue(tags, "l")) ??
		normalizeLanguage(normalizeExtension(firstTagValue(tags, "extension"))) ??
		normalizeLanguage(extensionFromName(firstTagValue(tags, "name"))) ??
		"plaintext"
	);
}

export function byteLength(content: string): number {
	return new TextEncoder().encode(content).byteLength;
}

export function formatByteSize(sizeBytes: number): string {
	if (sizeBytes < 1_024) {
		return `${sizeBytes} B`;
	}
	if (sizeBytes < 1_024 * 1_024) {
		return `${(sizeBytes / 1_024).toFixed(1)} KB`;
	}
	return `${(sizeBytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

export function encodeSnippetReference(event: SnippetEvent, relayHints: readonly string[]): string {
	void relayHints;
	void asHexPubkey(event.pubkey);
	return nip19.noteEncode(asEventId(event.id));
}

export function parseSnippetReference(reference: string): {
	eventId: EventId;
	relayHints: string[];
} {
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
	if (decoded.data.kind !== undefined && decoded.data.kind !== SNIPPET_KIND) {
		throw new Error("The supplied nevent does not reference a code snippet.");
	}

	return {
		eventId: asEventId(decoded.data.id),
		relayHints: decoded.data.relays ?? [],
	};
}

function lineCount(content: string): number {
	return content ? content.split("\n").length : 0;
}

function firstTagValue(tags: readonly string[][], name: string): string | null {
	return tagValues(tags, name)[0] ?? null;
}

function tagValues(tags: readonly string[][], name: string): string[] {
	return tags.flatMap((tag) => (tag[0] === name ? [optionalValue(tag[1])] : [])).filter(isString);
}

function extensionFromName(name: string | null): string | null {
	if (!name) {
		return null;
	}

	const extensionStart = name.lastIndexOf(".");
	return extensionStart > 0 && extensionStart < name.length - 1
		? name.slice(extensionStart + 1)
		: null;
}

function normalizeLanguage(value: string | undefined | null): string | null {
	const normalized = optionalValue(value)?.toLowerCase();
	return normalized ?? null;
}

function normalizeExtension(value: string | undefined | null): string | null {
	const normalized = optionalValue(value)?.replace(/^\.+/, "").toLowerCase();
	return normalized || null;
}

function normalizedValues(
	values: readonly string[] | undefined,
	field: string,
	limit: number
): string[] {
	const normalized = [...new Set((values ?? []).map(optionalValue).filter(isString))];
	if (normalized.length > limit) {
		throw new Error(`A snippet cannot contain more than ${limit} ${field}.`);
	}
	return normalized;
}

function optionalTag(name: string, value: string | null): string[] | null {
	return value ? [name, value] : null;
}

function optionalValue(value: string | undefined | null): string | null {
	const normalized = value?.trim();
	return normalized ? normalized : null;
}

function requiredValue(value: string, message: string): string {
	return (
		optionalValue(value) ??
		(() => {
			throw new Error(message);
		})()
	);
}

function isString(value: string | null): value is string {
	return value !== null;
}
