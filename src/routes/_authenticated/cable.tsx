import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { CABLE_PROVIDERS } from "@/lib/vtu-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/cable")({
  component: CablePage,
});

function CablePage() {
  const [providerId, setProviderId] = useState<string>("dstv");
  const [smartcard, setSmartcard] = useState("");
  const [pkg, setPkg] = useState("");

  const provider = CABLE_PROVIDERS.find((p) => p.id === providerId)!;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (smartcard.length < 10) return toast.error("Enter a valid smartcard number");
    if (!pkg) return toast.error("Select a package");
    toast.success(`${provider.name} — ${pkg} queued`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Cable TV Subscription" subtitle="DSTV, GOTV & StarTimes" />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-5 px-4 py-6">
        <div>
          <Label className="mb-2 block text-sm">Provider</Label>
          <div className="grid grid-cols-3 gap-2">
            {CABLE_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProviderId(p.id);
                  setPkg("");
                }}
                className={`h-14 rounded-xl border text-sm font-semibold ${
                  providerId === p.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-surface text-muted-foreground"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="sc" className="mb-2 block text-sm">
            Smartcard / IUC number
          </Label>
          <Input
            id="sc"
            inputMode="numeric"
            placeholder="1234567890"
            value={smartcard}
            onChange={(e) => setSmartcard(e.target.value.replace(/\D/g, ""))}
          />
        </div>

        <div>
          <Label className="mb-2 block text-sm">Package</Label>
          <Select value={pkg} onValueChange={setPkg}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${provider.name} package`} />
            </SelectTrigger>
            <SelectContent>
              {provider.packages.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="mt-auto h-12 rounded-full text-base font-semibold">
          Continue
        </Button>
      </form>
    </div>
  );
}
