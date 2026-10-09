import type { Event, EventTemplate, Filter } from "nostr-tools";
import { SimplePool } from "nostr-tools";
import { RelayRegistry } from "@/nostr/relay-registry";
import {
	type EventId,
	type NostrPool,
	type NostrSigner,
	PROFILE_KIND,
	type PublishResult,
	REACTION_KIND,
} from "@/nostr/types";
import { asEventId, asHexPubkey, normalizeRelayUrl } from "@/nostr/validation";
import { BrowserEventCache, type EventCache } from "@/storage/event-cache";

export class NostrPublishError extends Error {
	readonly result: PublishResult;

	constructor(result: PublishResult) {
		super("The event was rejected by every configured relay.");
		this.name = "NostrPublishError";
		this.result = result;
	}
}

export class NostrGateway {
	readonly #pool: NostrPool;
	readonly #relays: RelayRegistry;
	readonly #cache: EventCache;

	constructor({
		pool = new SimplePool({ enableReconnect: true }),
		relays = new RelayRegistry(),
		cache = new BrowserEventCache(),
	}: {
		pool?: NostrPool;
		relays?: RelayRegistry;
		cache?: EventCache;
	} = {}) {
		this.#pool = pool;
		this.#relays = relays;
		this.#cache = cache;
	}

	get relayUrls(): readonly string[] {
		return this.#relays.urls;
	}

	get relayStatus() {
		return this.#relays.getStatus(this.#pool.listConnectionStatus());
	}

	addRelayHints(relayUrls: readonly string[]): void {
		this.#relays.add(relayUrls);
	}

	async refreshRelayStatus(): Promise<void> {
		if (!this.#pool.ensureRelay) {
			return;
		}

		await Promise.allSettled(this.relayUrls.map((relayUrl) => this.#pool.ensureRelay?.(relayUrl)));
	}

	async getEventById(eventId: EventId, maxWait = 1_000): Promise<Event | null> {
		const normalizedEventId = asEventId(eventId);
		const cached = await this.#cache.get(normalizedEventId);
		if (cached) {
			this.addRelayHints(cached.relayHints);
			return cached.event;
		}

		const event = await this.#pool.get(
			[...this.relayUrls],
			{ ids: [normalizedEventId] },
			{ maxWait }
		);
		if (event) {
			void this.#cache.put(event, this.relayUrls);
		}
		return event;
	}

	async getProfile(pubkey: string, maxWait = 1_000): Promise<Event | null> {
		return this.#pool.get(
			[...this.relayUrls],
			{ authors: [asHexPubkey(pubkey)], kinds: [PROFILE_KIND] },
			{ maxWait }
		);
	}

	async queryEvents(
		filter: Filter,
		{
			relayUrls = this.relayUrls,
			maxWait = 3_000,
		}: { relayUrls?: readonly string[]; maxWait?: number } = {}
	): Promise<Event[]> {
		const normalizedRelays = [...new Set(relayUrls.map(normalizeRelayUrl))];
		if (normalizedRelays.length === 0) {
			return [];
		}

		const events = await this.#pool.querySync(normalizedRelays, filter, { maxWait });
		const deduplicatedEvents = [...new Map(events.map((event) => [event.id, event])).values()].sort(
			(first, second) => second.created_at - first.created_at || first.id.localeCompare(second.id)
		);
		for (const event of deduplicatedEvents) {
			void this.#cache.put(event, normalizedRelays);
		}
		return deduplicatedEvents;
	}

	subscribeToReactions(
		eventId: EventId,
		onEvent: (event: Event) => void,
		options: { maxWait?: number; onEose?(): void; onClose?(): void } = {}
	) {
		return this.#pool.subscribeMany(
			[...this.relayUrls],
			{ kinds: [REACTION_KIND], "#e": [asEventId(eventId)] },
			{
				onevent: onEvent,
				...(options.onEose ? { oneose: options.onEose } : {}),
				...(options.onClose ? { onclose: options.onClose } : {}),
				...(options.maxWait ? { maxWait: options.maxWait } : {}),
			}
		);
	}

	async publish(
		template: EventTemplate,
		signer: NostrSigner,
		{
			relayUrls = this.relayUrls,
			maxWait = 3_000,
		}: { relayUrls?: readonly string[]; maxWait?: number } = {}
	): Promise<PublishResult> {
		const event = await signer.signEvent(template);
		const targetRelayUrls = [...new Set(relayUrls.map(normalizeRelayUrl))];
		if (targetRelayUrls.length === 0) {
			throw new Error("At least one relay is required to publish an event.");
		}

		const responses = await Promise.allSettled(
			this.#pool.publish(targetRelayUrls, event, { maxWait })
		);
		const result: PublishResult = {
			event,
			relays: responses.map((response, index) => ({
				relayUrl: targetRelayUrls[index] ?? "unknown",
				accepted: response.status === "fulfilled",
				...(response.status === "fulfilled" ? {} : { message: errorMessage(response.reason) }),
			})),
		};

		if (!result.relays.some((relay) => relay.accepted)) {
			throw new NostrPublishError(result);
		}

		return result;
	}

	close(): void {
		this.#pool.close([...this.relayUrls]);
	}

	destroy(): void {
		this.#pool.destroy();
	}
}

function errorMessage(value: unknown): string {
	return value instanceof Error ? value.message : String(value);
}
