import type { Event } from "nostr-tools";
import { describe, expect, it } from "vitest";
import {
	byteLength,
	createSnippetTemplate,
	encodeSnippetReference,
	formatByteSize,
	MAX_SNIPPET_BYTES,
	parseSnippet,
	parseSnippetReference,
	resolveLanguage,
} from "@/nostr/events/snippet";

const snippetEvent = {
	id: "a".repeat(64),
	pubkey: "b".repeat(64),
	created_at: 1,
	kind: 1337,
	content: "const café = 'nostr';\n",
	tags: [
		["l", "typescript"],
		["name", "example.ts"],
		["extension", "ts"],
		["description", "A typed example"],
		["license", "MIT"],
		["dep", "nostr-tools"],
		["dep", "react"],
		["t", "nostr"],
	],
	sig: "c".repeat(128),
} satisfies Event;

describe("NIP-C0 snippet helpers", () => {
	it("serializes the standard metadata tags and an interoperable alt summary", () => {
		const template = createSnippetTemplate(
			{
				name: " hello.ts ",
				content: "console.log('hello')",
				language: " TypeScript ",
				extension: ".ts",
				description: "A hello world",
				runtime: "node v24",
				licenses: ["MIT"],
				dependencies: ["nostr-tools"],
				repository: "https://example.com/repo",
				tags: ["nostr"],
				clientTag: ["client", "NostrBin", "31990:app:descriptor", "wss://relay.example"],
			},
			new Date("2026-10-07T12:00:00Z")
		);

		expect(template).toEqual({
			kind: 1337,
			content: "console.log('hello')",
			created_at: 1_791_374_400,
			tags: [
				["l", "typescript"],
				["name", "hello.ts"],
				["extension", "ts"],
				["description", "A hello world"],
				["runtime", "node v24"],
				["license", "MIT"],
				["dep", "nostr-tools"],
				["repo", "https://example.com/repo"],
				["t", "nostr"],
				["alt", "Code snippet: hello.ts"],
				["client", "NostrBin", "31990:app:descriptor", "wss://relay.example"],
			],
		});
	});

	it("parses metadata and calculates UTF-8 size and lines", () => {
		const snippet = parseSnippet(snippetEvent);

		expect(snippet).toMatchObject({
			metadata: {
				language: "typescript",
				name: "example.ts",
				licenses: ["MIT"],
				dependencies: ["nostr-tools", "react"],
				tags: ["nostr"],
			},
			sizeBytes: byteLength(snippetEvent.content),
			lineCount: 2,
		});
		expect(formatByteSize(823)).toBe("823 B");
		expect(formatByteSize(4_800)).toBe("4.7 KB");
	});

	it("uses language, extension, filename then plaintext in that order", () => {
		expect(
			resolveLanguage([
				["l", "Rust"],
				["extension", "ts"],
				["name", "main.py"],
			])
		).toBe("rust");
		expect(
			resolveLanguage([
				["extension", "go"],
				["name", "main.py"],
			])
		).toBe("go");
		expect(resolveLanguage([["name", "main.py"]])).toBe("py");
		expect(resolveLanguage([])).toBe("plaintext");
	});

	it("does not treat content length as byte length and rejects oversize drafts", () => {
		expect(byteLength("café")).toBe(5);
		expect(() =>
			createSnippetTemplate({ name: "large.txt", content: "a".repeat(MAX_SNIPPET_BYTES + 1) })
		).toThrow("cannot exceed");
		expect(parseSnippet({ ...snippetEvent, kind: 1050 })).toBeNull();
	});

	it("includes a future NIP-40 expiration timestamp when requested", () => {
		const template = createSnippetTemplate(
			{ name: "temporary.txt", content: "expires", expiresAt: 1_800_000_000 },
			new Date("2026-10-08T12:00:00Z")
		);
		expect(template.tags).toContainEqual(["expiration", "1800000000"]);
	});

	it("prefers a portable note reference and still accepts typed nevent input", () => {
		const snippet = parseSnippet(snippetEvent);
		if (!snippet) {
			throw new Error("Fixture must be a snippet.");
		}

		const reference = encodeSnippetReference(snippet.event, ["wss://relay.example"]);
		expect(reference.startsWith("note1")).toBe(true);
		expect(parseSnippetReference(reference)).toEqual({
			eventId: snippetEvent.id,
			relayHints: [],
		});
	});
});
