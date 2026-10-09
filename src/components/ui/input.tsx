import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
	({ className, type = "text", ...props }, ref) => (
		<input
			className={cn(
				"w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50",
				className
			)}
			ref={ref}
			type={type}
			{...props}
		/>
	)
);

Input.displayName = "Input";

export { Input };
