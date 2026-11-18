import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { setConfigValue } from "@/lib/app-config";
import { sdtDaiLy } from "@/lib/doanh-thu";
import { ganMaTuLead, tinhDonCtv, type DonSo, type LeadCtv, type VanDon } from "@/lib/affiliate-don";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function layHet<T>(q: (tu: number, den: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const ra: T[] = [];
  for (let tu = 0; ; tu += 1000) {
    const { data, error } = await q(tu, tu + 999);
    if (error) throw new Error(error.message);
    ra.push(...(data || []));
    if (!data || data.length < 1000) return ra;
  }
}

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const url = process.env.AFF_APP_URL, push = process.env.AFF_PUSH_SECRET, sdtKey = process.env.AFF_SDT_KEY;
  const ghiNhip = async (v: Record<string, unknown>) => dry ? undefined :
    setConfigValue("aff_day_don", JSON.stringify({ at: new Date().toISOString(), ...v }), "Lần đẩy đơn CTV sang app affiliate gần nhất (watchdog đọc)");

  try {
    if (!url || !push || !sdtKey) throw new Error("thiếu AFF_APP_URL / AFF_PUSH_SECRET / AFF_SDT_KEY");
    const sb = getServiceClient();
    const donGoc = await layHet<DonSo>((a, b) => sb.from("tg_orders")
      .select("id, chat_id, message_id, ngay, sdt, khach_tra, san_pham, ma_ctv").order("id").range(a, b));

    const leadCtv = await layHet<LeadCtv>((a, b) => sb.from("leads")
      .select("phone, created_at, note").ilike("note", "%CTV: %").order("id").range(a, b));
    const don = ganMaTuLead(donGoc, leadCtv);
    const coMa = don.filter((o) => o.ma_ctv && String(o.ma_ctv).trim());
    if (!coMa.length) {
      await ghiNhip({ ok: true, don: 0, ghiChu: "chưa có đơn nào mang mã CTV" });
      return NextResponse.json({ ok: true, don: 0 });
    }
    const cuNhat = coMa.map((o) => o.ngay).sort()[0];
    const tu = new Date(Date.parse(cuNhat) - 30 * 864e5).toISOString();
    const vanDon = await layHet<VanDon>((a, b) => sb.from("jt_waybills")
      .select("receiver_phone, status_group, order_create_time, updated_at, is_void").gte("order_create_time", tu).order("waybill_no").range(a, b));
    const ds = tinhDonCtv(don, vanDon, { daiLy: await sdtDaiLy(sb), key: sdtKey });

    if (dry) return NextResponse.json({ ok: true, dry: true, don: ds.length, mau: ds.slice(0, 5).map((d) => ({ ...d, sdt_bam: "…" })) });

    const r = await fetch(url.replace(/\/$/, "") + "/api/nhap-don", {
      method: "POST", headers: { "Content-Type": "application/json", "x-aff-secret": push },
      body: JSON.stringify({ dons: ds }), cache: "no-store", signal: AbortSignal.timeout(60_000),
    });
    const kq = await r.json().catch(() => ({}));
    if (!r.ok || !kq.ok) throw new Error(`app CTV trả ${r.status}: ${kq.error || "?"}`);
    await ghiNhip({ ok: true, don: ds.length, moi: kq.moi, maLa: kq.maLa, leadCtv: leadCtv.length });
    return NextResponse.json({ ok: true, don: ds.length, ...kq });
  } catch (e: any) {
    const loi = String(e?.message || e);
    await ghiNhip({ ok: false, loi }).catch(() => {});
    return NextResponse.json({ ok: false, error: loi }, { status: 500 });
  }
}
