import { buttonVariants } from "@/components/ui/button";

export function NotFoundPage() {
	return (
		<section className="flex flex-col items-center gap-5 pt-16 text-center">
			<h1 className="text-5xl">Oops...</h1>
			<p className="text-2xl">This page does not exist.</p>
			<a className={buttonVariants()} href="/">
				Go Back
			</a>
		</section>
	);
}
