import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type ComponentPropsWithoutRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogContent = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay className="fixed inset-0 z-30 bg-transparent backdrop-blur-sm" />
		<DialogPrimitive.Content
			className={cn(
				"fixed top-1/2 left-1/2 z-40 max-h-[calc(100vh-4rem)] w-[calc(100vw-2rem)] max-w-[32rem] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[var(--color-text)] shadow-2xl outline-none",
				className
			)}
			ref={ref}
			{...props}
		/>
	</DialogPrimitive.Portal>
));

DialogContent.displayName = DialogPrimitive.Content.displayName;

export { Dialog, DialogClose, DialogContent, DialogTrigger };
