import type { Event } from "nostr-tools";
import type { EventId } from "@/nostr/types";
import { asEventId } from "@/nostr/validation";

const DATABASE_NAME = "nostrbin-event-cache";
const STORE_NAME = "events";
const DATABASE_VERSION = 1;

export interface CachedEvent {
	event: Event;
	cachedAt: number;
	relayHints: readonly string[];
}

interface CachedEventRecord extends CachedEvent {
	id: string;
}

export interface EventCache {
	get(eventId: EventId): Promise<CachedEvent | null>;
	put(event: Event, relayHints?: readonly string[]): Promise<void>;
}

/** Persistent browser cache for fetched Nostr events, with a safe memory fallback. */
export class BrowserEventCache implements EventCache {
	readonly #memory = new Map<EventId, CachedEvent>();
	readonly #database: Promise<IDBDatabase | null>;

	constructor() {
		this.#database = openDatabase();
	}

	async get(eventId: EventId): Promise<CachedEvent | null> {
		const normalizedId = asEventId(eventId);
		const memoryValue = this.#memory.get(normalizedId);
		if (memoryValue) {
			return memoryValue;
		}

		const database = await this.#database;
		if (!database) {
			return null;
		}
		try {
			const record = await request<CachedEventRecord | undefined>(
				database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(normalizedId)
			);
			if (!record) {
				return null;
			}
			const cached = {
				event: record.event,
				cachedAt: record.cachedAt,
				relayHints: record.relayHints,
			};
			this.#memory.set(normalizedId, cached);
			return cached;
		} catch {
			return null;
		}
	}

	async put(event: Event, relayHints: readonly string[] = []): Promise<void> {
		const eventId = asEventId(event.id);
		const existing = await this.get(eventId);
		const cached: CachedEvent = {
			event,
			cachedAt: Date.now(),
			relayHints: [...new Set([...(existing?.relayHints ?? []), ...relayHints])],
		};
		this.#memory.set(eventId, cached);

		const database = await this.#database;
		if (!database) {
			return;
		}
		try {
			await request(
				database
					.transaction(STORE_NAME, "readwrite")
					.objectStore(STORE_NAME)
					.put({ id: eventId, ...cached } satisfies CachedEventRecord)
			);
		} catch {
			// A quota or private-browsing failure leaves the in-memory entry usable.
		}
	}
}

async function openDatabase(): Promise<IDBDatabase | null> {
	if (typeof indexedDB === "undefined") {
		return null;
	}
	try {
		return await new Promise<IDBDatabase>((resolve, reject) => {
			const openRequest = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
			openRequest.onupgradeneeded = () => {
				if (!openRequest.result.objectStoreNames.contains(STORE_NAME)) {
					openRequest.result.createObjectStore(STORE_NAME, { keyPath: "id" });
				}
			};
			openRequest.onsuccess = () => resolve(openRequest.result);
			openRequest.onerror = () => reject(openRequest.error);
		});
	} catch {
		return null;
	}
}

function request<T = undefined>(idbRequest: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		idbRequest.onsuccess = () => resolve(idbRequest.result);
		idbRequest.onerror = () => reject(idbRequest.error);
	});
}
