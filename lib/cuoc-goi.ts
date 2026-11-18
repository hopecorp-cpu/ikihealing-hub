import crypto from "node:crypto";
import { chuanSdt } from "@/lib/du-lieu-ca-nhan";

export const BUCKET_GHI_AM = "ghi-am-cuoc-goi";

export const GIAY_TOI_THIEU = 30;

export const BYTE_TOI_DA_CHEP = 14 * 1024 * 1024;

export const NGAY_RA_DON = 7;

export type MayGhiAm = { ma: string; sale: string };

export const bamToken = (token: string) => crypto.createHash("sha256").update(token.trim(), "utf8").digest("hex");

export function timMay(token: string, cfgRaw: string | null): MayGhiAm | null {
  if (!token.trim() || !cfgRaw) return null;
  let cfg: any;
  try { cfg = JSON.parse(cfgRaw); } catch { return null; }
  const m = cfg?.[bamToken(token)];
  if (!m || typeof m.ma !== "string" || !m.ma.trim()) return null;
  return { ma: m.ma.trim(), sale: String(m.sale || "").trim() };
}

export function bienTheSdt(sdt: string): string[] {
  const goc = sdt.slice(1);
  return [sdt, "84" + goc, "+84" + goc];
}

export type DauVaoTaiLen = {
  ma_tren_may: string; sdt: string; chieu: "den" | "di";
  bat_dau: string; thoi_luong_giay: number; file_bytes: number; duoi: string;
};

const DUOI_HOP_LE = ["m4a", "amr", "mp3", "aac", "3gp", "ogg", "wav", "opus"];

export function kiemDauVao(b: any): { ok: true; v: DauVaoTaiLen } | { ok: false; loi: string } {
  const ma = String(b?.ma_tren_may || "").trim();
  if (!/^[a-f0-9]{16,64}$/.test(ma)) return { ok: false, loi: "ma_tren_may sai dạng" };
  const sdt = chuanSdt(b?.sdt);
  if (!sdt) return { ok: false, loi: "sdt không hợp lệ" };
  const chieu = b?.chieu === "den" || b?.chieu === "di" ? b.chieu : null;
  if (!chieu) return { ok: false, loi: "chieu phải là den|di" };
  const t = Date.parse(String(b?.bat_dau || ""));
  if (!Number.isFinite(t)) return { ok: false, loi: "bat_dau sai dạng" };
  if (t > Date.now() + 10 * 60e3) return { ok: false, loi: "bat_dau ở tương lai — giờ máy sai?" };
  const tl = Math.round(Number(b?.thoi_luong_giay));
  if (!Number.isFinite(tl) || tl < 0 || tl > 6 * 3600) return { ok: false, loi: "thoi_luong_giay sai" };
  const by = Math.round(Number(b?.file_bytes));
  if (!Number.isFinite(by) || by <= 0 || by > 50 * 1024 * 1024) return { ok: false, loi: "file_bytes sai (tối đa 50MB)" };
  const duoi = String(b?.duoi || "").toLowerCase().replace(/^\./, "");
  if (!DUOI_HOP_LE.includes(duoi)) return { ok: false, loi: "đuôi file không phải âm thanh" };
  return { ok: true, v: { ma_tren_may: ma, sdt, chieu, bat_dau: new Date(t).toISOString(), thoi_luong_giay: tl, file_bytes: by, duoi } };
}

export const duongDanFile = (may: string, v: DauVaoTaiLen) =>
  `${may.replace(/[^a-zA-Z0-9_-]/g, "_")}/${v.bat_dau.slice(0, 7)}/${v.ma_tren_may}.${v.duoi}`;

export const MIME_AM_THANH: Record<string, string> = {
  m4a: "audio/mp4", aac: "audio/aac", amr: "audio/amr", mp3: "audio/mpeg", "3gp": "audio/3gpp",
  ogg: "audio/ogg", opus: "audio/ogg", wav: "audio/wav",
};

export function ngayVN(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
}

export function raDon(cuoc: { sdt: string | null; bat_dau: string }, ngayDonTheoSdt: Map<string, string[]>): boolean {
  if (!cuoc.sdt) return false;
  const ds = ngayDonTheoSdt.get(cuoc.sdt);
  if (!ds?.length) return false;
  const tu = ngayVN(cuoc.bat_dau);
  const den = ngayVN(new Date(new Date(cuoc.bat_dau).getTime() + NGAY_RA_DON * 86400e3).toISOString());
  return ds.some((d) => d >= tu && d <= den);
}

export function gomDonTheoSdt(don: { sdt: string | null; ngay: string }[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const d of don) {
    const s = chuanSdt(d.sdt);
    if (!s) continue;
    if (!m.has(s)) m.set(s, []);
    m.get(s)!.push(String(d.ngay).slice(0, 10));
  }
  return m;
}
