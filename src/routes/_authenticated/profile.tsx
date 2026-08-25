import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { ChangePinDialog } from "@/components/ChangePinDialog";
import { ReferralPanel } from "@/components/ReferralPanel";
import { useBiometrics } from "@/hooks/useBiometrics";
import { Switch } from "@/components/ui/switch";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck, User as UserIcon, Phone, Mail, Wallet, KeyRound, Fingerprint } from "lucide-react";
import { toast } from "sonner";

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
              <BiometricSettings hasPin={!!profile?.transaction_pin_hash} />
            </div>

            <div className="mt-6">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Referrals</p>
              <ReferralPanel userId={profile?.id} />
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
  const { supported, enabled, pinSaved, enable, disable, rememberPin } = useBiometrics();
  const [askPin, setAskPin] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  if (!supported) {
    return (
      <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
        <p className="text-sm font-semibold text-foreground">Biometric unlock</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This device or browser does not offer Fingerprint / Face ID.
        </p>
      </div>
    );
  }

  async function toggle(next: boolean) {
    if (!next) {
      disable();
      toast.success("Biometric unlock turned off");
      return;
    }
    setBusy(true);
    const ok = await enable();
    setBusy(false);
    if (!ok) return toast.error("Could not register your biometrics");
    toast.success("Biometric unlock enabled");
  }

  function savePin() {
    if (pin.length !== 4) return toast.error("Enter your 4-digit transaction PIN");
    rememberPin(pin);
    setPin("");
    setAskPin(false);
    toast.success("You can now approve payments with biometrics");
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Fingerprint className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Unlock with biometrics</p>
          <p className="text-xs text-muted-foreground">Lock the app behind Fingerprint / Face ID</p>
        </div>
        <Switch checked={enabled} disabled={busy} onCheckedChange={toggle} />
      </div>

      {enabled && hasPin && (
        <div className="mt-4 border-t border-border/60 pt-3">
          {pinSaved ? (
            <p className="text-xs text-muted-foreground">
              Payments can be approved with biometrics on this device.
            </p>
          ) : askPin ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Enter your transaction PIN once to approve future payments with biometrics. It stays on this device only.
              </p>
              <div className="flex justify-center">
                <InputOTP maxLength={4} value={pin} onChange={setPin}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3].map((i) => (
                      <InputOTPSlot key={i} index={i} className="h-11 w-10 text-base" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button className="h-10 w-full rounded-full text-xs" onClick={savePin}>
                Save for biometric approvals
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="h-10 w-full rounded-full text-xs" onClick={() => setAskPin(true)}>
              Also approve payments with biometrics
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
