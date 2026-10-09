import { describe, expect, it } from "vitest";
import { PublicationSettingsStore } from "@/nostr/publication-settings";

function storage(initialValues: Record<string, string> = {}) {
	const values = new Map(Object.entries(initialValues));
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
	};
}

describe("publication settings", () => {
	it("identifies the client by default and persists an opt-out", () => {
		const localStorage = storage();
		const settings = new PublicationSettingsStore(localStorage);

		expect(settings.snapshot.identifyClient).toBe(true);
		settings.setIdentifyClient(false);
		expect(settings.snapshot.identifyClient).toBe(false);
		expect(new PublicationSettingsStore(localStorage).snapshot.identifyClient).toBe(false);
	});
});
