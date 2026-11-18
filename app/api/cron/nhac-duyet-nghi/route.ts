import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendTelegramMay, tgEscape } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { layPhieuNghiTreo, demSuaCongTreo, tomTatPhieuTreo } from "@/lib/phieu-nghi-treo";
import { dongBoViec, tomTat } from "@/lib/viec-tu-may";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  const sb = getServiceClient();
  const { phieu, loi } = await layPhieuNghiTreo(sb);

  if (loi) {
    const t = await sendTelegramMay("nhan-su", `<b>NHẮC DUYỆT PHIẾU NGHỈ — HỎNG</b>\n${tgEscape(loi)}\nKhông kiểm được phiếu treo hôm nay.`);
    return NextResponse.json({ ok: false, loi, telegram: t.ok ? "đã báo hỏng" : t }, { status: 200 });
  }

  const suaCong = await demSuaCongTreo(sb);

  const soViec = tomTat(await dongBoViec(sb, {
    the: "duyet-phieu-nghi",
    ngayLeoThang: 3,
    lyDoDong: "Phiếu đã được duyệt hoặc từ chối.",
    cans: phieu.map((p) => ({
      khoa: p.id,
      tieuDe: `[Duyệt phiếu nghỉ] ${p.ten} — ${p.tenLoai} ${p.tuNgay}${p.denNgay !== p.tuNgay ? ` → ${p.denNgay}` : ""}`,
      moTa: [
        `${p.ten} xin ${p.tenLoai.toLowerCase()} ${p.soNgay} ngày (${p.tuNgay}${p.denNgay !== p.tuNgay ? ` → ${p.denNgay}` : ""}).`,
        p.lyDo ? `Lý do: ${p.lyDo}` : "",
        p.anhHuongTien
          ? `CẢNH BÁO: loại nghỉ này KHÔNG hưởng lương — chưa duyệt thì máy tính lương không trừ, chốt lương xong là sai tiền.`
          : `Phiếu này không đổi tiền lương, nhưng treo lâu thì sổ phép của nhân viên sai.`,
        `Phiếu đã treo ${p.tuoiNgay} ngày.`,
        `Duyệt tại: ${appLink("/admin/xin-nghi")}`,
      ].filter(Boolean).join("\n"),
      uuTien: p.anhHuongTien || p.tuoiNgay >= 7 ? "high" : "medium",
    })),
  }));

  if (!phieu.length && !suaCong) {
    return NextResponse.json({ ok: true, phieuTreo: 0, soViec, telegram: "không có phiếu treo — không nhắc" });
  }

  const dong: string[] = [`<b>PHIẾU CHỜ DUYỆT — ${tomTatPhieuTreo(phieu)}</b>`];
  for (const p of phieu.slice(0, 15)) {
    dong.push(`• ${tgEscape(p.ten)} — ${tgEscape(p.tenLoai)} ${p.tuNgay}${p.denNgay !== p.tuNgay ? ` → ${p.denNgay}` : ""} · ${p.soNgay} ngày`
      + (p.anhHuongTien ? " · <b>lệch tiền lương</b>" : "")
      + (p.tuoiNgay >= 3 ? ` · treo ${p.tuoiNgay} ngày` : ""));
  }
  if (phieu.length > 15) dong.push(`… và ${phieu.length - 15} phiếu nữa`);
  if (suaCong) dong.push(`\nNgoài ra còn <b>${suaCong}</b> phiếu xin sửa công chờ duyệt.`);
  dong.push(`\nChưa duyệt thì máy tính lương KHÔNG trừ những ngày này.`);
  dong.push(`<a href="${appLink("/admin/xin-nghi")}">Mở trang duyệt phiếu</a>`);

  const t = await sendTelegramMay("nhan-su", dong.join("\n"));
  return NextResponse.json({
    ok: true, phieuTreo: phieu.length, suaCongTreo: suaCong, soViec,
    telegram: t.ok ? "đã nhắc TGĐ" : t,
  });
}
