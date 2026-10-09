import type { HexPubkey } from "@/nostr/types";
import { normalizePublicKey } from "@/nostr/validation";

const CREDENTIALS_KEY = "nostrbin.credentials";
const LEGACY_CREDENTIALS_KEY = "keys";

interface CredentialsPayload {
	version: 1;
	publicKey: string;
	privateKeyHex?: string;
}

export interface StoredCredentials {
	publicKey: HexPubkey;
	privateKeyHex?: string;
}

export interface KeyValueStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export class CredentialStore {
	readonly #storage: KeyValueStorage;

	constructor(storage: KeyValueStorage) {
		this.#storage = storage;
	}

	read(): StoredCredentials | null {
		return this.readVersioned() ?? this.readLegacy();
	}

	write(credentials: StoredCredentials): void {
		const payload: CredentialsPayload = {
			version: 1,
			publicKey: credentials.publicKey,
			...(credentials.privateKeyHex ? { privateKeyHex: credentials.privateKeyHex } : {}),
		};
		this.#storage.setItem(CREDENTIALS_KEY, JSON.stringify(payload));
	}

	clear(): void {
		this.#storage.removeItem(CREDENTIALS_KEY);
		this.#storage.removeItem(LEGACY_CREDENTIALS_KEY);
	}

	private readVersioned(): StoredCredentials | null {
		const rawValue = this.#storage.getItem(CREDENTIALS_KEY);
		if (!rawValue) {
			return null;
		}

		try {
			const payload: unknown = JSON.parse(rawValue);
			if (!isCredentialsPayload(payload)) {
				return null;
			}

			return {
				publicKey: normalizePublicKey(payload.publicKey),
				...(isPrivateKeyHex(payload.privateKeyHex) ? { privateKeyHex: payload.privateKeyHex } : {}),
			};
		} catch {
			return null;
		}
	}

	private readLegacy(): StoredCredentials | null {
		const rawValue = this.#storage.getItem(LEGACY_CREDENTIALS_KEY);
		if (!rawValue) {
			return null;
		}

		try {
			const value: unknown = JSON.parse(rawValue);
			if (!Array.isArray(value) || typeof value[0] !== "string" || typeof value[1] !== "string") {
				return null;
			}

			const privateKeyHex = isPrivateKeyHex(value[1]) ? value[1] : undefined;
			return {
				publicKey: normalizePublicKey(value[0]),
				...(privateKeyHex ? { privateKeyHex } : {}),
			};
		} catch {
			return null;
		}
	}
}

function isCredentialsPayload(value: unknown): value is CredentialsPayload {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const payload = value as Record<string, unknown>;
	return payload["version"] === 1 && typeof payload["publicKey"] === "string";
}

function isPrivateKeyHex(value: unknown): value is string {
	return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}
