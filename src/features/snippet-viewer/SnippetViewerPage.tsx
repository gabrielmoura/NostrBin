import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNostrSession } from "@/app/NostrSessionProvider";
import { Button } from "@/components/ui/button";
import { CommentSection } from "@/features/comments/CommentSection";
import { resolveHighlighterLanguage } from "@/features/snippet-editor/language-presets";
import {
	copyText,
	downloadSnippet,
	shareSnippet,
	snippetRawUrl,
} from "@/features/snippet-viewer/actions";
import { exportCodeImage } from "@/features/snippet-viewer/code-image";
import { useSnippetEvent } from "@/features/snippet-viewer/useSnippetEvent";
import { createDeletionTemplate } from "@/nostr/events/deletion";
import { encodeSnippetReference, formatByteSize } from "@/nostr/events/snippet";
import type { ProfileMetadata } from "@/nostr/types";
import { asEventId, asHexPubkey, encodePublicKey } from "@/nostr/validation";
import { navigate } from "@/routes/navigation";

const CodePreview = lazy(() => import("@/features/paste-editor/CodePreview"));

interface SnippetViewerPageProps {
	reference: string;
}

export function SnippetViewerPage({ reference }: SnippetViewerPageProps) {
	const { gateway, getSigner, resolveAuthorRelays, resolveProfile, session } = useNostrSession();
	const state = useSnippetEvent(reference);
	const [profile, setProfile] = useState<ProfileMetadata>({});
	const [feedback, setFeedback] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [deletionReport, setDeletionReport] = useState<string | null>(null);

	useEffect(() => {
		if (state.status !== "loaded") {
			setProfile({});
			return;
		}

		let active = true;
		void resolveProfile(state.snippet.event.pubkey).then((resolved) => {
			if (active) {
				setProfile(resolved.metadata);
			}
		});
		return () => {
			active = false;
		};
	}, [resolveProfile, state]);

	const snippetReference = useMemo(() => {
		if (state.status !== "loaded") {
			return null;
		}
		return encodeSnippetReference(state.snippet.event, gateway.relayUrls);
	}, [gateway.relayUrls, state]);

	useEffect(() => {
		if (state.status === "loaded" && !reference.startsWith("note1")) {
			navigate(
				`/snippet/${encodeURIComponent(encodeSnippetReference(state.snippet.event, gateway.relayUrls))}`
			);
		}
	}, [gateway.relayUrls, reference, state]);

	if (state.status === "loading") {
		return <StatusMessage title="Loading snippet…" />;
	}
	if (state.status === "not-found") {
		return (
			<StatusMessage title="Snippet not found" message="No configured relay returned this event." />
		);
	}
	if (state.status === "error") {
		return <StatusMessage title="Unable to load snippet" message={state.message} />;
	}

	const { event, lineCount, metadata, sizeBytes } = state.snippet;
	const filename = metadata.name ?? fallbackFilename(metadata.extension);
	const highlighterLanguage = resolveHighlighterLanguage(
		metadata.language,
		metadata.extension,
		metadata.name
	);
	const author = profile.displayName ?? profile.name ?? compactNpub(event.pubkey);

	async function runAction(action: () => Promise<void>, successMessage: string): Promise<void> {
		setFeedback(null);
		try {
			await action();
			setFeedback(successMessage);
		} catch (reason) {
			setFeedback(errorMessage(reason));
		}
	}

	async function exportImage(): Promise<void> {
		await exportCodeImage({
			filename,
			content: event.content,
			language: highlighterLanguage,
		});
	}

	async function deleteSnippet(): Promise<void> {
		if (
			session.publicKey !== event.pubkey ||
			!window.confirm(
				"Request deletion from your write relays? Copies on other relays may remain available."
			)
		) {
			return;
		}
		setDeletionReport(null);
		setIsDeleting(true);
		try {
			const signer = getSigner();
			const relays = await resolveAuthorRelays(event.pubkey);
			const result = await gateway.publish(
				createDeletionTemplate(asEventId(event.id), event.kind),
				signer,
				{ relayUrls: relays.writeRelayUrls }
			);
			const accepted = result.relays.filter((relay) => relay.accepted).length;
			setDeletionReport(
				`Deletion request published to ${accepted} / ${result.relays.length} write relays. Existing copies may remain distributed.`
			);
		} catch (reason) {
			setDeletionReport(errorMessage(reason));
		} finally {
			setIsDeleting(false);
		}
	}

	return (
		<section className="page-shell snippet-detail-page">
			<div className="detail-heading">
				<div className="min-w-0 flex-1">
					<a className="detail-back" href="/my">
						← Back to my pastes
					</a>
					<p className="eyebrow">Code snippet</p>
					<h1 className="break-all">{filename}</h1>
					{metadata.description ? (
						<p className="detail-description">{metadata.description}</p>
					) : null}
				</div>
				<div className="detail-actions">
					<a
						className="rounded border border-current px-3 py-2"
						href={snippetRawUrl(snippetReference ?? event.id)}
					>
						Raw
					</a>
					<Button
						className="w-auto px-4 text-base"
						onClick={() => downloadSnippet(filename, event.content)}
					>
						Download
					</Button>
					<Button
						className="w-auto px-4 text-base"
						onClick={() =>
							void runAction(
								() => shareSnippet(snippetReference ?? event.id, filename).then(() => undefined),
								"Snippet link shared."
							)
						}
					>
						Share
					</Button>
				</div>
			</div>

			<div className="detail-metadata">
				<a
					className="underline"
					href={`/u/${encodeURIComponent(encodePublicKey(asHexPubkey(event.pubkey)))}`}
				>
					by {author}
				</a>
				<span>{new Date(event.created_at * 1_000).toLocaleString()}</span>
				<span>{metadata.language}</span>
				<span>{formatByteSize(sizeBytes)}</span>
				<span>{lineCount} lines</span>
				{metadata.runtime ? <span>{metadata.runtime}</span> : null}
				{metadata.licenses.map((license) => (
					<span key={license}>{license}</span>
				))}
			</div>

			<Suspense fallback={<p className="mt-6">Loading code preview…</p>}>
				<div className="detail-code">
					<CodePreview content={event.content} language={highlighterLanguage} />
				</div>
			</Suspense>

			<div className="detail-interactions">
				<Button
					className="w-auto px-4 text-base"
					onClick={() => void runAction(() => copyText(event.content), "Code copied.")}
				>
					Copy code
				</Button>
				<Button
					className="w-auto px-4 text-base"
					onClick={() => void runAction(exportImage, "Code image downloaded.")}
				>
					Export image
				</Button>
				<Button
					className="w-auto px-4 text-base"
					onClick={() => void runAction(() => copyText(event.id), "Event ID copied.")}
				>
					Copy event ID
				</Button>
				{snippetReference ? (
					<Button
						className="w-auto px-4 text-base"
						onClick={() =>
							void runAction(() => copyText(`nostr:${snippetReference}`), "Nostr URI copied.")
						}
					>
						Copy Nostr URI
					</Button>
				) : null}
				{session.publicKey === event.pubkey ? (
					<Button
						className="w-auto px-4 text-base"
						disabled={isDeleting}
						onClick={() => void deleteSnippet()}
					>
						{isDeleting ? "Requesting deletion…" : "Delete snippet"}
					</Button>
				) : null}
			</div>
			{metadata.dependencies.length > 0 || metadata.repository ? (
				<section className="mt-8">
					<h2 className="text-2xl">Details</h2>
					{metadata.dependencies.length > 0 ? (
						<p className="mt-2">Dependencies: {metadata.dependencies.join(", ")}</p>
					) : null}
					{metadata.repository ? (
						<p className="mt-2 break-all">Source repository: {metadata.repository}</p>
					) : null}
				</section>
			) : null}
			<CommentSection
				target={{
					eventId: asEventId(event.id),
					kind: event.kind,
					pubkey: asHexPubkey(event.pubkey),
				}}
			/>
			{feedback ? (
				<p className="mt-4" role="status">
					{feedback}
				</p>
			) : null}
			{deletionReport ? (
				<p className="mt-4" role="status">
					{deletionReport}
				</p>
			) : null}
		</section>
	);
}

function StatusMessage({ message, title }: { title: string; message?: string }) {
	return (
		<section className="mt-16 text-center">
			<h1 className="text-4xl">{title}</h1>
			{message ? <p className="mt-3">{message}</p> : null}
		</section>
	);
}

function fallbackFilename(extension: string | null): string {
	return extension ? `snippet.${extension}` : "snippet.txt";
}

function compactNpub(pubkey: string): string {
	const npub = encodePublicKey(asHexPubkey(pubkey));
	return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
}

function errorMessage(reason: unknown): string {
	return reason instanceof Error ? reason.message : "The requested action could not be completed.";
}
