import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
	({ className, ...props }, ref) => (
		<textarea
			className={cn(
				"w-full resize-none rounded-md border border-[var(--color-border)] bg-[#08111f] p-2.5 text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50",
				className
			)}
			ref={ref}
			{...props}
		/>
	)
);

Textarea.displayName = "Textarea";

export { Textarea };
