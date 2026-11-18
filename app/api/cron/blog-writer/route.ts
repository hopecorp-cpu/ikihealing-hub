import { NextResponse } from "next/server";
import { setConfigValue } from "@/lib/app-config";
import { chayMotLuot, SITE_BLOG } from "@/lib/blogwriter/run";
import { soBaiTrongNgay } from "@/lib/blogwriter/github";
import { covanSendCEO } from "@/lib/covan/telegram";
import { ghiViecMay } from "@/lib/viec-may";
import { vnDateStr } from "@/lib/payroll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const maxDuration = 800;

const POSTS_PER_RUN = 1;

const HAN_VIET_MS = 700_000;

function authorized(req: Request): boolean {
  const url = new URL(req.url);
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret) {
    if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
    if (url.searchParams.get("key") === secret) return true;
  }
  const blogSecret = (process.env.BLOG_WRITER_SECRET || "").trim();
  if (blogSecret && req.headers.get("x-blog-secret") === blogSecret) return true;
  return false;
}

async function ghiNhip(o: Record<string, unknown>): Promise<void> {
  try {
    await setConfigValue("blog_writer_last", JSON.stringify({ at: new Date().toISOString(), ...o }),
      "Nhịp tim máy viết blog NOVA");
  } catch {  }
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = vnDateStr();
  const t0 = Date.now();

  try {
    const daCo = await soBaiTrongNgay(today);
    if (daCo >= POSTS_PER_RUN) {
      await ghiNhip({ ok: true, dang: 0, bo: 0, ghiChu: `đã đủ ${daCo}/${POSTS_PER_RUN} bài hôm nay (máy Mac viết) — lưới đỡ không cần bung` });
      await ghiViecMay({
        agent: "blog-writer", agentTen: "Máy viết blog NOVA",
        viec: "Lưới đỡ blog: kiểm bài trong ngày",
        trangThai: "khong_co_gi", soLuong: 0, donVi: "bài",
        chiTiet: `Hôm nay đã có ${daCo} bài trên main, không viết thêm`,
        link: "/content", giay: (Date.now() - t0) / 1000,
      });
      return NextResponse.json({ ok: true, posted: [], skipped: [], daCo, ghiChu: "đã đủ bài hôm nay" });
    }
  } catch (e) {
    console.warn("[blog-writer] đếm bài trong ngày hỏng, vẫn viết tiếp:", e);
  }

  const r = await chayMotLuot(POSTS_PER_RUN, Date.now() + HAN_VIET_MS);

  await ghiViecMay({
    agent: "blog-writer", agentTen: "Máy viết blog NOVA",
    viec: `Viết ${POSTS_PER_RUN} bài dài cho example.com/blog`,
    trangThai: !r.ok ? "hong" : (r.posted.length ? "xong" : "khong_co_gi"),
    soLuong: r.posted.length, donVi: "bài",
    chiTiet: r.ok ? (r.skipped.length ? `Bỏ ${r.skipped.length} bài: ${r.skipped.map(s => s.reason).join("; ").slice(0, 300)}` : null) : r.error,
    link: "/content", giay: (Date.now() - t0) / 1000,
  });

  if (!r.ok) {

    await ghiNhip({ ok: false, dang: 0, bo: r.skipped.length, loi: (r.error || "").slice(0, 300), chiTiet: r.skipped.slice(0, 3) });
    return NextResponse.json({ ok: false, posted: r.posted, skipped: r.skipped, error: r.error }, { status: 500 });
  }

  const lines = [
    `MÁY VIẾT BLOG NOVA ${today}: đã đăng ${r.posted.length} bài (commit ${(r.commit || "").slice(0, 7)}).`,
    ...r.titles.map((t) => `- ${t.title} -> ${SITE_BLOG}${t.slug}.html [${t.cat}]`),
  ];
  if (r.skipped.length) {
    lines.push("Bài bị bỏ:");
    lines.push(...r.skipped.map((s) => `- ${s.slug}: ${s.reason}`));
  }
  await covanSendCEO(lines.join("\n")).catch(() => undefined);

  await ghiNhip({ ok: true, dang: r.posted.length, bo: r.skipped.length, commit: (r.commit || "").slice(0, 7), slugs: r.posted });
  return NextResponse.json({ ok: true, posted: r.posted, skipped: r.skipped, commit: r.commit });
}
