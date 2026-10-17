import { CABLE_PROVIDERS, DISCOS, EXAMS, NETWORKS } from "@/lib/vtu-options";

export type VendService = "airtime" | "data" | "electricity" | "cable" | "education";
export type VendDetails = Record<string, string | number>;

function text(details: Record<string, unknown>, key: string): string {
  return typeof details[key] === "string" ? String(details[key]).trim() : "";
}

function integer(details: Record<string, unknown>, key: string): number {
  const value = details[key];
  if (typeof value !== "number" && typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

export function normalizeVendDetails(service: VendService, raw: Record<string, unknown>): VendDetails {
  if (service === "airtime") {
    const network = text(raw, "network");
    const phone = text(raw, "phone");
    const faceAmount = integer(raw, "face_amount");
    if (!NETWORKS.some((item) => item.id === network)) throw new Error("Select a valid mobile network");
    if (!/^0\d{10}$/.test(phone)) throw new Error("Enter a valid 11-digit phone number");
    if (faceAmount < 50 || faceAmount > 2_000_000) throw new Error("Enter a valid airtime amount");
    return { network, phone, face_amount: faceAmount };
  }

  if (service === "data") {
    const network = text(raw, "network");
    const phone = text(raw, "phone");
    const planId = text(raw, "plan_id");
    if (!NETWORKS.some((item) => item.id === network)) throw new Error("Select a valid mobile network");
    if (!/^0\d{10}$/.test(phone)) throw new Error("Enter a valid 11-digit phone number");
    if (!planId || planId.length > 120) throw new Error("Select a valid data plan");
    return { network, phone, plan_id: planId };
  }

  if (service === "electricity") {
    const disco = text(raw, "disco");
    const meter = text(raw, "meter");
    const meterType = text(raw, "meterType");
    const amount = integer(raw, "face_amount");
    if (!DISCOS.includes(disco as (typeof DISCOS)[number])) throw new Error("Select a valid electricity provider");
    if (!/^\d{10,13}$/.test(meter)) throw new Error("Meter number must be 10–13 digits");
    if (meterType !== "prepaid" && meterType !== "postpaid") throw new Error("Select a valid meter type");
    if (amount < 500 || amount > 2_000_000) throw new Error("Enter a valid electricity amount");
    return { disco, meter, meter_type: meterType, face_amount: amount };
  }

  if (service === "cable") {
    const provider = text(raw, "provider");
    const smartcard = text(raw, "smartcard");
    const packageName = text(raw, "package");
    const providerData = CABLE_PROVIDERS.find((item) => item.id === provider);
    if (!providerData) throw new Error("Select a valid TV provider");
    if (!/^\d{10,16}$/.test(smartcard)) throw new Error("Enter a valid smartcard number");
    if (!providerData.packages.includes(packageName as never)) throw new Error("Select a valid TV package");
    return { provider, smartcard, package: packageName };
  }

  const exam = text(raw, "exam");
  const quantity = integer(raw, "quantity");
  if (!EXAMS.some((item) => item.id === exam)) throw new Error("Select a valid exam board");
  if (quantity < 1 || quantity > 20) throw new Error("Enter a quantity from 1 to 20");
  return { exam, quantity };
}

export function vendIntentString(
  service: VendService,
  raw: Record<string, unknown>,
  idempotencyKey: string,
): string {
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey)) throw new Error("Invalid payment request");
  const details = normalizeVendDetails(service, raw);
  return JSON.stringify({ service, details, idempotencyKey });
}