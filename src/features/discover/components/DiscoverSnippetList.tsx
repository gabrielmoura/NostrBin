import { encodeSnippetReference } from "@/nostr/events/snippet";
import type { Snippet } from "@/nostr/types";
import { asHexPubkey, encodePublicKey } from "@/nostr/validation";

interface DiscoverSnippetListProps {
	snippets: readonly Snippet[];
}

/** Presentation-only list. It deliberately has no relay or subscription logic. */
export function DiscoverSnippetList({ snippets }: DiscoverSnippetListProps) {
	return (
		<ul className="discover-list">
			{snippets.map((snippet) => (
				<DiscoverSnippetListItem key={snippet.event.id} snippet={snippet} />
			))}
		</ul>
	);
}

function DiscoverSnippetListItem({ snippet }: { snippet: Snippet }) {
	const filename = snippet.metadata.name ?? `snippet.${snippet.metadata.extension ?? "txt"}`;
	const reference = encodeSnippetReference(snippet.event, []);
	const npub = encodePublicKey(asHexPubkey(snippet.event.pubkey));
	const topics = snippet.metadata.tags.slice(0, 3);

	return (
		<li>
			<a aria-label={`Open ${filename}`} href={`/snippet/${encodeURIComponent(reference)}`}>
				<div className="discover-item-heading">
					<span aria-hidden="true" className="discover-file-icon">
						&lt;/&gt;
					</span>
					<div className="min-w-0 flex-1">
						<strong>{filename}</strong>
						<p>
							{shortNpub(npub)} <span aria-hidden="true">·</span>{" "}
							{relativeTime(snippet.event.created_at)}
						</p>
					</div>
					<span className="language-badge">{snippet.metadata.language}</span>
				</div>
				{snippet.metadata.description ? (
					<p className="discover-description">{snippet.metadata.description}</p>
				) : null}
				<pre className="discover-code-preview">{preview(snippet.event.content)}</pre>
				<div className="discover-item-footer">
					<span>{formatSnippetSize(snippet.sizeBytes)}</span>
					{topics.map((topic) => (
						<span className="discover-topic" key={topic}>
							#{topic}
						</span>
					))}
					<span className="discover-open">View snippet →</span>
				</div>
			</a>
		</li>
	);
}

function formatSnippetSize(size: number): string {
	return size < 1_024 ? `${size} B` : `${(size / 1_024).toFixed(1)} KB`;
}

function preview(content: string): string {
	const value = content.split("\n").slice(0, 8).join("\n");
	return value.length > 1_000 ? `${value.slice(0, 1_000)}…` : value;
}

function relativeTime(createdAt: number): string {
	const minutes = Math.max(0, Math.floor((Date.now() / 1_000 - createdAt) / 60));
	return minutes < 60
		? `${minutes}m ago`
		: minutes < 1_440
			? `${Math.floor(minutes / 60)}h ago`
			: `${Math.floor(minutes / 1_440)}d ago`;
}

function shortNpub(npub: string): string {
	return `${npub.slice(0, 13)}…${npub.slice(-5)}`;
}
