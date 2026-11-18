import { NextResponse } from "next/server";
import { vuotGioiHan } from "@/lib/chan-spam";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { addLead, markSent, DRIP, blogNurtureBat, mauDaDuyet } from "@/lib/blog-nurture";
import { resendConfigured, sendResend } from "@/lib/resend";

export const dynamic = "force-dynamic";

const SURVEYS: Record<string, { maxQ: number }> = {
  "thuc-khuya": { maxQ: 10 },
  "chi-tieu-suc-khoe": { maxQ: 10 },
};

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
  if (await vuotGioiHan(req, "survey-submit", { moiIpMoiGio: 10, tongMoiNgay: 1000 })) return NextResponse.json({ ok: false, error: "Bạn gửi nhiều quá, đợi một lát rồi thử lại giúp NOVA nhé." }, { status: 429, headers: cors() });

  const id = String(b.survey || "").trim();
  const spec = SURVEYS[id];
  if (!spec) return NextResponse.json({ ok: false, error: "survey không hợp lệ" }, { status: 400, headers: cors() });

  const answers = b.answers && typeof b.answers === "object" ? b.answers : null;
  if (!answers || !Object.keys(answers).length) {
    return NextResponse.json({ ok: false, error: "thiếu đáp án" }, { status: 400, headers: cors() });
  }

  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers).slice(0, spec.maxQ)) {
    clean[String(k).slice(0, 40)] = String(v).slice(0, 120);
  }

  const key = `survey_responses_${id}`;
  let list: any[] = [];
  try { list = JSON.parse((await getConfigValue(key)) || "[]"); } catch { list = []; }
  list.push({ t: Date.now(), a: clean });
  if (list.length > 20000) list = list.slice(-20000);
  await setConfigValue(key, JSON.stringify(list), `Phiếu khảo sát cộng đồng: ${id}`);

  let welcome = false;
  const email = String(b.email || "").trim().toLowerCase();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

    const { docDongYTuBody, ghiDongY, ipCua } = await import("@/lib/du-lieu-ca-nhan");
    const { guiEmailNuoi } = await import("@/lib/blog-nurture");
    const dongY = docDongYTuBody(b);
    const { lead, isNew } = await addLead(email, `survey:${id}`, dongY.co && dongY.tinTuVan);
    if (dongY.co) {
      try {
        const { getServiceClient } = await import("@/lib/supabase-server");
        await ghiDongY(getServiceClient(), { email, kenh: "web-khaosat", nguon: `survey:${id}`, mucDich: dongY.mucDich, vanBan: dongY.vanBan, phienBan: dongY.phienBan, ip: ipCua(req), ua: req.headers.get("user-agent") });
      } catch {  }
    }
    if (isNew && resendConfigured() && !lead.sent.includes(0) && (await blogNurtureBat())) {
      const d0 = DRIP.find((d) => d.day === 0);
      if (d0 && mauDaDuyet(d0)) {
        const r = await guiEmailNuoi(email, d0.subject, d0.html(lead.id), { quangCao: false, nhip: { luong: "blog-nurture", mau: "ngay-0", neuSanPham: false } });
        if (r.ok) { await markSent(email, 0); welcome = true; }
      }
    }
  }

  return NextResponse.json({ ok: true, n: list.length, welcome }, { headers: cors() });
}
