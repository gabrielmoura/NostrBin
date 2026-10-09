import { describe, expect, it } from "vitest";
import {
	hasEditorValidationErrors,
	isMarkdownFilename,
	validateEditorDraft,
} from "@/features/paste-editor/editor";

describe("paste editor helpers", () => {
	it("selects Markdown preview from a case-insensitive .md filename", () => {
		expect(isMarkdownFilename("README.md")).toBe(true);
		expect(isMarkdownFilename("README.MD")).toBe(true);
		expect(isMarkdownFilename("README.txt")).toBe(false);
	});

	it("reports only the locally invalid fields", () => {
		const validation = validateEditorDraft({ filename: "", content: "" });
		expect(validation).toEqual({
			filename: "You must add a filename.",
			content: "You must add content to post.",
		});
		expect(hasEditorValidationErrors(validation)).toBe(true);
		expect(
			hasEditorValidationErrors(validateEditorDraft({ filename: "paste.txt", content: "ok" }))
		).toBe(false);
	});
});
