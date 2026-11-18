import { NextResponse } from "next/server";
import { sendBrainTelegram, tgEscape } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { setConfigValue } from "@/lib/app-config";
import { chanMay, khoaCron } from "@/lib/kiem-cron";
import { layThiTran } from "@/lib/thi-tran-server";
import { timPhong } from "@/lib/thi-tran";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const chan = await chanMay(req, [khoaCron()]);
  if (chan) return chan;
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
  const ghiNhip = (trangThai: string) => dry ? Promise.resolve() :
    setConfigValue("thi_tran_nhac_last", JSON.stringify({ at: new Date().toISOString(), trangThai }), "Nhịp tim máy nhắc vòng phản hồi Thị trấn máy (9:11)");

  const d = await layThiTran().catch(() => null);
  if (!d) {
    const chu = "<b>Thị trấn máy — HỎNG</b>\nKhông đọc được bản đồ máy, sáng nay không kiểm được chỗ đứt nào cần anh.";
    const t = dry || !ceo ? null : await sendBrainTelegram(ceo, chu);
    await ghiNhip("hong");
    return NextResponse.json({ ok: false, loi: "layThiTran null", telegram: t }, { status: 500 });
  }

  const can = d.vong.deXuat.filter((x) => x.canAnh);
  const nang = can.filter((x) => x.trangThai === "xong-van-dut" || x.trangThai === "chay-lai-van-dut");
  const dangXuLy = d.vong.deXuat.filter((x) => !x.canAnh);
  const daSua = d.vong.daSua;

  if (!can.length && !daSua.length) {
    await ghiNhip("khong-can-nhac");
    return NextResponse.json({ ok: true, gui: false, lyDo: "không có chỗ nào cần anh, không có gì vừa lành", dangXuLy: dangXuLy.length });
  }

  const dong: string[] = [];
  dong.push(`<b>Thị trấn máy — sáng nay</b>`);
  if (can.length) dong.push(`Còn <b>${can.length}</b> chỗ đứt cần anh trả lời${nang.length ? `, trong đó ${nang.length} chỗ đã xử lý mà vẫn đứt` : ""}.`);
  for (const x of can.slice(0, 6)) {
    const ten = x.may.length > 1 ? `${x.may.length} máy (${x.may[0].ten}…)` : x.may[0].ten;
    dong.push(`• ${tgEscape(ten)} · ${tgEscape(timPhong(x.phong)?.ngan || x.phong)} — ${tgEscape(x.chuTrangThai)}`);
  }
  if (can.length > 6) dong.push(`… và ${can.length - 6} chỗ nữa.`);
  if (dangXuLy.length) dong.push(`Đang xử lý: ${dangXuLy.length} chỗ (chờ duyệt / Claude đang sửa / hẹn lại).`);
  if (daSua.length) dong.push(`Đã lành sau khi anh xử lý: ${daSua.map((x) => tgEscape(x.ten)).slice(0, 5).join(", ")}.`);
  dong.push(`Trả lời từng chỗ (giao / chạy lại / để sau): ${appLink("/thi-tran-may")}`);
  const chu = dong.join("\n");

  if (dry) return NextResponse.json({ ok: true, dry: true, chu });
  if (!ceo) { await ghiNhip("thieu-chat-id"); return NextResponse.json({ ok: false, loi: "Thiếu TELEGRAM_CHAT_ID" }, { status: 500 }); }
  const t = await sendBrainTelegram(ceo, chu);
  await ghiNhip(t.ok ? "da-gui" : "gui-hong");
  return NextResponse.json({ ok: !!t.ok, gui: true, can: can.length, daSua: daSua.length, telegram: t }, { status: t.ok ? 200 : 502 });
}
