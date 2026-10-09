export function navigate(pathname: string): void {
	window.history.pushState(null, "", pathname);
	window.dispatchEvent(new PopStateEvent("popstate"));
}
