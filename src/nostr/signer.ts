import type { Event, EventTemplate } from "nostr-tools";
import { finalizeEvent, generateSecretKey, getPublicKey, nip19, verifyEvent } from "nostr-tools";
import { bytesToHex, hexToBytes } from "nostr-tools/utils";
import type { HexPubkey, NostrSigner } from "@/nostr/types";
import { asHexPubkey, NostrInputError } from "@/nostr/validation";

export class LocalKeySigner implements NostrSigner {
	readonly #secretKey: Uint8Array;
	readonly #publicKey: HexPubkey;

	private constructor(secretKey: Uint8Array) {
		this.#secretKey = secretKey;
		this.#publicKey = asHexPubkey(getPublicKey(secretKey));
	}

	static generate(): LocalKeySigner {
		return new LocalKeySigner(generateSecretKey());
	}

	static fromInput(input: string): LocalKeySigner {
		const value = input.trim();
		if (value.startsWith("nsec1")) {
			const decoded = nip19.decode(value);
			if (decoded.type !== "nsec") {
				throw new NostrInputError("The supplied key is not an nsec.");
			}

			return new LocalKeySigner(decoded.data);
		}

		if (!/^[a-f0-9]{64}$/i.test(value)) {
			throw new NostrInputError("A private key must be a 64-character hexadecimal value or nsec.");
		}

		return new LocalKeySigner(hexToBytes(value));
	}

	get publicKey(): HexPubkey {
		return this.#publicKey;
	}

	get nsec(): string {
		return nip19.nsecEncode(this.#secretKey);
	}

	get privateKeyHex(): string {
		return bytesToHex(this.#secretKey);
	}

	async getPublicKey(): Promise<HexPubkey> {
		return this.#publicKey;
	}

	async signEvent(template: EventTemplate): Promise<Event> {
		return finalizeEvent(template, this.#secretKey);
	}
}

export interface Nip07Extension {
	getPublicKey(): Promise<string>;
	signEvent(event: EventTemplate): Promise<Event>;
}

export class Nip07Signer implements NostrSigner {
	readonly #extension: Nip07Extension;

	constructor(extension: Nip07Extension | undefined = getWindowNostr()) {
		if (!extension) {
			throw new NostrInputError("No NIP-07 extension is available.");
		}

		this.#extension = extension;
	}

	async getPublicKey(): Promise<HexPubkey> {
		return asHexPubkey(await this.#extension.getPublicKey());
	}

	async signEvent(template: EventTemplate): Promise<Event> {
		const event = await this.#extension.signEvent(template);
		const publicKey = await this.getPublicKey();
		if (event.pubkey !== publicKey) {
			throw new NostrInputError("The NIP-07 extension signed with an unexpected public key.");
		}

		if (!verifyEvent(event)) {
			throw new NostrInputError("The NIP-07 extension returned an invalid event signature.");
		}

		return event;
	}
}

function getWindowNostr(): Nip07Extension | undefined {
	return typeof window === "undefined" ? undefined : window.nostr;
}
