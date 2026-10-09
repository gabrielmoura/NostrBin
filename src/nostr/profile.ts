import type { ProfileMetadata } from "@/nostr/types";
import { asHexPubkey } from "@/nostr/validation";

export function parseProfileMetadata(content: string): ProfileMetadata {
	try {
		const data: unknown = JSON.parse(content);
		if (!data || typeof data !== "object" || Array.isArray(data)) {
			return {};
		}

		const record = data as Record<string, unknown>;
		return withoutUndefined({
			name: asOptionalString(record["name"]),
			displayName: asOptionalString(record["display_name"]),
			picture: asOptionalString(record["picture"]),
			nip05: asOptionalString(record["nip05"]),
			about: asOptionalString(record["about"]),
		});
	} catch {
		return {};
	}
}

export async function verifyNip05(
	identifier: string,
	pubkey: string,
	fetchImplementation: typeof fetch = fetch
): Promise<boolean> {
	const [name, domain, ...extraParts] = identifier.trim().split("@");
	if (!name || !domain || extraParts.length > 0) {
		return false;
	}

	const expectedPubkey = asHexPubkey(pubkey);
	const url = new URL(`https://${domain}/.well-known/nostr.json`);
	url.searchParams.set("name", name);

	const response = await fetchImplementation(url, { redirect: "error" });
	if (!response.ok) {
		return false;
	}

	const responseBody: unknown = await response.json();
	if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
		return false;
	}

	const names = (responseBody as Record<string, unknown>)["names"];
	if (!names || typeof names !== "object" || Array.isArray(names)) {
		return false;
	}

	const suppliedPubkey = (names as Record<string, unknown>)[name];
	return typeof suppliedPubkey === "string" && suppliedPubkey.toLowerCase() === expectedPubkey;
}

function asOptionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value : undefined;
}

function withoutUndefined(values: Record<string, string | undefined>): ProfileMetadata {
	return Object.fromEntries(
		Object.entries(values).filter((entry): entry is [string, string] => entry[1] !== undefined)
	) as ProfileMetadata;
}
