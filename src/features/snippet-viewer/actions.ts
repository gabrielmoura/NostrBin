export function snippetWebUrl(reference: string): string {
	return new URL(`/snippet/${encodeURIComponent(reference)}`, window.location.origin).toString();
}

export function snippetRawUrl(reference: string): string {
	return new URL(
		`/snippet/${encodeURIComponent(reference)}/raw`,
		window.location.origin
	).toString();
}

export async function copyText(value: string): Promise<void> {
	if (!navigator.clipboard?.writeText) {
		throw new Error("Clipboard access is unavailable in this browser.");
	}
	await navigator.clipboard.writeText(value);
}

export async function shareSnippet(reference: string, title: string): Promise<"shared" | "copied"> {
	return shareUrl(snippetWebUrl(reference), title);
}

export async function shareUrl(url: string, title: string): Promise<"shared" | "copied"> {
	if (navigator.share) {
		await navigator.share({ title, url });
		return "shared";
	}

	await copyText(url);
	return "copied";
}

export function openRawContent(content: string): void {
	const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
	window.open(url, "_blank", "noopener,noreferrer");
	window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadSnippet(filename: string, content: string): void {
	const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
