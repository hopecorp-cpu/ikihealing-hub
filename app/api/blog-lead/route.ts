import { NextResponse } from "next/server";
import { vuotGioiHan } from "@/lib/chan-spam";
import { addLead, markSent, DRIP, guiEmailNuoi, blogNurtureBat, mauDaDuyet } from "@/lib/blog-nurture";
import { resendConfigured } from "@/lib/resend";
import { docDongYTuBody, ghiDongY, ipCua, PHIEN_BAN_DONG_Y } from "@/lib/du-lieu-ca-nhan";
import { docNguonTuBody, themNhan } from "@/lib/nguon-lead";

const THANKS = "https://example.com/blog/cam-on.html";

async function handle(email: string, source: string, dongY: ReturnType<typeof docDongYTuBody>, phone: string | undefined, req: Request) {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "email không hợp lệ" };
  }
  const { lead, isNew } = await addLead(email, source, dongY.co && dongY.tinTuVan, phone);
  if (dongY.co) {
    try {
      const { getServiceClient } = await import("@/lib/supabase-server");
      await ghiDongY(getServiceClient(), {
        email, phone, kenh: source.startsWith("tailieu") ? "web-tailieu" : "web-blog", nguon: source,
        mucDich: dongY.mucDich, vanBan: dongY.vanBan, phienBan: dongY.phienBan, ip: ipCua(req), ua: req.headers.get("user-agent"),
      });
    } catch {  }
  }

  let welcome: any = null;
  if (isNew && resendConfigured() && !lead.sent.includes(0) && (await blogNurtureBat())) {
    const d0 = DRIP.find((d) => d.day === 0);
    if (d0 && mauDaDuyet(d0)) {
      welcome = await guiEmailNuoi(lead.email, d0.subject, d0.html(lead.id), { quangCao: false, nhip: { luong: "blog-nurture", mau: "ngay-0", neuSanPham: false } });
      if (welcome.ok) await markSent(lead.email, 0);
    }
  }
  return { ok: true, isNew, resend: resendConfigured(), welcome, dongY: dongY.co ? dongY.mucDich : null };
}

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  let email = "", source = "blog", honey = "", phone = "";
  let dongY = docDongYTuBody(null);
  try {
    if (ct.includes("application/json")) {
      const b = await req.json();
      email = b.email || ""; source = b.source || "blog"; honey = b._honey || ""; phone = b.phone || "";
      dongY = docDongYTuBody(b);
      source = themNhan(source, docNguonTuBody(b));
    } else {
      const f = await req.formData();
      email = String(f.get("email") || ""); source = String(f.get("source") || "blog"); honey = String(f.get("_honey") || ""); phone = String(f.get("phone") || "");
      source = themNhan(source, docNguonTuBody({ nguon: String(f.get("nguon") || "") }));

      const vanBan = String(f.get("dongY_vanBan") || "");
      if (vanBan) dongY = docDongYTuBody({ dongY: { tinTuVan: f.get("consent") != null, vanBan, phienBan: String(f.get("dongY_phienBan") || PHIEN_BAN_DONG_Y) } });
    }
  } catch {  }

  if (honey.trim()) {
    return ct.includes("application/json")
      ? NextResponse.json({ ok: true, skipped: "honeypot" }, { headers: cors() })
      : NextResponse.redirect(THANKS, 303);
  }
  if (await vuotGioiHan(req, "blog-lead", { moiIpMoiGio: 10, tongMoiNgay: 500 })) return NextResponse.json({ ok: false, error: "Bạn gửi nhiều quá, đợi một lát rồi thử lại giúp NOVA nhé." }, { status: 429, headers: cors() });

  const res = await handle(email, source, dongY, phone || undefined, req);

  if (ct.includes("application/json")) {
    return NextResponse.json(res, { status: res.ok ? 200 : 400, headers: cors() });
  }
  return NextResponse.redirect(res.ok ? THANKS : "https://example.com/blog/?loi=email", 303);
}

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: cors() }); }
function cors() {
  return {
    "Access-Control-Allow-Origin": "https://example.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
