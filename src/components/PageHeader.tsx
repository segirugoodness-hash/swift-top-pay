import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur">
      <Link
        to="/"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:border-primary hover:text-primary"
        aria-label="Back to dashboard"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </header>
  );
}
