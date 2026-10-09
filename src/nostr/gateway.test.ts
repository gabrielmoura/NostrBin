import type { Event, EventTemplate, Filter } from "nostr-tools";
import { describe, expect, it } from "vitest";
import { NostrGateway, NostrPublishError } from "@/nostr/gateway";
import { RelayRegistry } from "@/nostr/relay-registry";
import type { NostrPool, NostrSigner, NostrSubscription } from "@/nostr/types";
import { asEventId, asHexPubkey } from "@/nostr/validation";
import type { EventCache } from "@/storage/event-cache";

const event = {
	id: "a".repeat(64),
	pubkey: "b".repeat(64),
	created_at: 1,
	kind: 1050,
	tags: [],
	content: "example",
	sig: "c".repeat(128),
} satisfies Event;

class FakePool implements NostrPool {
	readonly publishedRelays: string[][] = [];
	readonly ensuredRelays: string[] = [];
	readonly queriedRelays: string[][] = [];
	queryEvents: Event[] = [];
	shouldReject = false;

	async ensureRelay(relayUrl: string): Promise<void> {
		this.ensuredRelays.push(relayUrl);
	}

	async get(): Promise<Event | null> {
		return event;
	}

	async querySync(relays: string[]): Promise<Event[]> {
		this.queriedRelays.push(relays);
		return this.queryEvents;
	}

	publish(relays: string[]): Promise<string>[] {
		this.publishedRelays.push(relays);
		return relays.map((relay) =>
			this.shouldReject
				? Promise.reject(new Error(`${relay} rejected`))
				: Promise.resolve("accepted")
		);
	}

	subscribeMany(
		_relays: string[],
		_filter: Filter,
		_options: { onevent(event: Event): void }
	): NostrSubscription {
		return { close: () => undefined };
	}

	listConnectionStatus(): Map<string, boolean> {
		return new Map([["wss://relay.example", true]]);
	}

	close(): void {}

	destroy(): void {}
}

const signer: NostrSigner = {
	getPublicKey: async () => asHexPubkey("b".repeat(64)),
	signEvent: async (_template: EventTemplate) => event,
};

class FakeCache implements EventCache {
	readonly values = new Map<string, Event>();
	getCalls = 0;
	async get(eventId: string) {
		this.getCalls += 1;
		const cachedEvent = this.values.get(eventId);
		return cachedEvent ? { event: cachedEvent, cachedAt: 0, relayHints: [] } : null;
	}
	async put(cachedEvent: Event): Promise<void> {
		this.values.set(cachedEvent.id, cachedEvent);
	}
}

describe("NostrGateway", () => {
	it("publishes to every configured relay and retains each outcome", async () => {
		const pool = new FakePool();
		const gateway = new NostrGateway({
			pool,
			relays: new RelayRegistry(["wss://relay.example", "wss://relay-two.example"]),
		});

		const result = await gateway.publish(
			{ kind: 1050, tags: [], content: "example", created_at: 1 },
			signer
		);

		expect(pool.publishedRelays).toEqual([["wss://relay.example", "wss://relay-two.example"]]);
		expect(result.relays).toEqual([
			{ relayUrl: "wss://relay.example", accepted: true },
			{ relayUrl: "wss://relay-two.example", accepted: true },
		]);
	});

	it("fails only after every relay rejects the publication", async () => {
		const pool = new FakePool();
		pool.shouldReject = true;
		const gateway = new NostrGateway({ pool, relays: new RelayRegistry(["wss://relay.example"]) });

		await expect(
			gateway.publish({ kind: 1050, tags: [], content: "example", created_at: 1 }, signer)
		).rejects.toBeInstanceOf(NostrPublishError);
	});

	it("uses a closed reaction subscription filter", () => {
		const pool = new FakePool();
		const gateway = new NostrGateway({ pool, relays: new RelayRegistry(["wss://relay.example"]) });

		expect(() =>
			gateway.subscribeToReactions(asEventId("a".repeat(64)), () => undefined).close()
		).not.toThrow();
	});

	it("only opens relay connections when status is explicitly refreshed", async () => {
		const pool = new FakePool();
		const gateway = new NostrGateway({
			pool,
			relays: new RelayRegistry(["wss://relay.example", "wss://relay-two.example"]),
		});

		await gateway.refreshRelayStatus();

		expect(pool.ensuredRelays).toEqual(["wss://relay.example", "wss://relay-two.example"]);
	});

	it("includes valid nevent relay hints in subsequent queries", async () => {
		const pool = new FakePool();
		const gateway = new NostrGateway({
			pool,
			relays: new RelayRegistry(["wss://relay.example"]),
		});

		gateway.addRelayHints(["wss://relay-hint.example"]);
		await gateway.getEventById(asEventId("a".repeat(64)));

		expect(pool.publishedRelays).toEqual([]);
		expect(gateway.relayUrls).toEqual(["wss://relay.example", "wss://relay-hint.example"]);
	});

	it("returns a cached event without opening a relay query", async () => {
		const pool = new FakePool();
		const cache = new FakeCache();
		cache.values.set(event.id, event);
		const gateway = new NostrGateway({
			pool,
			relays: new RelayRegistry(["wss://relay.example"]),
			cache,
		});

		await expect(gateway.getEventById(asEventId(event.id))).resolves.toEqual(event);
		expect(cache.getCalls).toBe(1);
		expect(pool.queriedRelays).toEqual([]);
	});

	it("runs finite queries against the requested relays and deduplicates event ids", async () => {
		const pool = new FakePool();
		pool.queryEvents = [
			event,
			{ ...event, id: "d".repeat(64), created_at: 2 },
			{ ...event, content: "duplicate" },
		];
		const gateway = new NostrGateway({ pool, relays: new RelayRegistry(["wss://relay.example"]) });

		const events = await gateway.queryEvents(
			{ kinds: [1337], limit: 30 },
			{ relayUrls: ["wss://query.example"], maxWait: 500 }
		);

		expect(pool.queriedRelays).toEqual([["wss://query.example"]]);
		expect(events.map((item) => item.id)).toEqual(["d".repeat(64), "a".repeat(64)]);
	});
});
