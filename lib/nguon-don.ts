export const NGUON_DON = ["fb", "zalo", "web", "khach-cu", "gioi-thieu", "san", "khac"] as const;
export type NguonDon = (typeof NGUON_DON)[number];

export const TEN_NGUON_DON: Record<NguonDon, string> = {
  fb: "Facebook / Instagram",
  zalo: "Zalo",
  web: "Web NOVA (nội bộ)",
  "khach-cu": "Khách cũ mua lại",
  "gioi-thieu": "Giới thiệu",
  san: "Sàn TMĐT",
  khac: "Khác (sale ghi)",
};

const boDau = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

const LUAT: [RegExp, NguonDon][] = [
  [/\b(gioi thieu|gioi-thieu|gt|ctv|cong tac vien|nguoi quen|ban be|ban gioi thieu|referral|ref)\b/, "gioi-thieu"],
  [/\b(khach cu|khach-cu|kh cu|khachcu|mua lai|khach quen|khach than|quay lai|cu)\b/, "khach-cu"],
  [/\b(san|shopee|tiktok ?shop|tiktok|tik tok|lazada|tiki|tmdt|san tmdt)\b/, "san"],
  [/\b(zalo|zl|zalo oa|oa)\b/, "zalo"],
  [/\b(fb|facebook|face|fanpage|page|messenger|mess|inbox|meta|instagram|insta|ig|fb ads|quang cao)\b/, "fb"],
  [/\b(web|website|example|landing|salepage|sale page|blog|quiz|ebook|google|gg)\b/, "web"],
  [/\b(khac|other)\b/, "khac"],
];

export function chuanNguonDon(v: unknown): NguonDon | null {
  const s = boDau(String(v ?? "")).replace(/[_/|,;+]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  for (const [re, ma] of LUAT) if (re.test(s)) return ma;
  return null;
}

export function bocNguonDon(tin: unknown): NguonDon | null {
  const s = boDau(String(tin ?? ""));
  const m = s.match(/(?:^|[\s.,;(\[])nguon\s*(?:khach)?\s*[:=\-–]\s*([^\n.;|]{1,40})/);
  if (!m) return null;
  return chuanNguonDon(m[1]) || "khac";
}
