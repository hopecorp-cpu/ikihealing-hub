import { NextResponse } from "next/server";
import { setConfigValue } from "@/lib/app-config";
import { phanHoiTuChoi, xacThucKhoa } from "@/lib/kiem-cron";

export function kiemCron(req: Request): NextResponse | null {
  const secret = (process.env.CRON_SECRET || "").trim();
  return phanHoiTuChoi(xacThucKhoa(req, [{ khoa: secret, bearer: true, query: ["key"] }]));
}

export async function ghiNhip(key: string, extra: Record<string, unknown> = {}) {
  try {
    await setConfigValue(key, JSON.stringify({ at: new Date().toISOString(), ...extra }), `Nhịp tim ${key} (TikTok Shop)`);
  } catch (e) { console.error("[tts] ghi nhịp hỏng", key, e); }
}
