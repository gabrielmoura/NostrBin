import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DiscoverFiltersProps {
	language: string;
	languages: readonly string[];
	onLanguageChange(value: string): void;
	onQueryChange(value: string): void;
	query: string;
}

/**
 * Controlled, presentation-only discovery controls. Keeping this separate lets
 * the relay-query behavior evolve independently from the Discover layout.
 */
export function DiscoverFilters({
	language,
	languages,
	onLanguageChange,
	onQueryChange,
	query,
}: DiscoverFiltersProps) {
	const hasActiveFilters = Boolean(language || query);

	return (
		<div className="discover-filters">
			<label className="discover-search" htmlFor="discover-search">
				<span className="sr-only">Search loaded snippets</span>
				<Input
					id="discover-search"
					onChange={(event) => onQueryChange(event.target.value)}
					placeholder="Search filename, description, tag or author…"
					value={query}
				/>
			</label>
			<label className="discover-select" htmlFor="discover-language">
				<span>Language</span>
				<select
					id="discover-language"
					onChange={(event) => onLanguageChange(event.target.value)}
					value={language}
				>
					<option value="">All languages</option>
					{languages.map((value) => (
						<option key={value} value={value}>
							{value}
						</option>
					))}
				</select>
			</label>
			{hasActiveFilters ? (
				<Button
					className="discover-clear"
					onClick={() => {
						onQueryChange("");
						onLanguageChange("");
					}}
					type="button"
					variant="ghost"
				>
					Clear filters
				</Button>
			) : null}
		</div>
	);
}
