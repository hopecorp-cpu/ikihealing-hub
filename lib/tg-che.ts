const CHU = "\\p{L}\\p{M}";

const TU_TEN = `\\p{Lu}[${CHU}'’]*`;
const TEN = `${TU_TEN}(?:[ \\t]+${TU_TEN}){0,5}`;

export function vietTat(ten: string): string {
  const tu = String(ten || "").replace(/<[^>]*>/g, " ").split(/[\s.]+/).map((w) => w.replace(/[^\p{L}]/gu, "")).filter(Boolean);
  if (!tu.length) return "?";
  const chu = tu.slice(0, 5).map((w) => w[0].toLocaleUpperCase("vi"));
  return chu.length === 1 ? chu[0] + "." : chu.join(".");
}

const RE_SDT = /(?<![\p{L}\p{N}*])(?:\+?84|0)(?:[ .\-]?\d){8,10}(?![\p{L}\p{N}])/gu;
const chiSo = (s: string) => s.replace(/\D/g, "");

function laSdt(s: string): boolean {
  const d = chiSo(s);
  const tach = /[ .\-]/.test(s.trim());
  if (d.startsWith("84")) return d.length === 11 && (!tach || "35789".includes(d[2]));
  if (!d.startsWith("0")) return false;
  if (tach) return d.length === 10 && "35789".includes(d[1]);
  return d.length === 10 || d.length === 11;
}
export function cheSdt(text: string): string {
  return String(text ?? "").replace(RE_SDT, (m) => (laSdt(m) ? "***" + chiSo(m).slice(-3) : m));
}

const NGAN_HANG = "STK|S[ốo]\\s*TK|S[ốo]\\s*t[àa]i\\s*kho[ảa]n|T[àa]i\\s*kho[ảa]n|TK|Account|Acc|MB(?:\\s*Bank)?|TCB|Techcombank|VCB|Vietcombank|BIDV|ACB|Agribank|VPBank|TPBank|Sacombank|VIB|SHB|MSB|OCB|HDBank|VietinBank|CTG|Eximbank|SeABank|LPBank|NamABank|Kienlongbank|BVBank|Cake|Timo";
const RE_STK = new RegExp(`((?<![\\p{L}])(?:${NGAN_HANG})(?![\\p{L}])[^\\d\\n]{0,24}?)(\\d(?:[ .\\-]?\\d){5,18})(?![\\p{N}])`, "giu");
export function cheTaiKhoan(text: string): string {
  return String(text ?? "").replace(RE_STK, (_m, truoc: string, so: string) => {
    if (laSdt(so)) return truoc + "***" + chiSo(so).slice(-3);
    const d = chiSo(so);

    if (/^\d{1,3}(?:\.\d{3})+$/.test(so.trim())) return truoc + so;
    return truoc + "****" + d.slice(-4);
  });
}

const NHAN_TEN = "Kh[áa]ch\\s*h[àa]ng|Kh[áa]ch|Khach|KH|T[êe]n\\s*kh[áa]ch|H[ọo]\\s*t[êe]n|T[êe]n|Ng[ườ]+i\\s*nh[ậa]n|Nguoi\\s*nhan|Ng[ườ]+i\\s*mua|Lead\\s*m[ớo]i|Lead\\s*chuy[ểe]n\\s*t[ớo]i\\s*b[ạa]n|Lead";

const RE_NHAN = new RegExp(`((?<![\\p{L}])(?:${NHAN_TEN})\\s*[:：]\\s*(?:<[^>]+>\\s*)*)([${CHU}'’.][${CHU}'’. \\t]{0,39})`, "gu");

const RE_CUA = new RegExp(`((?<![\\p{L}])c[ủu]a\\s+)(${TEN})(?=\\s*[·\\-—,(]\\s*(?:\\*{3}\\d{3}|\\+?84|0\\d))`, "gu");

const RE_TRUOC_SDT = new RegExp(`(?<![\\p{L}.])(${TEN})(\\s*(?:</[a-z]+>)?\\s*(?:[(·\\-—,]|\\s)\\s*(?:<[^>]+>)?\\*{3}\\d{3})`, "gu");
const KHONG_PHAI_TEN = new Set(["sdt", "sđt", "đt", "dt", "tel", "phone", "hotline", "zalo", "shipper", "lh", "gọi", "goi", "số", "so", "sale", "khách", "khach", "kh", "mb", "tcb", "vcb", "stk", "tk", "ship", "cod", "j&t", "jt"]);

