import { cn } from "../lib/utils";

/** Canonical Atma 600 lockup. Both variants have identical vector geometry. */
export function BrandLogo({ width = 240, className }: { width?: number; className?: string }) {
  return (
    <span
      className={cn("inline-block max-w-full", className)}
      role="img"
      aria-label="Freebo"
      style={{ width }}
    >
      <img src="./brand/logo.svg" alt="" className="block h-auto w-full dark:hidden" />
      <img src="./brand/logo-on-dark.svg" alt="" className="hidden h-auto w-full dark:block" />
    </span>
  );
}

export function BrandName({ className }: { className?: string }) {
  return <span className={cn("brand-name", className)}>Freebo</span>;
}
