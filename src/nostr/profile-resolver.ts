import type { Event, Filter } from "nostr-tools";
import { parseProfileMetadata } from "@/nostr/profile";
import { type HexPubkey, PROFILE_KIND, type ProfileMetadata } from "@/nostr/types";
import { asHexPubkey, normalizeRelayUrl } from "@/nostr/validation";

const PROFILE_CACHE_TTL_MS = 10 * 60 * 1_000;

export interface ResolvedProfile {
	publicKey: HexPubkey;
	metadata: ProfileMetadata;
	found: boolean;
}

interface ProfileQueryGateway {
	queryEvents(
		filter: Filter,
		options?: { relayUrls?: readonly string[]; maxWait?: number }
	): Promise<Event[]>;
}

interface CachedProfile {
	profile: ResolvedProfile;
	expiresAt: number;
}

interface DeferredProfile {
	promise: Promise<ResolvedProfile>;
	resolve(profile: ResolvedProfile): void;
}

interface PendingBatch {
	relayUrls: readonly string[];
	deferredByPublicKey: Map<HexPubkey, DeferredProfile>;
}

export class ProfileResolver {
	readonly #gateway: ProfileQueryGateway;
	readonly #cache = new Map<HexPubkey, CachedProfile>();
	readonly #pendingByRelayKey = new Map<string, PendingBatch>();
	readonly #now: () => number;

	constructor(gateway: ProfileQueryGateway, now: () => number = Date.now) {
		this.#gateway = gateway;
		this.#now = now;
	}

	resolve(publicKey: string, relayUrls: readonly string[]): Promise<ResolvedProfile> {
		const normalizedPublicKey = asHexPubkey(publicKey);
		const cached = this.#cache.get(normalizedPublicKey);
		if (cached && cached.expiresAt > this.#now()) {
			return Promise.resolve(cached.profile);
		}

		const normalizedRelayUrls = [...new Set(relayUrls.map(normalizeRelayUrl))];
		const relayKey = normalizedRelayUrls.join("|");
		let pending = this.#pendingByRelayKey.get(relayKey);
		if (!pending) {
			pending = { relayUrls: normalizedRelayUrls, deferredByPublicKey: new Map() };
			this.#pendingByRelayKey.set(relayKey, pending);
			queueMicrotask(() => void this.flush(relayKey));
		}

		const existing = pending.deferredByPublicKey.get(normalizedPublicKey);
		if (existing) {
			return existing.promise;
		}

		const deferred = createDeferredProfile();
		pending.deferredByPublicKey.set(normalizedPublicKey, deferred);
		return deferred.promise;
	}

	invalidate(publicKey?: string): void {
		if (publicKey) {
			this.#cache.delete(asHexPubkey(publicKey));
			return;
		}
		this.#cache.clear();
	}

	private async flush(relayKey: string): Promise<void> {
		const pending = this.#pendingByRelayKey.get(relayKey);
		if (!pending) {
			return;
		}
		this.#pendingByRelayKey.delete(relayKey);

		const publicKeys = [...pending.deferredByPublicKey.keys()];
		let profiles = new Map<HexPubkey, ResolvedProfile>();
		try {
			const events = await this.#gateway.queryEvents(
				{ kinds: [PROFILE_KIND], authors: publicKeys, limit: publicKeys.length },
				{ relayUrls: pending.relayUrls, maxWait: 2_000 }
			);
			profiles = profilesByPublicKey(events, publicKeys);
		} catch {
			profiles = new Map();
		}

		for (const publicKey of publicKeys) {
			const profile = profiles.get(publicKey) ?? { publicKey, metadata: {}, found: false };
			this.#cache.set(publicKey, { profile, expiresAt: this.#now() + PROFILE_CACHE_TTL_MS });
			pending.deferredByPublicKey.get(publicKey)?.resolve(profile);
		}
	}
}

function profilesByPublicKey(
	events: readonly Event[],
	requestedPublicKeys: readonly HexPubkey[]
): Map<HexPubkey, ResolvedProfile> {
	const requested = new Set(requestedPublicKeys);
	const latestByPublicKey = new Map<HexPubkey, Event>();
	for (const event of events) {
		if (event.kind !== PROFILE_KIND) {
			continue;
		}

		let publicKey: HexPubkey;
		try {
			publicKey = asHexPubkey(event.pubkey);
		} catch {
			continue;
		}
		if (!requested.has(publicKey)) {
			continue;
		}

		const current = latestByPublicKey.get(publicKey);
		if (
			!current ||
			event.created_at > current.created_at ||
			(event.created_at === current.created_at && event.id > current.id)
		) {
			latestByPublicKey.set(publicKey, event);
		}
	}

	return new Map(
		[...latestByPublicKey].map(([publicKey, event]) => [
			publicKey,
			{ publicKey, metadata: parseProfileMetadata(event.content), found: true },
		])
	);
}

function createDeferredProfile(): DeferredProfile {
	let resolveProfile: ((profile: ResolvedProfile) => void) | undefined;
	const promise = new Promise<ResolvedProfile>((resolve) => {
		resolveProfile = resolve;
	});

	return {
		promise,
		resolve(profile) {
			resolveProfile?.(profile);
		},
	};
}
