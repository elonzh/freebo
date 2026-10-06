import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "../lib/utils";

export function PopupSurface({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    // Native windows restore the last focused control when shown again.
    if (open) root.current?.focus({ preventScroll: true });
  }, [open]);
  return (
    <main
      ref={root}
      tabIndex={-1}
      className={cn("flex h-screen flex-col overflow-hidden outline-none", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      {children}
    </main>
  );
}
