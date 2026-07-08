/** Airtime provider wholesale discounts and end-user cashback rates.
 *  Provider discount = how much cheaper Otapay sells to us.
 *  User discount = what we pass to the user as instant cashback / discount.
 *  Margin retained by platform = provider − user. */
export const AIRTIME_RATES: Record<string, { providerDiscount: number; userDiscount: number }> = {
  mtn:      { providerDiscount: 0.03, userDiscount: 0.02 },
  airtel:   { providerDiscount: 0.03, userDiscount: 0.02 },
  glo:      { providerDiscount: 0.05, userDiscount: 0.03 },
  "9mobile":{ providerDiscount: 0.04, userDiscount: 0.03 },
};

export function airtimeQuote(network: string, faceAmount: number) {
  const r = AIRTIME_RATES[network] ?? { providerDiscount: 0, userDiscount: 0 };
  const retail = Math.round(faceAmount * (1 - r.userDiscount));
  const wholesale = Math.round(faceAmount * (1 - r.providerDiscount));
  const cashback = faceAmount - retail;
  return { retail, wholesale, cashback, userDiscountPct: r.userDiscount * 100 };
}
