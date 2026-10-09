import type { Event } from "nostr-tools";
import { type FormEvent, useEffect, useState } from "react";
import { useAppShell } from "@/app/AppShell";
import { useNostrSession } from "@/app/NostrSessionProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { COMMENT_KIND, createRootCommentTemplate } from "@/nostr/events/comment";
import type { EventId, HexPubkey } from "@/nostr/types";
import { asHexPubkey, encodePublicKey } from "@/nostr/validation";

interface CommentSectionProps {
	target: { eventId: EventId; pubkey: HexPubkey; kind: number };
}

export function CommentSection({ target }: CommentSectionProps) {
	const { gateway, getSigner, resolveAuthorRelays, session } = useNostrSession();
	const { openAccountDialog } = useAppShell();
	const [comments, setComments] = useState<Event[]>([]);
	const [content, setContent] = useState("");
	const [isPublishing, setIsPublishing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		setComments([]);
		void gateway.queryEvents({ kinds: [COMMENT_KIND], "#E": [target.eventId], limit: 100 }).then(
			(events) => {
				if (active) setComments(events.filter((event) => isRootComment(event, target.eventId)));
			},
			(reason: unknown) => {
				if (active) setError(errorMessage(reason));
			}
		);
		return () => {
			active = false;
		};
	}, [gateway, target.eventId]);

	async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setError(null);
		if (!session.publicKey) {
			openAccountDialog();
			setError("Connect a Nostr signer before posting a comment.");
			return;
		}
		setIsPublishing(true);
		try {
			const signer = getSigner();
			const relays = await resolveAuthorRelays(session.publicKey);
			const commentTarget = gateway.relayUrls[0]
				? { ...target, relayHint: gateway.relayUrls[0] }
				: target;
			const result = await gateway.publish(
				createRootCommentTemplate(commentTarget, content),
				signer,
				{ relayUrls: relays.writeRelayUrls }
			);
			setComments((current) => [...current, result.event]);
			setContent("");
		} catch (reason) {
			setError(errorMessage(reason));
		} finally {
			setIsPublishing(false);
		}
	}

	return (
		<section className="comments-section">
			<h2>Comments {comments.length > 0 ? `(${comments.length})` : ""}</h2>
			{comments.length === 0 ? <p className="muted">No comments yet.</p> : null}
			<ul className="comment-list">
				{comments.map((comment) => (
					<li key={comment.id}>
						<strong>{shortNpub(comment.pubkey)}</strong>
						<span>{new Date(comment.created_at * 1_000).toLocaleString()}</span>
						<p>{comment.content}</p>
					</li>
				))}
			</ul>
			<form onSubmit={(event) => void submit(event)}>
				<Textarea
					aria-label="Comment"
					className="min-h-24"
					onChange={(event) => setContent(event.target.value)}
					placeholder="Add a plain-text Nostr comment…"
					value={content}
				/>
				<Button className="mt-3 w-auto" disabled={isPublishing || !content.trim()} type="submit">
					{isPublishing ? "Publishing…" : "Comment"}
				</Button>
			</form>
			{error ? (
				<p className="notice warning mt-3" role="alert">
					{error}
				</p>
			) : null}
		</section>
	);
}

function isRootComment(event: Event, eventId: EventId): boolean {
	return event.tags.some((tag) => tag[0] === "E" && tag[1] === eventId);
}

function shortNpub(publicKey: string): string {
	const npub = encodePublicKey(asHexPubkey(publicKey));
	return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
}

function errorMessage(reason: unknown): string {
	return reason instanceof Error ? reason.message : "Unable to load or publish comments.";
}
