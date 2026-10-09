import { describe, expect, it } from "vitest";
import { LocalKeySigner, Nip07Signer } from "@/nostr/signer";

describe("signers", () => {
	it("generates and signs with a local nsec-compatible signer", async () => {
		const signer = LocalKeySigner.generate();
		const restoredSigner = LocalKeySigner.fromInput(signer.nsec);
		const event = await restoredSigner.signEvent({
			kind: 1050,
			content: "test",
			created_at: 1,
			tags: [],
		});

		await expect(restoredSigner.getPublicKey()).resolves.toBe(signer.publicKey);
		expect(event.pubkey).toBe(signer.publicKey);
		expect(event.sig).toHaveLength(128);
	});

	it("rejects an unavailable NIP-07 extension", () => {
		expect(() => new Nip07Signer(undefined)).toThrow("No NIP-07 extension is available");
	});
});
