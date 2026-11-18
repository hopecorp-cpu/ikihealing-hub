import type { Ctx, Den, O, SucKhoe } from "./types";
import { CAT, CHU, GIO, MS, LECH_VN_GIO, TRANG, TRAN_VONG } from "./muc-tieu";

export type Khung = {
  key: string;
  phong: string;
  ten: string;
  donVi: string;
  mucTieu: string | null;
  nguon: string;
  tanSuat: string;
  nhayCam?: boolean;
  nguongGio: number;
  watchdog?: string | null;
};

export type NapMot = { giaTri?: number | string | null; capNhatLuc?: string | null; nguon?: string | null };

const denXam = "xam" as const;

export class ThieuBang extends Error {
  bang: string;
  constructor(bang: string) {
    super(`chưa có bảng ${bang} trên Supabase`);
    this.bang = bang;
  }
}

function maLoi(e: unknown): string {
  if (!e || typeof e !== "object" || !("code" in e)) return "";
  return String((e as { code?: unknown }).code || "").trim();
}

function loiGoc(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message?: unknown }).message || "");
  return String(e || "");
}

export function rutLoi(e: unknown): string {
  if (e instanceof ThieuBang) return e.message.slice(CAT.khong, CAT.lyDo);
  const code = maLoi(e);
  if (code) return `lỗi đọc dữ liệu (${code})`.slice(CAT.khong, CAT.lyDo);
  const s = loiGoc(e).replace(/\s+/g, " ").trim();
  return (s || "lỗi không rõ").slice(CAT.khong, CAT.lyDo);
}

function cat(m: string, dau: string, cuoi: string): string | null {
  const a = m.toLowerCase().indexOf(dau.toLowerCase());
  if (a < 0) return null;
  const b = m.indexOf(cuoi, a + dau.length);
  if (b < 0) return null;
  const ten = m.slice(a + dau.length, b).replace(/^public\./, "");
  return ten || null;
}

function tenBangTuLoi(e: unknown): string | null {
  const m = loiGoc(e);
  return cat(m, 'relation "', '" does not exist') || cat(m, "table '", "'");
}

export function laThieuBang(e: unknown): boolean {
  if (e instanceof ThieuBang) return true;
  const code = maLoi(e).toUpperCase();
  if (code === "42P01" || code === "PGRST205") return true;
  const m = loiGoc(e).toLowerCase();
  return m.includes("does not exist") || m.includes("could not find the table") || m.includes("schema cache");
}

export function homNayVN(d = new Date()): string {
  const vn = new Date(d.getTime() + LECH_VN_GIO * MS.gio);
  return vn.toISOString().slice(CAT.khong, CAT.ngay);
}

export function thangCua(ngay: string): string {
  return ngay.slice(CAT.khong, CAT.thang);
}

export function dauNgayIso(ngay: string): string {
  const t = Date.parse(`${ngay}T00:00:00Z`) - LECH_VN_GIO * MS.gio;
  return new Date(t).toISOString();
}

export function congNgay(ngay: string, so: number): string {
  const t = Date.parse(`${ngay}T00:00:00Z`) + so * MS.ngay;
  return new Date(t).toISOString().slice(CAT.khong, CAT.ngay);
}

export function ngayTuIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return homNayVN(new Date(t));
}

