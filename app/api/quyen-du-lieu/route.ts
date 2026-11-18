import { NextResponse } from "next/server";
import { vuotGioiHan } from "@/lib/chan-spam";
import { getServiceClient } from "@/lib/supabase-server";
import { chuanEmail, chuanSdt, ghiTuChoi, ghiYeuCau, HAN_XU_LY_NGAY, type LoaiYeuCau } from "@/lib/du-lieu-ca-nhan";

export const dynamic = "force-dynamic";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const LOAI: LoaiYeuCau[] = ["xem", "sua", "xoa", "rut-dong-y", "han-che", "khac"];
const TEN_LOAI: Record<LoaiYeuCau, string> = { xem: "xem dữ liệu", sua: "sửa dữ liệu", xoa: "xoá dữ liệu", "rut-dong-y": "rút lại đồng ý / ngừng nhận tin", "han-che": "hạn chế xử lý", khac: "khác" };

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: "body" }, { status: 400, headers: CORS }); }
  if (String(b._honey || "").trim()) return NextResponse.json({ ok: true }, { headers: CORS });
  const loai = (LOAI.includes(b.loai) ? b.loai : "khac") as LoaiYeuCau;
  const email = chuanEmail(b.email), sdt = chuanSdt(b.sdt || b.phone);
  if (!email && !sdt) return NextResponse.json({ ok: false, error: "Cần email hoặc số điện thoại để NOVA tìm đúng dữ liệu của bạn." }, { status: 400, headers: CORS });
  if (await vuotGioiHan(req, "quyen-du-lieu", { moiIpMoiGio: 5, tongMoiNgay: 50 })) return NextResponse.json({ ok: false, error: "Bạn gửi nhiều quá, đợi một lát rồi thử lại giúp NOVA nhé." }, { status: 429, headers: CORS });
  const ten = String(b.ten || "").trim().slice(0, 120);
  const noiDung = String(b.noiDung || "").trim().slice(0, 2000);

  const sb = getServiceClient();
  const yc = await ghiYeuCau(sb, { loai, email, phone: sdt, ten, noiDung, kenh: "web", meta: { ua: req.headers.get("user-agent") } });

  if (loai === "rut-dong-y" || loai === "xoa" || loai === "han-che") {
    try {
      await ghiTuChoi(sb, { email, phone: sdt, kenh: "web", lyDo: "khach-yeu-cau", nguon: `quyen-du-lieu:${loai}`, daXacNhan: !!email });
      if (email) { const { danhDauTuChoi } = await import("@/lib/blog-nurture"); await danhDauTuChoi(email, "web", `quyen-du-lieu:${loai}`); }
    } catch (e) { console.error("[quyen-du-lieu] ghi từ chối hỏng:", e); }
  }

  const han = HAN_XU_LY_NGAY[loai];
  if (email) {
    try {
      const { sendResend, resendConfigured } = await import("@/lib/resend");
      if (resendConfigured()) await sendResend(email, `NOVA đã nhận yêu cầu ${TEN_LOAI[loai]} của bạn`,
        `<div style="font-family:Arial,sans-serif;color:#1F2937;max-width:560px;margin:0 auto"><h2 style="color:#1F4D1F">Đã nhận yêu cầu của bạn</h2>
        <p>NOVA (Công ty CP TMDV ACME) xác nhận đã nhận yêu cầu <b>${TEN_LOAI[loai]}</b> lúc ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (mã ${String(yc.id || "").slice(0, 8)}).</p>
        <p>Theo Luật Bảo vệ dữ liệu cá nhân, NOVA sẽ hoàn tất trong tối đa <b>${han} ngày</b>${loai === "rut-dong-y" || loai === "xoa" || loai === "han-che" ? " — riêng việc <b>ngừng gửi tin quảng cáo đã có hiệu lực ngay</b>" : ""}. Cần bổ sung gì, NOVA sẽ email lại đúng địa chỉ này.</p>
        <p style="color:#8a967f;font-size:12px;margin-top:28px">Bộ phận bảo vệ dữ liệu cá nhân · contact@example.com · Số 1 Đường Mẫu, Phường Mẫu, Thành phố Mẫu</p></div>`);
    } catch {  }
  }

  try {
    const { sendTelegram, telegramConfigured, tgEscape } = await import("@/lib/telegram");
    if (telegramConfigured()) await sendTelegram(`YEU CAU DU LIEU CA NHAN (${TEN_LOAI[loai]})\n${tgEscape(ten || "?")} · ${tgEscape(email || "")} ${sdt || ""}\n${noiDung ? tgEscape(noiDung.slice(0, 300)) + "\n" : ""}Han xu ly: ${han} ngay (den ${yc.hanXuLy.slice(0, 10)}). Xem /admin/du-lieu-ca-nhan hoac bang yeu_cau_du_lieu.`);
  } catch {  }
  try {
    await sb.from("tasks").insert({
      title: `[Dữ liệu cá nhân] ${TEN_LOAI[loai]} — ${email || sdt}`,
      description: `Yêu cầu từ example.com/quyen-du-lieu lúc ${new Date().toISOString()}. Hạn xác nhận 2 ngày làm việc (đã tự gửi email xác nhận${email ? "" : " — KHÔNG có email, phải gọi/nhắn xác nhận tay"}), hạn xử lý ${han} ngày (${yc.hanXuLy.slice(0, 10)}). Nội dung: ${noiDung || "(trống)"}. Mã sổ: ${yc.id}. Quy trình: docs/tuan-thu-nd-330-2026-du-lieu-ca-nhan.md mục 6.`,
      status: "todo", priority: "high", due_date: yc.hanXuLy.slice(0, 10), tags: ["du-lieu-ca-nhan", `yc:${loai}`],
    });
  } catch {  }

  return NextResponse.json({ ok: true, id: yc.id, hanNgay: han }, { headers: CORS });
}
