import type { Event, Filter } from "nostr-tools";
import { describe, expect, it } from "vitest";
import { ProfileResolver } from "@/nostr/profile-resolver";

function profileEvent(publicKey: string, createdAt: number, content: string): Event {
	return {
		id: `${createdAt}`.padStart(64, "0"),
		pubkey: publicKey,
		created_at: createdAt,
		kind: 0,
		tags: [],
		content,
		sig: "c".repeat(128),
	};
}

describe("ProfileResolver", () => {
	it("batches profiles for the same relay set and selects the latest metadata", async () => {
		const firstPublicKey = "a".repeat(64);
		const secondPublicKey = "b".repeat(64);
		const calls: Filter[] = [];
		const resolver = new ProfileResolver({
			queryEvents: async (filter) => {
				calls.push(filter);
				return [
					profileEvent(firstPublicKey, 1, '{"name":"old"}'),
					profileEvent(firstPublicKey, 2, '{"display_name":"Alice","about":"About"}'),
					profileEvent(secondPublicKey, 1, '{"name":"Bob"}'),
				];
			},
		});

		const [first, second] = await Promise.all([
			resolver.resolve(firstPublicKey, ["wss://profile.example"]),
			resolver.resolve(secondPublicKey, ["wss://profile.example"]),
		]);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.authors).toEqual([firstPublicKey, secondPublicKey]);
		expect(first.metadata).toEqual({ displayName: "Alice", about: "About" });
		expect(second.metadata).toEqual({ name: "Bob" });
	});

	it("deduplicates simultaneous profile requests and caches the result", async () => {
		const publicKey = "a".repeat(64);
		let calls = 0;
		const resolver = new ProfileResolver({
			queryEvents: async () => {
				calls += 1;
				return [profileEvent(publicKey, 1, '{"name":"Alice"}')];
			},
		});

		const [first, second] = await Promise.all([
			resolver.resolve(publicKey, ["wss://profile.example"]),
			resolver.resolve(publicKey, ["wss://profile.example"]),
		]);
		const cached = await resolver.resolve(publicKey, ["wss://profile.example"]);

		expect(first).toEqual(second);
		expect(cached).toEqual(first);
		expect(calls).toBe(1);
	});
});
