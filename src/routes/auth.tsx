import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Zap } from "lucide-react";
import { DIGITS_ONLY, otpErrorMessage } from "@/lib/otp-errors";
import { offerBiometricSetup } from "@/components/BiometricSetupSheet";
import { Fingerprint } from "lucide-react";
import { passkeysSupported, signInWithPasskey } from "@/lib/passkeys";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Swift Top" },
      { name: "description", content: "Sign in or create a Swift Top account to pay bills, buy airtime and data instantly." },
    ],
  }),
});

type Mode = "login" | "signup" | "verify" | "forgot" | "reset";
type OtpPurpose = "signup" | "recover" | "signin";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose>("signup");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    // Referral links look like /auth?ref=<user_id>; remember it until signup completes.
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      sessionStorage.setItem("st_ref", ref);
      localStorage.setItem("st_ref", ref);
    }
    if (params.get("mode") === "signup") setMode("signup");
  }, []);

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data }) => {
        if (data.user) navigate({ to: "/" });
      })
      .catch(() => toast.error("Could not check your sign-in status"));
  }, [navigate]);

  /** Links the new account to whoever referred them (no-op when there is no ref). */
  async function attachReferral() {
    const ref = sessionStorage.getItem("st_ref") ?? localStorage.getItem("st_ref");
    if (!ref) return;
    try {
      await supabase.rpc("attach_referrer", { _referrer: ref });
      sessionStorage.removeItem("st_ref");
      localStorage.removeItem("st_ref");
    } catch {
      // referral tracking must never block sign-in
    }
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) return toast.error("Enter your email address");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setOtpPurpose("signin");
      setMode("verify");
      setCooldown(60);
      toast.success("We sent a 6-digit sign-in code to your email");
    } catch (error) {
      toast.error(otpErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  /** Passwordless sign-in with a 6-digit email code. */
  async function handleOtpSignIn() {
    if (!/.+@.+\..+/.test(email)) return toast.error("Enter your email address first");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) throw error;
      setOtpPurpose("signin");
      setMode("verify");
      setCooldown(60);
      toast.success("We sent a 6-digit sign-in code to your email");
    } catch (error) {
      toast.error(otpErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  /** Returning users: fingerprint / Face ID instead of a password or a code. */
  async function handlePasskeySignIn() {
    if (!passkeysSupported()) {
      return toast.error("This device doesn't support Fingerprint / Face ID sign-in");
    }
    setLoading(true);
    try {
      await signInWithPasskey();
      await attachReferral();
      toast.success("Signed in");
      navigate({ to: "/" });
    } catch (e) {
      const msg = (e as Error).message || "";
      toast.error(
        /not set up|couldn't find/i.test(msg)
          ? "This device isn't set up yet — sign in once, then enable Fingerprint / Face ID."
          : msg || "Fingerprint sign-in was cancelled",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (phone.length !== 11) return toast.error("Enter a valid 11-digit phone number");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setLoading(true);
    if (!/.+@.+\..+/.test(email)) return toast.error("Enter a valid email address");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: { full_name: fullName, phone },
        },
      });
      if (error) throw error;
      setOtpPurpose("signup");
      setMode("verify");
      setCooldown(60);
      toast.success("We sent a 6-digit code to your email");
    } catch (error) {
      toast.error(otpErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) return toast.error("Enter the 6-digit code");
    setLoading(true);
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: otpPurpose === "recover" ? "recovery" : "email",
      });
      if (error) throw error;
      if (otpPurpose === "recover") {
        setMode("reset");
      } else if (otpPurpose === "signin") {
        await attachReferral();
        offerBiometricSetup();
        toast.success("Signed in");
        navigate({ to: "/" });
      } else {
        await attachReferral();
        offerBiometricSetup();
        toast.success("Account verified — set your transaction PIN");
        navigate({ to: "/create-pin" });
      }
    } catch (error) {
      setOtp("");
      toast.error(otpErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) return toast.error("Enter your email address");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setOtpPurpose("recover");
      setMode("verify");
      setCooldown(60);
      toast.success("Reset code sent to your email");
    } catch (error) {
      toast.error(otpErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setLoading(true);
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/" });
    } catch (error) {
      toast.error(otpErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      const result = otpPurpose === "recover"
        ? await supabase.auth.resetPasswordForEmail(email)
        : await supabase.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser: otpPurpose === "signup",
              ...(otpPurpose === "signup" ? { data: { full_name: fullName, phone } } : {}),
            },
          });
      if (result.error) throw result.error;
      setOtp("");
      setCooldown(60);
      toast.success("A fresh code was sent");
    } catch (error) {
      toast.error(otpErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="flex min-h-screen flex-col bg-background px-5 py-8">
      <div className="mb-8 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[color:oklch(0.78_0.15_190)] to-[color:oklch(0.62_0.18_160)] text-black">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-lg font-bold text-foreground">Swift Top</p>
          <p className="text-xs text-muted-foreground">Airtime · Data · Bills</p>
        </div>
      </div>

      {mode === "login" && (
        <form onSubmit={handleLogin} className="flex flex-1 flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your Swift Top account.</p>
          </div>
          <Field id="email" label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <button type="button" onClick={() => setMode("forgot")} className="self-end text-xs font-medium text-primary">
            Forgot password?
          </button>
          <Button type="submit" disabled={loading} className="h-12 rounded-full text-base font-semibold">
            {loading ? "Sending code…" : "Continue with email code"}
          </Button>
          <button
            type="button"
            onClick={() => { handlePasskeySignIn().catch(() => undefined); }}
            disabled={loading}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary/15 py-3 text-sm font-semibold text-primary disabled:opacity-60"
          >
            <Fingerprint className="h-4 w-4" />
            Login with Biometrics
          </button>


          <p className="mt-auto text-center text-sm text-muted-foreground">
            New to Swift Top?{" "}
            <button type="button" onClick={() => setMode("signup")} className="font-semibold text-primary">
              Create an account
            </button>
          </p>
        </form>
      )}

      {mode === "signup" && (
        <form onSubmit={handleSignup} className="flex flex-1 flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Create your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">We'll send a 6-digit code to verify your email.</p>
          </div>
          <Field id="name" label="Full name" value={fullName} onChange={setFullName} placeholder="Ada Okoro" />
          <Field id="phone" label="Phone number" value={phone} onChange={(v) => setPhone(v.replace(/\D/g, ""))} placeholder="08012345678" inputMode="numeric" maxLength={11} />
          <Field id="email" label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <Button type="submit" disabled={loading} className="h-12 rounded-full text-base font-semibold">
            {loading ? "Sending code…" : "Create account with email code"}
          </Button>
          <p className="mt-auto text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button type="button" onClick={() => setMode("login")} className="font-semibold text-primary">
              Sign in
            </button>
          </p>
        </form>
      )}

      {mode === "forgot" && (
        <form onSubmit={handleForgot} className="flex flex-1 flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Reset password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your email and we'll send a 6-digit code.</p>
          </div>
          <Field id="email" label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <Button type="submit" disabled={loading} className="h-12 rounded-full text-base font-semibold">
            {loading ? "Sending…" : "Send reset code"}
          </Button>
          <button type="button" onClick={() => setMode("login")} className="mt-auto text-center text-sm text-muted-foreground">
            Back to sign in
          </button>
        </form>
      )}

      {mode === "verify" && (
        <form onSubmit={handleVerify} className="flex flex-1 flex-col gap-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Enter verification code</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
            </p>
          </div>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp} pattern={DIGITS_ONLY} inputMode="numeric" autoFocus>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button type="submit" disabled={loading || otp.length !== 6} className="h-12 rounded-full text-base font-semibold">
            {loading ? "Verifying…" : "Verify"}
          </Button>
          <button
            type="button"
            onClick={resendOtp}
            disabled={cooldown > 0 || loading}
            className="text-center text-sm font-medium text-primary disabled:text-muted-foreground"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>

          <button type="button" onClick={() => setMode("login")} className="mt-auto text-center text-sm text-muted-foreground">
            Back to sign in
          </button>
        </form>
      )}

      {mode === "reset" && (
        <form onSubmit={handleReset} className="flex flex-1 flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Set a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Choose a strong password (at least 8 characters).</p>
          </div>
          <Field id="password" label="New password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
          <Button type="submit" disabled={loading} className="h-12 rounded-full text-base font-semibold">
            {loading ? "Saving…" : "Update password"}
          </Button>
        </form>
      )}
    </div>
  );
}

function Field({
  id, label, value, onChange, type = "text", placeholder, inputMode, maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  maxLength?: number;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-2 block text-sm">{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} required />
    </div>
  );
}
