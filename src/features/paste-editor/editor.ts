export interface EditorDraft {
	filename: string;
	content: string;
}

export interface EditorValidation {
	filename?: string;
	content?: string;
}

export function isMarkdownFilename(filename: string): boolean {
	return filename.trim().toLowerCase().endsWith(".md");
}

export function validateEditorDraft({ filename, content }: EditorDraft): EditorValidation {
	return {
		...(filename.trim() ? {} : { filename: "You must add a filename." }),
		...(content ? {} : { content: "You must add content to post." }),
	};
}

export function hasEditorValidationErrors(validation: EditorValidation): boolean {
	return Boolean(validation.filename || validation.content);
}
