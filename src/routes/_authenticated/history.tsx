import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["transactions", "all"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Transaction history" subtitle="All your recent activity" />
      <div className="flex-1 px-4 py-4 pb-24">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">Could not load history</p>
        ) : !data || data.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border/70 bg-surface/50 p-8 text-center">
            <Receipt className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No transactions yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Your bill payments will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between rounded-2xl border border-border/70 bg-surface/70 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold capitalize text-foreground">{String(tx.type).replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">−₦{Number(tx.amount).toLocaleString()}</p>
                  <p className={`text-[11px] capitalize ${tx.status === "success" ? "text-primary" : "text-muted-foreground"}`}>{tx.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
