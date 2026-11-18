import { NextResponse } from "next/server";
import { vuotGioiHan } from "@/lib/chan-spam";
import { saveQuizSubmission, dayQuizSangSale } from "@/lib/quiz-leads";
import { addLead, markSent, DRIP, blogNurtureBat, mauDaDuyet } from "@/lib/blog-nurture";
import { resendConfigured } from "@/lib/resend";
import { docNguonTuBody, themNhan } from "@/lib/nguon-lead";

export const dynamic = "force-dynamic";

function cors() {
  return {
    "Access-Control-Allow-Origin": "https://example.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: cors() }); }

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch {  }

  if (String(b._honey || "").trim()) {
    return NextResponse.json({ ok: true, skipped: "honeypot" }, { headers: cors() });
  }

  const email = String(b.email || "").trim();
  const phone = String(b.phone || "").trim() || undefined;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Email không hợp lệ" }, { status: 400, headers: cors() });
  }
  if (await vuotGioiHan(req, "quiz-submit", { moiIpMoiGio: 15, tongMoiNgay: 1000 })) return NextResponse.json({ ok: false, error: "Bạn gửi nhiều quá, đợi một lát rồi thử lại giúp NOVA nhé." }, { status: 429, headers: cors() });

  const name = String(b.name || "").trim() || email.split("@")[0];
  const source = themNhan(String(b.source || `quiz:${b.profile || "unknown"}`), docNguonTuBody(b));

  let saved: any = null;
  try {
    saved = await saveQuizSubmission({
      name, email, phone,
      profile: String(b.profile || ""),
      profileName: b.profileName || undefined,
      overall: Number(b.overall) || 0,
      dims: (b.dims && typeof b.dims === "object") ? b.dims : {},
      answers: Array.isArray(b.answers) ? b.answers : [],
      pkg: b.pkg || null,
      vat: b.vat || null,
      source,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Không lưu được hồ sơ" }, { status: 500, headers: cors() });
  }

  const { docDongYTuBody, ghiDongY, ipCua } = await import("@/lib/du-lieu-ca-nhan");
  const dongY = docDongYTuBody(b, ["giao-dich", "du-lieu-suc-khoe"]);
  if (dongY.co) {
    try {
      const { getServiceClient } = await import("@/lib/supabase-server");
      await ghiDongY(getServiceClient(), { email, phone, ten: name, kenh: "web-quiz", nguon: source, mucDich: dongY.mucDich, vanBan: dongY.vanBan, phienBan: dongY.phienBan, ip: ipCua(req), ua: req.headers.get("user-agent") });
    } catch {  }
  }

  let saleLead: any = null;
  try {
    const { getServiceClient } = await import("@/lib/supabase-server");
    saleLead = await dayQuizSangSale(getServiceClient(), { ...saved, source }, { tinTuVan: dongY.co && dongY.tinTuVan });
  } catch {  }

  let isNew = false, resend = false, welcomeOk = false;
  try {
    const { guiEmailNuoi } = await import("@/lib/blog-nurture");
    const r = await addLead(email, source, dongY.co && dongY.tinTuVan, phone);
    isNew = r.isNew;
    resend = resendConfigured();
    if (isNew && resend && !r.lead.sent.includes(0) && (await blogNurtureBat())) {
      const d0 = DRIP.find((d) => d.day === 0);
      if (d0 && mauDaDuyet(d0)) {
        const w = await guiEmailNuoi(r.lead.email, d0.subject, d0.html(r.lead.id), { quangCao: false, nhip: { luong: "blog-nurture", mau: "ngay-0", neuSanPham: false } });
        if (w.ok) { await markSent(r.lead.email, 0); welcomeOk = true; }
      }
    }
  } catch {  }

  let progress: any = null;
  try {
    const { compareWithFirst } = await import("@/lib/quiz-recheck");
    const cmp = await compareWithFirst(email, Number(b.overall) || 0);

    if (cmp) {
      progress = { first: cmp.first, now: Number(b.overall) || 0, delta: cmp.delta, days: cmp.days, times: cmp.times };
      const { sendTelegram, telegramConfigured, tgEscape } = await import("@/lib/telegram");
      if (telegramConfigured()) {
        const dir = cmp.delta > 0 ? "TIẾN BỘ" : cmp.delta < 0 ? "ĐI LÙI" : "ĐI NGANG";
        await sendTelegram(
          `\u{1F501} KHÁCH ĐO LẠI NẾP SỐNG — ${dir}\n${tgEscape(name || "")}${phone ? ` · ${tgEscape(phone)}` : ""}\n` +
          `Lần đầu ${cmp.first}/100 → hôm nay ${progress.now}/100 (${cmp.delta >= 0 ? "+" : ""}${cmp.delta} điểm sau ${cmp.days} ngày)\n` +
          `→ Gọi chúc mừng và bàn chặng tiếp theo cho khách.`
        ).catch(() => { });
      }
    }
  } catch {  }

  return NextResponse.json({ ok: true, id: saved?.id, isNew, resend, welcome: welcomeOk, sale: saleLead ? { ok: saleLead.ok, dedup: !!saleLead.dedup } : null }, { headers: cors() });
}
