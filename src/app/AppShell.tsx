import { useHotkey } from "@tanstack/react-hotkeys";
import {
	createContext,
	type FormEvent,
	type ReactNode,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { FaCog, FaGithub, FaServer } from "react-icons/fa";
import { useNostrSession } from "@/app/NostrSessionProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { encodePublicKey } from "@/nostr/validation";

interface AppShellProps {
	children: ReactNode;
}

interface AppShellContextValue {
	openAccountDialog(): void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

interface AccountDialogProps {
	open: boolean;
	onOpenChange(open: boolean): void;
}

function AccountDialog({ open, onOpenChange }: AccountDialogProps) {
	const { connectNip07, currentProfile, generateLocalKey, importCredentials, logout, session } =
		useNostrSession();
	const [publicKeyInput, setPublicKeyInput] = useState("");
	const [privateKeyInput, setPrivateKeyInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isAvatarBroken, setIsAvatarBroken] = useState(false);

	useEffect(() => {
		if (!open) {
			return;
		}

		setPublicKeyInput(session.publicKey ? encodePublicKey(session.publicKey) : "");
		setPrivateKeyInput("");
		setError(null);
	}, [open, session.publicKey]);

	useEffect(() => {
		setIsAvatarBroken(false);
	}, [currentProfile?.picture, session.publicKey]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		try {
			if (!publicKeyInput.trim() && !privateKeyInput.trim()) {
				logout();
				onOpenChange(false);
				return;
			}

			importCredentials(publicKeyInput, privateKeyInput);
			setPrivateKeyInput("");
			onOpenChange(false);
		} catch (reason) {
			setError(errorMessage(reason));
		}
	}

	function handleGenerate(): void {
		const credentials = generateLocalKey();
		setPublicKeyInput(encodePublicKey(credentials.publicKey));
		setPrivateKeyInput(credentials.nsec);
		setError(null);
	}

	async function handleNip07(): Promise<void> {
		setIsSubmitting(true);
		setError(null);
		try {
			const publicKey = await connectNip07();
			setPublicKeyInput(encodePublicKey(publicKey));
			setPrivateKeyInput("");
			onOpenChange(false);
		} catch (reason) {
			setError(errorMessage(reason));
		} finally {
			setIsSubmitting(false);
		}
	}

	const fallbackAvatarUrl = session.publicKey
		? `https://robohash.org/${session.publicKey}?sets=1`
		: null;
	const avatarUrl =
		!isAvatarBroken && currentProfile?.picture ? currentProfile.picture : fallbackAvatarUrl;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogTrigger asChild>
				{avatarUrl ? (
					<img
						alt="Profile"
						className="my-auto size-12 cursor-pointer rounded"
						onError={() => setIsAvatarBroken(true)}
						src={avatarUrl}
					/>
				) : (
					<Button>Login</Button>
				)}
			</DialogTrigger>
			<DialogContent aria-describedby="account-dialog-description">
				<h2 className="text-2xl">Manage Keys</h2>
				<hr className="my-2" />
				<form className="flex flex-col gap-5" onSubmit={handleSubmit}>
					<label className="flex flex-col gap-1" htmlFor="public-key">
						<span>Public Key (npub or hex)</span>
						<Input
							autoComplete="off"
							id="public-key"
							onChange={(event) => setPublicKeyInput(event.target.value)}
							placeholder="Type your public key..."
							value={publicKeyInput}
						/>
					</label>
					<label className="flex flex-col gap-1" htmlFor="private-key">
						<span>Private Key (nsec or hex)</span>
						<Input
							autoComplete="off"
							id="private-key"
							onChange={(event) => setPrivateKeyInput(event.target.value)}
							placeholder="Type your private key..."
							type="password"
							value={privateKeyInput}
						/>
					</label>
					<div className="flex flex-wrap gap-2">
						<Button onClick={handleGenerate} type="button">
							Generate
						</Button>
						<Button disabled={isSubmitting} onClick={handleNip07} type="button">
							NIP-07
						</Button>
					</div>
					{error ? (
						<p className="text-sm text-red-700 dark:text-red-300" role="alert">
							{error}
						</p>
					) : null}
					<p id="account-dialog-description">
						<small>
							{session.mode === "nip-07"
								? "Your extension will be asked to sign each event."
								: "Local keys are retained by this browser in plaintext for legacy compatibility."}
						</small>
					</p>
					<div className="flex gap-2">
						<Button type="submit">Done</Button>
						{session.mode !== "none" ? (
							<Button onClick={logout} type="button">
								Logout
							</Button>
						) : null}
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function RelayDialog() {
	const { refreshRelays, relayStatus } = useNostrSession();
	const [open, setOpen] = useState(false);
	const [countdown, setCountdown] = useState(10);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}

		let active = true;
		const refresh = async () => {
			try {
				await refreshRelays();
				if (active) {
					setError(null);
					setCountdown(10);
				}
			} catch (reason) {
				if (active) {
					setError(errorMessage(reason));
				}
			}
		};

		void refresh();
		const timer = window.setInterval(() => {
			setCountdown((current) => {
				if (current <= 1) {
					void refresh();
					return 10;
				}
				return current - 1;
			});
		}, 1_000);

		return () => {
			active = false;
			window.clearInterval(timer);
		};
	}, [open, refreshRelays]);

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger asChild>
				<button
					aria-label="View relays"
					className="cursor-pointer rounded p-1 outline-none focus-visible:ring-2 focus-visible:ring-current"
					type="button"
				>
					<FaServer aria-hidden="true" className="size-5 md:size-6" />
				</button>
			</DialogTrigger>
			<DialogContent aria-describedby="relay-dialog-description">
				<h2 className="text-2xl">View Relays</h2>
				<span>Refreshing in {countdown}s</span>
				<hr className="my-2" />
				<div className="flex flex-col gap-2">
					{relayStatus.map((relay) => (
						<div className="flex" key={relay.url}>
							<span
								className="mr-2"
								role="img"
								aria-label={relay.connected ? "connected" : "disconnected"}
							>
								{relay.connected ? "✅" : "⚠️"}
							</span>
							<span className="break-all">{relay.url}</span>
						</div>
					))}
				</div>
				{error ? (
					<p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
						{error}
					</p>
				) : null}
				<p className="mt-3" id="relay-dialog-description">
					<small>
						Relay selection remains the legacy bootstrap list during this migration phase.
					</small>
				</p>
				<hr className="my-2" />
				<DialogClose asChild>
					<Button>Done</Button>
				</DialogClose>
			</DialogContent>
		</Dialog>
	);
}

