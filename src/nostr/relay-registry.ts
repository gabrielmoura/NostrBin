import { normalizeRelayUrl } from "@/nostr/validation";

export const BOOTSTRAP_RELAY_URLS = [
	"wss://relay.nostrbin.com",
	"wss://eden.nostr.land",
	"wss://relay.damus.io",
	"wss://relay.snort.social",
	"wss://relay.current.fyi",
	"wss://nostr.oxtr.dev",
	"wss://atlas.nostr.land",
	"wss://nostr.zebedee.cloud",
	"wss://relay.orangepill.dev",
	"wss://nostr.fmt.wiz.biz",
	"wss://nostr.wine",
] as const;

/** Controlled public relays used only for finite snippet discovery queries. */
export const DISCOVERY_RELAY_URLS: readonly string[] = BOOTSTRAP_RELAY_URLS.slice(0, 3);

export interface RelayStatus {
	url: string;
	connected: boolean;
}

export class RelayRegistry {
	#urls: string[];

	constructor(urls: readonly string[] = BOOTSTRAP_RELAY_URLS) {
		const normalizedUrls = urls.map(normalizeRelayUrl);
		this.#urls = [...new Set(normalizedUrls)];
	}

	get urls(): readonly string[] {
		return this.#urls;
	}

	add(urls: readonly string[]): void {
		const normalizedUrls = urls.map(normalizeRelayUrl);
		this.#urls = [...new Set([...this.#urls, ...normalizedUrls])];
	}

	getStatus(connectionStatus: ReadonlyMap<string, boolean>): RelayStatus[] {
		return this.#urls.map((url) => ({ url, connected: connectionStatus.get(url) ?? false }));
	}
}
