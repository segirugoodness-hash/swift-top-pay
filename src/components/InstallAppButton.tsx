import { useState } from "react";
import { Download, Share, PlusSquare, CheckSquare } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { toast } from "sonner";

/** Header download icon → install sheet. Hidden when already running as the installed app. */
export function InstallAppButton() {
  const { canInstall, isStandalone, isIOS, promptInstall } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  if (isStandalone) return null;

  async function install() {
    const ok = await promptInstall();
    if (ok) { toast.success("Swift Top installed"); setOpen(false); }
    else if (!canInstall) toast.message("Use your browser menu → Install app / Add to Home Screen");
  }

  const steps = [
    { icon: Share, text: "Tap the 'Share' icon in the Safari navigation bar." },
    { icon: PlusSquare, text: "Scroll down and select 'Add to Home Screen'." },
    { icon: CheckSquare, text: "Tap 'Add' in the top right corner to launch full-screen without URL bars." },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Install App"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary"
      >
        <Download className="h-5 w-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-background pb-8">
          <SheetHeader className="text-center">
            <SheetTitle className="font-display">Install Swift Top App</SheetTitle>
            <SheetDescription>Full-screen access, faster loading, fingerprint sign-in.</SheetDescription>
          </SheetHeader>
          {isIOS ? (
            <ol className="mt-5 space-y-3">
              {steps.map((s, i) => (
                <li key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><s.icon className="h-4 w-4" /></span>
                  <p className="text-sm text-foreground"><span className="font-semibold">{i + 1}.</span> {s.text}</p>
                </li>
              ))}
            </ol>
          ) : (
            <Button className="mt-6 h-12 w-full rounded-full text-base font-semibold" onClick={install}>
              <Download className="mr-2 h-4 w-4" /> Install Now
            </Button>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
