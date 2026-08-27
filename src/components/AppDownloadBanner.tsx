import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const APK_URL = "/downloads/swift_top.apk";
const DISMISS_KEY = "st_apk_banner_dismissed";

/** Starts the APK download, degrading to a friendly notice when the build isn't published yet. */
export async function downloadApp() {
  try {
    const res = await fetch(APK_URL, { method: "HEAD" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || type.includes("text/html")) {
      toast.message("The Android build is being prepared — check back shortly");
      return;
    }
    window.location.href = APK_URL;
  } catch {
    toast.message("The Android build is being prepared — check back shortly");
  }
}

/**
 * Promotes the installable mobile app, which is where Fingerprint / Face ID login works.
 * `dismissible` is used on the dashboard; the Profile copy always stays visible.
 */
export function AppDownloadBanner({ dismissible = false }: { dismissible?: boolean }) {
  const [hidden, setHidden] = useState(
    () => dismissible && typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1",
  );

  if (hidden) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5 p-4">
      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setHidden(true);
          }}
          className="absolute right-3 top-3 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 pr-6">
          <p className="font-display text-sm font-bold text-foreground">Get the Swift Top app</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Install the Swift Top mobile app to unlock instant Fingerprint &amp; Face ID login!
          </p>
        </div>
      </div>
      <Button
        onClick={() => { downloadApp().catch(() => undefined); }}
        className="mt-3 h-10 w-full rounded-full text-sm font-semibold"
      >
        <Download className="mr-2 h-4 w-4" />
        Download App
      </Button>
    </div>
  );
}
