import { useHotkey } from "@tanstack/react-hotkeys";
import { type ChangeEvent, type FormEvent, lazy, Suspense, useMemo, useRef, useState } from "react";
import { useAppShell } from "@/app/AppShell";
import { useNostrSession } from "@/app/NostrSessionProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { inferLanguagePreset } from "@/features/snippet-editor/language-presets";
import { publishSnippet, type SnippetPublication } from "@/features/snippet-editor/publish";
import { exportCodeImage } from "@/features/snippet-viewer/code-image";
import { byteLength, formatByteSize } from "@/nostr/events/snippet";
import type { NostrSigner, SnippetDraft } from "@/nostr/types";

const CodePreview = lazy(() => import("@/features/paste-editor/CodePreview"));

export function NewSnippetPage() {
	const { clientTag, gateway, getSigner, resolveAuthorRelays, session } = useNostrSession();
	const { openAccountDialog } = useAppShell();
	const [name, setName] = useState("");
	const [language, setLanguage] = useState("");
	const [description, setDescription] = useState("");
	const [runtime, setRuntime] = useState("");
	const [licenses, setLicenses] = useState("");
	const [dependencies, setDependencies] = useState("");
	const [repository, setRepository] = useState("");
	const [topics, setTopics] = useState("");
	const [content, setContent] = useState("");
	const [isPublishing, setIsPublishing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [publication, setPublication] = useState<SnippetPublication | null>(null);
	const [showOptionalFields, setShowOptionalFields] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const [isExportingImage, setIsExportingImage] = useState(false);
	const [expirationPreset, setExpirationPreset] = useState("never");
	const [customExpiration, setCustomExpiration] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const size = useMemo(() => formatByteSize(byteLength(content)), [content]);
	const inferred = useMemo(() => inferLanguagePreset(name), [name]);
	const extension = inferred?.extension ?? "";
	const effectiveLanguage = language.trim() || inferred?.preset.language || "plaintext";
	const highlighterLanguage = inferred?.preset.highlighter ?? effectiveLanguage;
	const expiresAt = useMemo(
		() => resolveExpiration(expirationPreset, customExpiration),
		[customExpiration, expirationPreset]
	);

	useHotkey("Mod+Enter", (event) => {
		event.preventDefault();
		const form = document.getElementById("new-snippet-form");
		if (form instanceof HTMLFormElement) {
			form.requestSubmit();
		}
	});

	function updateFilename(value: string): void {
		setName(value);
		const nextPreset = inferLanguagePreset(value);
		setLanguage(nextPreset?.preset.language ?? "");
		setPublication(null);
	}

	async function handleFileImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		setError(null);
		if (file.size > 48 * 1024) {
			setError("Files imported into a snippet are limited to 48 KB.");
			return;
		}
		try {
			const importedContent = await file.text();
			if (byteLength(importedContent) > 48 * 1024) {
				setError("The decoded file content exceeds the 48 KB snippet limit.");
				return;
			}
			updateFilename(file.name);
			setContent(importedContent);
		} catch (reason) {
			setError(errorMessage(reason));
		}
	}

	async function handleExportImage(): Promise<void> {
		setError(null);
		setIsExportingImage(true);
		try {
			await exportCodeImage({
				filename: name || "snippet.txt",
				content,
				language: highlighterLanguage,
			});
		} catch (reason) {
			setError(errorMessage(reason));
		} finally {
			setIsExportingImage(false);
		}
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setError(null);
		setPublication(null);

		if (!session.publicKey) {
			setError("A signing key or NIP-07 extension is required.");
			openAccountDialog();
			return;
		}

		let signer: NostrSigner;
		try {
			signer = getSigner();
		} catch (reason) {
			setError(errorMessage(reason));
			openAccountDialog();
			return;
		}

		setIsPublishing(true);
		try {
			const authorRelays = await resolveAuthorRelays(session.publicKey);
			const draft: SnippetDraft = {
				name,
				content,
				language: effectiveLanguage,
				extension,
				description,
				runtime,
				licenses: commaSeparated(licenses),
				dependencies: commaSeparated(dependencies),
				repository,
				tags: commaSeparated(topics),
				...(expiresAt ? { expiresAt } : {}),
				...(clientTag ? { clientTag } : {}),
			};
			setPublication(await publishSnippet(draft, gateway, signer, authorRelays.writeRelayUrls));
		} catch (reason) {
			setError(errorMessage(reason));
		} finally {
			setIsPublishing(false);
		}
	}

	const acceptedRelayCount =
		publication?.result.relays.filter((relay) => relay.accepted).length ?? 0;

	return (
		<section className="page-shell new-snippet-page">
			<p className="eyebrow">Nostr code snippet</p>
			<h1>Create a new paste</h1>
			<p className="muted mt-2">Share one code file, note or text directly through your relays.</p>
			<form
				className="new-snippet-form"
				id="new-snippet-form"
				onSubmit={(event) => void handleSubmit(event)}
			>
				<div className="grid gap-4 md:grid-cols-2">
					<Field
						label="Filename"
						value={name}
						onChange={updateFilename}
						placeholder="hello.ts"
						required
					/>
					<Field
						label="Language"
						value={effectiveLanguage}
						onChange={setLanguage}
						placeholder="typescript"
					/>
				</div>
				{extension ? (
					<input aria-hidden="true" name="extension" type="hidden" value={extension} />
				) : null}
				<label className="flex flex-col gap-1" htmlFor="snippet-content">
					<span>Code</span>
					<Textarea
						className="min-h-96 font-mono"
						id="snippet-content"
						onChange={(event) => setContent(event.target.value)}
						placeholder="Write your code..."
						value={content}
					/>
					<small>{size} of 48 KB maximum</small>
				</label>
				<div className="flex flex-wrap gap-3">
					<input
						className="sr-only"
						onChange={(event) => void handleFileImport(event)}
						ref={fileInputRef}
						type="file"
					/>
					<Button
						className="w-auto px-4 text-base"
						onClick={() => fileInputRef.current?.click()}
						type="button"
						variant="secondary"
					>
						Add file
					</Button>
					<label className="flex items-center gap-2 text-sm" htmlFor="snippet-expiration">
						<span>Expires in</span>
						<select
							id="snippet-expiration"
							onChange={(event) => setExpirationPreset(event.target.value)}
							value={expirationPreset}
						>
							<option value="never">Never</option>
							<option value="day">24 hours</option>
							<option value="week">7 days</option>
							<option value="month">30 days</option>
							<option value="custom">Custom date</option>
						</select>
					</label>
					{expirationPreset === "custom" ? (
						<Input
							aria-label="Custom expiration"
							onChange={(event) => setCustomExpiration(event.target.value)}
							type="datetime-local"
							value={customExpiration}
						/>
					) : null}
					<Button
						aria-expanded={showPreview}
						className="w-auto px-4 text-base"
						onClick={() => setShowPreview((current) => !current)}
						type="button"
					>
						{showPreview ? "Hide preview" : "Preview"}
					</Button>
					<Button
						className="w-auto px-4 text-base"
						disabled={isExportingImage || !content}
						onClick={() => void handleExportImage()}
						type="button"
					>
						{isExportingImage ? "Exporting image…" : "Export image"}
					</Button>
					<Button
						aria-expanded={showOptionalFields}
						className="w-auto px-4 text-base"
						onClick={() => setShowOptionalFields((current) => !current)}
						type="button"
					>
						{showOptionalFields ? "Hide optional fields" : "Show optional fields"}
					</Button>
				</div>
				{showPreview ? (
					<section
						aria-label="Snippet preview"
						className="overflow-hidden rounded border border-current"
					>
						<Suspense fallback={<p className="p-4">Loading preview…</p>}>
							<CodePreview content={content} language={highlighterLanguage} />
						</Suspense>
					</section>
				) : null}
				{showOptionalFields ? (
					<div className="grid gap-4 md:grid-cols-2">
						<label className="flex flex-col gap-1 md:col-span-2" htmlFor="snippet-description">
							<span>Description</span>
							<Input
								id="snippet-description"
								onChange={(event) => setDescription(event.target.value)}
								placeholder="What does this snippet do?"
								value={description}
							/>
						</label>
						<Field label="Runtime" value={runtime} onChange={setRuntime} placeholder="node v24" />
						<Field
							label="License"
							value={licenses}
							onChange={setLicenses}
							placeholder="MIT, Apache-2.0"
						/>
						<Field
							label="Dependencies"
							value={dependencies}
							onChange={setDependencies}
							placeholder="nostr-tools, react"
						/>
						<Field
							label="Repository"
							value={repository}
							onChange={setRepository}
							placeholder="https://example.com/repo"
						/>
						<Field
							label="Topics"
							value={topics}
							onChange={setTopics}
							placeholder="nostr, example"
						/>
					</div>
				) : null}
				<div className="flex items-center gap-3">
					<Button disabled={isPublishing} type="submit">
						{isPublishing ? "Publishing…" : "Publish snippet (Ctrl/⌘ Enter)"}
					</Button>
					<small>
						{clientTag
							? "The configured NIP-89 client tag will be included."
							: "No application client tag is configured."}
					</small>
				</div>
				{error ? <p role="alert">{error}</p> : null}
			</form>
			{publication ? (
				<section className="mt-8 rounded border border-current p-4" role="status">
					<h2 className="text-2xl">
						{acceptedRelayCount === publication.result.relays.length
							? "Published"
							: "Partially published"}
					</h2>
					<p>
						{acceptedRelayCount} / {publication.result.relays.length} relays accepted this snippet.
					</p>
					<p className="mt-2 break-all text-sm">Nostr reference: {publication.reference}</p>
					<ul className="mt-3 flex flex-col gap-1">
						{publication.result.relays.map((relay) => (
							<li key={relay.relayUrl}>
								{relay.accepted ? "✓" : "✗"} {relay.relayUrl}
								{relay.message ? ` — ${relay.message}` : ""}
							</li>
						))}
					</ul>
				</section>
			) : null}
		</section>
	);
}

interface FieldProps {
	label: string;
	value: string;
	onChange(value: string): void;
	placeholder: string;
	required?: boolean;
}

function Field({ label, onChange, placeholder, required = false, value }: FieldProps) {
	const id = `snippet-${label.toLowerCase().replaceAll(" ", "-")}`;
	return (
		<label className="flex flex-col gap-1" htmlFor={id}>
			<span>{label}</span>
			<Input
				id={id}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				required={required}
				value={value}
			/>
		</label>
	);
}

function commaSeparated(value: string): string[] {
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function errorMessage(reason: unknown): string {
	return reason instanceof Error ? reason.message : "Unable to publish this snippet.";
}

function resolveExpiration(preset: string, customValue: string): number | undefined {
	const now = Date.now();
	const durationByPreset: Record<string, number> = {
		day: 86_400_000,
		week: 604_800_000,
		month: 2_592_000_000,
	};
	const duration = durationByPreset[preset];
	if (duration) {
		return Math.floor((now + duration) / 1_000);
	}
	if (preset !== "custom" || !customValue) {
		return undefined;
	}
	const timestamp = new Date(customValue).getTime();
	return Number.isFinite(timestamp) && timestamp > now ? Math.floor(timestamp / 1_000) : undefined;
}
