import Markdown from "react-markdown";

interface MarkdownPreviewProps {
	content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
	return <Markdown>{content}</Markdown>;
}
