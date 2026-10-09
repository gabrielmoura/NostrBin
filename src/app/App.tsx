import { useSyncExternalStore } from "react";
import { AppShell } from "@/app/AppShell";
import { NostrSessionProvider } from "@/app/NostrSessionProvider";
import { DiscoverPage } from "@/features/discover/DiscoverPage";
import { HomePage } from "@/features/home/HomePage";
import { MySnippetsPage } from "@/features/my-snippets/MySnippetsPage";
import { PasteViewerPage } from "@/features/paste-viewer/PasteViewerPage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { NewSnippetPage } from "@/features/snippet-editor/NewSnippetPage";
import { SnippetRawPage } from "@/features/snippet-viewer/SnippetRawPage";
import { SnippetViewerPage } from "@/features/snippet-viewer/SnippetViewerPage";
import { NotFoundPage } from "@/routes/NotFoundPage";

function subscribe(onStoreChange: () => void): () => void {
	window.addEventListener("popstate", onStoreChange);
	return () => window.removeEventListener("popstate", onStoreChange);
}

function getPathname(): string {
	return window.location.pathname;
}

export function App() {
	const pathname = useSyncExternalStore(subscribe, getPathname, () => "/");
	const snippetRoute = matchSnippetRoute(pathname);
	const profileRoute = matchProfileRoute(pathname);
	const isKnownRoute = pathname === "/" || /^\/[^/]+\/?$/.test(pathname);
	const content =
		pathname === "/" ? (
			<HomePage />
		) : pathname === "/new" ? (
			<NewSnippetPage />
		) : pathname === "/my" ? (
			<MySnippetsPage />
		) : pathname === "/discover" ? (
			<DiscoverPage />
		) : profileRoute ? (
			<ProfilePage publicKeyInput={profileRoute} />
		) : snippetRoute?.raw ? (
			<SnippetRawPage reference={snippetRoute.reference} />
		) : snippetRoute ? (
			<SnippetViewerPage reference={snippetRoute.reference} />
		) : isKnownRoute ? (
			<PasteViewerPage reference={pathname.slice(1).replace(/\/$/, "")} />
		) : (
			<NotFoundPage />
		);

	return (
		<NostrSessionProvider>
			{snippetRoute?.raw ? content : <AppShell>{content}</AppShell>}
		</NostrSessionProvider>
	);
}

function matchProfileRoute(pathname: string): string | null {
	const match = /^\/u\/([^/]+)\/?$/.exec(pathname);
	if (!match?.[1]) {
		return null;
	}
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return null;
	}
}

function matchSnippetRoute(pathname: string): { reference: string; raw: boolean } | null {
	const match = /^\/snippet\/([^/]+)(\/raw)?\/?$/.exec(pathname);
	if (!match) {
		return null;
	}

	try {
		const reference = match[1];
		if (!reference) {
			return null;
		}
		return { reference: decodeURIComponent(reference), raw: Boolean(match[2]) };
	} catch {
		return null;
	}
}
