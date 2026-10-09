import type { Event } from "nostr-tools";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { FaCheck, FaXmark } from "react-icons/fa6";
import { useAppShell } from "@/app/AppShell";
import { useNostrSession } from "@/app/NostrSessionProvider";
import { Button } from "@/components/ui/button";
import { CommentSection } from "@/features/comments/CommentSection";
import { isMarkdownFilename } from "@/features/paste-editor/editor";
import { hasReacted, reactionCount } from "@/features/paste-viewer/reactions";
import { inferLanguagePreset } from "@/features/snippet-editor/language-presets";
import { downloadSnippet, openRawContent, shareUrl } from "@/features/snippet-viewer/actions";
import { exportCodeImage } from "@/features/snippet-viewer/code-image";
import { encodePasteReference, getPasteFilename, parsePasteReference } from "@/nostr/events/paste";
import { createReactionTemplate } from "@/nostr/events/reaction";
import { verifyNip05 } from "@/nostr/profile";
import type { EventId, NostrSigner, ProfileMetadata } from "@/nostr/types";
import { asHexPubkey } from "@/nostr/validation";
import { navigate } from "@/routes/navigation";

const MarkdownPreview = lazy(() => import("@/features/paste-editor/MarkdownPreview"));
const CodePreview = lazy(() => import("@/features/paste-editor/CodePreview"));

interface PasteViewerPageProps {
	reference: string;
}

type LoadState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "not-found" }
	| { status: "loaded"; event: Event; eventId: EventId };

