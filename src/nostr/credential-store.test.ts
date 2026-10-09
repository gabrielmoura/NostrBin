import { describe, expect, it } from "vitest";
import { CredentialStore, type KeyValueStorage } from "@/nostr/credential-store";
import { asHexPubkey } from "@/nostr/validation";

class MemoryStorage implements KeyValueStorage {
	readonly #values = new Map<string, string>();

	getItem(key: string): string | null {
		return this.#values.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.#values.set(key, value);
	}

	removeItem(key: string): void {
		this.#values.delete(key);
	}
}

describe("CredentialStore", () => {
	it("reads the reference application's legacy keys entry", () => {
		const storage = new MemoryStorage();
		const publicKey = "a".repeat(64);
		const privateKey = "b".repeat(64);
		storage.setItem("keys", JSON.stringify([publicKey, privateKey]));

		expect(new CredentialStore(storage).read()).toEqual({
			publicKey: asHexPubkey(publicKey),
			privateKeyHex: privateKey,
		});
	});

	it("prefers versioned credentials and can clear both keys", () => {
		const storage = new MemoryStorage();
		const store = new CredentialStore(storage);
		const publicKey = asHexPubkey("c".repeat(64));

		store.write({ publicKey });
		storage.setItem("keys", JSON.stringify(["a".repeat(64), "b".repeat(64)]));

		expect(store.read()).toEqual({ publicKey });
		store.clear();
		expect(store.read()).toBeNull();
	});
});
