interface FoundationPageProps {
	pathname: string;
}

export function FoundationPage({ pathname }: FoundationPageProps) {
	const isEventRoute = pathname !== "/";

	return (
		<section className="flex min-h-80 flex-col justify-center gap-3 text-center">
			<h1 className="text-5xl">{isEventRoute ? "Paste view" : "Welcome to NostrBin"}</h1>
			<p className="text-xl">
				{isEventRoute
					? "The Nostr-backed paste viewer is being wired in the next migration stage."
					: "The decentralized pasting platform, built on Nostr."}
			</p>
		</section>
	);
}
