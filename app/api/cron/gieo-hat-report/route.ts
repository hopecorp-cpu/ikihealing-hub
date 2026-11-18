import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { dichCuaMay, tgEscape } from "@/lib/telegram";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function docConfig(key: string): Promise<any> {
  try {
    const v = (await getServiceClient().from("config").select("value").eq("key", key).maybeSingle()).data?.value;
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

const vnNgay = (lui = 0) => new Date(Date.now() + 7 * 3600e3 - lui * 864e5).toISOString().slice(0, 10);
const tuoi = (iso?: string) => {
  if (!iso) return "chưa đo";
  const gio = Math.floor((Date.now() - new Date(iso).getTime()) / 3600e3);
  return gio < 24 ? `${gio}h trước` : `${Math.floor(gio / 24)} ngày trước`;
};

async function guiBangTroLy(text: string) {
  const token = (process.env.TELEGRAM_BRAIN_BOT_TOKEN || "").trim();
  const chat = (await dichCuaMay("gieo-hat")) || (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token) return { ok: false, error: "thiếu TELEGRAM_BRAIN_BOT_TOKEN (token Trợ lý AI)" };
  if (!chat) return { ok: false, error: "không có đích gửi" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
      cache: "no-store",
    });
    const j: any = await res.json().catch(() => ({}));
    return { ok: res.ok && j.ok !== false, status: res.status, resp: j };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const dry = url.searchParams.get("dry") === "1";

  const [gieo, app, funnel] = await Promise.all([
    docConfig("gieo_hat_trang_thai"),
    docConfig("nova_app_dosong"),
    docConfig("funnel_daily"),
  ]);

  const d: string[] = ["<b>NGƯỜI GIEO HẠT — app NOVA</b>"];

  if (gieo) {
    const lanCuoi = (gieo.lichSu || []).slice(-1)[0];
    d.push("");
    d.push(`Bậc hiện tại: <b>${tgEscape(String(gieo.buoc || "?"))}</b>${gieo.dungHan ? "  (ĐÃ DỪNG HẲN)" : ""}`);
    if (lanCuoi) d.push(`Lần chạy gần nhất (${tgEscape(lanCuoi.ngay || "")}): ${tgEscape(String(lanCuoi.ketQua || ""))}`);
    if (gieo.dungHan) d.push(`Lý do dừng: ${tgEscape(String(gieo.lyDoDung || ""))}. Máy KHÔNG tự mở lại, cần người xem.`);
  } else {
    d.push("\nChưa có trạng thái gieo hạt (máy ở nhà chưa chạy lần nào).");
  }

  if (app) {
    const tong = Number(app.nguoiDung || 0);
    const song7 = Number(app.conSong7Ngay || 0);
    const giu7 = tong ? Math.round((song7 / tong) * 100) : 0;
    d.push("");
    d.push(`<b>Người dùng app</b> (đo ${tgEscape(tuoi(app.doLuc))})`);
    d.push(`Tổng ${tong} · mới 7 ngày ${Number(app.nguoiDungMoi7Ngay || 0)} · còn mở 7 ngày ${song7} (<b>${giu7}%</b>)`);
    d.push(`Đã quét món ${Number(app.daQuetMon || 0)} · đã chat ${Number(app.daChat || 0)} · có SĐT ${Number(app.coSoDienThoai || 0)}`);
    if (giu7 < 20) d.push("Giữ chân dưới 20% — app đang ngủ, đổ thêm người vào lúc này là đổ vào thùng thủng.");
  }

  if (funnel) {
    const hq = vnNgay(1), hk = vnNgay(2);
    const lay = (ng: string, b: string) => Number(funnel?.[ng]?.[`quiz:${b}`] || 0);
    const dong = (b: string, ten: string) => {
      const a = lay(hk, b), c = lay(hq, b);
      return `${ten}: ${c}${c - a !== 0 ? ` (${c - a > 0 ? "+" : ""}${c - a})` : ""}`;
    };
    d.push("");
    d.push(`<b>Phễu quiz</b> ${tgEscape(hq)} (so ${tgEscape(hk)})`);
    d.push([dong("view", "vào"), dong("start", "làm"), dong("lead", "để email"), dong("paid", "trả tiền")].join(" · "));
  }

  d.push("");
  const deXuat: string[] = [];
  if (gieo?.dungHan) deXuat.push("Xem lại lý do dừng rồi quyết mở lại hay đổi lời mời.");
  else if (app && Number(app.conSong7Ngay || 0) / Math.max(1, Number(app.nguoiDung || 1)) < 0.2)
    deXuat.push("Ưu tiên đánh thức người cũ (danh sách ở ~/Downloads/NOVA-danh-thuc) trước khi đổ người mới.");
  if (app && !Number(app.daQuetMon || 0)) deXuat.push("0 người quét món — tính năng lõi chưa ai dùng, cần xem lại luồng vào.");
  if (!deXuat.length) deXuat.push("Chưa có gì cần anh quyết. Máy chạy tiếp bậc sau.");
  d.push("<b>Đề xuất</b>: " + deXuat.map(tgEscape).join(" | "));

  const text = d.join("\n");
  if (dry) return NextResponse.json({ ok: true, dry: true, text });

  const r: any = await guiBangTroLy(text);

  if (!r?.ok) return NextResponse.json({ ok: false, error: r?.error || r?.resp || "gửi trượt" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
