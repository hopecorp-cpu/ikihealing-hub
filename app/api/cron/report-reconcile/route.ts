import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { sendTelegramMay, tgEscape } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { vnDateStr } from "@/lib/payroll";
import { computeReportReconcile, type MetricRow, type ReconcileResult } from "@/lib/report-reconcile";
import { dongBoViec, tomTat } from "@/lib/viec-tu-may";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

const money = (n: number) => Math.round(n || 0).toLocaleString("vi-VN") + "đ";

function fmtVal(m: MetricRow, v: number) {
  return m.money ? money(v) : String(v);
}

function metricLine(m: MetricRow) {
  const sign = m.diff > 0 ? "+" : "";
  const soft = m.hard ? "" : " <i>(tham khảo — tự log)</i>";
  return `      • ${tgEscape(m.label)}: khai <b>${fmtVal(m, m.reported)}</b> vs đo <b>${fmtVal(m, m.measured)}</b> (lệch ${sign}${fmtVal(m, m.diff)})${soft}`;
}

function digest(r: ReconcileResult) {
  const parts: string[] = [
    `📋 <b>ĐỐI CHIẾU BÁO CÁO ↔ SỐ ĐO — ${r.date.slice(8)}/${r.date.slice(5, 7)}</b>`,
    `Lệch cần xem: <b>${r.flagged.length}</b> người${r.notReported.length ? ` · chưa nộp báo cáo: <b>${r.notReported.length}</b>` : ""}`,
  ];
  for (const e of r.flagged) {
    parts.push(`\n<b>${tgEscape(e.name)}</b> <i>(${e.kind === "sale" ? "Sale" : "MKT"})</i>\n` + e.lines.map(metricLine).join("\n"));
  }
  if (r.notReported.length) {
    parts.push(`\n<b>Chưa nộp báo cáo cuối ngày:</b>\n      ${r.notReported.slice(0, 15).map(u => tgEscape(u.name)).join(", ")}${r.notReported.length > 15 ? ` … +${r.notReported.length - 15}` : ""}`);
  }
  parts.push(`\n<i>Lệch có thể do đơn ghi nhận trễ / đổi tên sale / MISA về muộn — xem kỹ trước khi kết luận.</i>`);
  parts.push(`\n👉 <a href="${appLink("/doi-chieu-bao-cao")}">Xem chi tiết tại /doi-chieu-bao-cao</a>`);
  return parts.join("\n");
}

function nudge(r: ReconcileResult) {
  return `⏰ <b>NHẮC NỘP BÁO CÁO CUỐI NGÀY — ${r.date.slice(8)}/${r.date.slice(5, 7)}</b>\n`
    + `Còn <b>${r.notReported.length}</b> người chưa nộp:\n      `
    + r.notReported.slice(0, 20).map(u => `${tgEscape(u.name)} <i>(${tgEscape(u.dept)})</i>`).join(", ")
    + (r.notReported.length > 20 ? ` … +${r.notReported.length - 20}` : "")
    + `\n\n👉 <a href="${appLink("/admin/daily-report")}">Duyệt báo cáo</a>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  const mode = url.searchParams.get("mode") === "nudge" ? "nudge" : "full";
  const sb = getServiceClient();
  const today = vnDateStr();
  const r = await computeReportReconcile(sb, today);

  if (mode === "nudge") {

    const sentKey = `report_nudge_sent_${today}`;
    const already = (await getConfigValue(sentKey)) === "1";
    if (!r.notReported.length) return NextResponse.json({ ok: true, mode, notReported: 0, telegram: "ai cũng đã nộp" });
    if (already) return NextResponse.json({ ok: true, mode, notReported: r.notReported.length, telegram: "đã nhắc hôm nay rồi" });
    const t = await sendTelegramMay("doi-chieu-bao-cao", nudge(r));
    if (t.ok) await setConfigValue(sentKey, "1", "Đã nhắc nộp báo cáo hôm nay");
    return NextResponse.json({ ok: true, mode, notReported: r.notReported.length, telegram: t.ok ? "đã nhắc TGĐ" : t });
  }

  await setConfigValue("report_reconcile_status", JSON.stringify({ at: new Date().toISOString(), ...r }), "Đối chiếu báo cáo tự khai vs số đo (mới nhất)");

  if (!r.measurable) {
    return NextResponse.json({ ok: true, mode, measurable: false, misaRows: r.misaRows, note: "MISA chưa có dữ liệu ngày này — KHÔNG bắn cờ khai ảo", notReported: r.notReported.length });
  }

  const soViec = r.flagged.length ? tomTat(await dongBoViec(sb, {
    the: "lech-bao-cao",
    tuDong: false,
    ngayLeoThang: 2,
    cans: r.flagged.map((e) => ({

      khoa: e.userId,
      tieuDe: `[Lệch báo cáo] ${e.name} — giải trình báo cáo khai lệch số đo`,
      moTa: [
        `Lần lệch mới nhất — báo cáo cuối ngày ${today} khai lệch so với số máy đo:`,
        ...e.lines.map((m) => `- ${m.label}: khai ${m.reported} vs đo ${m.measured} (lệch ${m.diff > 0 ? "+" : ""}${m.diff})${m.hard ? "" : " (tham khảo)"}`),
        ``,
        `Việc cần làm: xem lại và sửa báo cáo, hoặc nhắn lý do lệch (đơn chưa lên hệ thống, khách huỷ...).`,
        `Mở đối chiếu: ${appLink("/doi-chieu-bao-cao")}`,
      ].join("\n"),
      nguoi: e.name,
      uuTien: "medium",
    })),
  })) : null;

  const sentKey = `report_reconcile_sent_${today}`;
  const already = (await getConfigValue(sentKey)) === "1";
  if (!r.flagged.length) return NextResponse.json({ ok: true, mode, measurable: true, flagged: 0, notReported: r.notReported.length, telegram: "không ai lệch quá ngưỡng" });
  if (already) return NextResponse.json({ ok: true, mode, measurable: true, flagged: r.flagged.length, soViec, telegram: "đã gửi digest hôm nay rồi" });

  const t = await sendTelegramMay("doi-chieu-bao-cao", digest(r));
  if (t.ok) await setConfigValue(sentKey, "1", "Đã gửi digest đối chiếu báo cáo hôm nay");
  return NextResponse.json({ ok: true, mode, measurable: true, flagged: r.flagged.length, notReported: r.notReported.length, soViec, telegram: t.ok ? "đã gửi digest TGĐ" : t });
}
