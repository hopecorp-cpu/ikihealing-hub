import { getServiceClient } from "./supabase-server";

export type GioiHan = { moiIpMoiGio: number; tongMoiNgay: number };

export type CoHeaders = { headers: { get(ten: string): string | null } };

function layIp(req: CoHeaders): string {
  const h = req.headers;
  return (h.get("x-real-ip") || (h.get("x-forwarded-for") || "").split(",")[0] || "khong-ro").trim().slice(0, 64);
}

function ngayVN(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

export async function vuotGioiHan(req: CoHeaders, nhom: string, gh: GioiHan): Promise<boolean> {
  try {
    const sb = getServiceClient();
    const key = `chan_spam:${nhom}`;
    const raw = (await sb.from("config").select("value").eq("key", key).maybeSingle()).data?.value;
    let so: { ngay: string; tong: number; ip: Record<string, [number, number]> } = { ngay: ngayVN(), tong: 0, ip: {} };
    try { const p = JSON.parse(raw || ""); if (p && typeof p === "object") so = p; } catch { }
    const now = Date.now();
    if (so.ngay !== ngayVN()) so = { ngay: ngayVN(), tong: 0, ip: {} };
    for (const [k, [, t0]] of Object.entries(so.ip || {})) if (now - t0 > 3600_000) delete so.ip[k];
    const ip = layIp(req);
    const cu = so.ip[ip] || [0, now];
    if (so.tong >= gh.tongMoiNgay || cu[0] >= gh.moiIpMoiGio) return true;
    so.ip[ip] = [cu[0] + 1, cu[1]];
    so.tong += 1;
    await sb.from("config").upsert({ key, value: JSON.stringify(so), description: "Sổ đếm chặn spam cửa công khai (lib/chan-spam.ts)" }, { onConflict: "key" });
    return false;
  } catch {
    return false;
  }
}

export async function vuotLuotNguoi(nhom: string, nguoi: string, gh: { moiPhut: number; moiNgay: number }): Promise<boolean> {
  try {
    const { xetLuot } = await import("./bot-an-toan");
    const sb = getServiceClient();
    const key = `chan_spam:${nhom}`;
    const raw = (await sb.from("config").select("value").eq("key", key).maybeSingle()).data?.value;
    let so: any = null;
    try { so = JSON.parse(raw || ""); } catch { }
    const kq = xetLuot(so, nguoi, Date.now(), ngayVN(), gh);
    if (kq.vuot) return true;
    await sb.from("config").upsert({ key, value: JSON.stringify(kq.so), description: "Sổ đếm lượt gọi bộ não theo người — bot Telegram (lib/chan-spam.ts)" }, { onConflict: "key" });
    return false;
  } catch {
    return false;
  }
}
