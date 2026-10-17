import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AIRTIME_RATES } from "@/lib/airtime-pricing";
import { applyMarkup, type MarkupRow } from "@/lib/pricing";
import { CABLE_PROVIDERS, EXAMS } from "@/lib/vtu-options";
import { normalizeVendDetails, type VendDetails, type VendService } from "@/lib/vend-intent";

export const VEND_ENDPOINTS: Record<VendService, string> = {
  airtime: "/v1/vend/airtime",
  data: "/v1/vend/data",
  electricity: "/v1/vend/electricity",
  cable: "/v1/vend/cable",
  education: "/v1/vend/education",
};

export type VendQuote = {
  service: VendService;
  details: VendDetails;
  retail: number;
  wholesale: number;
  metadata: Record<string, unknown>;
  providerPayload: Record<string, unknown>;
  endpoint: string;
};

const BILL_SERVICE_FEE = 100;

export async function resolveVendQuote(
  supabase: SupabaseClient<Database>,
  service: VendService,
  rawDetails: Record<string, unknown>,
): Promise<VendQuote> {
  const details = normalizeVendDetails(service, rawDetails);

  if (service === "airtime") {
    const network = String(details.network);
    const face = Number(details.face_amount);
    const rate = AIRTIME_RATES[network] ?? { providerDiscount: 0, userDiscount: 0 };
    const retail = Math.round(face * (1 - rate.userDiscount));
    const wholesale = Math.round(face * (1 - rate.providerDiscount));
    return {
      service, details, retail, wholesale, endpoint: VEND_ENDPOINTS.airtime,
      metadata: { ...details, cashback: face - retail },
      providerPayload: { network, phone: details.phone, amount: face },
    };
  }

  if (service === "data") {
    const id = String(details.plan_id);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const planQuery = supabase.from("data_plans").select("id, network, name, wholesale_price, validity, external_id, is_active")
      .eq("is_active", true).eq("network", String(details.network));
    const { data: plan, error: planError } = isUuid
      ? await planQuery.eq("id", id).maybeSingle()
      : await planQuery.eq("external_id", id).maybeSingle();
    if (planError) throw new Error("Could not verify the selected data plan");
    if (!plan || !plan.external_id) throw new Error("This data plan is no longer available. Refresh and choose another plan.");
    const { data: markup, error: markupError } = await supabase.from("network_markups").select("network, markup_type, markup_value")
      .eq("network", String(details.network)).maybeSingle();
    if (markupError) throw new Error("Could not verify current data pricing");
    const wholesale = Number(plan.wholesale_price);
    const retail = applyMarkup(wholesale, (markup as MarkupRow | null) ?? null);
    return {
      service, details, retail, wholesale, endpoint: VEND_ENDPOINTS.data,
      metadata: { ...details, plan: plan.name, plan_validity: plan.validity, plan_id: plan.id },
      providerPayload: { network: details.network, phone: details.phone, plan_id: plan.external_id },
    };
  }

  if (service === "electricity") {
    const retail = Number(details.face_amount);
    return {
      service, details, retail, wholesale: Math.max(0, retail - BILL_SERVICE_FEE), endpoint: VEND_ENDPOINTS.electricity,
      metadata: details,
      providerPayload: { disco: details.disco, meter_number: details.meter, meter_type: details.meter_type, amount: retail },
    };
  }

  if (service === "cable") {
    const provider = CABLE_PROVIDERS.find((item) => item.id === details.provider);
    const packageName = String(details.package);
    const priceMatch = packageName.match(/₦([\d,]+)/);
    const retail = priceMatch ? Number(priceMatch[1].replaceAll(",", "")) : 0;
    if (!provider || retail <= 0) throw new Error("Could not verify the selected TV package");
    return {
      service, details, retail, wholesale: Math.max(0, retail - BILL_SERVICE_FEE), endpoint: VEND_ENDPOINTS.cable,
      metadata: { ...details, provider_name: provider.name },
      providerPayload: { provider: provider.id, smartcard: details.smartcard, package: packageName, amount: retail },
    };
  }

  const exam = EXAMS.find((item) => item.id === details.exam);
  const unit = exam ? Number(exam.price.replace(/[^\d]/g, "")) : 0;
  const retail = unit * Number(details.quantity);
  if (!exam || retail <= 0) throw new Error("Could not verify the selected exam PIN");
  return {
    service, details, retail, wholesale: Math.max(0, retail - BILL_SERVICE_FEE), endpoint: VEND_ENDPOINTS.education,
    metadata: details,
    providerPayload: { exam: details.exam, quantity: details.quantity, amount: retail },
  };
}