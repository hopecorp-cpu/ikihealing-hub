import crypto from "node:crypto";
import { NextResponse } from "next/server";

export type ChoNhan = { bearer?: boolean; query?: string[]; headers?: string[] };

export type NguonKhoa = ChoNhan & { env?: string; cfg?: string };

export type KhoaDaDoc = ChoNhan & { khoa: string };
export type KetQuaKhoa = "ok" | "sai" | "thieu";

export const khoaCron = (cho: ChoNhan = { bearer: true, query: ["key"] }): NguonKhoa => ({ env: "CRON_SECRET", ...cho });

export const khoaBaoCao = (cho: ChoNhan): NguonKhoa => ({ cfg: "ads_report_token", ...cho });

export function soKhopAnToan(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

function giaTriDuaVao(req: Request, url: URL, cho: ChoNhan): string[] {
  const out: string[] = [];
  if (cho.bearer) {
    const h = req.headers.get("authorization") || "";
    if (/^Bearer\s+/i.test(h)) out.push(h.replace(/^Bearer\s+/i, ""));
  }
  for (const q of cho.query || []) out.push(url.searchParams.get(q) || "");
  for (const h of cho.headers || []) out.push(req.headers.get(h) || "");
  return out.map((v) => v.trim()).filter(Boolean);
}

export function xacThucKhoa(req: Request, ds: KhoaDaDoc[]): KetQuaKhoa {
  const coKhoa = ds.filter((d) => (d.khoa || "").trim());
  if (!coKhoa.length) return "thieu";
  const url = new URL(req.url);
  for (const d of coKhoa) {
    const khoa = d.khoa.trim();
    for (const v of giaTriDuaVao(req, url, d)) if (soKhopAnToan(v, khoa)) return "ok";
  }
  return "sai";
}

async function docKhoa(n: NguonKhoa): Promise<string> {
  if (n.env) return (process.env[n.env] || "").trim();
  if (n.cfg) {
    try {
      const { getConfigValue } = await import("@/lib/app-config");
      return ((await getConfigValue(n.cfg)) || "").trim();
    } catch { return ""; }
  }
  return "";
}

export async function xacThucMay(req: Request, nguon: NguonKhoa[]): Promise<KetQuaKhoa> {
  let coKhoa = false;
  for (const n of nguon) {
    const kq = xacThucKhoa(req, [{ ...n, khoa: await docKhoa(n) }]);
    if (kq === "ok") return "ok";
    if (kq === "sai") coKhoa = true;
  }
  return coKhoa ? "sai" : "thieu";
}

export function phanHoiTuChoi(kq: KetQuaKhoa, init?: { headers?: HeadersInit }): NextResponse | null {
  if (kq === "ok") return null;
  if (kq === "thieu") {
    return NextResponse.json({ ok: false, error: "Chưa cấu hình khoá bảo vệ (biến môi trường / config) — route đóng" }, { status: 503, ...init });
  }
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, ...init });
}

export async function chanMay(req: Request, nguon: NguonKhoa[], init?: { headers?: HeadersInit }): Promise<NextResponse | null> {
  return phanHoiTuChoi(await xacThucMay(req, nguon), init);
}
