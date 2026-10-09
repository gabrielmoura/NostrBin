import { useEffect } from "react";
import { useSnippetEvent } from "@/features/snippet-viewer/useSnippetEvent";

interface SnippetRawPageProps {
	reference: string;
}

export function SnippetRawPage({ reference }: SnippetRawPageProps) {
	const state = useSnippetEvent(reference);

	useEffect(() => {
		if (state.status === "loaded") {
			document.title = state.snippet.metadata.name ?? "snippet.txt";
		}
	}, [state]);

	if (state.status === "loading") {
		return <p>Loading raw snippet…</p>;
	}
	if (state.status === "not-found") {
		return <p>Snippet not found.</p>;
	}
	if (state.status === "error") {
		return <p>{state.message}</p>;
	}

	return <pre>{state.snippet.event.content}</pre>;
}
