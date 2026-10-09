import { CredentialStore, type KeyValueStorage } from "@/nostr/credential-store";
import { LocalKeySigner, Nip07Signer } from "@/nostr/signer";
import type { HexPubkey, NostrSigner } from "@/nostr/types";
import { normalizePublicKey } from "@/nostr/validation";

export type SessionMode = "none" | "public-key" | "local-key" | "nip-07";

export interface SessionSnapshot {
	mode: SessionMode;
	publicKey: HexPubkey | null;
}

export interface GeneratedCredentials {
	publicKey: HexPubkey;
	nsec: string;
}

export class SessionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SessionError";
	}
}

export class NostrSession {
	readonly #credentialStore: CredentialStore;
	readonly #listeners = new Set<() => void>();
	#snapshot: SessionSnapshot = { mode: "none", publicKey: null };
	#signer: NostrSigner | null = null;

	constructor(storage: KeyValueStorage) {
		this.#credentialStore = new CredentialStore(storage);
	}

	get snapshot(): SessionSnapshot {
		return this.#snapshot;
	}

	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	restore(): void {
		const credentials = this.#credentialStore.read();
		if (!credentials) {
			return;
		}

		if (credentials.privateKeyHex) {
			try {
				const signer = LocalKeySigner.fromInput(credentials.privateKeyHex);
				if (signer.publicKey !== credentials.publicKey) {
					throw new SessionError("The saved public and private keys do not match.");
				}

				this.setSnapshot({ mode: "local-key", publicKey: signer.publicKey }, signer);
				return;
			} catch {
				this.#credentialStore.clear();
			}
		}

		this.setSnapshot({ mode: "public-key", publicKey: credentials.publicKey }, null);
	}

	generateLocalKey(): GeneratedCredentials {
		const signer = LocalKeySigner.generate();
		this.#credentialStore.write({
			publicKey: signer.publicKey,
			privateKeyHex: signer.privateKeyHex,
		});
		this.setSnapshot({ mode: "local-key", publicKey: signer.publicKey }, signer);
		return { publicKey: signer.publicKey, nsec: signer.nsec };
	}

	importCredentials(publicKeyInput: string, privateKeyInput: string): HexPubkey {
		const privateKey = privateKeyInput.trim();
		if (privateKey) {
			const signer = LocalKeySigner.fromInput(privateKey);
			const suppliedPublicKey = publicKeyInput.trim()
				? normalizePublicKey(publicKeyInput)
				: signer.publicKey;
			if (suppliedPublicKey !== signer.publicKey) {
				throw new SessionError("The public key does not match the supplied private key.");
			}

			this.#credentialStore.write({
				publicKey: signer.publicKey,
				privateKeyHex: signer.privateKeyHex,
			});
			this.setSnapshot({ mode: "local-key", publicKey: signer.publicKey }, signer);
			return signer.publicKey;
		}

		const publicKey = normalizePublicKey(publicKeyInput);
		this.#credentialStore.write({ publicKey });
		this.setSnapshot({ mode: "public-key", publicKey }, null);
		return publicKey;
	}

	async connectNip07(): Promise<HexPubkey> {
		const signer = new Nip07Signer();
		const publicKey = await signer.getPublicKey();
		this.#credentialStore.write({ publicKey });
		this.setSnapshot({ mode: "nip-07", publicKey }, signer);
		return publicKey;
	}

	getSigner(): NostrSigner {
		if (!this.#signer) {
			throw new SessionError("A signing key or NIP-07 extension is required.");
		}

		return this.#signer;
	}

	logout(): void {
		this.#credentialStore.clear();
		this.setSnapshot({ mode: "none", publicKey: null }, null);
	}

	private setSnapshot(snapshot: SessionSnapshot, signer: NostrSigner | null): void {
		this.#snapshot = snapshot;
		this.#signer = signer;
		for (const listener of this.#listeners) {
			listener();
		}
	}
}
