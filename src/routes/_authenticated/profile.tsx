import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { ChangePinDialog } from "@/components/ChangePinDialog";
import { ReferralPanel } from "@/components/ReferralPanel";
import { AppDownloadBanner } from "@/components/AppDownloadBanner";
import { BiometricUnavailableDialog } from "@/components/BiometricUnavailableDialog";
import { useBiometrics } from "@/hooks/useBiometrics";
import { PasskeyDevices } from "@/components/PasskeyDevices";
import { SmartVaultCard } from "@/components/SmartVaultCard";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck, User as UserIcon, Phone, Mail, Wallet, KeyRound, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { registerPasskey } from "@/lib/passkeys";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "SU").trim();
  const parts = src.split(/\s+/);
  return (parts[0]?.[0] ?? "S").toUpperCase() + (parts[1]?.[0] ?? parts[0]?.[1] ?? "U").toUpperCase();
}

function ProfilePage() {
  const { data: profile, isLoading, error } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pinOpen, setPinOpen] = useState(false);

  const { data: authUser } = useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Profile" subtitle="Your Swift Top account" />
      <div className="flex-1 px-4 py-6 pb-24">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-surface/70" />
            <div className="h-32 animate-pulse rounded-2xl bg-surface/70" />
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">Could not load profile</p>
        ) : (
          <>
            <div className="mb-4">
              <AppDownloadBanner />
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-surface/70 p-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[color:oklch(0.78_0.15_190)] to-[color:oklch(0.62_0.18_160)] font-display text-xl font-bold text-black">
                {initials(profile?.full_name, authUser?.email)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {profile?.full_name || "Swift Top user"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{authUser?.email ?? "—"}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-2xl border border-border/70 bg-surface/70 p-2">
              <Row icon={UserIcon} label="Full name" value={profile?.full_name || "—"} />
              <Row icon={Mail} label="Email" value={authUser?.email || "—"} />
              <Row icon={Phone} label="Phone" value={profile?.phone || "—"} />
              <Row
                icon={Wallet}
                label="Wallet balance"
                value={`₦${Number(profile?.wallet_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
              <Row
                icon={ShieldCheck}
                label="Transaction PIN"
                value={profile?.transaction_pin_hash ? "Set" : "Not set"}
              />
            </div>

            <div className="mt-6">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Security settings</p>
              <div className="rounded-2xl border border-border/70 bg-surface/70">
                {profile?.transaction_pin_hash ? (
                  <button
                    onClick={() => setPinOpen(true)}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left transition hover:bg-surface"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">Change transaction PIN</p>
                      <p className="text-xs text-muted-foreground">Verify current PIN and set a new one</p>
                    </div>
                  </button>
                ) : (
                  <Button
                    variant="secondary"
                    className="h-11 w-full rounded-full"
                    onClick={() => navigate({ to: "/create-pin" })}
                  >
                    Create transaction PIN
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <PasskeyDevices />
            </div>

            <div className="mt-4">
              <BiometricSettings hasPin={!!profile?.transaction_pin_hash} />
            </div>

            <div className="mt-6"><SmartVaultCard /></div>

            <div className="mt-6">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Referrals</p>
              <ReferralPanel userId={profile?.id} />
              <a href="/refer" className="mt-2 block text-center text-sm font-semibold text-primary">Open Refer &amp; Earn →</a>
            </div>



            <div className="mt-4 space-y-2">
              <Button
                variant="outline"
                className="h-11 w-full rounded-full"
                onClick={() => { signOut().catch(() => toast.error("Could not sign out")); }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </div>
          </>
        )}
      </div>
      <ChangePinDialog open={pinOpen} onOpenChange={setPinOpen} />
      <BottomNav />
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

/** Device-local Fingerprint / Face ID settings: app lock plus optional PIN-free approvals. */
function BiometricSettings({ hasPin }: { hasPin: boolean }) {
  const { canEnroll, enabled, loading, supported, enable, disable } = useBiometrics();
  const [busy, setBusy] = useState(false);
  const [needApp, setNeedApp] = useState(false);

  if (!supported && !enabled) {
    return (
      <>
        <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Fingerprint className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Biometric payment confirmation</p>
              <p className="text-xs text-muted-foreground">This device does not support a platform biometric check</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="mt-3 h-10 w-full rounded-full text-xs"
            onClick={() => setNeedApp(true)}
          >
            Biometric confirmation unavailable
          </Button>
        </div>
        <BiometricUnavailableDialog open={needApp} onOpenChange={setNeedApp} />
      </>
    );
  }

  async function toggle(next: boolean) {
    if (!next) {
      setBusy(true);
      const disabled = await disable();
      setBusy(false);
      if (!disabled) return toast.error("Could not update payment security");
      toast.success("Biometric payment confirmation turned off");
      return;
    }
    if (!hasPin) return toast.error("Set a transaction PIN before enabling biometrics");
    if (!canEnroll) {
      setNeedApp(true);
      return;
    }
    setBusy(true);
    try {
      await registerPasskey();
      const ok = await enable();
      if (!ok) throw new Error("Could not enable biometric payment confirmation");
      toast.success("Payments now require your PIN and a biometric check");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Biometric setup was cancelled");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
      <BiometricUnavailableDialog open={needApp} onOpenChange={setNeedApp} />
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Fingerprint className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Biometric payment confirmation</p>
          <p className="text-xs text-muted-foreground">Add Face ID / fingerprint after your transaction PIN</p>
        </div>
        <Switch checked={enabled} disabled={busy || loading} onCheckedChange={toggle} />
      </div>

      {enabled && <p className="mt-3 text-xs text-muted-foreground">Every payment requires both your 4-digit PIN and a verified device biometric.</p>}
    </div>
  );
}
