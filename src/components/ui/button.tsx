import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex h-10 cursor-pointer items-center justify-center rounded-md border px-4 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default:
					"border-[var(--color-primary)] bg-[var(--color-primary)] text-[#071426] hover:bg-[var(--color-primary-hover)]",
				secondary:
					"border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]",
				ghost:
					"border-transparent bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]",
				danger:
					"border-[var(--color-danger)] bg-transparent text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)]",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, type = "button", ...props }, ref) => (
		<button
			className={cn(buttonVariants({ variant }), className)}
			ref={ref}
			type={type}
			{...props}
		/>
	)
);

Button.displayName = "Button";

export { Button, buttonVariants };
