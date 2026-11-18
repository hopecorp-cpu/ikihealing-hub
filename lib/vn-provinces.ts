export const VN_PROVINCES: string[] = [
  "Hà Nội", "Hồ Chí Minh", "Hải Phòng", "Đà Nẵng", "Cần Thơ",
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh",
  "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận", "Cà Mau",
  "Cao Bằng", "Đắk Lắk", "Đắk Nông", "Điện Biên", "Đồng Nai", "Đồng Tháp",
  "Gia Lai", "Hà Giang", "Hà Nam", "Hà Tĩnh", "Hải Dương", "Hậu Giang",
  "Hòa Bình", "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu",
  "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An",
  "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam",
  "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sóc Trăng", "Sơn La", "Tây Ninh",
  "Thái Bình", "Thái Nguyên", "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang",
  "Trà Vinh", "Tuyên Quang", "Vĩnh Long", "Vĩnh Phúc", "Yên Bái",
];

const ALIAS: Record<string, string> = {
  "tphcm": "Hồ Chí Minh", "tp hcm": "Hồ Chí Minh", "hcm": "Hồ Chí Minh",
  "sai gon": "Hồ Chí Minh", "thanh pho ho chi minh": "Hồ Chí Minh",
  "ha noi": "Hà Nội", "hn": "Hà Nội", "thu do ha noi": "Hà Nội",
  "hue": "Thừa Thiên Huế", "tt hue": "Thừa Thiên Huế", "thua thien hue": "Thừa Thiên Huế",
  "brvt": "Bà Rịa - Vũng Tàu", "vung tau": "Bà Rịa - Vũng Tàu", "ba ria vung tau": "Bà Rịa - Vũng Tàu",
  "dak lak": "Đắk Lắk", "daklak": "Đắk Lắk", "buon ma thuot": "Đắk Lắk",
  "dak nong": "Đắk Nông", "daknong": "Đắk Nông",
  "khanh hoa": "Khánh Hòa", "nha trang": "Khánh Hòa",
  "lam dong": "Lâm Đồng", "da lat": "Lâm Đồng", "bao loc": "Lâm Đồng",
  "thanh hoa": "Thanh Hóa", "hoa binh": "Hòa Bình", "hai duong": "Hải Dương",

  "bien hoa": "Đồng Nai", "phu my": "Bà Rịa - Vũng Tàu",
  "dak kak": "Đắk Lắk", "dac lak": "Đắk Lắk", "krong ana": "Đắk Lắk",
  "dac nong": "Đắk Nông", "gia nghia": "Đắk Nông",
  "thu dau mot": "Bình Dương", "di an": "Bình Dương",
  "quy nhon": "Bình Định", "phan thiet": "Bình Thuận", "phan rang": "Ninh Thuận",
  "viet tri": "Phú Thọ", "ha long": "Quảng Ninh", "cam pha": "Quảng Ninh",
  "vinh yen": "Vĩnh Phúc", "thai nguyen": "Thái Nguyên", "bac lieu": "Bạc Liêu",
};

export const boDau = (s: string): string =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const LOOKUP: Array<{ key: string; name: string }> = [
  ...VN_PROVINCES.map((p) => ({ key: boDau(p), name: p })),
  ...Object.entries(ALIAS).map(([k, v]) => ({ key: boDau(k), name: v })),
].sort((a, b) => b.key.length - a.key.length);

export function detectProvince(address: string): string | null {
  const s = boDau(address);
  if (!s) return null;
  let best: { name: string; at: number } | null = null;
  for (const { key, name } of LOOKUP) {
    const at = s.lastIndexOf(key);
    if (at < 0) continue;
    if (!best || at > best.at) best = { name, at };
  }
  return best?.name ?? null;
}

const MIEN_BAC = new Set(["Hà Nội", "Hải Phòng", "Bắc Giang", "Bắc Kạn", "Bắc Ninh", "Cao Bằng", "Điện Biên", "Hà Giang", "Hà Nam", "Hải Dương", "Hòa Bình", "Hưng Yên", "Lai Châu", "Lạng Sơn", "Lào Cai", "Nam Định", "Ninh Bình", "Phú Thọ", "Quảng Ninh", "Sơn La", "Thái Bình", "Thái Nguyên", "Tuyên Quang", "Vĩnh Phúc", "Yên Bái"]);
const MIEN_TRUNG = new Set(["Đà Nẵng", "Bình Định", "Bình Thuận", "Đắk Lắk", "Đắk Nông", "Gia Lai", "Hà Tĩnh", "Khánh Hòa", "Kon Tum", "Lâm Đồng", "Nghệ An", "Ninh Thuận", "Phú Yên", "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Trị", "Thanh Hóa", "Thừa Thiên Huế"]);

export function mienCua(province: string): "Bắc" | "Trung" | "Nam" {
  if (MIEN_BAC.has(province)) return "Bắc";
  if (MIEN_TRUNG.has(province)) return "Trung";
  return "Nam";
}
