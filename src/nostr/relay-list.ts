import type { Event, Filter } from "nostr-tools";
import type { HexPubkey } from "@/nostr/types";
import { asHexPubkey, normalizeRelayUrl } from "@/nostr/validation";

export const RELAY_LIST_KIND = 10_002;
const MAX_AUTHOR_RELAYS = 4;

export interface AuthorRelaySet {
	publicKey: HexPubkey;
	writeRelayUrls: readonly string[];
	readRelayUrls: readonly string[];
	source: "nip-65" | "fallback";
}

interface RelayQueryGateway {
	readonly relayUrls: readonly string[];
	queryEvents(
		filter: Filter,
		options?: { relayUrls?: readonly string[]; maxWait?: number }
	): Promise<Event[]>;
}

export function parseRelayList(
	event: Event
): { writeRelayUrls: string[]; readRelayUrls: string[] } | null {
	if (event.kind !== RELAY_LIST_KIND) {
		return null;
	}

	const writeRelayUrls = new Set<string>();
	const readRelayUrls = new Set<string>();
	for (const tag of event.tags) {
		if (tag[0] !== "r" || !tag[1]) {
			continue;
		}

		try {
			const relayUrl = normalizeRelayUrl(tag[1]);
			const marker = tag[2];
			if (!marker || marker === "write") {
				writeRelayUrls.add(relayUrl);
			}
			if (!marker || marker === "read") {
				readRelayUrls.add(relayUrl);
			}
		} catch {
			// A malformed relay entry must not invalidate a whole NIP-65 event.
		}
	}

	return { writeRelayUrls: [...writeRelayUrls], readRelayUrls: [...readRelayUrls] };
}

export class AuthorRelayResolver {
	readonly #gateway: RelayQueryGateway;
	readonly #cache = new Map<HexPubkey, Promise<AuthorRelaySet>>();

	constructor(gateway: RelayQueryGateway) {
		this.#gateway = gateway;
	}

	resolve(publicKey: string): Promise<AuthorRelaySet> {
		const normalizedPublicKey = asHexPubkey(publicKey);
		const cached = this.#cache.get(normalizedPublicKey);
		if (cached) {
			return cached;
		}

		const resolution = this.load(normalizedPublicKey);
		this.#cache.set(normalizedPublicKey, resolution);
		return resolution;
	}

	invalidate(publicKey?: string): void {
		if (publicKey) {
			this.#cache.delete(asHexPubkey(publicKey));
			return;
		}
		this.#cache.clear();
	}

	private async load(publicKey: HexPubkey): Promise<AuthorRelaySet> {
		try {
			const events = await this.#gateway.queryEvents(
				{ kinds: [RELAY_LIST_KIND], authors: [publicKey], limit: 5 },
				{ maxWait: 2_000 }
			);
			const latest = latestEvent(events);
			const parsed = latest ? parseRelayList(latest) : null;
			if (parsed && parsed.writeRelayUrls.length > 0) {
				return {
					publicKey,
					writeRelayUrls: parsed.writeRelayUrls.slice(0, MAX_AUTHOR_RELAYS),
					readRelayUrls: parsed.readRelayUrls.slice(0, MAX_AUTHOR_RELAYS),
					source: "nip-65",
				};
			}
		} catch {
			// The caller receives the controlled bootstrap fallback below.
		}

		return {
			publicKey,
			writeRelayUrls: this.#gateway.relayUrls.slice(0, MAX_AUTHOR_RELAYS),
			readRelayUrls: [],
			source: "fallback",
		};
	}
}

function latestEvent(events: readonly Event[]): Event | null {
	return (
		[...events]
			.filter((event) => event.kind === RELAY_LIST_KIND)
			.sort(
				(first, second) => second.created_at - first.created_at || first.id.localeCompare(second.id)
			)[0] ?? null
	);
}
