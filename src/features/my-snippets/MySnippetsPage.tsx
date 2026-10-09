import type { Event } from "nostr-tools";
import { useEffect, useState } from "react";
import { useAppShell } from "@/app/AppShell";
import { useNostrSession } from "@/app/NostrSessionProvider";
import { Button } from "@/components/ui/button";
import { encodePasteReference, getPasteFilename } from "@/nostr/events/paste";
import { encodeSnippetReference, formatByteSize, parseSnippet } from "@/nostr/events/snippet";
import type { Snippet } from "@/nostr/types";
import { asEventId } from "@/nostr/validation";

type MySnippetsState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "loaded"; items: SnippetListItem[] };

type SnippetListItem =
	| { type: "nip-c0"; snippet: Snippet; relayHints: readonly string[] }
	| { type: "legacy"; event: Event; relayHints: readonly string[] };

const MY_SNIPPETS_LIMIT = 100;

export function MySnippetsPage() {
	const { currentUserRelays, gateway, session } = useNostrSession();
	const { openAccountDialog } = useAppShell();
	const [state, setState] = useState<MySnippetsState>({ status: "idle" });

	useEffect(() => {
		if (!session.publicKey) {
			setState({ status: "idle" });
			return;
		}

		let active = true;
		setState({ status: "loading" });
		const relayUrls =
			currentUserRelays && currentUserRelays.readRelayUrls.length > 0
				? currentUserRelays.readRelayUrls
				: (currentUserRelays?.writeRelayUrls ?? gateway.relayUrls);
		void gateway
			.queryEvents(
				{ kinds: [1050, 1337], authors: [session.publicKey], limit: MY_SNIPPETS_LIMIT },
				{ relayUrls, maxWait: 3_000 }
			)
			.then(
				(events) => {
					if (active) {
						setState({
							status: "loaded",
							items: events.map((event) => {
								const snippet = parseSnippet(event);
								return snippet
									? { type: "nip-c0", snippet, relayHints: relayUrls }
									: { type: "legacy", event, relayHints: relayUrls };
							}),
						});
					}
				},
				(reason: unknown) => {
					if (active) {
						setState({ status: "error", message: errorMessage(reason) });
					}
				}
			);

		return () => {
			active = false;
		};
	}, [currentUserRelays, gateway, session.publicKey]);

	if (!session.publicKey) {
		return (
			<section className="mx-auto mt-16 max-w-xl text-center">
				<h1 className="text-4xl">Your snippets</h1>
				<p className="mt-3">
					Connect a Nostr signer to load the snippets published by your identity.
				</p>
				<Button className="mt-6 w-auto px-4 text-base" onClick={openAccountDialog}>
					Connect account
				</Button>
			</section>
		);
	}

	return (
		<section className="mx-auto max-w-4xl">
			<h1 className="text-4xl md:text-5xl">Your snippets</h1>
			<p className="mt-2">
				Recent NIP-C0 snippets and legacy NostrBin pastes found through your relays.
			</p>
			{state.status === "loading" ? <p className="mt-8">Loading your snippets…</p> : null}
			{state.status === "error" ? (
				<p className="mt-8" role="alert">
					{state.message}
				</p>
			) : null}
			{state.status === "loaded" && state.items.length === 0 ? (
				<p className="mt-8">No snippets found on the selected relays.</p>
			) : null}
			{state.status === "loaded" && state.items.length > 0 ? (
				<ul className="mt-6 divide-y divide-current border-y border-current">
					{state.items.map((item) => (
						<MySnippetListItem
							item={item}
							key={item.type === "nip-c0" ? item.snippet.event.id : item.event.id}
						/>
					))}
				</ul>
			) : null}
		</section>
	);
}

function MySnippetListItem({ item }: { item: SnippetListItem }) {
	if (item.type === "legacy") {
		const filename = getPasteFilename(item.event.tags) ?? "paste.txt";
		return (
			<li className="py-5">
				<a
					className="block no-underline"
					href={`/${encodeURIComponent(encodePasteReference(asEventId(item.event.id), item.relayHints))}`}
				>
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<h2 className="break-all text-xl">{filename}</h2>
						<span className="text-sm">Legacy NostrBin paste</span>
						<span className="text-sm">
							{new Date(item.event.created_at * 1_000).toLocaleDateString()}
						</span>
					</div>
					<pre className="mt-3 max-h-32 overflow-hidden whitespace-pre-wrap text-sm">
						{preview(item.event.content)}
					</pre>
				</a>
			</li>
		);
	}

	const { snippet } = item;
	const filename = snippet.metadata.name ?? `snippet.${snippet.metadata.extension ?? "txt"}`;
	const reference = encodeSnippetReference(snippet.event, item.relayHints);
	return (
		<li className="py-5">
			<a className="block no-underline" href={`/snippet/${encodeURIComponent(reference)}`}>
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<h2 className="break-all text-xl">{filename}</h2>
					<span className="text-sm">{snippet.metadata.language}</span>
					<span className="text-sm">{formatByteSize(snippet.sizeBytes)}</span>
					<span className="text-sm">
						{new Date(snippet.event.created_at * 1_000).toLocaleDateString()}
					</span>
				</div>
				{snippet.metadata.description ? (
					<p className="mt-2">{snippet.metadata.description}</p>
				) : null}
				<pre className="mt-3 max-h-32 overflow-hidden whitespace-pre-wrap text-sm">
					{preview(snippet.event.content)}
				</pre>
			</a>
		</li>
	);
}

function preview(content: string): string {
	const lines = content.split("\n").slice(0, 12).join("\n");
	return lines.length > 1_500 ? `${lines.slice(0, 1_500)}…` : lines;
}

function errorMessage(reason: unknown): string {
	return reason instanceof Error ? reason.message : "Unable to load your snippets.";
}
