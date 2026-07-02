import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { EXAMS } from "@/lib/vtu-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/education")({
  component: EducationPage,
});

function EducationPage() {
  const [exam, setExam] = useState("waec");
  const [qty, setQty] = useState("1");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(qty || "0", 10);
    if (!n || n < 1) return toast.error("Enter a valid quantity");
    toast.success(`${n} ${exam.toUpperCase()} PIN(s) queued`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Education PINs" subtitle="Result tokens for WAEC, NECO, JAMB" />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-5 px-4 py-6">
        <div>
          <Label className="mb-2 block text-sm">Select exam board</Label>
          <div className="grid grid-cols-3 gap-2">
            {EXAMS.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setExam(e.id)}
                className={`flex h-20 flex-col items-center justify-center rounded-xl border text-sm font-semibold ${
                  exam === e.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-surface text-muted-foreground"
                }`}
              >
                {e.name}
                <span className="mt-1 text-xs font-normal opacity-80">{e.price}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="qty" className="mb-2 block text-sm">
            Quantity
          </Label>
          <Input
            id="qty"
            inputMode="numeric"
            placeholder="1"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
          />
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 text-xs text-muted-foreground">
          Your result tokens will be delivered to your Swift Top inbox and emailed to the address
          on file.
        </div>

        <Button type="submit" className="mt-auto h-12 rounded-full text-base font-semibold">
          Continue
        </Button>
      </form>
    </div>
  );
}
