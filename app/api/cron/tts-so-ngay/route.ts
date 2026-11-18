import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { ttsConfigured } from "@/lib/tiktok-shop/config";
import { kiemCron } from "@/lib/tiktok-shop/cron-guard";
import { getOrderDetail, searchOrders } from "@/lib/tiktok-shop/api";
import { chonCheDoTiktok, tongQuanTuDon } from "@/lib/tiktok-shop/che-do";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const GIU_NGAY = 90;
const ngayVN = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export async function GET(req: Request) {
  const chan = kiemCron(req); if (chan) return chan;
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const { count, error } = await getServiceClient().from("tts_tokens").select("open_id", { count: "exact", head: true });
  if (error) return NextResponse.json({ ok: false, error: `đếm tts_tokens lỗi: ${error.message}` }, { status: 500 });
  const cd = chonCheDoTiktok(process.env.TIKTOK_CHE_DO, count ?? 0);
  if (cd.cheDo !== "api") return NextResponse.json({ ok: true, boQua: true, cheDo: cd.cheDo, lyDo: cd.lyDo });
  if (!ttsConfigured()) return NextResponse.json({ ok: false, error: "chưa cấu hình TTS_APP_KEY/TTS_APP_SECRET" }, { status: 503 });

  try {
    const tuGiay = Math.floor(Date.now() / 1000) - 7 * 86400;
    const ids: string[] = [];
    let pageToken: string | undefined;
    for (let trang = 0; trang < 20; trang++) {
      const d = await searchOrders({ create_time_ge: tuGiay }, { pageSize: 50, pageToken, sortField: "create_time" });
      for (const o of d?.orders || []) if (o?.id) ids.push(String(o.id));
      pageToken = d?.next_page_token || undefined;
      if (!pageToken) break;
    }
    const kq = tongQuanTuDon(ids.length ? await getOrderDetail(ids) : []);
    const ngay = ngayVN();
    const tom = { ok: true, cheDo: "api", ngay, soDon: kq.soDon, soDonBoQua: kq.soDonBoQua, soSanPham: kq.sanPham.length, gmv7ngay: kq.tongQuan.gmv7ngay };
    if (dry) return NextResponse.json({ ...tom, dry: true });

    let cu: any = null;
    try { cu = JSON.parse((await getConfigValue("san_tiktok_so")) || "null"); } catch { cu = null; }
    cu = cu && typeof cu === "object" ? cu : { ngay: {} };
    cu.ngay = cu.ngay || {};
    cu.ngay[ngay] = { tongQuan: kq.tongQuan, sanPham: kq.sanPham, at: new Date().toISOString(), nguon: "api" };
    const cacNgay = Object.keys(cu.ngay).sort();
    for (const n of cacNgay.slice(0, Math.max(0, cacNgay.length - GIU_NGAY))) delete cu.ngay[n];
    await setConfigValue("san_tiktok_so", JSON.stringify(cu));
    await setConfigValue("san_tiktok_status", JSON.stringify({ ok: true, at: new Date().toISOString(), nguon: "api", soDon: kq.soDon, soSanPham: kq.sanPham.length }));
    return NextResponse.json(tom);
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("[tts-so-ngay]", msg);
    await setConfigValue("san_tiktok_status", JSON.stringify({ ok: false, at: new Date().toISOString(), nguon: "api", loi: msg.slice(0, 300) })).catch(() => {});
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
