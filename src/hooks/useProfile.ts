import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  wallet_balance: number;
  bvn: string | null;
  bvn_verified: boolean;
  dedicated_account_number: string | null;
  dedicated_account_bank: string | null;
  dedicated_account_name: string | null;
  transaction_pin_hash: string | null;
};

export function useProfile() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  return q;
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("*")
        .eq("id", "global")
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; use_dedicated_accounts: boolean } | null;
    },
    staleTime: 60_000,
  });
}
