import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";

export type ReceiptTx = { id: string; type: string; amount: number; status: string; reference: string | null; created_at: string; wholesale_price?: number | null; metadata?: Record<string, unknown> | null };

const FEE_TYPES = new Set(["electricity", "cable", "education"]);
function rows(tx: ReceiptTx): [string, string][] {
  const m = (tx.metadata ?? {}) as Record<string, unknown>;
  const provider = String(m.network ?? m.provider ?? m.disco ?? m.exam ?? "Swift Top");
  const beneficiary = String(m.phone ?? m.meter_number ?? m.meter ?? m.smartcard ?? m.account_number ?? "—");
  const fee = FEE_TYPES.has(tx.type) ? 100 : 0;
  return [
    ["Status", tx.status === "success" ? "Successful" : tx.status === "failed" ? "Failed" : "Pending"],
    ["Service", String(tx.type).replace(/_/g, " ")],
    ["Provider", provider],
    ["Beneficiary", beneficiary],
    ["Fee", `₦${fee.toLocaleString()}`],
    ["Amount", `₦${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
    ["Date", new Date(tx.created_at).toLocaleString()],
    ["Reference", tx.reference ?? tx.id],
  ];
}

async function renderPng(tx: ReceiptTx): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 720; c.height = 900;
  const g = c.getContext("2d")!;
  const css = getComputedStyle(document.documentElement);
  const bg = css.getPropertyValue("--background").trim() || "#0b1220";
  g.fillStyle = bg.startsWith("oklch") ? "#0b1220" : bg; g.fillRect(0, 0, 720, 900);
  g.fillStyle = "#14b8a6"; g.font = "bold 44px sans-serif"; g.fillText("Swift Top", 48, 96);
  g.fillStyle = "#94a3b8"; g.font = "24px sans-serif"; g.fillText("Transaction receipt", 48, 140);
  let y = 230;
  for (const [k, v] of rows(tx)) {
    g.fillStyle = "#94a3b8"; g.font = "22px sans-serif"; g.fillText(k, 48, y);
    g.fillStyle = "#f1f5f9"; g.font = "bold 28px sans-serif";
    g.fillText(v.length > 34 ? v.slice(0, 34) + "…" : v, 48, y + 40); y += 110;
  }
  return new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
}

export function ReceiptSheet({ tx, onOpenChange }: { tx: ReceiptTx | null; onOpenChange: (v: boolean) => void }) {
  async function download() {
    if (!tx) return;
    const url = URL.createObjectURL(await renderPng(tx));
    const a = document.createElement("a"); a.href = url; a.download = `swift-top-${tx.id.slice(0, 8)}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function share() {
    if (!tx) return;
    const file = new File([await renderPng(tx)], `swift-top-${tx.id.slice(0, 8)}.png`, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title: "Swift Top receipt" }); } catch { /* dismissed */ }
    } else { await download(); toast.message("Receipt saved — share it from your gallery"); }
  }
  return (
    <Sheet open={!!tx} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border bg-background pb-8">
        <SheetHeader><SheetTitle className="font-display">Transaction receipt</SheetTitle></SheetHeader>
        {tx && (
          <div className="mt-3 flex justify-center">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tx.status === "success" ? "bg-primary/15 text-primary" : tx.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
              {tx.status === "success" ? "Successful" : tx.status === "failed" ? "Failed" : "Pending"}
            </span>
          </div>
        )}
        {tx && (
          <dl className="mt-4 space-y-3 rounded-2xl border border-border bg-surface p-4">
            {rows(tx).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="break-all text-right font-semibold capitalize text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="h-12 flex-1 rounded-full" onClick={download}><Download className="mr-2 h-4 w-4" />Download</Button>
          <Button className="h-12 flex-1 rounded-full" onClick={share}><Share2 className="mr-2 h-4 w-4" />Share / Download Receipt</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
