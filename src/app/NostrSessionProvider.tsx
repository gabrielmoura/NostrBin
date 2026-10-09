import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";
import { type ClientTag, getNostrBinClientTag } from "@/nostr/application-handler";
import { NostrGateway } from "@/nostr/gateway";
import { ProfileResolver, type ResolvedProfile } from "@/nostr/profile-resolver";
import {
	type PublicationSettingsSnapshot,
	PublicationSettingsStore,
} from "@/nostr/publication-settings";
import { AuthorRelayResolver, type AuthorRelaySet } from "@/nostr/relay-list";
import type { RelayStatus } from "@/nostr/relay-registry";
import { type GeneratedCredentials, NostrSession, type SessionSnapshot } from "@/nostr/session";
import type { HexPubkey, NostrSigner, ProfileMetadata } from "@/nostr/types";

interface NostrSessionContextValue {
	session: SessionSnapshot;
	gateway: NostrGateway;
	relayStatus: readonly RelayStatus[];
	currentProfile: ProfileMetadata | null;
	currentUserRelays: AuthorRelaySet | null;
	publicationSettings: PublicationSettingsSnapshot;
	clientTag: ClientTag | null;
	generateLocalKey(): GeneratedCredentials;
	importCredentials(publicKeyInput: string, privateKeyInput: string): HexPubkey;
	connectNip07(): Promise<HexPubkey>;
	getSigner(): NostrSigner;
	logout(): void;
	refreshRelays(): Promise<void>;
	resolveProfile(publicKey: string): Promise<ResolvedProfile>;
	resolveAuthorRelays(publicKey: string): Promise<AuthorRelaySet>;
	refreshCurrentProfile(): Promise<void>;
	setIdentifyClient(identifyClient: boolean): void;
}

const NostrSessionContext = createContext<NostrSessionContextValue | null>(null);

interface NostrSessionProviderProps {
	children: ReactNode;
}

export function NostrSessionProvider({ children }: NostrSessionProviderProps) {
	const [runtime] = useState(() => ({
		session: new NostrSession(window.localStorage),
		gateway: new NostrGateway(),
		publicationSettings: new PublicationSettingsStore(window.localStorage),
	}));
	const nostrSession = runtime.session;
	const gateway = runtime.gateway;
	const publicationSettingsStore = runtime.publicationSettings;
	const [relayResolver] = useState(() => new AuthorRelayResolver(gateway));
	const [profileResolver] = useState(() => new ProfileResolver(gateway));
	const session = useSyncExternalStore(
		(callback) => nostrSession.subscribe(callback),
		() => nostrSession.snapshot,
		() => nostrSession.snapshot
	);
	const [relayStatus, setRelayStatus] = useState(() => gateway.relayStatus);
	const [currentProfile, setCurrentProfile] = useState<ProfileMetadata | null>(null);
	const [currentUserRelays, setCurrentUserRelays] = useState<AuthorRelaySet | null>(null);
	const publicationSettings = useSyncExternalStore(
		(callback) => publicationSettingsStore.subscribe(callback),
		() => publicationSettingsStore.snapshot,
		() => publicationSettingsStore.snapshot
	);
	const clientTag = publicationSettings.identifyClient ? getNostrBinClientTag() : null;

	useEffect(() => {
		nostrSession.restore();
	}, [nostrSession]);

	useEffect(() => () => gateway.destroy(), [gateway]);

	const refreshRelays = useCallback(async () => {
		await gateway.refreshRelayStatus();
		setRelayStatus(gateway.relayStatus);
	}, [gateway]);

	const resolveProfile = useCallback(
		async (publicKey: string): Promise<ResolvedProfile> => {
			const authorRelays = await relayResolver.resolve(publicKey);
			return profileResolver.resolve(publicKey, authorRelays.writeRelayUrls);
		},
		[profileResolver, relayResolver]
	);

	const resolveAuthorRelays = useCallback(
		(publicKey: string): Promise<AuthorRelaySet> => relayResolver.resolve(publicKey),
		[relayResolver]
	);

	const refreshCurrentProfile = useCallback(async () => {
		if (!session.publicKey) {
			setCurrentProfile(null);
			setCurrentUserRelays(null);
			return;
		}

		relayResolver.invalidate(session.publicKey);
		profileResolver.invalidate(session.publicKey);
		const authorRelays = await relayResolver.resolve(session.publicKey);
		const profile = await profileResolver.resolve(session.publicKey, authorRelays.writeRelayUrls);
		setCurrentUserRelays(authorRelays);
		setCurrentProfile(profile.metadata);
	}, [profileResolver, relayResolver, session.publicKey]);

	useEffect(() => {
		let active = true;
		if (!session.publicKey) {
			setCurrentProfile(null);
			setCurrentUserRelays(null);
			return () => {
				active = false;
			};
		}

		void (async () => {
			const authorRelays = await relayResolver.resolve(session.publicKey as HexPubkey);
			const profile = await profileResolver.resolve(
				session.publicKey as HexPubkey,
				authorRelays.writeRelayUrls
			);
			if (active) {
				setCurrentUserRelays(authorRelays);
				setCurrentProfile(profile.metadata);
			}
		})();

		return () => {
			active = false;
		};
	}, [profileResolver, relayResolver, session.publicKey]);

	const value = useMemo<NostrSessionContextValue>(
		() => ({
			session,
			gateway,
			relayStatus,
			currentProfile,
			currentUserRelays,
			publicationSettings,
			clientTag,
			generateLocalKey: () => nostrSession.generateLocalKey(),
			importCredentials: (publicKeyInput, privateKeyInput) =>
				nostrSession.importCredentials(publicKeyInput, privateKeyInput),
			connectNip07: () => nostrSession.connectNip07(),
			getSigner: () => nostrSession.getSigner(),
			logout: () => nostrSession.logout(),
			refreshRelays,
			resolveProfile,
			resolveAuthorRelays,
			refreshCurrentProfile,
			setIdentifyClient: (identifyClient) =>
				publicationSettingsStore.setIdentifyClient(identifyClient),
		}),
		[
			session,
			gateway,
			relayStatus,
			currentProfile,
			currentUserRelays,
			publicationSettings,
			clientTag,
			nostrSession,
			publicationSettingsStore,
			refreshRelays,
			resolveProfile,
			resolveAuthorRelays,
			refreshCurrentProfile,
		]
	);

	return <NostrSessionContext.Provider value={value}>{children}</NostrSessionContext.Provider>;
}

export function useNostrSession(): NostrSessionContextValue {
	const context = useContext(NostrSessionContext);
	if (!context) {
		throw new Error("useNostrSession must be used inside NostrSessionProvider.");
	}

	return context;
}
