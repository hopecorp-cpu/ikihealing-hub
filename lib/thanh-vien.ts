import { createHmac, timingSafeEqual } from "crypto";
import { chuanSdt } from "@/lib/du-lieu-ca-nhan";
import { CHAT_DAI_LY, trangThaiJt, type VanDon } from "@/lib/affiliate-don";
import { chuanSdt as sdtJt } from "@/lib/don-hang-jt";

export type Hang = { ten: string; tu: number };
export type Qua = { id: string; ten: string; moTa: string; diem: number; conHang: boolean };
export type CauHinhThanhVien = {
  mo: boolean;
  dongMoiDiem: number;
  tinhTu: string;
  hang: Hang[];
  qua: Qua[];
};

export const CAU_HINH_MAC_DINH: CauHinhThanhVien = {
  mo: false,
  dongMoiDiem: 10000,
  tinhTu: "2026-08-01",
  hang: [{ ten: "Thành viên", tu: 0 }],
  qua: [],
};

const CHU_GIAM = /gi[aả]m|chi[eế]t\s*kh[aấ]u|%|sale\s*off|discount/i;

export function docCauHinh(raw: unknown): CauHinhThanhVien {
  let j: any = raw;
  if (typeof raw === "string") { try { j = JSON.parse(raw); } catch { j = null; } }
  if (!j || typeof j !== "object") j = {};
  const md = CAU_HINH_MAC_DINH;
  const dong = Number(j.dongMoiDiem);
  const hang: Hang[] = (Array.isArray(j.hang) ? j.hang : [])
    .map((h: any) => ({ ten: String(h?.ten || "").trim().slice(0, 30), tu: Math.max(0, Math.floor(Number(h?.tu) || 0)) }))
    .filter((h: Hang) => h.ten)
    .sort((a: Hang, b: Hang) => a.tu - b.tu);
  if (!hang.length || hang[0].tu !== 0) hang.unshift({ ...md.hang[0] });
  const qua: Qua[] = (Array.isArray(j.qua) ? j.qua : [])
    .map((q: any) => ({
      id: String(q?.id || "").trim().slice(0, 40), ten: String(q?.ten || "").trim().slice(0, 60),
      moTa: String(q?.moTa || "").trim().slice(0, 120), diem: Math.floor(Number(q?.diem) || 0), conHang: q?.conHang !== false,
    }))
    .filter((q: Qua) => q.id && q.ten && q.diem > 0 && !CHU_GIAM.test(q.ten + " " + q.moTa));
  return {
    mo: j.mo === true,
    dongMoiDiem: Number.isFinite(dong) && dong >= 1000 ? dong : md.dongMoiDiem,
    tinhTu: /^\d{4}-\d{2}-\d{2}$/.test(String(j.tinhTu || "")) ? j.tinhTu : md.tinhTu,
    hang, qua,
  };
}

export type DonTV = { chat_id: string; message_id: string | number; ngay: string; sdt: string | null; khach_tra: number | null };
export type YeuCauDoi = { id: string; sdt: string; quaId: string; diem: number; luc: string; trangThai: "cho_xu_ly" | "da_gui" | "tu_choi" };

export type TheThanhVien = {
  tichLuy: number; daDoi: number; khaDung: number;
  hang: string; hangKe: string | null; conLenHang: number | null;
  soDonDaGiao: number;
};

export function tinhThe(sdtRaw: string, don: DonTV[], vanDon: VanDon[], doi: YeuCauDoi[], ch: CauHinhThanhVien, daiLy: Set<string>): TheThanhVien {
  const sdt = chuanSdt(sdtRaw);
  const theoSdt = new Map<string, VanDon[]>();
  for (const v of vanDon) {
    const s = sdtJt(v.receiver_phone);
    if (s.length === 10) (theoSdt.get(s) || theoSdt.set(s, []).get(s)!).push(v);
  }
  let tichLuy = 0, soDon = 0;
  if (sdt && !daiLy.has(sdt)) {
    for (const o of don) {
      if (String(o.chat_id) === CHAT_DAI_LY || chuanSdt(o.sdt) !== sdt || o.ngay < ch.tinhTu) continue;
      if (trangThaiJt(sdt, o.ngay, theoSdt).tt !== "da_giao") continue;
      tichLuy += Math.floor(Math.round((Number(o.khach_tra) || 0) / 1.08) / ch.dongMoiDiem);
      soDon++;
    }
  }
  const daDoi = doi.filter((d) => d.sdt === sdt && d.trangThai !== "tu_choi").reduce((s, d) => s + d.diem, 0);
  let i = 0;
  for (let k = 0; k < ch.hang.length; k++) if (ch.hang[k].tu <= tichLuy) i = k;
  const ke = ch.hang[i + 1] || null;
  return {
    tichLuy, daDoi, khaDung: Math.max(0, tichLuy - daDoi),
    hang: ch.hang[i].ten, hangKe: ke?.ten || null, conLenHang: ke ? ke.tu - tichLuy : null, soDonDaGiao: soDon,
  };
}

export function kiemDoi(the: TheThanhVien, qua: Qua | undefined, ch: CauHinhThanhVien): { ok: true } | { ok: false; ly: string } {
  if (!ch.mo) return { ok: false, ly: "chua-mo" };
  if (!qua) return { ok: false, ly: "khong-co-qua" };
  if (!qua.conHang) return { ok: false, ly: "het-qua" };
  if (the.khaDung < qua.diem) return { ok: false, ly: "chua-du-diem" };
  return { ok: true };
}

const NGAY_THE = 30;
const ky = (s: string, khoa: string) => createHmac("sha256", khoa).update(s).digest("base64url");

export function taoThe(sdt: string, khoa: string, bayGio = Date.now()): string {
  const het = Math.floor(bayGio / 1000) + NGAY_THE * 86400;
  const goc = `${Buffer.from(sdt).toString("base64url")}.${het}`;
  return `${goc}.${ky(goc, khoa)}`;
}

export function docThe(the: string, khoa: string, bayGio = Date.now()): string | null {
  const p = String(the || "").split(".");
  if (p.length !== 3 || !khoa) return null;
  const goc = `${p[0]}.${p[1]}`;
  const a = Buffer.from(ky(goc, khoa)), b = Buffer.from(p[2]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!(Number(p[1]) * 1000 > bayGio)) return null;
  return chuanSdt(Buffer.from(p[0], "base64url").toString());
}
