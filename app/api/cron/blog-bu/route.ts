import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { setConfigValue } from "@/lib/app-config";
import {
  chayMotLuot,
  demBaiHomNay,
  chiTieuToiGio,
  gioVN,
  CHI_TIEU_NGAY,
  SITE_BLOG,
} from "@/lib/blogwriter/run";
import { covanSendCEO } from "@/lib/covan/telegram";
import { ghiViecMay } from "@/lib/viec-may";
import { vnDateStr } from "@/lib/payroll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const BU_MOI_LUOT = 2;
const HAN_VIET_MS = 215_000;

async function ghiNhip(o: Record<string, unknown>): Promise<void> {
  try {
    await setConfigValue("blog_bu_last", JSON.stringify({ at: new Date().toISOString(), ...o }),
      "Nhịp tim lớp bù bài blog");
  } catch {  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sb = getServiceClient();
  const secret = (process.env.CRON_SECRET || "").trim();
  const key = (url.searchParams.get("key") || "").trim();

  const tokenCfg = String((await sb.from("config").select("value").eq("key", "ads_report_token").maybeSingle()).data?.value || "").trim();
  const oke = req.headers.get("authorization") === `Bearer ${secret}`
    || (key && ((secret && key === secret) || (tokenCfg && key === tokenCfg)));
  if (!oke) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = vnDateStr();
  const so = await demBaiHomNay();
  const gio = gioVN();
  const chiTieu = chiTieuToiGio(gio);
  const thieu = Math.max(0, chiTieu - so.dang);

  if (!thieu) {

    await ghiNhip({ ok: true, co: so.dang, chiTieu, thieu: 0, note: "đủ chỉ tiêu tới giờ này" });
    return NextResponse.json({ ok: true, ngay: today, co: so.dang, chiTieu, thieu: 0 });
  }

  const n = Math.min(BU_MOI_LUOT, thieu);
  if (url.searchParams.get("dry") === "1") {
    return NextResponse.json({ ok: true, dry: true, ngay: today, gioVN: gio, co: so.dang, chiTieu, thieu, se_viet: n });
  }

  const t0 = Date.now();
  const r = await chayMotLuot(n, Date.now() + HAN_VIET_MS);

  await ghiViecMay({
    agent: "blog-bu", agentTen: "Lớp bù bài blog",
    viec: `Bù ${n} bài (mới có ${so.dang}/${chiTieu} tới giờ này)`,
    trangThai: !r.ok ? "hong" : (r.posted.length ? "xong" : "khong_co_gi"),
    soLuong: r.ok ? r.posted.length : 0, donVi: "bài",
    chiTiet: r.ok ? null : r.error, link: "/content", giay: (Date.now() - t0) / 1000,
  });

  if (!r.ok) {
    await ghiNhip({ ok: false, co: so.dang, chiTieu, thieu, loi: (r.error || "").slice(0, 300) });
    await covanSendCEO(
      `MÁY VIẾT BLOG NOVA ${today}: viết bù cũng không ra bài. Hôm nay mới có ${so.dang}/${CHI_TIEU_NGAY} bài.\n` +
      `Lý do: ${r.error || "?"}\n\n` +
      `Em đã thử lại, vẫn hỏng — chỗ này cần người xem. Chạy tay: /api/cron/blog-writer?key=<CRON_SECRET>`
    ).catch(() => undefined);
    return NextResponse.json({ ok: false, ngay: today, co: so.dang, chiTieu, thieu, error: r.error }, { status: 500 });
  }

  const lines = [
    `MÁY VIẾT BLOG NOVA ${today}: lượt khung giờ thiếu bài nên em viết bù ${r.posted.length} bài (commit ${(r.commit || "").slice(0, 7)}).`,
    `Trước khi bù: ${so.dang}/${chiTieu} bài đáng lẽ phải có tới giờ này.`,
    ...r.titles.map((t) => `- ${t.title} -> ${SITE_BLOG}${t.slug}.html [${t.cat}]`),
  ];
  if (r.skipped.length) {
    lines.push("Bài bị bỏ:");
    lines.push(...r.skipped.map((s) => `- ${s.slug}: ${s.reason}`));
  }
  await covanSendCEO(lines.join("\n")).catch(() => undefined);

  await ghiNhip({ ok: true, co: so.dang, chiTieu, thieu, viet_bu: r.posted.length, slugs: r.posted, commit: (r.commit || "").slice(0, 7) });
  return NextResponse.json({ ok: true, ngay: today, co: so.dang, chiTieu, thieu, viet_bu: r.posted.length, commit: r.commit });
}
