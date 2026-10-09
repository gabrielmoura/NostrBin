import { nip19 } from "nostr-tools";
import type { EventId, HexPubkey } from "@/nostr/types";

const HEX_32_BYTES = /^[a-f0-9]{64}$/i;

export class NostrInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "NostrInputError";
	}
}

export function asHexPubkey(value: string): HexPubkey {
	if (!HEX_32_BYTES.test(value)) {
		throw new NostrInputError("A public key must be a 64-character hexadecimal value.");
	}

	return value.toLowerCase() as HexPubkey;
}

export function asEventId(value: string): EventId {
	if (!HEX_32_BYTES.test(value)) {
		throw new NostrInputError("An event id must be a 64-character hexadecimal value.");
	}

	return value.toLowerCase() as EventId;
}

export function normalizePublicKey(value: string): HexPubkey {
	const trimmed = value.trim();

	if (trimmed.startsWith("npub1")) {
		const decoded = nip19.decode(trimmed);
		if (decoded.type !== "npub") {
			throw new NostrInputError("The supplied key is not an npub.");
		}

		return asHexPubkey(decoded.data);
	}

	return asHexPubkey(trimmed);
}

export function encodePublicKey(value: HexPubkey): string {
	return nip19.npubEncode(value);
}

export function isRelayUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (url.protocol === "wss:" || url.protocol === "ws:") && url.pathname === "/";
	} catch {
		return false;
	}
}

export function normalizeRelayUrl(value: string): string {
	const url = new URL(value);
	if (url.protocol !== "wss:" && url.protocol !== "ws:") {
		throw new NostrInputError("A relay URL must use ws or wss.");
	}

	if (url.pathname !== "/" || url.search || url.hash) {
		throw new NostrInputError("A relay URL must not contain a path, query string, or hash.");
	}

	return url.toString().replace(/\/$/, "");
}
