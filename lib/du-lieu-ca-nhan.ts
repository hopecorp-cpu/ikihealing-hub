import crypto from "crypto";

export type MucDich = "giao-dich" | "tin-tu-van" | "du-lieu-suc-khoe";

export const PHIEN_BAN_DONG_Y = "v1-2026-09-04";

export const NHAN_QC = "[QC]";
export function ganNhanQC(tieuDe: string): string {
  const t = String(tieuDe || "").trim();
  return t.toUpperCase().startsWith(NHAN_QC) ? t : `${NHAN_QC} ${t}`;
}

export const CHAN_TIN_QC = "— NOVA (Công ty CP TMDV ACME). Không muốn nhận tin nữa, anh/chị nhắn DỪNG là em ngưng ngay ạ.";

export function chuanSdt(raw?: string | null): string | null {
  let s = String(raw || "").replace(/[^\d+]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && s.length === 11) s = "0" + s.slice(2);
  return /^0(3|5|7|8|9)\d{8}$/.test(s) ? s : null;
}
export function chuanEmail(raw?: string | null): string | null {
  const e = String(raw || "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
}

export function gioVN(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }).format(now));
}

export function trongGioNhanTin(now: Date = new Date()): boolean { const h = gioVN(now); return h >= 7 && h < 22; }

export function trongGioGoi(now: Date = new Date()): boolean { const h = gioVN(now); return h >= 8 && h < 17; }

