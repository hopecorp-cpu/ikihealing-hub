import { NextResponse } from "next/server";
import { vuotGioiHan } from "@/lib/chan-spam";
import { tgEscape } from "@/lib/telegram";
import { getServiceClient } from "@/lib/supabase-server";
import { insertAndAssign } from "@/lib/leads";
import { addLead as themEmailDrip, markSent, guiEmailNuoi } from "@/lib/blog-nurture";
import { resendConfigured } from "@/lib/resend";
import { docDongYTuBody, ghiDongY, ipCua } from "@/lib/du-lieu-ca-nhan";
import { docNguonTuBody, themNhan } from "@/lib/nguon-lead";

const SACH: Record<string, { ten: string; file: string; moTa: string; note: string }> = {
  "21ngay": {
    ten: "21 Ngày Ăn Lành Cùng Đạm Sạch", file: "ebook-21-ngay-an-lanh.pdf",
    moTa: "ba tuần tập lại cách ăn nhẹ bụng mà đủ chất, mỗi ngày một việc nhỏ và một thực đơn gợi ý kèm lượng đạm ước tính",
    note: "Nhận ebook 21 Ngày Ăn Lành (camp 09/2026)",
  },
  "100mon": {
    ten: "100 Bữa Ăn Đủ Đạm Không Cần Thịt", file: "ebook-100-bua-an-du-dam.pdf",
    moTa: "100 món Việt dễ nấu, mỗi món kèm lượng đạm ước tính cho từng khẩu phần",
    note: "Nhận ebook 100 Bữa Ăn Đủ Đạm (camp 20/08)",
  },
};
function sachCua(nguon: string) {
  const s = String(nguon || "").toLowerCase();
  const key = /(^|[:|])ebook:21ngay|21ngay/.test(s) ? "21ngay" : "100mon";
  return { key, ...SACH[key], link: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-images/${SACH[key].file}` };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function chuanSdt(raw: string): string | null {
  let s = String(raw || "").replace(/[^\d+]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && s.length === 11) s = "0" + s.slice(2);
  return /^0(3|5|7|8|9)\d{8}$/.test(s) ? s : null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const APP_PLAY = "https://play.google.com/store/apps/details?id=com.example.app";

const APP_IOS = "https://apps.apple.com/vn/app/nova-beauty-wellness/id0000000000";

export async function GET(req: Request) {
  const u = new URL(req.url);

  if (u.searchParams.get("app") === "1") {

    const epOs = (u.searchParams.get("os") || "").toLowerCase();
    const laIos = epOs === "ios" || (epOs !== "android" && /iPhone|iPad|iPod/i.test(req.headers.get("user-agent") || ""));

    const kenh = (u.searchParams.get("k") || "").replace(/[^\w.-]/g, "").slice(0, 24);
    const nguon = "app:" + (u.searchParams.get("s") || "khong-ro").replace(/[^\w:.-]/g, "").slice(0, 60)
      + (kenh ? ":k-" + kenh : "") + (laIos ? ":ios" : ":android");
    try {
      const sb = getServiceClient();
      const { data } = await sb.from("config").select("value").eq("key", "ebook_tai_dem").maybeSingle();
      const dem = data?.value ? JSON.parse(data.value) : {};
      dem[nguon] = (dem[nguon] || 0) + 1;
      dem._tong = (dem._tong || 0) + 1;
      await sb.from("config").upsert({ key: "ebook_tai_dem", value: JSON.stringify(dem) }, { onConflict: "key" });
    } catch {  }
    return NextResponse.redirect(laIos ? APP_IOS : APP_PLAY, 302);
  }

  if (u.searchParams.get("theo-doi") === "1") {
    const nguon = "theodoi:" + (u.searchParams.get("s") || "khong-ro").replace(/[^\w:.-]/g, "").slice(0, 60);
    try {
      const sb = getServiceClient();
      const { data } = await sb.from("config").select("value").eq("key", "ebook_tai_dem").maybeSingle();
      const dem = data?.value ? JSON.parse(data.value) : {};
      dem[nguon] = (dem[nguon] || 0) + 1;
      await sb.from("config").upsert({ key: "ebook_tai_dem", value: JSON.stringify(dem) }, { onConflict: "key" });
    } catch {  }

    if (u.searchParams.get("dem") === "1") return new NextResponse(null, { status: 204, headers: CORS });
    return NextResponse.redirect("https://www.facebook.com/example", 302);
  }
  if (u.searchParams.get("tai") !== "1") {

    const sb = getServiceClient();
    const { data } = await sb.from("config").select("value").eq("key", "ebook_tai_dem").maybeSingle();
    return NextResponse.json({ ok: true, dem: data?.value ? JSON.parse(data.value) : {} }, { headers: CORS });
  }
  const nguon = (u.searchParams.get("s") || "khong-ro").replace(/[^\w:.-]/g, "").slice(0, 60);
  try {
    const sb = getServiceClient();
    const { data } = await sb.from("config").select("value").eq("key", "ebook_tai_dem").maybeSingle();
    const dem = data?.value ? JSON.parse(data.value) : {};
    dem[nguon] = (dem[nguon] || 0) + 1;
    dem._tong = (dem._tong || 0) + 1;
    await sb.from("config").upsert({ key: "ebook_tai_dem", value: JSON.stringify(dem), description: "Đếm lượt tải ebook 100 món theo nguồn (link /api/ebook-lead?tai=1&s=...)" }, { onConflict: "key" });
  } catch {  }
  return NextResponse.redirect(sachCua(u.searchParams.get("s") || "").link, 302);
}

export async function POST(req: Request) {
  let ten = "", sdt = "", email = "", source = "ebook:100mon", honey = "";

  let dongY = docDongYTuBody(null);
  let tho: any = null;
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const b = await req.json();
      ten = String(b.ten || b.name || "").trim();
      sdt = String(b.sdt || b.phone || "");
      email = String(b.email || "").trim().toLowerCase();
      source = String(b.source || "ebook:100mon").slice(0, 120);
      honey = String(b._honey || "");
      dongY = docDongYTuBody(b);
      tho = b;
    } else {
      const f = await req.formData();
      ten = String(f.get("ten") || "").trim();
      sdt = String(f.get("sdt") || "");
      email = String(f.get("email") || "").trim().toLowerCase();
      source = String(f.get("source") || "ebook:100mon").slice(0, 120);
      honey = String(f.get("_honey") || "");
      tho = { nguon: String(f.get("nguon") || "") };
    }
  } catch {
    return NextResponse.json({ ok: false, error: "body không đọc được" }, { status: 400, headers: CORS });
  }

  if (honey) return NextResponse.json({ ok: true, link: sachCua(source).link }, { headers: CORS });
  if (await vuotGioiHan(req, "ebook-lead", { moiIpMoiGio: 10, tongMoiNgay: 500 })) return NextResponse.json({ ok: false, error: "Bạn gửi nhiều quá, đợi một lát rồi thử lại giúp NOVA nhé." }, { status: 429, headers: CORS });

  source = themNhan(source, docNguonTuBody(tho));

  if ((!ten || ten.length < 2) && source.startsWith("exit:")) ten = "Khách blog";
  if (!ten || ten.length < 2) {
    return NextResponse.json({ ok: false, error: "Cho NOVA xin tên của bạn nhé." }, { status: 400, headers: CORS });
  }
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : "";
  if (!emailOk) {
    return NextResponse.json({ ok: false, error: "Cho NOVA xin email của bạn để gửi kèm bản PDF vào hộp thư nhé." }, { status: 400, headers: CORS });
  }
  const sdtChuan = sdt.trim() ? chuanSdt(sdt) : null;
  if (sdt.trim() && !sdtChuan) {
    return NextResponse.json({ ok: false, error: "Số điện thoại chưa đúng — nhập số di động Việt Nam 10 chữ số (hoặc để trống)." }, { status: 400, headers: CORS });
  }

  const sb = getServiceClient();

  if (dongY.co) {
    try {
      await ghiDongY(sb, { email: emailOk, phone: sdtChuan, ten, kenh: source.startsWith("exit:") ? "web-blog" : "web-ebook", nguon: source, mucDich: dongY.mucDich, vanBan: dongY.vanBan, phienBan: dongY.phienBan, ip: ipCua(req), ua: req.headers.get("user-agent") });
    } catch (e) { console.error("[ebook-lead] ghi đồng ý hỏng:", e); }
  }

  const nhanDongY = dongY.co && dongY.tinTuVan ? "" : " · [CHƯA đồng ý nhận tin tư vấn/QC — chỉ gửi ebook + thực đơn đã hứa, KHÔNG chào hàng]";

  const kq = sdtChuan
    ? await insertAndAssign(sb, {
      customer_name: ten.slice(0, 80),
      phone: sdtChuan,
      channel: "ebook",
      source,
      external_id: `ebook:${sdtChuan}`,
      note: `${sachCua(source).note}. Nguồn: ${source} · Email: ${emailOk}${nhanDongY}`,
    })
    : { ok: true as const, dedup: false };

  if (emailOk) {
    try {
      const { lead: emailLead, isNew } = await themEmailDrip(emailOk, source, dongY.co && dongY.tinTuVan, sdtChuan || undefined);
      if (isNew && resendConfigured() && !emailLead.sent.includes(0)) {
        const linkEmail = `https://ikihealing-hub.example.com/api/ebook-lead?tai=1&s=${encodeURIComponent("email:" + source)}`;
        const sach = sachCua(source);

        const g = await guiEmailNuoi(
          emailLead.email,
          `Ebook ${sach.ten} — quà của bạn từ NOVA`,
          `<div style="font-family:Arial,Helvetica,sans-serif;color:#23301f;max-width:560px;margin:0 auto">
            <h2 style="color:#1F4D1F">Chào ${tgEscape(ten.slice(0, 60))},</h2>
            <p>NOVA gửi bạn trọn bộ <b>${sach.ten}</b> — ${sach.moTa}.</p>
            <p style="margin:24px 0"><a href="${linkEmail}" style="background:#1F4D1F;color:#fff;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:bold">Tải ebook (PDF)</a></p>
            <p>Bước tiếp theo: làm bài <a href="https://example.com/quiz/?nhom=an-chay&s=ebook100-email&utm_source=email&utm_medium=email&utm_campaign=ebook-100mon" style="color:#2E6B2D">đo thể trạng 2 phút</a> để nhận thêm thực đơn 3 ngày soạn riêng theo thể trạng của bạn, miễn phí.</p>
            <p style="color:#8a967f;font-size:12px;margin-top:28px">Nội dung chia sẻ kiến thức ẩm thực và dinh dưỡng, không thay thế tư vấn y khoa.<br>NOVA by ACME Corp · example.com · Tư vấn: 0900000001<br>Không muốn nhận email từ NOVA nữa? <a href="{{LINK_HUY}}" style="color:#8a967f">Bấm vào đây để ngừng nhận</a>.</p>
          </div>`,
          { quangCao: false }
        );
        if (g.ok) await markSent(emailLead.email, 0);
      }
    } catch (e) { console.error("[ebook-lead] drip email hỏng:", e); }
  }
  if (!kq.ok) {

    console.error("[ebook-lead] insertAndAssign hỏng:", kq.error);
  }

  const linkTai = `https://ikihealing-hub.example.com/api/ebook-lead?tai=1&s=${encodeURIComponent(source)}`;
  return NextResponse.json({ ok: true, link: linkTai, dedup: (kq as any).dedup === true }, { headers: CORS });
}
