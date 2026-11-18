import { cheDuLieu } from "./tg-che";
import { cheKhoa, tgEscape } from "./telegram";

export const TRANG_THAI = ["dang-chay", "xong", "ket", "cho-anh"] as const;
export type TrangThai = (typeof TRANG_THAI)[number];
export const TRANG_THAI_BAO: readonly TrangThai[] = ["xong", "ket", "cho-anh"];
export const NHAN_TRANG_THAI: Record<TrangThai, string> = { "dang-chay": "Đang chạy", xong: "Xong", ket: "Kẹt", "cho-anh": "Chờ anh" };

export const THU_TU: Record<TrangThai, number> = { "cho-anh": 0, ket: 1, "dang-chay": 2, xong: 3 };

export const TOI_DA_VIEC = 200;
export const KHOA_CONFIG = "bang_viec";

export type Viec = { ma: string; trang_thai: TrangThai; link: string; la_url: boolean; mo_ta: string; luc: string; phong?: string };

export type BangViecLuu = { cap_nhat: string; viec: Viec[]; da_bao: Record<string, TrangThai>; cho_gui?: string[] };

export function cheChu(s: string): string {
  const t = String(s ?? "").replace(/\/Users\/[^/\s]+\//g, "~/");
  return cheDuLieu(cheKhoa(t));
}

export function chuanHoaLink(raw: unknown): { link: string; la_url: boolean } {
  const s = String(raw ?? "").trim();
  if (!s) return { link: "", la_url: false };
  if (/^https:\/\//i.test(s) && s.length <= 500) {
    try {
      new URL(s);
      if (cheKhoa(s) === s && cheDuLieu(s) === s) return { link: s, la_url: true };
    } catch {  }
  }
  if (s.length > 200) return { link: "", la_url: false };
  return { link: cheChu(s).slice(0, 200), la_url: false };
}

export type KetQuaChuanHoa = { ok: true; viec: Viec[]; bo_qua: number } | { ok: false; error: string };

export function chuanHoaDauVao(body: unknown): KetQuaChuanHoa {
  const ds = (body as any)?.viec;
  if (!Array.isArray(ds)) return { ok: false, error: "Thiếu mảng viec" };
  if (ds.length > TOI_DA_VIEC) return { ok: false, error: `Tối đa ${TOI_DA_VIEC} việc mỗi lượt` };
  const theoMa = new Map<string, Viec>();
  let boQua = 0;
  for (const x of ds) {
    const ma = String(x?.ma ?? "").trim().slice(0, 80);
    const tt = String(x?.trang_thai ?? "").trim() as TrangThai;
    const luc = String(x?.luc ?? "").trim();
    if (!ma || !TRANG_THAI.includes(tt) || !luc || Number.isNaN(Date.parse(luc))) { boQua++; continue; }
    const { link, la_url } = chuanHoaLink(x?.link);
    const v: Viec = { ma: cheChu(ma), trang_thai: tt, link, la_url, mo_ta: cheChu(String(x?.mo_ta ?? "")).slice(0, 200), luc };
    const phong = String(x?.phong ?? "").trim().toLowerCase();
    if (/^[a-z]{2,6}$/.test(phong)) v.phong = phong;
    const cu = theoMa.get(v.ma);
    if (!cu || Date.parse(v.luc) >= Date.parse(cu.luc)) theoMa.set(v.ma, v);
  }
  return { ok: true, viec: [...theoMa.values()], bo_qua: boQua };
}

const MOT_NGAY = 24 * 3600 * 1000;

export function tinhCanBao(cu: BangViecLuu | null, moi: Viec[], nowMs: number): { canBao: Viec[]; daBao: Record<string, TrangThai> } {
  const daBao: Record<string, TrangThai> = {};
  const canBao: Viec[] = [];
  const cuTheoMa = new Map((cu?.viec || []).map((v) => [v.ma, v] as const));
  for (const v of moi) {
    if (!TRANG_THAI_BAO.includes(v.trang_thai)) continue;
    const daBaoCu = cu?.da_bao?.[v.ma];
    if (cu && daBaoCu !== v.trang_thai) {
      const truoc = cuTheoMa.get(v.ma);
      const doi = (cu.cho_gui || []).includes(v.ma) || (truoc ? truoc.trang_thai !== v.trang_thai : nowMs - Date.parse(v.luc) <= MOT_NGAY);
      if (doi) canBao.push(v);
    }
    daBao[v.ma] = v.trang_thai;
  }
  return { canBao, daBao };
}

export function soanTin(ds: Viec[], linkTrang: string): string {
  const dong = ds.slice(0, 10).map((v) => {
    const mo = v.mo_ta ? ` — ${tgEscape(v.mo_ta.slice(0, 120))}` : "";
    return `• <b>${NHAN_TRANG_THAI[v.trang_thai]}</b>: ${tgEscape(v.ma)}${mo}`;
  });
  if (ds.length > 10) dong.push(`… và ${ds.length - 10} việc nữa`);
  return [`<b>Bảng việc iMac</b>`, ...dong, linkTrang].join("\n");
}

export function docLuu(raw: string | null | undefined): BangViecLuu | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (!j || !Array.isArray(j.viec)) return null;
    return { cap_nhat: String(j.cap_nhat || ""), viec: j.viec, da_bao: j.da_bao && typeof j.da_bao === "object" ? j.da_bao : {}, cho_gui: Array.isArray(j.cho_gui) ? j.cho_gui : [] };
  } catch { return null; }
}

export function gioVN(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Saigon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

export function sapXep(ds: Viec[]): Viec[] {
  return [...ds].sort((a, b) => (THU_TU[a.trang_thai] - THU_TU[b.trang_thai]) || (Date.parse(b.luc) - Date.parse(a.luc)));
}
