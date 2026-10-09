export const MAX_CODE_IMAGE_BYTES = 48 * 1024;
export const MAX_CODE_IMAGE_LINES = 200;

interface CodeImageRequest {
	filename: string;
	content: string;
	language?: string | undefined;
}

interface ColoredToken {
	text: string;
	color: string;
}

const theme = {
	background: "#08111f",
	border: "#1d3a56",
	defaultText: "#e8eef5",
	gutter: "#587089",
	header: "#102a46",
	label: "#8fa6ba",
};

export function validateCodeImageContent(content: string): string | null {
	const size = new TextEncoder().encode(content).byteLength;
	if (size > MAX_CODE_IMAGE_BYTES) {
		return `Images are limited to ${MAX_CODE_IMAGE_BYTES / 1024} KB of UTF-8 code.`;
	}
	if (content.split("\n").length > MAX_CODE_IMAGE_LINES) {
		return `Images are limited to ${MAX_CODE_IMAGE_LINES} lines.`;
	}
	return null;
}

export async function exportCodeImage({
	content,
	filename,
	language,
}: CodeImageRequest): Promise<void> {
	const validationError = validateCodeImageContent(content);
	if (validationError) {
		throw new Error(validationError);
	}

	const { default: highlighter } = await import("highlight.js/lib/common");
	const highlighted =
		language && highlighter.getLanguage(language)
			? highlighter.highlight(content, { language, ignoreIllegals: true }).value
			: highlighter.highlightAuto(content).value;
	const lines = tokenizeHighlightedHtml(highlighted);
	const canvas = createCanvas(lines, filename, language ?? "plaintext");
	const blob = await canvasToBlob(canvas);
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.download = `${imageFilename(filename)}.png`;
	link.href = url;
	link.click();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function createCanvas(
	lines: ColoredToken[][],
	filename: string,
	language: string
): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	const font = "14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
	const lineHeight = 24;
	const horizontalPadding = 28;
	const gutterWidth = 58;
	const headerHeight = 54;
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Your browser cannot create a code image.");
	}

	context.font = font;
	const codeWidth = Math.max(
		560,
		...lines.map((line) =>
			line.reduce((width, token) => width + context.measureText(token.text).width, 0)
		)
	);
	canvas.width = Math.min(2_000, Math.ceil(codeWidth + gutterWidth + horizontalPadding * 2));
	canvas.height =
		headerHeight + horizontalPadding + Math.max(1, lines.length) * lineHeight + horizontalPadding;

	context.fillStyle = theme.background;
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = theme.header;
	context.fillRect(0, 0, canvas.width, headerHeight);
	context.strokeStyle = theme.border;
	context.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
	context.beginPath();
	context.moveTo(0, headerHeight + 0.5);
	context.lineTo(canvas.width, headerHeight + 0.5);
	context.stroke();

	context.font = "600 14px ui-sans-serif, system-ui, sans-serif";
	context.fillStyle = theme.defaultText;
	context.fillText(filename || "snippet.txt", horizontalPadding, 33);
	context.font = "12px ui-sans-serif, system-ui, sans-serif";
	context.fillStyle = theme.label;
	const languageWidth = context.measureText(language).width;
	context.fillText(language, canvas.width - horizontalPadding - languageWidth, 33);

	context.font = font;
	for (const [lineIndex, line] of lines.entries()) {
		const y = headerHeight + horizontalPadding + lineIndex * lineHeight;
		context.fillStyle = theme.gutter;
		context.textAlign = "right";
		context.fillText(String(lineIndex + 1), gutterWidth, y);
		context.textAlign = "left";
		let x = gutterWidth + horizontalPadding;
		for (const token of line) {
			context.fillStyle = token.color;
			context.fillText(token.text, x, y);
			x += context.measureText(token.text).width;
		}
	}

	return canvas;
}

function tokenizeHighlightedHtml(html: string): ColoredToken[][] {
	const documentFragment = new DOMParser().parseFromString(`<pre>${html}</pre>`, "text/html");
	const lines: ColoredToken[][] = [[]];
	const root = documentFragment.querySelector("pre");
	if (!root) {
		return lines;
	}

	const visit = (node: Node, inheritedColor: string): void => {
		if (node.nodeType === Node.TEXT_NODE) {
			for (const fragment of (node.textContent ?? "").split("\n")) {
				const currentLine = lines.at(-1);
				if (currentLine && fragment) {
					currentLine.push({ text: fragment, color: inheritedColor });
				}
				if (fragment !== (node.textContent ?? "").split("\n").at(-1)) {
					lines.push([]);
				}
			}
			return;
		}

		if (node.nodeType !== Node.ELEMENT_NODE) {
			return;
		}
		const element = node as Element;
		const color = colorForClasses([...element.classList], inheritedColor);
		for (const child of element.childNodes) {
			visit(child, color);
		}
	};

	for (const child of root.childNodes) {
		visit(child, theme.defaultText);
	}
	return lines;
}

function colorForClasses(classes: readonly string[], fallback: string): string {
	if (classes.some((name) => name.includes("comment"))) return "#607d8e";
	if (classes.some((name) => name.includes("string") || name.includes("meta"))) return "#a7d46f";
	if (classes.some((name) => name.includes("keyword") || name.includes("literal")))
		return "#ff7b96";
	if (classes.some((name) => name.includes("number") || name.includes("symbol"))) return "#f2b84b";
	if (classes.some((name) => name.includes("title") || name.includes("function"))) return "#39c6e8";
	if (classes.some((name) => name.includes("type") || name.includes("built_in"))) return "#69b7ff";
	return fallback;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) {
				resolve(blob);
				return;
			}
			reject(new Error("Unable to encode this code image."));
		}, "image/png");
	});
}

function imageFilename(filename: string): string {
	const normalized = filename.trim().replace(/[\\/:*?"<>|]+/g, "-");
	return normalized || "snippet";
}
