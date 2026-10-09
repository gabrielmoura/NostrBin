import { describe, expect, it } from "vitest";
import {
	MAX_CODE_IMAGE_BYTES,
	MAX_CODE_IMAGE_LINES,
	validateCodeImageContent,
} from "@/features/snippet-viewer/code-image";

describe("code image limits", () => {
	it("accepts a small code snippet", () => {
		expect(validateCodeImageContent("console.log('nostr')")).toBeNull();
	});

	it("rejects content over the explicit byte and line limits", () => {
		expect(validateCodeImageContent("a".repeat(MAX_CODE_IMAGE_BYTES + 1))).toContain("48 KB");
		expect(
			validateCodeImageContent(
				Array.from({ length: MAX_CODE_IMAGE_LINES + 1 }, () => "x").join("\n")
			)
		).toContain("200 lines");
	});
});
