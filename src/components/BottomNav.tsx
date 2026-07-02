import { Link } from "@tanstack/react-router";
import { Home, Receipt, User } from "lucide-react";

const items = [
  { to: "/" as const, icon: Home, label: "Home" },
  { to: "/" as const, icon: Receipt, label: "History" },
  { to: "/" as const, icon: User, label: "Profile" },
];

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-20 mt-8 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
      <ul className="flex items-center justify-around">
        {items.map((it, i) => (
          <li key={i}>
            <Link
              to={it.to}
              className="flex flex-col items-center gap-1 text-xs text-muted-foreground [&.active]:text-primary"
              activeProps={{ className: "active" }}
              activeOptions={{ exact: true }}
            >
              <it.icon className="h-5 w-5" />
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
