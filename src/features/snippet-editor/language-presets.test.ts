import { describe, expect, it } from "vitest";
import {
	extensionFromFilename,
	inferLanguagePreset,
	resolveHighlighterLanguage,
} from "@/features/snippet-editor/language-presets";

describe("language presets", () => {
	it("derives the extension and Go language from a filename", () => {
		expect(inferLanguagePreset("example.go")).toEqual({
			extension: "go",
			preset: { language: "go", label: "Go", highlighter: "go" },
		});
	});

	it("uses the final extension and ignores files without one", () => {
		expect(extensionFromFilename("archive.backup.ts")).toBe("ts");
		expect(extensionFromFilename("README")).toBeNull();
		expect(extensionFromFilename(".env")).toBeNull();
	});

	it("uses filename extension when protocol language and extension are absent", () => {
		expect(resolveHighlighterLanguage("typescript", "ts", "example.go")).toBe("typescript");
		expect(resolveHighlighterLanguage(undefined, undefined, "example.go")).toBe("go");
		expect(resolveHighlighterLanguage(undefined, undefined, "README")).toBeUndefined();
	});
});
