import { lazy, Suspense, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useAppShell } from "@/app/AppShell";
import { useNostrSession } from "@/app/NostrSessionProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	type EditorValidation,
	hasEditorValidationErrors,
	isMarkdownFilename,
	validateEditorDraft,
} from "@/features/paste-editor/editor";
import { publishPaste } from "@/features/paste-editor/publish";
import type { NostrSigner } from "@/nostr/types";
import { navigate } from "@/routes/navigation";

const MarkdownPreview = lazy(() => import("@/features/paste-editor/MarkdownPreview"));
const CodePreview = lazy(() => import("@/features/paste-editor/CodePreview"));

export function PasteEditorPage() {
	const [filename, setFilename] = useState("");
	const [content, setContent] = useState("");
	const [previewMode, setPreviewMode] = useState(false);
	const [validation, setValidation] = useState<EditorValidation>({});
	const [publishError, setPublishError] = useState<string | null>(null);
	const [isPublishing, setIsPublishing] = useState(false);
	const { gateway, getSigner } = useNostrSession();
	const { openAccountDialog } = useAppShell();

	async function publish(): Promise<void> {
		const nextValidation = validateEditorDraft({ filename, content });
		setValidation(nextValidation);
		setPublishError(null);

		if (hasEditorValidationErrors(nextValidation)) {
			return;
		}

		let signer: NostrSigner;
		try {
			signer = getSigner();
		} catch (reason) {
			setPublishError(errorMessage(reason));
			openAccountDialog();
			return;
		}

		setIsPublishing(true);
		try {
			const reference = await publishPaste({ filename, content }, gateway, signer);
			navigate(`/${reference}`);
		} catch (reason) {
			setPublishError(errorMessage(reason));
		} finally {
			setIsPublishing(false);
		}
	}

	return (
		<section>
			<h1>Welcome to NostrBin</h1>
			<p>
				The original decentralized pasting platform, built on{" "}
				<a className="underline" href="https://usenostr.org">
					Nostr
				</a>
			</p>

			<div className="mt-4 flex flex-col rounded border border-[#bbbbbb]" id="editbox">
				<div className="m-3 flex flex-wrap gap-3">
					<div className="w-28">
						<Input
							aria-invalid={Boolean(validation.filename)}
							onChange={(event) => {
								setFilename(event.target.value);
								setPublishError(null);
							}}
							placeholder="README.md"
							value={filename}
						/>
					</div>
					<button
						aria-label={previewMode ? "Disable preview" : "Enable preview"}
						className="my-auto flex cursor-pointer items-center gap-5 rounded outline-none focus-visible:ring-2 focus-visible:ring-current"
						onClick={() => setPreviewMode((current) => !current)}
						title="Preview"
						type="button"
					>
						{previewMode ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
						<small>
							Append <code>.md</code> to your filename to enter Markdown Mode!
						</small>
					</button>
				</div>

				{previewMode ? (
					<Suspense fallback={<p className="h-[50vh] p-4">Loading preview…</p>}>
						{isMarkdownFilename(filename) ? (
							<div className="h-[50vh] overflow-auto px-4 py-2">
								<MarkdownPreview content={content} />
							</div>
						) : (
							<CodePreview content={content} />
						)}
					</Suspense>
				) : (
					<Textarea
						aria-invalid={Boolean(validation.content)}
						className="h-[50vh] rounded-none border-x-0 border-b-0"
						onChange={(event) => {
							setContent(event.target.value);
							setPublishError(null);
						}}
						placeholder="Write your paste..."
						value={content}
					/>
				)}
			</div>

			<div className="mt-3 flex flex-col gap-2">
				<div className="flex items-center gap-3">
					<Button disabled={isPublishing} onClick={() => void publish()}>
						{isPublishing ? "Posting…" : "Post"}
					</Button>
					<small>
						Make sure you inputted or generated your keys before attempting to post! Click the
						profile icon in the top right to get started.
					</small>
				</div>
				{validation.filename ? <p role="alert">{validation.filename}</p> : null}
				{validation.content ? <p role="alert">{validation.content}</p> : null}
				{publishError ? <p role="alert">{publishError}</p> : null}
			</div>
		</section>
	);
}

function errorMessage(reason: unknown): string {
	return reason instanceof Error ? reason.message : "Unable to publish the paste.";
}
