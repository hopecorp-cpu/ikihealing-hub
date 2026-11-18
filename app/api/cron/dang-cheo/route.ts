import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { setConfigValue } from "@/lib/app-config";
import { chayMotLuot } from "@/lib/dang-cheo";
import { sendTelegramMay, tgEscape } from "@/lib/telegram";
import { ghiViecMay } from "@/lib/viec-may";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sb = getServiceClient();
  const secret = (process.env.CRON_SECRET || "").trim();
  const key = (url.searchParams.get("key") || "").trim();

  const tokenCfg = String((await sb.from("config").select("value").eq("key", "ads_report_token").maybeSingle()).data?.value || "").trim();
  const oke = req.headers.get("authorization") === `Bearer ${secret}`
    || (key && ((secret && key === secret) || (tokenCfg && key === tokenCfg)));
  if (!oke) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dry = url.searchParams.get("dry") === "1";
  const t0 = Date.now();
  try {
    const kq = await chayMotLuot(dry);
    await ghiViecMay({
      agent: "dang-cheo", agentTen: "Máy soạn bài đăng chéo",
      viec: `Soạn bản đăng cho các nền tảng ngoài${dry ? " (chạy thử)" : ""}`,
      trangThai: kq.ds.length ? "xong" : "khong_co_gi",
      soLuong: kq.ds.length, donVi: "bản",
      chiTiet: kq.boQua.length ? `Bỏ qua ${kq.boQua.length} nền tảng` : null,
      link: "/dang-cheo", giay: (Date.now() - t0) / 1000,
    });
    if (!dry && kq.ds.length) await sendTelegramMay("dang-cheo", tgEscape(kq.text));
    await setConfigValue(
      "dang_cheo_last",
      JSON.stringify({ at: kq.at, soan: kq.ds.length, boQua: kq.boQua.length, dry }),
      "Nhịp tim máy soạn bài đăng chéo (Medium, Substack, X, LinkedIn...)"
    );

    return NextResponse.json({ ok: true, dry, soan: kq.ds.length, boQua: kq.boQua, text: kq.text, ds: dry ? kq.ds : undefined });
  } catch (e: any) {
    const loi = String(e?.message || e).slice(0, 300);
    await ghiViecMay({
      agent: "dang-cheo", agentTen: "Máy soạn bài đăng chéo",
      viec: "Soạn bản đăng cho các nền tảng ngoài",
      trangThai: "hong", chiTiet: loi, link: "/dang-cheo", giay: (Date.now() - t0) / 1000,
    });
    await setConfigValue("dang_cheo_status", JSON.stringify({ at: new Date().toISOString(), ok: false, error: loi }),
      "Trạng thái máy soạn bài đăng chéo").catch(() => {});
    return NextResponse.json({ ok: false, error: loi }, { status: 500 });
  }
}