export function PasteViewerPage({ reference }: PasteViewerPageProps) {
	const { gateway, getSigner, resolveProfile, session } = useNostrSession();
	const { openAccountDialog } = useAppShell();
	const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
	const [profile, setProfile] = useState<ProfileMetadata>({});
	const [nip05Valid, setNip05Valid] = useState<boolean | null>(null);
	const [reactions, setReactions] = useState<Event[]>([]);
	const [reactionError, setReactionError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [isReacting, setIsReacting] = useState(false);

	useEffect(() => {
		let active = true;
		setLoadState({ status: "loading" });
		setProfile({});
		setNip05Valid(null);
		setReactions([]);
		setReactionError(null);
		setActionError(null);

		void (async () => {
			try {
				const parsedReference = parsePasteReference(reference);
				gateway.addRelayHints(parsedReference.relayHints);
				const event = await gateway.getEventById(parsedReference.eventId);
				if (!active) {
					return;
				}

				setLoadState(
					event
						? { status: "loaded", event, eventId: parsedReference.eventId }
						: { status: "not-found" }
				);
			} catch (reason) {
				if (active) {
					setLoadState({ status: "error", message: errorMessage(reason) });
				}
			}
		})();

		return () => {
			active = false;
		};
	}, [gateway, reference]);

	useEffect(() => {
		if (loadState.status !== "loaded" || reference.startsWith("note1")) {
			return;
		}
		navigate(`/${encodePasteReference(loadState.eventId, gateway.relayUrls)}`);
	}, [gateway.relayUrls, loadState, reference]);

	useEffect(() => {
		if (loadState.status === "loaded" && loadState.event.kind === 1337) {
			navigate(`/snippet/${encodeURIComponent(reference)}`);
		}
	}, [loadState, reference]);

	useEffect(() => {
		if (loadState.status !== "loaded") {
			return;
		}

		const subscription = gateway.subscribeToReactions(loadState.eventId, (reaction) => {
			setReactions((current) =>
				current.some((existing) => existing.id === reaction.id) ? current : [...current, reaction]
			);
		});

		return () => subscription.close();
	}, [gateway, loadState]);

	useEffect(() => {
		if (loadState.status !== "loaded") {
			return;
		}

		let active = true;
		void resolveProfile(loadState.event.pubkey).then(
			(profile) => {
				if (active) {
					setProfile(profile.metadata);
				}
			},
			() => undefined
		);

		return () => {
			active = false;
		};
	}, [loadState, resolveProfile]);

	useEffect(() => {
		if (loadState.status !== "loaded" || !profile.nip05) {
			setNip05Valid(null);
			return;
		}

		let active = true;
		void verifyNip05(profile.nip05, loadState.event.pubkey).then(
			(valid) => {
				if (active) {
					setNip05Valid(valid);
				}
			},
			() => {
				if (active) {
					setNip05Valid(false);
				}
			}
		);

		return () => {
			active = false;
		};
	}, [loadState, profile.nip05]);

	const reactionState = useMemo(() => {
		return {
			positive: reactionCount(reactions, "positive"),
			negative: reactionCount(reactions, "negative"),
			hasReacted: hasReacted(reactions, session.publicKey),
		};
	}, [reactions, session.publicKey]);

	async function postReaction(content: "+" | "-"): Promise<void> {
		if (loadState.status !== "loaded" || reactionState.hasReacted) {
			return;
		}

		setReactionError(null);
		let signer: NostrSigner;
		try {
			signer = getSigner();
		} catch (reason) {
			setReactionError(errorMessage(reason));
			openAccountDialog();
			return;
		}

		setIsReacting(true);
		try {
			await gateway.publish(
				createReactionTemplate({
					content,
					target: {
						eventId: loadState.eventId,
						pubkey: asHexPubkey(loadState.event.pubkey),
						kind: loadState.event.kind,
					},
				}),
				signer
			);
		} catch (reason) {
			setReactionError(errorMessage(reason));
		} finally {
			setIsReacting(false);
		}
	}

	async function runAction(action: () => void | Promise<void>): Promise<void> {
		setActionError(null);
		try {
			await action();
		} catch (reason) {
			setActionError(errorMessage(reason));
		}
	}

	if (loadState.status === "loading") {
		return <LoadingState />;
	}

	if (loadState.status === "not-found") {
		return <ErrorState message="This paste was not found on the configured relays." />;
	}

	if (loadState.status === "error") {
		return <ErrorState message={loadState.message} />;
	}

	const { event } = loadState;
	const filename = getPasteFilename(event.tags) ?? tagValue(event.tags, "name") ?? "paste.txt";
	const highlighterLanguage = inferLanguagePreset(filename)?.preset.highlighter;
	const displayName = profile.displayName ?? profile.name;
	const avatarUrl = profile.picture ?? `https://robohash.org/${event.pubkey}?sets=1`;

	return (
		<section className="page-shell paste-detail-page">
			<p className="eyebrow">Nostr paste</p>
			<div className="detail-heading">
				<div>
					<a className="detail-back" href="/discover">
						← Back to discover
					</a>
					<h1 className="break-all">{filename}</h1>
				</div>
				<div className="detail-actions">
					<Button
						className="w-auto"
						onClick={() => void runAction(() => openRawContent(event.content))}
						variant="secondary"
					>
						Raw
					</Button>
					<Button
						className="w-auto"
						onClick={() => void runAction(() => downloadSnippet(filename, event.content))}
					>
						Download
					</Button>
					<Button
						className="w-auto"
						onClick={() =>
							void runAction(() => shareUrl(window.location.href, filename).then(() => undefined))
						}
					>
						Share
					</Button>
					<Button
						className="w-auto"
						onClick={() =>
							void runAction(() =>
								exportCodeImage({
									filename,
									content: event.content,
									language: highlighterLanguage,
								})
							)
						}
						variant="secondary"
					>
						Export image
					</Button>
				</div>
			</div>
			<div className="detail-author">
				<img alt="Profile" className="detail-avatar" src={avatarUrl} />
				<div>
					<span>
						{displayName ?? event.pubkey} {displayName ? <small>{event.pubkey}</small> : null}
					</span>
					{profile.nip05 ? (
						<span className="flex items-center gap-1">
							{profile.nip05}
							{nip05Valid === true ? <FaCheck aria-label="NIP-05 verified" /> : null}
							{nip05Valid === false ? <FaXmark aria-label="NIP-05 not verified" /> : null}
						</span>
					) : null}
				</div>
			</div>
			<p className="detail-metadata">
				Posted {new Date(event.created_at * 1_000).toLocaleString()} ·{" "}
				{highlighterLanguage ?? "Plain text"}
			</p>
			<Suspense fallback={<p>Loading paste…</p>}>
				{isMarkdownFilename(filename) ? (
					<MarkdownPreview content={event.content} />
				) : (
					<CodePreview content={event.content} language={highlighterLanguage} />
				)}
			</Suspense>
			<div className="detail-interactions">
				<ReactionButton
					disabled={isReacting || reactionState.hasReacted}
					emoji="👍"
					count={reactionState.positive}
					onClick={() => void postReaction("+")}
					selected={reactionState.hasReacted}
				/>
				<ReactionButton
					disabled={isReacting || reactionState.hasReacted}
					emoji="👎"
					count={reactionState.negative}
					onClick={() => void postReaction("-")}
					selected={reactionState.hasReacted}
				/>
			</div>
			{reactionError ? (
				<p className="mt-3" role="alert">
					{reactionError}
				</p>
			) : null}
			{actionError ? (
				<p className="notice warning mt-3" role="alert">
					{actionError}
				</p>
			) : null}
			<CommentSection
				target={{ eventId: loadState.eventId, kind: event.kind, pubkey: asHexPubkey(event.pubkey) }}
			/>
		</section>
	);
}

function LoadingState() {
	return (
		<div className="mt-16 flex flex-col gap-3 text-center">
			<h1 className="text-6xl">Fetching...</h1>
			<p>If data doesn't load, try refreshing.</p>
		</div>
	);
}

function ErrorState({ message }: { message: string }) {
	return (
		<p className="mt-16 text-center" role="alert">
			{message}
		</p>
	);
}

interface ReactionButtonProps {
	count: number;
	emoji: string;
	selected: boolean;
	disabled: boolean;
	onClick(): void;
}

function ReactionButton({ count, disabled, emoji, onClick, selected }: ReactionButtonProps) {
	return (
		<button
			aria-label={`React with ${emoji}`}
			className={`flex cursor-pointer rounded border border-black px-4 py-1 dark:border-white ${
				selected ? "border-2" : ""
			}`}
			disabled={disabled}
			onClick={onClick}
			type="button"
		>
			<span className="mr-2">{count}</span>
			<span>{emoji}</span>
		</button>
	);
}

function tagValue(tags: readonly string[][], name: string): string | null {
	return tags.find((tag) => tag[0] === name)?.[1] ?? null;
}

function errorMessage(reason: unknown): string {
	return reason instanceof Error ? reason.message : "Unable to load this paste.";
}
