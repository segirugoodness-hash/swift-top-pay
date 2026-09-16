/**
 * Transactional email through Brevo (server-only).
 * Calls go through the Lovable connector gateway, so no Brevo key is ever in app code.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<boolean> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const brevoKey = process.env["BREVO_API_KEY"];
  if (!lovableKey || !brevoKey) {
    console.error("[email] Brevo is not configured");
    return false;
  }
  if (!/.+@.+\..+/.test(to)) return false;

  const senderEmail = process.env["SWIFT_TOP_SENDER_EMAIL"] ?? "no-reply@swift-top.app";

  try {
    const res = await fetch(`${GATEWAY_URL}/smtp/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": brevoKey,
      },
      body: JSON.stringify({
        sender: { name: "Swift Top", email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      console.error(`[email] Brevo request failed [${res.status}]: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] Brevo request error", e);
    return false;
  }
}

/** Simple dark-themed receipt used for successful purchases. */
export function receiptHtml(opts: {
  service: string;
  amount: number;
  reference: string;
  detail?: string;
}): string {
  const naira = `₦${opts.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;background:#111a2e;color:#e8eefc;padding:24px">
    <h2 style="margin:0 0 8px;font-size:18px">Swift Top receipt</h2>
    <p style="margin:0 0 16px;opacity:.75;font-size:14px">Your ${opts.service} purchase was successful.</p>
    <table style="font-size:14px;border-collapse:collapse">
      <tr><td style="padding:4px 12px 4px 0;opacity:.7">Amount</td><td style="font-weight:600">${naira}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;opacity:.7">Service</td><td>${opts.service}</td></tr>
      ${opts.detail ? `<tr><td style="padding:4px 12px 4px 0;opacity:.7">Details</td><td>${opts.detail}</td></tr>` : ""}
      <tr><td style="padding:4px 12px 4px 0;opacity:.7">Reference</td><td>${opts.reference}</td></tr>
    </table>
    <p style="margin:20px 0 0;opacity:.6;font-size:12px">Thank you for using Swift Top.</p>
  </div>`;
}
