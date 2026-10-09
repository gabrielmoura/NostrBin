import { describe, expect, it } from "vitest";
import type { KeyValueStorage } from "@/nostr/credential-store";
import { NostrSession } from "@/nostr/session";

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

describe("NostrSession", () => {
	it("generates a local signer and restores it from storage", async () => {
		const storage = new MemoryStorage();
		const session = new NostrSession(storage);
		const { publicKey } = session.generateLocalKey();

		expect(session.snapshot).toEqual({ mode: "local-key", publicKey });
		await expect(session.getSigner().getPublicKey()).resolves.toBe(publicKey);

		const restoredSession = new NostrSession(storage);
		restoredSession.restore();
		expect(restoredSession.snapshot).toEqual({ mode: "local-key", publicKey });
	});

	it("rejects mismatched imported public and private keys", () => {
		const sourceSession = new NostrSession(new MemoryStorage());
		const { publicKey } = sourceSession.generateLocalKey();
		const targetSession = new NostrSession(new MemoryStorage());

		expect(() => targetSession.importCredentials("a".repeat(64), "b".repeat(64))).toThrow(
			"The public key does not match"
		);
		expect(publicKey).not.toBe("a".repeat(64));
	});

	it("stores a watch-only public key without exposing a signer", () => {
		const session = new NostrSession(new MemoryStorage());
		const publicKey = session.importCredentials("c".repeat(64), "");

		expect(session.snapshot).toEqual({ mode: "public-key", publicKey });
		expect(() => session.getSigner()).toThrow("A signing key or NIP-07 extension is required");
	});
});
