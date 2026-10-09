import type { KeyValueStorage } from "@/nostr/credential-store";

const CLIENT_IDENTIFICATION_STORAGE_KEY = "nostrbin.publication.identify-client";

export interface PublicationSettingsSnapshot {
	identifyClient: boolean;
}

export class PublicationSettingsStore {
	readonly #storage: KeyValueStorage;
	readonly #listeners = new Set<() => void>();
	#snapshot: PublicationSettingsSnapshot;

	constructor(storage: KeyValueStorage) {
		this.#storage = storage;
		this.#snapshot = {
			identifyClient: storage.getItem(CLIENT_IDENTIFICATION_STORAGE_KEY) !== "false",
		};
	}

	get snapshot(): PublicationSettingsSnapshot {
		return this.#snapshot;
	}

	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	setIdentifyClient(identifyClient: boolean): void {
		if (this.#snapshot.identifyClient === identifyClient) {
			return;
		}

		this.#storage.setItem(CLIENT_IDENTIFICATION_STORAGE_KEY, identifyClient ? "true" : "false");
		this.#snapshot = { identifyClient };
		for (const listener of this.#listeners) {
			listener();
		}
	}
}