const CUM_TU_CHOI = [
  "kh(?:o|ô)ng (?:nh(?:a|ậ)n|mu(?:o|ố)n nh(?:a|ậ)n|g(?:u|ử)i) n(?:u|ữ)a",
  "kh(?:o|ô)ng (?:mu(?:o|ố)n )?nh(?:a|ậ)n (?:tin|th(?:o|ô)ng tin|qu(?:a|ả)ng c(?:a|á)o)",
  "(?:đ|d)(?:u|ừ)ng (?:nh(?:a|ắ)n|g(?:u|ử)i|l(?:a|à)m phi(?:e|ề)n)",
  "th(?:o|ô)i (?:g(?:u|ử)i|nh(?:a|ắ)n)",
  "b(?:o|ỏ) theo d(?:o|õ)i",
  "ng(?:u|ư)ng (?:g(?:u|ử)i|nh(?:a|ắ)n)",
  "(?:huy|huỷ|hủy) (?:nh(?:a|ậ)n tin|(?:đ|d)(?:a|ă)ng k(?:y|ý))",
  "ch(?:a|ặ)n (?:tin|nick|s(?:o|ố)|zalo|lu(?:o|ô)n)",
  "kh(?:o|ô)ng quan t(?:a|â)m",
  "spam",
];
const CUM_RE = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${CUM_TU_CHOI.join("|")})(?=$|[^\\p{L}\\p{N}])`, "iu");
const TU_DON_RE = /^(?:dung|dừng|stop|unsubscribe|huy|huỷ|hủy|chan|chặn)$/iu;

const TU_DEM = new Set("nhe nhé nha nhá a ạ à e em oi ơi di đi lai lại giup giúp minh mình tin nhan nhắn gui gửi luon luôn het hết ok oke nghe di ngay".split(" "));

export function laTinTuChoi(text?: string | null): boolean {
  const t = String(text || "").trim();
  if (!t || t.length > 200) return false;
  if (CUM_RE.test(t)) return true;
  const tu = t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (!tu.length || !TU_DON_RE.test(tu[0])) return false;
  return tu.slice(1).every((x) => TU_DEM.has(x));
}

export type MucTuChoi = { luc: string; kenh: string; nguon?: string; lyDo?: string };
export type DanhSachTuChoi = { sdt: Record<string, MucTuChoi>; email: Record<string, MucTuChoi>; zalo: Record<string, MucTuChoi> };
const KHOA_TU_CHOI = "tu_choi_lien_he";

async function docConfig(sb: any, key: string): Promise<any> {
  const { data } = await sb.from("config").select("value").eq("key", key).maybeSingle();
  try { return data?.value ? JSON.parse(data.value) : null; } catch { return null; }
}
async function ghiConfig(sb: any, key: string, value: any, description?: string) {
  await sb.from("config").upsert({ key, value: JSON.stringify(value), ...(description ? { description } : {}) }, { onConflict: "key" });
}

export async function layTuChoi(sb: any): Promise<DanhSachTuChoi> {
  const v = (await docConfig(sb, KHOA_TU_CHOI)) || {};
  return { sdt: v.sdt || {}, email: v.email || {}, zalo: v.zalo || {} };
}
export async function daTuChoi(sb: any, ai: { phone?: string | null; email?: string | null; zaloUid?: string | null }): Promise<boolean> {
  const ds = await layTuChoi(sb);
  const p = chuanSdt(ai.phone), e = chuanEmail(ai.email), z = ai.zaloUid ? String(ai.zaloUid) : null;
  return !!((p && ds.sdt[p]) || (e && ds.email[e]) || (z && ds.zalo[z]));
}

export async function ghiTuChoi(sb: any, o: {
  phone?: string | null; email?: string | null; zaloUid?: string | null;
  kenh: string; lyDo?: string; nguon?: string; tinGoc?: string; daXacNhan?: boolean; meta?: any;
}): Promise<{ moi: boolean }> {
  const p = chuanSdt(o.phone), e = chuanEmail(o.email), z = o.zaloUid ? String(o.zaloUid) : null;
  if (!p && !e && !z) return { moi: false };
  const ds = await layTuChoi(sb);
  const luc = new Date().toISOString();
  const muc: MucTuChoi = { luc, kenh: o.kenh, nguon: o.nguon, lyDo: o.lyDo };
  let moi = false;
  if (p && !ds.sdt[p]) { ds.sdt[p] = muc; moi = true; }
  if (e && !ds.email[e]) { ds.email[e] = muc; moi = true; }
  if (z && !ds.zalo[z]) { ds.zalo[z] = muc; moi = true; }
  if (moi) await ghiConfig(sb, KHOA_TU_CHOI, ds, "Danh sách khách TỪ CHỐI nhận tin quảng cáo (NĐ 330/2026) — đọc lúc gửi, KHÔNG xoá tay");
  try {
    const { error } = await sb.from("tu_choi_lien_he").insert({
      phone: p, email: e, zalo_uid: z, kenh: o.kenh, ly_do: o.lyDo || null, nguon: o.nguon || null,
      tin_goc: o.tinGoc ? String(o.tinGoc).slice(0, 300) : null, da_xac_nhan: !!o.daXacNhan, meta: o.meta || null,
    });
    if (error) throw error;
  } catch {

    const key = "tu_choi_log";
    const log: any[] = (await docConfig(sb, key)) || [];
    log.push({ luc, phone: p, email: e, zalo: z, kenh: o.kenh, lyDo: o.lyDo, nguon: o.nguon, tinGoc: (o.tinGoc || "").slice(0, 300), daXacNhan: !!o.daXacNhan });
    await ghiConfig(sb, key, log.slice(-5000));
  }
  return { moi };
}

export type DongYInput = {
  phone?: string | null; email?: string | null; ten?: string | null;
  kenh: string; nguon?: string | null;
  mucDich: MucDich[];
  vanBan: string; phienBan?: string;
  ip?: string | null; ua?: string | null; meta?: any;
};
export async function ghiDongY(sb: any, o: DongYInput): Promise<{ ok: boolean; noi: "bang" | "config" | "bo" }> {
  const p = chuanSdt(o.phone), e = chuanEmail(o.email);
  if (!p && !e) return { ok: false, noi: "bo" };
  const row = {
    phone: p, email: e, ten: o.ten ? String(o.ten).slice(0, 120) : null, kenh: o.kenh, nguon: o.nguon || null,
    muc_dich: o.mucDich.length ? o.mucDich : ["giao-dich"], van_ban: String(o.vanBan || "").slice(0, 1000),
    phien_ban: o.phienBan || PHIEN_BAN_DONG_Y, ip: o.ip || null, ua: o.ua ? String(o.ua).slice(0, 300) : null, meta: o.meta || null,
  };
  try {
    const { error } = await sb.from("dong_y_du_lieu").insert(row);
    if (error) throw error;
    return { ok: true, noi: "bang" };
  } catch {
    const thang = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
    const key = `dong_y_log_${thang}`;
    const log: any[] = (await docConfig(sb, key)) || [];
    log.push({ luc: new Date().toISOString(), ...row });
    await ghiConfig(sb, key, log.slice(-20000), "Nhật ký đồng ý xử lý dữ liệu (fallback khi chưa dán migration 057)");
    return { ok: true, noi: "config" };
  }
}

export function docDongYTuBody(b: any, mucDichMacDinh: MucDich[] = ["giao-dich"]): { co: boolean; tinTuVan: boolean; mucDich: MucDich[]; vanBan: string; phienBan: string } {
  const d = b && typeof b.dongY === "object" && b.dongY ? b.dongY : null;
  if (!d) return { co: false, tinTuVan: false, mucDich: mucDichMacDinh, vanBan: "", phienBan: "" };
  const tinTuVan = d.tinTuVan === true || d.tinTuVan === "true" || d.tinTuVan === 1;
  const mucDich = Array.from(new Set<MucDich>([...mucDichMacDinh, ...(tinTuVan ? ["tin-tu-van" as MucDich] : [])]));
  return { co: true, tinTuVan, mucDich, vanBan: String(d.vanBan || "").slice(0, 1000), phienBan: String(d.phienBan || PHIEN_BAN_DONG_Y).slice(0, 40) };
}

export function ipCua(req: Request): string | null {
  const h = req.headers;
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
}

function bimat(): string {
  return process.env.HUY_NHAN_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "acme-huy-nhan";
}
export function tokenHuy(email: string): string {
  return crypto.createHmac("sha256", bimat()).update(chuanEmail(email) || "").digest("hex").slice(0, 24);
}
export function kiemTokenHuy(email: string, token: string): boolean {
  const a = Buffer.from(tokenHuy(email)), b = Buffer.from(String(token || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function linkHuy(email: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://ops-hub.example.com";
  return `${base}/api/huy-nhan?e=${encodeURIComponent(chuanEmail(email) || "")}&t=${tokenHuy(email)}`;
}

export type LoaiYeuCau = "xem" | "sua" | "xoa" | "rut-dong-y" | "han-che" | "khac";
export const HAN_XU_LY_NGAY: Record<LoaiYeuCau, number> = { xem: 10, sua: 10, xoa: 20, "rut-dong-y": 15, "han-che": 15, khac: 15 };
export async function ghiYeuCau(sb: any, o: { loai: LoaiYeuCau; phone?: string | null; email?: string | null; ten?: string | null; noiDung?: string; kenh: string; meta?: any }): Promise<{ ok: boolean; id?: string; hanXuLy: string }> {
  const now = new Date();
  const hanXacNhan = new Date(now.getTime() + 2 * 86400000).toISOString();
  const hanXuLy = new Date(now.getTime() + HAN_XU_LY_NGAY[o.loai] * 86400000).toISOString();
  const row = {
    loai: o.loai, phone: chuanSdt(o.phone), email: chuanEmail(o.email), ten: o.ten ? String(o.ten).slice(0, 120) : null,
    noi_dung: o.noiDung ? String(o.noiDung).slice(0, 2000) : null, kenh: o.kenh, trang_thai: "moi",
    han_xac_nhan: hanXacNhan, han_xu_ly: hanXuLy, meta: o.meta || null,
  };
  try {
    const { data, error } = await sb.from("yeu_cau_du_lieu").insert(row).select("id").single();
    if (error) throw error;
    return { ok: true, id: data?.id, hanXuLy };
  } catch {
    const key = "yeu_cau_du_lieu";
    const log: any[] = (await docConfig(sb, key)) || [];
    const id = crypto.randomUUID();
    log.push({ id, luc: now.toISOString(), ...row });
    await ghiConfig(sb, key, log.slice(-2000), "Yêu cầu chủ thể dữ liệu (fallback khi chưa dán migration 057)");
    return { ok: true, id, hanXuLy };
  }
}
