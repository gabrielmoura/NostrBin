import { useEffect, useState } from "react";
import { useNostrSession } from "@/app/NostrSessionProvider";
import { encodeSnippetReference, formatByteSize, parseSnippet } from "@/nostr/events/snippet";
import type { ProfileMetadata, Snippet } from "@/nostr/types";
import { encodePublicKey, normalizePublicKey } from "@/nostr/validation";

type ProfilePageState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "loaded"; snippets: Snippet[]; publicKey: string; profile: ProfileMetadata };

interface ProfilePageProps {
	publicKeyInput: string;
}

export function ProfilePage({ publicKeyInput }: ProfilePageProps) {
	const { gateway, resolveAuthorRelays, resolveProfile } = useNostrSession();
	const [state, setState] = useState<ProfilePageState>({ status: "loading" });
	const [avatarBroken, setAvatarBroken] = useState(false);

	useEffect(() => {
		let active = true;
		setState({ status: "loading" });
		setAvatarBroken(false);
		void (async () => {
			try {
				const publicKey = normalizePublicKey(publicKeyInput);
				const relays = await resolveAuthorRelays(publicKey);
				const relayUrls =
					relays.writeRelayUrls.length > 0 ? relays.writeRelayUrls : gateway.relayUrls;
				const [profile, events] = await Promise.all([
					resolveProfile(publicKey),
					gateway.queryEvents(
						{ authors: [publicKey], kinds: [1337], limit: 100 },
						{ relayUrls, maxWait: 3_000 }
					),
				]);
				if (active) {
					setState({
						status: "loaded",
						publicKey,
						profile: profile.metadata,
						snippets: events.flatMap((event) => {
							const snippet = parseSnippet(event);
							return snippet ? [snippet] : [];
						}),
					});
					setAvatarBroken(!profile.metadata.picture);
				}
			} catch (reason) {
				if (active) {
					setState({ status: "error", message: errorMessage(reason) });
				}
			}
		})();
		return () => {
			active = false;
		};
	}, [gateway, publicKeyInput, resolveAuthorRelays, resolveProfile]);

	if (state.status === "loading") return <p className="page-status">Loading profile…</p>;
	if (state.status === "error")
		return (
			<p className="page-status" role="alert">
				{state.message}
			</p>
		);

	return (
		<ProfileContent
			avatarBroken={avatarBroken}
			onAvatarError={() => setAvatarBroken(true)}
			publicKey={state.publicKey}
			profile={state.profile}
			snippets={state.snippets}
		/>
	);
}

function ProfileContent({
	avatarBroken,
	onAvatarError,
	publicKey,
	profile,
	snippets,
}: {
	avatarBroken: boolean;
	onAvatarError(): void;
	publicKey: string;
	profile: ProfileMetadata;
	snippets: Snippet[];
}) {
	const fallbackAvatar = `https://robohash.org/${publicKey}?sets=1`;
	const npub = encodePublicKey(normalizePublicKey(publicKey));
	return (
		<section className="page-shell">
			<div className="profile-hero">
				<img
					alt=""
					className="avatar-large"
					onError={onAvatarError}
					src={!avatarBroken && profile.picture ? profile.picture : fallbackAvatar}
				/>
				<div>
					<h1>{profile.displayName ?? profile.name ?? `${npub.slice(0, 16)}…${npub.slice(-6)}`}</h1>
					<p className="mono muted break-all">{npub}</p>
					{profile.nip05 ? <p className="muted">{profile.nip05}</p> : null}
					{profile.about ? <p className="mt-3">{profile.about}</p> : null}
				</div>
			</div>
			<h2 className="section-title">Snippets</h2>
			{snippets.length === 0 ? (
				<p className="empty-state">No public snippets found on this author’s write relays.</p>
			) : (
				<ul className="snippet-list">
					{snippets.map((snippet) => {
						const filename =
							snippet.metadata.name ?? `snippet.${snippet.metadata.extension ?? "txt"}`;
						const reference = encodeSnippetReference(snippet.event, []);
						return (
							<li key={snippet.event.id}>
								<a href={`/snippet/${encodeURIComponent(reference)}`}>
									<strong>{filename}</strong>
									<span>
										{snippet.metadata.language} · {formatByteSize(snippet.sizeBytes)}
									</span>
									{snippet.metadata.description ? (
										<small>{snippet.metadata.description}</small>
									) : null}
								</a>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}

function errorMessage(reason: unknown): string {
	return reason instanceof Error ? reason.message : "Unable to load this profile.";
}
