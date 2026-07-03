import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { NETWORKS, BANKS } from "@/lib/vtu-options";
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

export const Route = createFileRoute("/_authenticated/airtime-to-cash")({
  component: AirtimeToCashPage,
});

function AirtimeToCashPage() {
  const [network, setNetwork] = useState("mtn");
  const [sender, setSender] = useState("");
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sender.length !== 11) return toast.error("Enter a valid sender phone number");
    if (!amount) return toast.error("Enter an amount");
    if (!bank) return toast.error("Select a bank");
    if (account.length !== 10) return toast.error("Enter a valid 10-digit account number");
    toast.success(`₦${amount} conversion request submitted`);
  }

  const payout = amount ? Math.floor(parseInt(amount, 10) * 0.75) : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Airtime to Cash" subtitle="Convert airtime to bank cash" />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-5 px-4 py-6">
        <div>
          <Label className="mb-2 block text-sm">Network</Label>
          <div className="grid grid-cols-4 gap-2">
            {NETWORKS.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setNetwork(n.id)}
                className={`flex h-14 flex-col items-center justify-center rounded-xl border text-xs font-semibold ${
                  network === n.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-surface text-muted-foreground"
                }`}
              >
                <span className="mb-1 h-3 w-3 rounded-full" style={{ backgroundColor: n.color }} />
                {n.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="sender" className="mb-2 block text-sm">
            Sender phone number
          </Label>
          <Input
            id="sender"
            inputMode="numeric"
            maxLength={11}
            placeholder="08012345678"
            value={sender}
            onChange={(e) => setSender(e.target.value.replace(/\D/g, ""))}
          />
        </div>

        <div>
          <Label htmlFor="amt" className="mb-2 block text-sm">
            Airtime amount (₦)
          </Label>
          <Input
            id="amt"
            inputMode="numeric"
            placeholder="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          />
          {amount && (
            <p className="mt-2 text-xs text-muted-foreground">
              You'll receive ≈ <span className="font-semibold text-primary">₦{payout.toLocaleString()}</span>{" "}
              (75% rate)
            </p>
          )}
        </div>

        <div>
          <Label className="mb-2 block text-sm">Bank</Label>
          <Select value={bank} onValueChange={setBank}>
            <SelectTrigger>
              <SelectValue placeholder="Select destination bank" />
            </SelectTrigger>
            <SelectContent>
              {BANKS.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="acct" className="mb-2 block text-sm">
            Account number
          </Label>
          <Input
            id="acct"
            inputMode="numeric"
            maxLength={10}
            placeholder="0123456789"
            value={account}
            onChange={(e) => setAccount(e.target.value.replace(/\D/g, ""))}
          />
        </div>

        <Button type="submit" className="mt-auto h-12 rounded-full text-base font-semibold">
          Submit request
        </Button>
      </form>
    </div>
  );
}
