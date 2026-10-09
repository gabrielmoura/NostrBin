import { useEffect, useState } from "react";
import { useNostrSession } from "@/app/NostrSessionProvider";
import { parseSnippet, parseSnippetReference } from "@/nostr/events/snippet";
import type { EventId, Snippet } from "@/nostr/types";

export type SnippetLoadState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "not-found" }
	| { status: "loaded"; eventId: EventId; snippet: Snippet };

export function useSnippetEvent(reference: string): SnippetLoadState {
	const { gateway } = useNostrSession();
	const [state, setState] = useState<SnippetLoadState>({ status: "loading" });

	useEffect(() => {
		let active = true;
		setState({ status: "loading" });

		void (async () => {
			try {
				const parsedReference = parseSnippetReference(reference);
				gateway.addRelayHints(parsedReference.relayHints);
				const event = await gateway.getEventById(parsedReference.eventId);
				if (!active) {
					return;
				}
				if (!event) {
					setState({ status: "not-found" });
					return;
				}

				const snippet = parseSnippet(event);
				setState(
					snippet
						? { status: "loaded", eventId: parsedReference.eventId, snippet }
						: { status: "error", message: "This event is not a NIP-C0 code snippet." }
				);
			} catch (reason) {
				if (active) {
					setState({ status: "error", message: errorMessage(reason) });
				}
			}
		})();

		return () => {
			active = false;
		};
	}, [gateway, reference]);

	return state;
}

function errorMessage(reason: unknown): string {
	return reason instanceof Error ? reason.message : "Unable to load this snippet.";
}
