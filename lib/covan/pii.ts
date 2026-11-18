function boKyTuAn(text: string): string {
  return text.normalize("NFKC").replace(/\p{Cf}/gu, "");
}

const PHONE_RE = /(?<![\p{L}\d])(?<!\d[.,/-])(\+?84\d{9}|0\d{9,10})(?![\p{L}\d])(?![.,/-]\d)/gu;

const PHONE_TACH_RE = /(?<![\p{L}\d.,/-])\(?\+?(?:84|0\d)\d{0,2}\)?(?:[ .-]?\d{2,4}){1,4}(?![\p{L}\d])(?![.,/-]\d)/gu;
const DAU_DI_DONG = new Set(["3", "5", "7", "8", "9"]);

const PHONE_LE_RE = /(?<![\p{L}\d.,/-])\+?(?:0|8\s?4)(?:[ .\-]{0,3}\d){8,11}(?![\p{L}\d])(?![ .,/\-]{0,3}\d)/gu;

function soDiDong(raw: string): string | null {
  const coCong = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("84")) {
    if (digits.length !== 11 || !DAU_DI_DONG.has(digits[2])) return null;
    return (coCong ? "+" : "") + digits;
  }
  if (digits.startsWith("0")) {
    if (digits.length !== 10 || !DAU_DI_DONG.has(digits[1])) return null;
    return digits;
  }
  return null;
}

function tachSoVaDuoi(raw: string): [string, string] | null {
  const so = soDiDong(raw);
  if (so) return [so, ""];
  let cat = raw;
  for (;;) {
    const i = cat.lastIndexOf(" ");
    if (i <= 0) return null;
    cat = cat.slice(0, i);
    const s = soDiDong(cat);
    if (s) return [s, raw.slice(cat.length)];
  }
}

const EMAIL_RE = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

const cheSo = (p: string) => `${p.slice(0, 4)}***${p.slice(-3)}`;

export function maskPII(text: string): string {
  if (!text) return text;
  return boKyTuAn(text)
    .replace(EMAIL_RE, "$1***@$2")
    .replace(PHONE_RE, cheSo)
    .replace(PHONE_TACH_RE, (raw) => {
      const r = tachSoVaDuoi(raw);
      return r ? cheSo(r[0]) + r[1] : raw;
    })
    .replace(PHONE_LE_RE, (raw) => {
      const so = soDiDong(raw);
      return so ? cheSo(so) : raw;
    });
}

export function conSoDienThoai(text: string): boolean {
  if (!text) return false;
  const t = boKyTuAn(text);
  PHONE_RE.lastIndex = 0;
  PHONE_TACH_RE.lastIndex = 0;
  if (PHONE_RE.test(t)) return true;
  for (const m of t.matchAll(PHONE_TACH_RE)) if (tachSoVaDuoi(m[0])) return true;
  for (const m of t.matchAll(PHONE_LE_RE)) if (soDiDong(m[0])) return true;
  return false;
}

const XUNG_HO = /^(?:chị|chi|anh|a|c|cô|co|chú|chu|bác|bac|em|e|ms|mr|mrs|bà|ba|ông|ong)\.?\s+/iu;

export function chuanHoaTenKhach(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let t = raw.replace(/\s+/g, " ").trim();
  t = t.replace(XUNG_HO, "");

  t = t.split(/[\-–(/,|:]/)[0].trim();
  if (!/^[\p{L}\p{M}\s]+$/u.test(t)) return null;
  const tu = t.split(" ").filter(Boolean);
  if (tu.length < 2 || tu.length > 6 || t.length < 5) return null;
  return tu.join(" ");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function cheTenKhach(text: string, danhSachTen: readonly string[]): string {
  if (!text || !danhSachTen.length) return text;
  const ten = [...new Set(danhSachTen.map(chuanHoaTenKhach).filter((x): x is string => !!x))]
    .sort((a, b) => b.length - a.length)
    .slice(0, 1000);
  if (!ten.length) return text;
  const re = new RegExp(`(^|[^\\p{L}\\p{M}])(${ten.map(escapeRe).join("|")})(?![\\p{L}\\p{M}])`, "giu");
  return text.replace(re, (_m, truoc: string, t: string) => `${truoc}${t[0]}***`);
}

export function maskPIIVoiTen(text: string, danhSachTen: readonly string[]): string {
  return cheTenKhach(maskPII(text), danhSachTen);
}
