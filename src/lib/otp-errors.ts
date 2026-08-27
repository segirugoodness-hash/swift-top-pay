/** Digits-only pattern for the 6-digit and 4-digit code inputs. */
export const DIGITS_ONLY = "^\\d+$";

/** Turns Supabase OTP failures into short, user-readable toast copy. */
export function otpErrorMessage(error: unknown): string {
  const raw = (error as { message?: string })?.message ?? "";
  const m = raw.toLowerCase();
  if (m.includes("expired")) return "That code has expired — tap “Resend code” for a fresh one.";
  if (m.includes("invalid") || m.includes("token")) return "That code is incorrect. Check the 6 digits and try again.";
  if (m.includes("rate") || m.includes("too many") || m.includes("429"))
    return "Too many attempts. Please wait a minute before requesting another code.";
  if (m.includes("user not found") || m.includes("signups not allowed"))
    return "We couldn't find an account with that email address.";
  return raw || "We couldn't verify that code. Please try again.";
}
