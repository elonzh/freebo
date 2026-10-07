import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function PopupSurface({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <main className={cn("flex h-screen flex-col overflow-hidden", className)}>{children}</main>
  );
}