export function fmtLucVN(iso: string | null | undefined): string {
  if (!iso) return "chưa có mốc";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "chưa có mốc";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

export function gioTu(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(CAT.khong, (Date.now() - t) / MS.gio);
}

export function moiNhat(isos: Array<string | null | undefined>): string | null {
  let m: string | null = null;
  let t = CAT.khong;
  for (const s of isos) {
    if (!s) continue;
    const n = Date.parse(s);
    if (!Number.isFinite(n)) continue;
    if (!m || n > t) { m = s; t = n; }
  }
  return m;
}

export function oTrong(k: Khung, lyDo: string): O {
  return {
    key: k.key, phong: k.phong, ten: k.ten, giaTri: null, donVi: k.donVi,
    mucTieu: k.mucTieu, den: denXam, trangThai: "chua-co-du-lieu", lyDo,
    nguon: k.nguon, capNhatLuc: null, tanSuat: k.tanSuat, nhayCam: !!k.nhayCam,
  };
}

export function oLoi(k: Khung, e: unknown): O {
  return {
    key: k.key, phong: k.phong, ten: k.ten, giaTri: null, donVi: k.donVi,
    mucTieu: k.mucTieu, den: "do", trangThai: "loi", lyDo: rutLoi(e),
    nguon: k.nguon, capNhatLuc: null, tanSuat: k.tanSuat, nhayCam: !!k.nhayCam,
  };
}

export function denDem(gia: number, mucLaKhong: boolean): Den {
  if (!mucLaKhong) return "xanh";
  return gia > CAT.khong ? "do" : "xanh";
}

export function apCham(o: O, k: Khung, ctx?: Ctx): O {
  if (o.trangThai === "chua-co-du-lieu" || o.trangThai === "loi") return o;
  const wd: SucKhoe | undefined = k.watchdog ? ctx?.health?.find((s) => s.key === k.watchdog) : undefined;
  const gio = gioTu(o.capNhatLuc);
  const chamGio = gio != null && gio > k.nguongGio;
  const chamMay = !!(wd && !wd.ok && !wd.chiThamKhao);
  if (!chamGio && !chamMay) return o;
  const ly = [
    chamMay ? wd?.note : null,
    chamGio ? `nguồn chậm từ ${fmtLucVN(o.capNhatLuc)}` : null,
    o.lyDo,
  ].filter(Boolean).join(" · ");
  return {
    ...o,
    trangThai: "cham",
    den: o.den === "do" ? "do" : "vang",
    lyDo: ly || o.lyDo,
  };
}

export async function chay(k: Khung, viec: () => Promise<O>, ctx?: Ctx): Promise<O> {
  try {
    const o = await viec();
    return apCham(o, k, ctx);
  } catch (e) {
    if (e instanceof ThieuBang) return oTrong(k, e.message);
    if (laThieuBang(e)) {
      const ten = tenBangTuLoi(e);
      return oTrong(k, ten ? `chưa có bảng ${ten} trên Supabase` : "chưa có bảng này trên Supabase");
    }
    return oLoi(k, e);
  }
}

export async function docBang(sb: any, bang: string, cot: string, gan?: (q: any) => any): Promise<any[]> {
  const het: any[] = [];
  let from = CAT.khong;
  let vong = CAT.khong;
  for (;;) {
    vong += CAT.mot;
    if (vong > TRAN_VONG) break;
    let q = sb.from(bang).select(cot);
    if (gan) q = gan(q);
    const { data, error } = await q.range(from, from + TRANG - CAT.mot);
    if (error) {
      if (laThieuBang(error)) throw new ThieuBang(bang);
      throw error;
    }
    const ds = data || [];
    het.push(...ds);
    if (ds.length < TRANG) break;
    from += TRANG;
  }
  return het;
}

export async function docMot(sb: any, bang: string, cot: string, gan?: (q: any) => any): Promise<any> {
  let q = sb.from(bang).select(cot);
  if (gan) q = gan(q);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data;
}

function parseCauHinh(raw: string | null): any {
  if (raw == null || raw === "") return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

export async function docKhoa(sb: any, key: string, ctx?: Ctx): Promise<any> {
  if (ctx?.docCauHinh) {
    const { error } = await sb.from("config").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return parseCauHinh(await ctx.docCauHinh(key));
  }
  const row = await docMot(sb, "config", "value", (q) => q.eq("key", key));
  if (!row?.value) return null;
  return parseCauHinh(String(row.value));
}

export async function docNap(sb: any, ctx?: Ctx): Promise<Record<string, NapMot>> {
  const j = await docKhoa(sb, "chi_so_nap", ctx);
  if (!j || typeof j !== "object" || Array.isArray(j)) return {};
  return j as Record<string, NapMot>;
}

export function lyDoNap(key: string, may: string): string {
  return `nguồn là file trên ${may}, chưa nạp lên Supabase (config.chi_so_nap.${key})`;
}

export function oTuNap(k: Khung, nap: NapMot | undefined, may: string): O {
  if (nap == null || nap.giaTri == null || nap.giaTri === "") return oTrong(k, lyDoNap(k.key, may));
  return {
    key: k.key, phong: k.phong, ten: k.ten, giaTri: nap.giaTri, donVi: k.donVi,
    mucTieu: k.mucTieu, den: "xanh", trangThai: "song", lyDo: null,
    nguon: nap.nguon || k.nguon, capNhatLuc: nap.capNhatLuc || null, tanSuat: k.tanSuat, nhayCam: !!k.nhayCam,
  };
}

export function oSo(k: Khung, giaTri: number | string, o: Partial<O> & { den: Den }): O {
  return {
    key: k.key, phong: k.phong, ten: k.ten, giaTri, donVi: k.donVi,
    mucTieu: k.mucTieu, den: o.den, trangThai: o.trangThai || "song", lyDo: o.lyDo ?? null,
    nguon: o.nguon || k.nguon, capNhatLuc: o.capNhatLuc ?? null, tanSuat: k.tanSuat, nhayCam: !!k.nhayCam,
  };
}

export const nguong = GIO;
export const chu = CHU;

export function trungVi(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  const hai = CAT.mot + CAT.mot;
  const giua = Math.floor(n / hai);
  if (n % hai === CAT.khong) {
    const a = s[giua - CAT.mot];
    const b = s[giua];
    return (a + b) / hai;
  }
  return s[giua];
}

export function xongChua(status: string | null | undefined): boolean {
  return status === "done" || status === "cancelled";
}

export function treQuaMotNgay(due: string | null | undefined, hom: string): boolean {
  if (!due) return false;
  const d = due.slice(CAT.khong, CAT.ngay);
  const moc = congNgay(hom, -CAT.mot);
  return d < moc;
}
