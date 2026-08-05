/** Local wholesale price cache.
 *  Renders instantly (and keeps the storefront usable if the live catalogue is empty),
 *  while retail prices are always computed from wholesale + the network markup engine. */
export type CachedPlan = {
  id: string;
  network: string;
  category: "daily" | "three_day" | "weekly" | "monthly";
  name: string;
  wholesale_price: number;
  validity: string;
};

export const LOCAL_PLAN_CACHE: CachedPlan[] = [
  // MTN
  { id: "c_mtn_100mb_d", network: "mtn", category: "daily", name: "MTN 100MB", wholesale_price: 92, validity: "1 Day" },
  { id: "c_mtn_1gb_d", network: "mtn", category: "daily", name: "MTN 1GB", wholesale_price: 320, validity: "1 Day" },
  { id: "c_mtn_200mb_3d", network: "mtn", category: "three_day", name: "MTN 200MB", wholesale_price: 182, validity: "3 Days" },
  { id: "c_mtn_25gb_3d", network: "mtn", category: "three_day", name: "MTN 2.5GB", wholesale_price: 550, validity: "3 Days" },
  { id: "c_mtn_750mb_w", network: "mtn", category: "weekly", name: "MTN 750MB", wholesale_price: 460, validity: "7 Days" },
  { id: "c_mtn_2gb_w", network: "mtn", category: "weekly", name: "MTN 2GB", wholesale_price: 1100, validity: "7 Days" },
  { id: "c_mtn_41gb_m", network: "mtn", category: "monthly", name: "MTN SME 4.1GB", wholesale_price: 1380, validity: "30 Days" },
  { id: "c_mtn_12gb_m", network: "mtn", category: "monthly", name: "MTN SME 12GB", wholesale_price: 3220, validity: "30 Days" },
  // Airtel
  { id: "c_air_100mb_d", network: "airtel", category: "daily", name: "Airtel 100MB", wholesale_price: 94, validity: "1 Day" },
  { id: "c_air_1gb_d", network: "airtel", category: "daily", name: "Airtel 1GB", wholesale_price: 325, validity: "1 Day" },
  { id: "c_air_2gb_3d", network: "airtel", category: "three_day", name: "Airtel 2GB", wholesale_price: 560, validity: "3 Days" },
  { id: "c_air_2gb_w", network: "airtel", category: "weekly", name: "Airtel 2GB", wholesale_price: 1120, validity: "7 Days" },
  { id: "c_air_45gb_m", network: "airtel", category: "monthly", name: "Airtel Corporate 4.5GB", wholesale_price: 1400, validity: "30 Days" },
  { id: "c_air_10gb_m", network: "airtel", category: "monthly", name: "Airtel Corporate 10GB", wholesale_price: 2900, validity: "30 Days" },
  // Glo
  { id: "c_glo_105mb_d", network: "glo", category: "daily", name: "Glo 105MB", wholesale_price: 90, validity: "1 Day" },
  { id: "c_glo_1gb_d", network: "glo", category: "daily", name: "Glo 1GB", wholesale_price: 310, validity: "1 Day" },
  { id: "c_glo_25gb_3d", network: "glo", category: "three_day", name: "Glo 2.5GB", wholesale_price: 540, validity: "3 Days" },
  { id: "c_glo_2gb_w", network: "glo", category: "weekly", name: "Glo 2GB", wholesale_price: 1050, validity: "7 Days" },
  { id: "c_glo_10gb_m", network: "glo", category: "monthly", name: "Glo Gifting 10GB", wholesale_price: 2650, validity: "30 Days" },
  // 9mobile
  { id: "c_9mo_100mb_d", network: "9mobile", category: "daily", name: "9mobile 100MB", wholesale_price: 88, validity: "1 Day" },
  { id: "c_9mo_1gb_d", network: "9mobile", category: "daily", name: "9mobile 1GB", wholesale_price: 300, validity: "1 Day" },
  { id: "c_9mo_2gb_3d", network: "9mobile", category: "three_day", name: "9mobile 2GB", wholesale_price: 530, validity: "3 Days" },
  { id: "c_9mo_2gb_w", network: "9mobile", category: "weekly", name: "9mobile 2GB", wholesale_price: 1040, validity: "7 Days" },
  { id: "c_9mo_11gb_m", network: "9mobile", category: "monthly", name: "9mobile SME 11GB", wholesale_price: 2800, validity: "30 Days" },
];
