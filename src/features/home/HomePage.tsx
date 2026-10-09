import { FaBolt, FaCode, FaLock, FaShareNodes } from "react-icons/fa6";

const benefits = [
	{ icon: FaBolt, title: "Fast", text: "Create and share in seconds." },
	{ icon: FaLock, title: "Private by design", text: "Your identity stays under your control." },
	{ icon: FaShareNodes, title: "Open", text: "Published through Nostr relays." },
	{ icon: FaCode, title: "Syntax highlighting", text: "Readable code across common languages." },
];

export function HomePage() {
	return (
		<section className="home-page">
			<div className="hero">
				<div className="hero-copy">
					<p className="eyebrow">Decentralized & private</p>
					<h1>
						Share code and text
						<br />
						on <em>Nostr</em>
					</h1>
					<p className="hero-lead">
						A simple, fast and decentralized pastebin powered by Nostr. Share code, notes and files
						with privacy and permanence.
					</p>
					<div className="hero-actions">
						<a className="button button-primary" href="/new">
							Create a paste
						</a>
						<a className="button button-secondary" href="/discover">
							Discover
						</a>
					</div>
				</div>
				<div className="hero-mark">
					<img alt="NostrBin" src="/logo.webp" />
					<span>NostrBin</span>
				</div>
			</div>
			<div className="benefit-grid">
				{benefits.map(({ icon: Icon, text, title }) => (
					<article key={title}>
						<Icon aria-hidden="true" />
						<h2>{title}</h2>
						<p>{text}</p>
					</article>
				))}
			</div>
		</section>
	);
}
