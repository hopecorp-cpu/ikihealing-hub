import { NextResponse } from "next/server";
import { tomorrowUnreminded, markReminded, consultSummary } from "@/lib/consultations";
import { getServiceClient } from "@/lib/supabase-server";
import { covanSendCEO, covanTelegramConfigured } from "@/lib/covan/telegram";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  try {
    const rows = await tomorrowUnreminded();
    if (!rows.length) return NextResponse.json({ ok: true, reminded: 0, note: "Ngày mai không có buổi tư vấn nào" });

    const sb = getServiceClient();
    const byStaff = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = r.staff_id || "__none__";
      if (!byStaff.has(k)) byStaff.set(k, []);
      byStaff.get(k)!.push(r);
    }
    const day = rows[0].slot_date;
    let tasked = 0;
    for (const [staffId, list] of byStaff) {
      if (staffId === "__none__") continue;
      const lines = list.map((r) => `- ${r.slot_time} · ${r.customer_name}${r.customer_phone ? ` (${r.customer_phone})` : ""}${r.note ? ` — ${r.note}` : ""}`);
      const { error } = await sb.from("tasks").insert({
        title: `[Tư vấn 1-1] Nhắc ${list.length} khách có lịch ngày mai (${day})`,
        description:
          `Nhắn Zalo nhắc từng khách trước buổi tư vấn 30 phút ngày mai — khách quên là mất buổi.\n\n${lines.join("\n")}\n\n` +
          `Mẫu tin: "Dạ em nhắc anh/chị buổi tư vấn 1-1 lúc [giờ] ngày mai ạ. Anh/chị vẫn sắp xếp được chứ ạ, nếu bận mình đổi giờ giúp em nhé."\n` +
          `Sau buổi nhớ vào trang Lịch tư vấn bấm Đến / Vắng để máy đo tỷ lệ đến.`,
        assigner_id: staffId,
        assignee_id: staffId,
        priority: "high",
        status: "todo",
        due_date: day,
        tags: ["tu-van-1-1"],
      });
      if (!error) tasked++;
    }
    await markReminded(rows.map((r) => r.id));

    if (covanTelegramConfigured()) {
      const sum = await consultSummary().catch(() => null);
      const rate = sum?.weekRate?.ratePct;
      await covanSendCEO(
        `LỊCH TƯ VẤN NGÀY MAI (${day})\n${rows.length} buổi 30 phút, đã giao việc nhắc khách cho ${tasked} chuyên viên.\n` +
        (rate === null || rate === undefined ? "" : `Tỷ lệ đến 7 ngày qua: ${rate}%.`)
      );
    }
    return NextResponse.json({ ok: true, reminded: rows.length, tasked });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
