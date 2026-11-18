import { NextResponse } from "next/server";
import { blogNurtureBat, BLOG_NURTURE_LY_DO_TAT } from "@/lib/blog-nurture";
import { chayBlogNurture } from "@/lib/blog-nurture-chay";
import { resendConfigured } from "@/lib/resend";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {

  if (!(await blogNurtureBat())) {
    return NextResponse.json({ ok: true, tat: true, ly_do: BLOG_NURTURE_LY_DO_TAT });
  }
  const u = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const kho = u.searchParams.get("kho") === "1";
  if (!kho && !resendConfigured()) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY chưa cấu hình — chưa gửi drip." });
  }
  const kq = await chayBlogNurture({ kho });
  return NextResponse.json({ ok: true, ...kq });
}