function ApplicationSettingsDialog() {
	const { clientTag, publicationSettings, setIdentifyClient } = useNostrSession();
	const [open, setOpen] = useState(false);

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger asChild>
				<button
					aria-label="Application settings"
					className="cursor-pointer rounded p-1 outline-none focus-visible:ring-2 focus-visible:ring-current"
					type="button"
				>
					<FaCog aria-hidden="true" className="size-5 md:size-6" />
				</button>
			</DialogTrigger>
			<DialogContent aria-describedby="application-settings-description">
				<h2 className="text-2xl">Application settings</h2>
				<hr className="my-2" />
				<label className="flex cursor-pointer items-start gap-3" htmlFor="identify-client">
					<input
						checked={publicationSettings.identifyClient}
						id="identify-client"
						onChange={(event) => setIdentifyClient(event.target.checked)}
						type="checkbox"
					/>
					<span>
						<span className="block">Identify application in publications</span>
						<small className="block" id="application-settings-description">
							{clientTag
								? "A complete NIP-89 client tag will be included in new snippets."
								: "No published NostrBin application descriptor is configured yet, so no client tag will be sent."}
						</small>
					</span>
				</label>
				<hr className="my-2" />
				<DialogClose asChild>
					<Button>Done</Button>
				</DialogClose>
			</DialogContent>
		</Dialog>
	);
}

function HeaderSearch() {
	const [query, setQuery] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	useHotkey("Mod+K", (event) => {
		event.preventDefault();
		inputRef.current?.focus();
	});
	function submit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault();
		const value = query.trim();
		window.location.assign(value ? `/discover?q=${encodeURIComponent(value)}` : "/discover");
	}
	return (
		<search className="header-search">
			<form onSubmit={submit}>
				<Input
					aria-label="Search loaded snippets"
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search snippets…"
					ref={inputRef}
					value={query}
				/>
			</form>
		</search>
	);
}

export function AppShell({ children }: AppShellProps) {
	const [isLogoBroken, setIsLogoBroken] = useState(false);
	const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);

	return (
		<AppShellContext.Provider value={{ openAccountDialog: () => setIsAccountDialogOpen(true) }}>
			<div className="app-shell">
				<header className="app-header">
					<div className="app-header-inner">
						<a aria-label="NostrBin home" className="brand" href="/">
							{isLogoBroken ? (
								<span className="flex size-9 items-center justify-center rounded border border-current text-xl">
									n
								</span>
							) : (
								<img alt="NostrBin logo" onError={() => setIsLogoBroken(true)} src="/logo.webp" />
							)}
							<span>NostrBin</span>
						</a>
						<nav aria-label="Primary navigation" className="nav-links">
							<a href="/new">New</a>
							<a href="/discover">Discover</a>
							<a href="/my">My pastes</a>
						</nav>
						<HeaderSearch />
						<div className="header-actions">
							<RelayDialog />
							<ApplicationSettingsDialog />
							<AccountDialog onOpenChange={setIsAccountDialogOpen} open={isAccountDialogOpen} />
						</div>
					</div>
				</header>
				<main className="app-main">{children}</main>
				<footer className="app-footer">
					<a aria-label="NostrBin GitHub" href="https://github.com/gabrielmoura/NostrBin">
						<FaGithub aria-hidden="true" className="mr-2 inline size-4" />
						Open source on GitHub
					</a>
				</footer>
			</div>
		</AppShellContext.Provider>
	);
}

export function useAppShell(): AppShellContextValue {
	const context = useContext(AppShellContext);
	if (!context) {
		throw new Error("useAppShell must be used inside AppShell.");
	}

	return context;
}

function errorMessage(reason: unknown): string {
	return reason instanceof Error ? reason.message : "An unexpected error occurred.";
}
