import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Zap, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { IosInstallDialog } from "@/components/AppDownloadBanner";
import { getReferrerName } from "@/lib/admin.functions";

export const Route = createFileRoute("/signup")({
  component: SignupLanding,
  head: () => ({
    meta: [
      { title: "Join Swift Top — Cheap Data, Airtime & Bills" },
      {
        name: "description",
        content:
          "You've been invited to Swift Top. Create your free wallet to buy cheap data and airtime and pay electricity, cable TV and exam bills instantly.",
      },
      { property: "og:title", content: "Join Swift Top — Cheap Data, Airtime & Bills" },
      {
        property: "og:description",
        content: "Create your free Swift Top wallet and start paying bills in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function SignupLanding() {
  const navigate = useNavigate();
  const resolveRef = useServerFn(getReferrerName);
  const { canInstall, isStandalone, promptInstall } = useInstallPrompt();
  const [showIos, setShowIos] = useState(false);
  const [referrer, setReferrer] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("ref");
    if (!value) return;
    setRef(value);
    // Persist through OTP verification so the bonus still attaches after sign-up.
    try {
      sessionStorage.setItem("st_ref", value);
      localStorage.setItem("st_ref", value);
    } catch {
      // private mode — referral simply won't be tracked
    }
    resolveRef({ data: { ref: value } })
      .then((r) => setReferrer(r.name))
      .catch(() => setReferrer(null));
  }, [resolveRef]);

  async function install() {
    if (canInstall) {
      await promptInstall();
      return;
    }
    setShowIos(true);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Zap className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Welcome to Swift Top</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cheap data & airtime, electricity, cable TV and exam PINs — all from one wallet.
          </p>
        </div>

        {referrer && (
          <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5 p-4">
            <div className="mb-1 flex items-center gap-2 text-primary">
              <Gift className="h-4 w-4" />
              <p className="text-sm font-bold">{referrer} invited you</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Create your account and fund your wallet — your invite is credited automatically on your first funding.
            </p>
          </div>
        )}

        {!isStandalone && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-foreground">Install Swift Top</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add Swift Top to your home screen for one-tap access and Fingerprint / Face ID sign-in.
            </p>
            <Button
              variant="outline"
              className="mt-3 h-10 w-full rounded-full text-xs"
              onClick={() => {
                install().catch(() => undefined);
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add to Home Screen
            </Button>
          </div>
        )}

        <Button
          className="h-12 w-full rounded-full text-sm font-semibold"
          onClick={() =>
            navigate({ to: "/auth", search: ref ? { mode: "signup", ref } : { mode: "signup" } })
          }
        >
          Create my free account <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={() => navigate({ to: "/auth" })}
          className="w-full py-1 text-center text-sm text-muted-foreground"
        >
          I already have an account
        </button>
      </div>
      <IosInstallDialog open={showIos} onOpenChange={setShowIos} />
    </main>
  );
}
