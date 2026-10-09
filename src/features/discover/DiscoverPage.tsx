import { useEffect, useMemo, useState } from "react";
import { useNostrSession } from "@/app/NostrSessionProvider";
import { Button } from "@/components/ui/button";
import { DiscoverFilters } from "@/features/discover/components/DiscoverFilters";
import { DiscoverSnippetList } from "@/features/discover/components/DiscoverSnippetList";
import { parseSnippet } from "@/nostr/events/snippet";
import { DISCOVERY_RELAY_URLS } from "@/nostr/relay-registry";
import type { Snippet } from "@/nostr/types";

const PAGE_SIZE = 30;

type DiscoverState =
	| { status: "loading"; snippets: Snippet[] }
	| { status: "loaded"; snippets: Snippet[]; hasMore: boolean }
	| { status: "error"; snippets: Snippet[]; message: string };

export function DiscoverPage() {
	const { gateway } = useNostrSession();
	const [language, setLanguage] = useState("");
	const [query, setQuery] = useState(
		() => new URLSearchParams(window.location.search).get("q") ?? ""
	);
	const [state, setState] = useState<DiscoverState>({ status: "loading", snippets: [] });
	const [until, setUntil] = useState<number | null>(null);

	useEffect(() => {
		let active = true;
		setUntil(null);
		setState({ status: "loading", snippets: [] });
		void loadPage(language, null).then(
			(result) => {
				if (active) {
					setState({ status: "loaded", snippets: result.snippets, hasMore: result.hasMore });
				}
			},
			(reason: unknown) => {
				if (active) setState({ status: "error", snippets: [], message: errorMessage(reason) });
			}
		);
		return () => {
			active = false;
		};
	}, [gateway, language]);

	async function loadPage(
		selectedLanguage: string,
		cursor: number | null
	): Promise<{ snippets: Snippet[]; hasMore: boolean }> {
		const events = await gateway.queryEvents(
			{
				kinds: [1337],
				limit: PAGE_SIZE,
				...(selectedLanguage ? { "#l": [selectedLanguage] } : {}),
				...(cursor ? { until: cursor } : {}),
			},
			{ relayUrls: DISCOVERY_RELAY_URLS, maxWait: 3_000 }
		);
		const snippets = events.flatMap((event) => {
			const snippet = parseSnippet(event);
			return snippet ? [snippet] : [];
		});
		return { snippets, hasMore: snippets.length === PAGE_SIZE };
	}

	async function loadMore(): Promise<void> {
		if (state.status === "loading" || state.snippets.length === 0) return;
		const cursor = Math.min(...state.snippets.map((snippet) => snippet.event.created_at)) - 1;
		setUntil(cursor);
		setState({ status: "loading", snippets: state.snippets });
		try {
			const next = await loadPage(language, cursor);
			const merged = [
				...new Map(
					[...state.snippets, ...next.snippets].map((snippet) => [snippet.event.id, snippet])
				).values(),
			];
			setState({ status: "loaded", snippets: merged, hasMore: next.hasMore });
		} catch (reason) {
			setState({ status: "error", snippets: state.snippets, message: errorMessage(reason) });
		}
	}

	const languages = useMemo(
		() => [...new Set(state.snippets.map((snippet) => snippet.metadata.language))].sort(),
		[state.snippets]
	);
	const visibleSnippets = useMemo(
		() => filterSnippets(state.snippets, query),
		[query, state.snippets]
	);

	return (
		<section className="page-shell discover-page">
			<div className="discover-hero">
				<div>
					<p className="eyebrow">Network discovery</p>
					<h1>Discover</h1>
					<p className="muted">
						Explore recent public code from the Nostr network, without a central index.
					</p>
				</div>
				<p className="discover-relay-note">
					Recent <span>·</span> {DISCOVERY_RELAY_URLS.length} discovery relays
				</p>
			</div>
			<DiscoverFilters
				language={language}
				languages={languages}
				onLanguageChange={setLanguage}
				onQueryChange={setQuery}
				query={query}
			/>
			{state.snippets.length > 0 ? (
				<p aria-live="polite" className="discover-summary">
					{visibleSnippets.length} {visibleSnippets.length === 1 ? "snippet" : "snippets"} shown
					{query || language ? " from the loaded results" : " from recent relay responses"}.
				</p>
			) : null}
			{state.status === "loading" && state.snippets.length === 0 ? (
				<p className="page-status">Querying discovery relays…</p>
			) : null}
			{state.status === "error" ? (
				<p className="notice warning" role="alert">
					{state.message} Showing any available results.
				</p>
			) : null}
			{state.status !== "loading" && visibleSnippets.length === 0 ? (
				<p className="empty-state">No snippets match the current relays and filters.</p>
			) : null}
			{visibleSnippets.length > 0 ? <DiscoverSnippetList snippets={visibleSnippets} /> : null}
			{state.status !== "loading" && state.status !== "error" && state.hasMore ? (
				<Button className="mt-6 w-auto px-5 text-base" onClick={() => void loadMore()}>
					Load more
				</Button>
			) : null}
			{until ? (
				<p className="muted mt-3 text-sm">
					Loaded through {new Date(until * 1_000).toLocaleString()}.
				</p>
			) : null}
		</section>
	);
}

function filterSnippets(snippets: readonly Snippet[], query: string): Snippet[] {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return [...snippets];
	return snippets.filter((snippet) =>
		[
			snippet.metadata.name,
			snippet.metadata.description,
			snippet.metadata.language,
			...snippet.metadata.tags,
			snippet.event.pubkey,
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase()
			.includes(normalized)
	);
}

function errorMessage(reason: unknown): string {
	return reason instanceof Error
		? reason.message
		: "Unable to query the selected discovery relays.";
}
