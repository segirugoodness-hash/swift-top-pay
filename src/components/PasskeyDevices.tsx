import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listPasskeys, deletePasskey } from "@/lib/passkeys.functions";
import { passkeysSupported, registerPasskey } from "@/lib/passkeys";

/** Manage the devices allowed to sign in with Fingerprint / Face ID. */
export function PasskeyDevices() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data: devices, isLoading } = useQuery({
    queryKey: ["passkeys"],
    queryFn: () => listPasskeys(),
  });

  async function addDevice() {
    if (!passkeysSupported()) {
      toast.error("This device doesn't support Fingerprint / Face ID sign-in");
      return;
    }
    setBusy(true);
    try {
      await registerPasskey();
      await qc.invalidateQueries({ queryKey: ["passkeys"] });
      toast.success("This device can now sign in with Fingerprint / Face ID");
    } catch (e) {
      toast.error((e as Error).message || "Setup was cancelled");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deletePasskey({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["passkeys"] });
      toast.success("Device removed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Fingerprint className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Fingerprint / Face ID sign-in</p>
          <p className="text-xs text-muted-foreground">Sign in without typing a code on these devices</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <div className="h-10 animate-pulse rounded-xl bg-surface" />
        ) : devices && devices.length > 0 ? (
          devices.map((d) => (
            <div key={d.id} className="flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{d.device_label ?? "Device"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {d.last_used_at ? `Last used ${new Date(d.last_used_at).toLocaleDateString()}` : "Not used yet"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Remove device"
                onClick={() => { remove(d.id).catch(() => undefined); }}
                className="flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No devices set up yet.</p>
        )}
      </div>

      <Button
        variant="outline"
        disabled={busy}
        onClick={() => { addDevice().catch(() => undefined); }}
        className="mt-3 h-12 w-full rounded-full text-xs"
      >
        <Fingerprint className="mr-2 h-4 w-4" />
        {busy ? "Waiting for your fingerprint…" : "Set up this device"}
      </Button>
    </div>
  );
}
