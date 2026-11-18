import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { chayLuongThang, docNgayNghiLe, quyetDinhChayLuong, vnHomNay } from "@/lib/luong-thang";
import { sendTelegram, sendTelegramDocumentMay, telegramConfigured } from "@/lib/telegram";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { chanMay, khoaBaoCao, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron(), khoaBaoCao({ headers: ["x-report-token"], query: ["token"] })]);
  if (chanKhoa) return chanKhoa;

  const sb = getServiceClient();
  const force = url.searchParams.get("force") === "1";
  const dry = url.searchParams.get("dry") === "1";
  const homNay = vnHomNay();

  try {
    const ngayNghi = await docNgayNghiLe(sb);
    const qd = quyetDinhChayLuong(homNay, ngayNghi);
    const thang = url.searchParams.get("thang") || qd.thang;
    if (!qd.chay && !force) {
      await setConfigValue("luong_thang_last", JSON.stringify({ at: new Date().toISOString(), ok: true, thang, trangThai: "bo-qua", lyDo: qd.lyDo }), "Nhịp tim máy tính lương tháng");
      return NextResponse.json({ ok: true, skip: qd.lyDo, homNay, thang });
    }

    const kq = await chayLuongThang(sb, { thang, ghi: !dry, lyDo: force ? "chạy tay" : qd.lyDo });

    let sent = 0;
    if (!dry) {
      if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "telegram chua cau hinh", kq: { ...kq, xemTruoc: undefined } }, { status: 500 });
      for (const tin of kq.baoCao) { const r: any = await sendTelegram(tin); if (r?.ok) sent++; }
      await setConfigValue("luong_thang_last", JSON.stringify({ at: new Date().toISOString(), ok: true, thang, trangThai: kq.trangThai, lyDo: kq.lyDo, sent }), "Nhịp tim máy tính lương tháng");
    }

    let keToan: any = { bo: "không gửi" };
    if (!dry && url.searchParams.get("keToan") !== "0") {
      keToan = await guiKeToan(sb, thang, url.searchParams.get("keToanLai") === "1");

      if (keToan.loi) await sendTelegram(`LƯƠNG ${thang}: KHÔNG gửi được file cho kế toán — ${keToan.loi}\nTự gửi lại: mở /api/cron/luong-thang?token=...&thang=${thang}&force=1&keToanLai=1`);
    }

    return NextResponse.json({
      ok: true, homNay, thang, trangThai: kq.trangThai, lyDo: kq.lyDo, soDong: kq.soDong,
      tongThucLinh: kq.tongThucLinh, tongChiPhi: kq.tongChiPhi, tongHoaHong: kq.tongHoaHong,
      viecCanCeo: kq.viecCanCeo, sent, keToan, ...(dry ? { baoCao: kq.markdown } : {}),
    });
  } catch (e: any) {

    try { await setConfigValue("luong_thang_last", JSON.stringify({ at: new Date().toISOString(), ok: false, error: String(e?.message || e) }), "Nhịp tim máy tính lương tháng"); } catch {  }
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

async function guiKeToan(sb: any, thang: string, guiLai: boolean) {
  const khoa = `luong_ke_toan_${thang}`;
  try {
    if (!guiLai) {
      const cu = await getConfigValue(khoa).catch(() => "");
      if (cu) { try { if (JSON.parse(cu)?.ok) return { bo: "đã gửi rồi", cu: JSON.parse(cu) }; } catch {  } }
    }
    const { dungBangLuongKeToan } = await import("@/lib/bang-luong-xuat");
    const b = await dungBangLuongKeToan(sb, thang);
    const caption = [
      `LƯƠNG + HOA HỒNG THÁNG ${thang} — nhờ kế toán kiểm trước khi CEO duyệt`,
      `${b.soNguoi} người · thực lĩnh ${new Intl.NumberFormat("vi-VN").format(b.tongThucLinh)}đ · chi phí doanh nghiệp ${new Intl.NumberFormat("vi-VN").format(b.tongChiPhi)}đ · hoa hồng và thưởng ${new Intl.NumberFormat("vi-VN").format(b.tongHoaHong)}đ`,
      b.canhBao.length ? `CẦN KIỂM ${b.canhBao.length} điểm — xem sheet "Ghi chu" trong file Excel.` : "Ba phép đối chiếu của máy đều khớp.",
      `File .xlsx: các ô tổng là công thức thật, sửa một ô là thấy tổng đổi theo. Bốn việc cần kiểm ghi trong sheet "Ghi chu".`,
      `Tài liệu nội bộ (lương cả công ty) — xin đừng chuyển ra ngoài nhóm này.`,
    ].join("\n");

    const r1: any = await sendTelegramDocumentMay("chot-luong", { ten: b.tenXlsx, noiDung: b.xlsx, kieu: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, { caption });
    const r2: any = await sendTelegramDocumentMay("chot-luong", { ten: b.tenHtml, noiDung: b.html, kieu: "text/html" });
    const ok = !!r1?.ok;
    const loi = ok ? undefined : `Telegram: ${r1?.loi || r1?.error || r1?.status} (nhóm ${r1?.dich || "?"})`;
    const ghi = { at: new Date().toISOString(), ok, thang, dich: r1?.dich, canhBao: b.canhBao.length, htmlOk: !!r2?.ok, loi };
    await setConfigValue(khoa, JSON.stringify(ghi), "Đã gửi bản lương+hoa hồng cho nhóm kế toán tháng này");
    return ghi;
  } catch (e: any) {
    const loi = String(e?.message || e);
    try { await setConfigValue(khoa, JSON.stringify({ at: new Date().toISOString(), ok: false, thang, loi }), "Đã gửi bản lương+hoa hồng cho nhóm kế toán tháng này"); } catch {  }
    return { ok: false, loi };
  }
}
