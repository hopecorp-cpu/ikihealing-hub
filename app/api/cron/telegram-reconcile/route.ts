import { NextResponse } from "next/server";
import { soiNguocJT } from "@/lib/doanh-thu";
import { vnDateStr } from "@/lib/payroll";
import { getServiceClient } from "@/lib/supabase-server";
import { sendTelegramMay, telegramConfigured, tgEscape } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MIN_ORDERS = 5;
const DEFAULT_MIN_AMOUNT = 10_000_000;

async function notify(text: string) {

  if (telegramConfigured()) return sendTelegramMay("doi-soat-cod", text);
  return { ok: false, error: "no telegram" };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  const homNay = vnDateStr();
  const month = url.searchParams.get("m") || homNay.slice(0, 7);
  const force = url.searchParams.get("force") === "1";
  const tu = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const cuoiThang = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const anHan = vnDateStr(new Date(Date.now() - 3 * 864e5));
  const den = cuoiThang < anHan ? cuoiThang : anHan;

  const sb = getServiceClient();
  try {
    if (den < tu) return NextResponse.json({ ok: true, alerted: false, ghiChu: "đầu tháng, chưa qua ân hạn 3 ngày" });
    const r = await soiNguocJT(sb, tu, den);

    let minOrders = DEFAULT_MIN_ORDERS, minAmount = DEFAULT_MIN_AMOUNT;
    try {
      const { data } = await sb.from("config").select("value").eq("key", "jt_misa_alert").maybeSingle();
      if (data?.value) {
        const c = JSON.parse(data.value);
        if (Number(c.minOrders) > 0) minOrders = Number(c.minOrders);
        if (Number(c.minAmount) > 0) minAmount = Number(c.minAmount);
      }
    } catch {  }

    const shouldAlert = force || r.vanDonKhongCoDon >= minOrders || r.tienVanDonLac >= minAmount;

    await sb.from("config").upsert({
      key: "jt_tele_doi_chieu",
      value: JSON.stringify({
        at: new Date().toISOString(), month, tu, den,
        donTrongSo: r.donTrongSo, vanDon: r.vanDon, thieuVanDon: r.thieuVanDon,
        vanDonKhongCoDon: r.vanDonKhongCoDon, tienVanDonLac: r.tienVanDonLac, alerted: shouldAlert,
      }),
    }, { onConflict: "key" });

    if (!shouldAlert) {
      return NextResponse.json({ ok: true, alerted: false, vanDonKhongCoDon: r.vanDonKhongCoDon, tienVanDonLac: r.tienVanDonLac });
    }

    const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";
    const che = (sdt: string) => (sdt ? "*******" + sdt.slice(-3) : "-");
    const L: string[] = [];
    L.push(`<b>HÀNG ĐÃ GỬI NHƯNG CHƯA VÀO SỔ ĐƠN</b> · ${tu} → ${den}`);
    L.push("");
    L.push(`Sổ đơn Telegram: <b>${r.donTrongSo}</b> đơn · J&amp;T: <b>${r.vanDon}</b> vận đơn`);
    L.push(`Vận đơn J&amp;T không có đơn trong sổ: <b>${r.vanDonKhongCoDon}</b> · COD <b>${vnd(r.tienVanDonLac)}</b>`);
    if (r.thieuVanDon) L.push(`Chiều ngược lại: ${r.thieuVanDon} đơn trong sổ chưa thấy vận đơn (đơn chuyển khoản/tự giao cũng nằm ở đây).`);
    if (r.chiTietLac.length) {
      L.push("");
      L.push("Vận đơn lớn nhất cần khai:");
      for (const w of [...r.chiTietLac].sort((a, b) => b.cod - a.cod).slice(0, 5))
        L.push(`  ${w.ngay} · ${tgEscape(w.waybill)} · ${che(w.sdt)} · ${vnd(w.cod)}`);
    }
    L.push("");
    L.push("Việc cần làm: sale kiểm từng vận đơn, đơn thật thì gõ bổ sung vào nhóm Đơn Hàng để doanh thu và hoa hồng về đúng.");
    const text = `${L.join("\n")}\n\n<a href="${appLink("/gan-don")}">Mở trang gán đơn</a>`;

    if (url.searchParams.get("dry") === "1") return NextResponse.json({ ok: true, dry: true, text });
    const sent = await notify(text);
    return NextResponse.json({ ok: true, alerted: true, vanDonKhongCoDon: r.vanDonKhongCoDon, tienVanDonLac: r.tienVanDonLac, sent: (sent as any).ok !== false });
  } catch (e: any) {
    await notify(`<b>Đối chiếu J&amp;T ↔ sổ đơn Telegram lỗi</b> — ${tgEscape(e?.message || String(e))}`);

    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
