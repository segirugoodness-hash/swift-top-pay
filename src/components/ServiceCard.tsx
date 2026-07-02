import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

type LinkProps = ComponentProps<typeof Link>;

export function ServiceCard({
  to,
  label,
  icon: Icon,
  tint = "teal",
}: {
  to: LinkProps["to"];
  label: string;
  icon: LucideIcon;
  tint?: "teal" | "emerald";
}) {
  const bg =
    tint === "teal"
      ? "bg-[color:oklch(0.78_0.15_190_/_0.14)] text-[color:oklch(0.85_0.14_190)]"
      : "bg-[color:oklch(0.72_0.18_160_/_0.14)] text-[color:oklch(0.85_0.17_160)]";
  return (
    <Link
      to={to}
      className="group flex min-h-[104px] flex-col justify-between rounded-2xl border border-border/70 bg-surface p-4 transition active:scale-[0.98] hover:border-primary/50"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="mt-3 text-sm font-semibold text-foreground">{label}</span>
    </Link>
  );
}
