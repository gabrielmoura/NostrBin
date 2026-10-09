import presets from "@/features/snippet-editor/language-presets.json";

export interface LanguagePreset {
	language: string;
	label: string;
	highlighter: string;
}

interface LanguagePresetFile {
	extensions: Record<string, LanguagePreset>;
}

const languagePresetFile = presets as LanguagePresetFile;

export function inferLanguagePreset(
	filename: string
): { extension: string; preset: LanguagePreset } | null {
	const extension = extensionFromFilename(filename);
	if (!extension) {
		return null;
	}

	const preset = languagePresetFile.extensions[extension];
	return preset ? { extension, preset } : null;
}

/** Resolves a grammar from protocol metadata, then extension, then filename. */
export function resolveHighlighterLanguage(
	language: string | null | undefined,
	extension: string | null | undefined,
	filename: string | null | undefined
): string | undefined {
	const normalizedLanguage = language?.trim().toLowerCase();
	if (normalizedLanguage) {
		const direct = Object.values(languagePresetFile.extensions).find(
			(preset) =>
				preset.language === normalizedLanguage || preset.highlighter === normalizedLanguage
		);
		if (direct) {
			return direct.highlighter;
		}
	}

	const normalizedExtension = extension?.trim().replace(/^\.+/, "").toLowerCase();
	if (normalizedExtension) {
		const preset = languagePresetFile.extensions[normalizedExtension];
		if (preset) {
			return preset.highlighter;
		}
	}

	return filename ? inferLanguagePreset(filename)?.preset.highlighter : undefined;
}

export function extensionFromFilename(filename: string): string | null {
	const normalized = filename.trim().split(/[\\/]/).pop() ?? "";
	const dotIndex = normalized.lastIndexOf(".");
	if (dotIndex <= 0 || dotIndex === normalized.length - 1) {
		return null;
	}

	return normalized.slice(dotIndex + 1).toLowerCase();
}
