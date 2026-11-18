import { NextResponse } from "next/server";
import { soanCaTruc } from "@/lib/ca-truc-ai";
import { sendTelegramMay, telegramConfigured, tgEscape } from "@/lib/telegram";
import { ghiViecMay } from "@/lib/viec-may";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  const t0 = Date.now();
  try {
    const n = Number(url.searchParams.get("n") || 20);
    const kq = await soanCaTruc(n);

    await ghiViecMay({
      agent: "ca-truc-ai", agentTen: "Ca trực AI",
      viec: `Soạn sẵn câu trả lời cho khách đang chờ`,
      trangThai: kq.hong && !kq.soan ? "hong" : (kq.soan ? "xong" : "khong_co_gi"),
      soLuong: kq.soan, donVi: "câu",
      chiTiet: [kq.hong ? `${kq.hong} ca hỏng` : "", kq.boVìTuCam ? `${kq.boVìTuCam} ca bỏ vì dính từ cấm` : ""].filter(Boolean).join(" · ") || null,
      link: "/ca-truc-ai", giay: (Date.now() - t0) / 1000,
    });

    if (url.searchParams.get("bao") === "1" && telegramConfigured() && kq.soan > 0) {
      const nong = kq.ds.filter((d) => d.nong).length;
      const L = [
        `\u{1F4DD} <b>CA TRỰC AI</b> — đã soạn sẵn <b>${kq.soan}</b> câu trả lời cho khách đang chờ`,
        nong ? `Trong đó <b>${nong}</b> khách có dấu hiệu muốn mua — làm trước.` : ``,
        ``,
        ...kq.ds.slice(0, 5).map((d, i) =>
          `${i + 1}. <b>${tgEscape(d.ten)}</b>${d.nong ? " (nóng)" : ""} — chờ ${Math.round(d.choGio / 24)} ngày\n` +
          `   Khách hỏi: <i>${tgEscape(d.cauHoi.slice(0, 110))}</i>\n` +
          `   Trả lời soạn sẵn: ${tgEscape(d.traLoi.slice(0, 260))}` +
          (d.link ? `\n   ${tgEscape(d.link)}` : ``)),
        ``,
        `Máy chỉ soạn, KHÔNG tự nhắn khách. Đọc lại rồi gửi giúp em.`,
      ].filter(Boolean);
      await sendTelegramMay("phan-hoi-khach", L.join("\n")).catch(() => null);
    }

    return NextResponse.json({
      ok: true, soan: kq.soan, khoiLai: kq.khoiLai, boVìTuCam: kq.boVìTuCam, hong: kq.hong,
      nong: kq.ds.filter((d) => d.nong).length,
      mau: kq.ds.slice(0, 3).map((d) => ({ ten: d.ten, choNgay: Math.round(d.choGio / 24), cauHoi: d.cauHoi.slice(0, 80), traLoi: d.traLoi.slice(0, 160) })),
    });
  } catch (e: any) {
    const loi = String(e?.message || e).slice(0, 300);
    await ghiViecMay({
      agent: "ca-truc-ai", agentTen: "Ca trực AI", viec: "Soạn sẵn câu trả lời cho khách đang chờ",
      trangThai: "hong", chiTiet: loi, link: "/ca-truc-ai", giay: (Date.now() - t0) / 1000,
    });
    return NextResponse.json({ ok: false, error: loi }, { status: 500 });
  }
}
