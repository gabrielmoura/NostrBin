import { useEffect, useState } from "react";

interface CodePreviewProps {
	content: string;
	language?: string | undefined;
}

interface HighlightedLine {
	html: string;
}

export default function CodePreview({ content, language }: CodePreviewProps) {
	const [lines, setLines] = useState<HighlightedLine[] | null>(null);

	useEffect(() => {
		let active = true;
		setLines(null);

		void import("highlight.js/lib/common").then(({ default: highlighter }) => {
			if (!active) {
				return;
			}

			setLines(
				content.split("\n").map((line) => ({
					html:
						language && highlighter.getLanguage(language)
							? highlighter.highlight(line, { language, ignoreIllegals: true }).value
							: highlighter.highlightAuto(line).value,
				}))
			);
		});

		return () => {
			active = false;
		};
	}, [content, language]);

	if (!lines) {
		return <p className="p-4">Loading preview…</p>;
	}

	return (
		<pre className="code-preview">
			<code className="block min-w-max">
				{lines.map((line, index) => (
					<span className="code-preview-line" key={`${index}-${line.html}`}>
						<span className="code-preview-line-number">{index + 1}</span>
						<span dangerouslySetInnerHTML={{ __html: line.html || " " }} />
					</span>
				))}
			</code>
		</pre>
	);
}
