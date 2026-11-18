import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getAllSaleMetrics } from "@/lib/sale-metrics";
import { tuoiNguonDon } from "@/lib/doanh-thu";
import { sendTelegramMay, telegramConfigured, tgEscape } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { chanMay, khoaBaoCao, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const vnNow = () => new Date(Date.now() + 7 * 3600e3);
const fmtVnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
const trieu = (n: number) => (n / 1_000_000).toFixed(1) + "tr";

function laNgayCuoiThang(d: Date): boolean {
  const cuoi = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return d.getUTCDate() === cuoi;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const chanKhoa = await chanMay(req, [khoaCron(), khoaBaoCao({ headers: ["x-report-token"], query: ["token"] })]);
  if (chanKhoa) return chanKhoa;

  try {
    const now = vnNow();
    const force = url.searchParams.get("force") === "1";
    const cuoiThang = laNgayCuoiThang(now);
    const mung1 = now.getUTCDate() === 1;
    if (!cuoiThang && !mung1 && !force) {
      return NextResponse.json({ ok: true, skip: "khong phai moc chot luong", ngay: now.toISOString().slice(0, 10) });
    }

    const thang = mung1 && !cuoiThang
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7)
      : now.toISOString().slice(0, 7);

    const sb = getServiceClient();
    const [ds, tuoi] = await Promise.all([getAllSaleMetrics(thang), tuoiNguonDon(sb)]);
    const tong = ds.reduce((s, m) => s + (m.revenue || 0), 0);

    const L: string[] = [];
    L.push(mung1 && !cuoiThang
      ? `\u{1F4B0} <b>MÙNG 1 — CHỐT SỔ LƯƠNG THÁNG ${thang.slice(5)}/${thang.slice(0, 4)}</b>`
      : `\u{1F4B0} <b>HÔM NAY LÀ NGÀY CUỐI THÁNG — CHỐT LƯƠNG THÁNG ${thang.slice(5)}/${thang.slice(0, 4)}</b>`);
    L.push("");

    if (tuoi.muSo) {
      L.push(`\u{26A0} <b>MÙ SỐ — ĐỪNG CHỐT LƯƠNG LÚC NÀY.</b> Sổ đơn Telegram cũ: ${tuoi.teleToi || "trống"}.`);
      L.push("Đối soát vận đơn J&T + nhóm Đơn Hàng trước đã.");
    } else {
      L.push(`Sổ đơn Telegram tươi tới ${tuoi.teleToi}.`);
    }
    L.push("");

    L.push(`<b>Doanh số ${thang} (sổ đơn Telegram + J&T)</b> — tổng ${tgEscape(trieu(tong))}:`);
    for (const m of ds.filter((x) => (x.revenue || 0) > 0).sort((a, b) => b.revenue - a.revenue)) {
      L.push(`  ${tgEscape(m.name)}: ${tgEscape(fmtVnd(m.revenue))} · ${m.orders} đơn`);
    }
    if (!ds.some((x) => (x.revenue || 0) > 0)) L.push("  (chưa có doanh số nào được ghi nhận)");
    L.push("");

    L.push("<b>Việc cần làm:</b>");
    if (mung1 && !cuoiThang) {
      L.push("1. Đối soát ba nguồn: nhóm Đơn Hàng · vận đơn J&T (hoàn/huỷ) · sao kê COD về tài khoản.");
      L.push("2. Trừ theo đúng thứ tự: giá niêm yết − chiết khấu = khách trả − hoàn/huỷ − chưa xác minh = tiền được tính − VAT 8% − giá vốn quà − ship.");
      L.push("3. Đơn CHƯA xác minh thì chuyển sang tháng sau, ghi rõ cho sale biết là không mất.");
      L.push("4. Xuất bảng lương + hoa hồng gửi RIÊNG CEO duyệt (không đăng vào nhóm).");
    } else {
      L.push("1. Nhắc sale chốt nốt đơn trong ngày, đơn nào chưa lên thì gõ vào nhóm Đơn Hàng hôm nay.");
      L.push("2. Chốt ngày công + phép + phụ cấp tháng này.");
      L.push("3. Rà đơn hoàn/huỷ theo ĐƠN (không theo vận đơn — J&T huỷ rồi tạo lại vẫn là một đơn).");
      L.push("4. Đào mùng 1 em nhắc lại để đối soát và xuất bảng.");
    }
    L.push("");
    L.push(`\u{1F449} <a href="${appLink("/bang-luong")}">Mở bảng lương</a>`);

    const text = L.join("\n");
    if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "telegram chua cau hinh" }, { status: 500 });
    const sent = await sendTelegramMay("chot-luong", text);
    return NextResponse.json({ ok: true, moc: mung1 && !cuoiThang ? "mung-1" : "cuoi-thang", thang, sale: ds.length, sent: (sent as any).ok !== false });
  } catch (e: any) {

    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
