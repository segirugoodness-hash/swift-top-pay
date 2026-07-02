export const NETWORKS = [
  { id: "mtn", name: "MTN", color: "#facc15" },
  { id: "airtel", name: "Airtel", color: "#ef4444" },
  { id: "glo", name: "Glo", color: "#22c55e" },
  { id: "9mobile", name: "9mobile", color: "#10b981" },
] as const;

export const DISCOS = [
  "Ikeja Electric (IKEDC)",
  "Eko Electricity (EKEDC)",
  "Abuja Electricity (AEDC)",
  "Port Harcourt Electric (PHED)",
  "Ibadan Electricity (IBEDC)",
  "Kano Electricity (KEDCO)",
  "Enugu Electricity (EEDC)",
  "Kaduna Electric (KAEDCO)",
  "Jos Electricity (JED)",
];

export const CABLE_PROVIDERS = [
  {
    id: "dstv",
    name: "DSTV",
    packages: ["Padi — ₦2,950", "Yanga — ₦4,200", "Confam — ₦7,400", "Compact — ₦12,500", "Premium — ₦29,500"],
  },
  {
    id: "gotv",
    name: "GOTV",
    packages: ["Smallie — ₦1,300", "Jinja — ₦2,700", "Jolli — ₦3,950", "Max — ₦5,700", "Supa — ₦7,600"],
  },
  {
    id: "startimes",
    name: "StarTimes",
    packages: ["Nova — ₦1,700", "Basic — ₦3,300", "Smart — ₦4,700", "Classic — ₦5,100", "Super — ₦8,800"],
  },
] as const;

export const EXAMS = [
  { id: "waec", name: "WAEC", price: "₦3,500" },
  { id: "neco", name: "NECO", price: "₦1,200" },
  { id: "jamb", name: "JAMB", price: "₦4,700" },
] as const;

export const BANKS = [
  "Access Bank",
  "GTBank",
  "First Bank",
  "UBA",
  "Zenith Bank",
  "Opay",
  "Kuda",
  "PalmPay",
  "Moniepoint",
  "Wema Bank",
];
