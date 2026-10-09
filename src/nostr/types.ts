import type { Event, EventTemplate, Filter, UnsignedEvent } from "nostr-tools";

export const PASTE_KIND = 1050;
export const SNIPPET_KIND = 1337;
export const REACTION_KIND = 7;
export const PROFILE_KIND = 0;

export type HexPubkey = string & { readonly __brand: "HexPubkey" };
export type EventId = string & { readonly __brand: "EventId" };

export interface NostrSubscription {
	close(reason?: string): void;
}

export interface NostrPool {
	ensureRelay?(relayUrl: string): Promise<unknown>;
	get(relays: string[], filter: Filter, options?: { maxWait?: number }): Promise<Event | null>;
	querySync(relays: string[], filter: Filter, options?: { maxWait?: number }): Promise<Event[]>;
	publish(relays: string[], event: Event, options?: { maxWait?: number }): Promise<string>[];
	subscribeMany(
		relays: string[],
		filter: Filter,
		options: { onevent(event: Event): void; oneose?(): void; onclose?(): void; maxWait?: number }
	): NostrSubscription;
	listConnectionStatus(): Map<string, boolean>;
	close(relays: string[]): void;
	destroy(): void;
}

export interface NostrSigner {
	getPublicKey(): Promise<HexPubkey>;
	signEvent(template: EventTemplate): Promise<Event>;
}

export interface PasteDraft {
	filename: string;
	content: string;
}

export interface PasteEvent extends Event {
	kind: typeof PASTE_KIND;
}

export interface SnippetDraft {
	name: string;
	content: string;
	language?: string;
	extension?: string;
	description?: string;
	runtime?: string;
	licenses?: readonly string[];
	dependencies?: readonly string[];
	repository?: string;
	tags?: readonly string[];
	alt?: string;
	expiresAt?: number;
	clientTag?: readonly [tag: "client", name: string, address: string, relayHint: string];
}

export interface SnippetMetadata {
	language: string;
	name: string | null;
	extension: string | null;
	description: string | null;
	runtime: string | null;
	licenses: readonly string[];
	dependencies: readonly string[];
	repository: string | null;
	tags: readonly string[];
	alt: string | null;
}

export interface SnippetEvent extends Event {
	kind: typeof SNIPPET_KIND;
}

export interface Snippet {
	event: SnippetEvent;
	metadata: SnippetMetadata;
	sizeBytes: number;
	lineCount: number;
}

export interface ReactionTarget {
	eventId: EventId;
	pubkey: HexPubkey;
	relayHint?: string;
	kind?: number;
}

export interface ReactionDraft {
	content: "+" | "-";
	target: ReactionTarget;
}

export interface PublishRelayResult {
	relayUrl: string;
	accepted: boolean;
	message?: string;
}

export interface PublishResult {
	event: Event;
	relays: PublishRelayResult[];
}

export interface ProfileMetadata {
	name?: string;
	displayName?: string;
	picture?: string;
	nip05?: string;
	about?: string;
}

export interface ParsedNevent {
	eventId: EventId;
	relayHints: string[];
}

export type LocalUnsignedEvent = UnsignedEvent;
