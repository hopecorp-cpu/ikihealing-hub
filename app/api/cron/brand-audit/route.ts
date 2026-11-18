import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { reviewContent } from "@/lib/brand-review";
import { sendTelegram, sendTelegramMay, telegramConfigured, tgEscape } from "@/lib/telegram";
import { setConfigValue } from "@/lib/app-config";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BAI = 12;

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron({ bearer: true, query: ["secret"] })]);
  if (chanKhoa) return chanKhoa;

  try {
    const sb = getServiceClient();
    const tu = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data, error } = await sb
      .from("content_items")
      .select("id,title,content_brief,status,created_at")
      .gte("created_at", tu)
      .order("created_at", { ascending: false })
      .limit(MAX_BAI);
    if (error) throw new Error(`đọc content_items lỗi: ${error.message}`);

    const bai = (data || []).filter((r: any) => (r.content_brief || "").length > 120);
    if (!bai.length) {
      const msg = `\u{1F50D} <b>GIÁM ĐỐC THƯƠNG HIỆU — rà soát tuần</b>\n\nTuần qua KHÔNG có bài nào để rà (nhà máy content chưa chạy hoặc bài quá ngắn). Kiểm ở /content.`;
      if (telegramConfigured()) await sendTelegramMay("noi-dung", msg);
      await setConfigValue("brand_audit_last", JSON.stringify({ at: new Date().toISOString(), n: 0 }));
      return NextResponse.json({ ok: true, reviewed: 0, note: "không có bài" });
    }

    const kq: { title: string; diem: number; loi: string[]; banned: string[] }[] = [];
    for (const b of bai) {
      try {
        const v = await reviewContent(b.title || "", b.content_brief || "");
        kq.push({ title: b.title || "(không tên)", diem: v.diem, loi: v.loi, banned: v.banned });
      } catch {  }
    }
    if (!kq.length) throw new Error("rà được 0/" + bai.length + " bài — AI không phản hồi");

    const tb = Math.round(kq.reduce((s, x) => s + x.diem, 0) / kq.length);
    const truot = kq.filter((x) => x.diem < 70).sort((a, b) => a.diem - b.diem);
    const dinhTuCam = kq.filter((x) => x.banned.length);

    const dem = new Map<string, number>();
    for (const x of kq) for (const l of x.loi) {
      const k = l.toLowerCase().slice(0, 45);
      dem.set(k, (dem.get(k) || 0) + 1);
    }
    const lap = [...dem.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const L = [
      `\u{1F50D} <b>GIÁM ĐỐC THƯƠNG HIỆU — rà soát tuần</b>`,
      `Đã rà <b>${kq.length}</b> bài · điểm trung bình <b>${tb}/100</b>`,
    ];
    if (dinhTuCam.length) L.push(`\n\u{26A0} <b>${dinhTuCam.length} bài DÍNH TỪ CẤM</b> — nguy hiểm pháp lý:\n` +
      dinhTuCam.slice(0, 3).map((x) => `\u{2022} ${tgEscape(x.title.slice(0, 55))} — ${tgEscape(x.banned.join(", "))}`).join("\n"));
    if (truot.length) L.push(`\n<b>${truot.length} bài dưới 70 điểm:</b>\n` +
      truot.slice(0, 4).map((x) => `\u{2022} ${x.diem}đ — ${tgEscape(x.title.slice(0, 55))}`).join("\n"));
    if (lap.length) L.push(`\n<b>Lỗi LẶP LẠI (thương hiệu đang trôi):</b>\n` +
      lap.map(([k, n]) => `\u{2022} ${n} bài: ${tgEscape(k)}`).join("\n"));
    if (!truot.length && !dinhTuCam.length) L.push(`\n\u{2713} Tuần này không bài nào lệch. Giữ nhịp.`);
    L.push(`\n<i>Xem/sửa bài ở /content · muốn lên chiến dịch thì nhắn Trợ lý "lên chiến dịch ..."</i>`);

    const text = L.join("\n");
    let sent = false;
    if (telegramConfigured()) { await sendTelegramMay("noi-dung", text); sent = true; }
    await setConfigValue("brand_audit_last", JSON.stringify({
      at: new Date().toISOString(), n: kq.length, tb, truot: truot.length, banned: dinhTuCam.length,
    }));
    return NextResponse.json({ ok: true, reviewed: kq.length, avg: tb, failed: truot.length, sent });
  } catch (e: any) {

    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}