const KHUON: Array<{ nguon: RegExp; re: RegExp }> = [

  { nguon: /neworder/, re: new RegExp(`^(\\s*•\\s*<b>[^<]*</b>\\s*—\\s*[^—\\n]*?\\s*—\\s*)([^\\n<]+)`, "gmu") },

  { nguon: /ca-truc-ai/, re: new RegExp(`^(\\s*\\d+\\.\\s*<b>)([^<]+)(?=</b>)`, "gmu") },

  { nguon: /chatquality/, re: new RegExp(`^(\\s*•\\s*<b>\\d+/10</b>[^—\\n]*—\\s*)([^\\n<]+)`, "gmu") },
  { nguon: /chatquality/, re: new RegExp(`^(\\s*\\S{1,3}\\s*<b>)([^<]+)(?=</b>\\s*\\(\\d+/10\\))`, "gmu") },

  { nguon: /zalo-nhac/, re: new RegExp(`^(\\s*-\\s+)([^\\n(—*]+?)(?=\\s*—\\s*nh[ắa]n)`, "gmu") },
];

const vietTatGiuKhoang = (ten: string) => {
  const m = ten.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  return m[1] + vietTat(m[2]) + m[3];
};

export function cheTen(text: string, nguon = ""): string {
  let t = String(text ?? "");
  for (const k of KHUON) if (k.nguon.test(nguon)) t = t.replace(k.re, (_m, a: string, ten: string) => a + vietTatGiuKhoang(ten));
  t = t.replace(RE_NHAN, (_m, a: string, ten: string) => { const cuoi = ten.match(/\s*$/)![0]; return a + vietTat(ten) + cuoi; });
  t = t.replace(RE_CUA, (_m, a: string, ten: string) => a + vietTat(ten));
  t = t.replace(RE_TRUOC_SDT, (_m, ten: string, sau: string) => {

    const ra: string[] = []; let cum: string[] = [];
    const xa = () => { if (cum.length) { ra.push(vietTat(cum.join(" "))); cum = []; } };
    for (const w of ten.split(/\s+/)) { if (KHONG_PHAI_TEN.has(w.toLocaleLowerCase("vi"))) { xa(); ra.push(w); } else cum.push(w); }
    xa();
    return ra.join(" ") + sau;
  });
  return t;
}

const NHAN_DC = "Đ\\/?C|đ\\/?c|DC|Đ[ịi]a\\s*ch[ỉi]|Dia\\s*chi|Giao\\s*(?:t[ớo]i|đ[ếe]n|v[ềe])|Address";
const RE_DC = new RegExp(`((?<![\\p{L}])(?:${NHAN_DC})\\s*[:：]\\s*)([^\\n]+)`, "gu");
export function cheDiaChiCoNhan(text: string): string {
  return String(text ?? "").replace(RE_DC, (_m, a: string) => a + "[đã ẩn]");
}

const DON_VI = /(?<![\p{L}])(ph[ưu][ờo]ng|x[ãa]|th[ịi]\s*tr[ấa]n|qu[ậa]n|huy[ệe]n|th[ịi]\s*x[ãa]|t[ỉi]nh|th[àa]nh\s*ph[ốo]|tp\.?|p\.\s?\d+|q\.\s?\d+|ng[õo]|ng[áa]ch|h[ẻe]m|ki[ệe]t|đ[ưu][ờo]ng|s[ốo]\s*nh[àa])(?![\p{L}])/giu;

export function laDongDiaChi(dong: string): boolean {
  if (new RegExp(`(?<![\\p{L}])(?:${NHAN_DC})\\s*[:：]`, "u").test(dong)) return true;
  const n = new Set((dong.match(DON_VI) || []).map((x) => x.toLowerCase().replace(/\s+/g, " ").replace(/\.$/, ""))).size;
  return n >= 2;
}

export function boDiaChi(text: string): string {
  return String(text ?? "").split("\n").filter((d) => !laDongDiaChi(d.replace(/<[^>]*>/g, ""))).join("\n");
}

const RE_EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
export function cheEmail(text: string): string { return String(text ?? "").replace(RE_EMAIL, "$1***@$2"); }

const escRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function cheTenTheoDanhSach(text: string, danhSach: readonly string[]): string {
  const ds = [...new Set(danhSach.filter((x) => x && x.trim().split(/\s+/).length >= 2))].sort((a, b) => b.length - a.length).slice(0, 1000);
  if (!text || !ds.length) return text;
  const re = new RegExp(`(^|[^\\p{L}\\p{M}])(${ds.map(escRe).join("|")})(?![\\p{L}\\p{M}])`, "giu");
  return text.replace(re, (_m, truoc: string, ten: string) => truoc + vietTat(ten));
}

export function cheDuLieu(text: string, opts: { nguon?: string; tenKhach?: readonly string[] } = {}): string {
  let t = String(text ?? "");
  t = cheEmail(t);
  t = cheTaiKhoan(t);
  t = cheSdt(t);
  if (opts.tenKhach?.length) t = cheTenTheoDanhSach(t, opts.tenKhach);
  t = cheTen(t, opts.nguon || "");
  t = cheDiaChiCoNhan(t);
  return t;
}

export function conSdt(text: string): boolean {
  return [...String(text ?? "").matchAll(RE_SDT)].some((m) => laSdt(m[0]));
}
