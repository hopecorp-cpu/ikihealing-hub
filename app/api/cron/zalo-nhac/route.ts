import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendTelegram, telegramConfigured, tgEscape } from "@/lib/telegram";
import { ghiViecMay } from "@/lib/viec-may";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const sb = getServiceClient();
  const url = new URL(req.url);

  const cron = (process.env.CRON_SECRET || "").trim();
  const tokenCfg = String((await sb.from("config").select("value").eq("key", "ads_report_token").maybeSingle()).data?.value || "").trim();
  const key = (url.searchParams.get("key") || "").trim();
  const auth = req.headers.get("authorization") === `Bearer ${cron}`;
  if (!auth && !(key && ((cron && key === cron) || (tokenCfg && key === tokenCfg)))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();
  let raw: any = null;
  try { raw = JSON.parse((await sb.from("config").select("value").eq("key", "zalo_hoi_thoai").maybeSingle()).data?.value || "null"); } catch { }
  if (!raw) {

    return NextResponse.json({ ok: false, error: "chưa có config zalo_hoi_thoai — chạy scripts/zalo-cau-noi-do.mjs --commit" }, { status: 500 });
  }

  const cho: any[] = Array.isArray(raw.choTraLoi) ? raw.choTraLoi : [];
  const tuoiGio = raw.at ? (Date.now() - new Date(raw.at).getTime()) / 3600e3 : 999;
  if (tuoiGio > 30) {
    return NextResponse.json({ ok: false, error: `dữ liệu cũ ${Math.round(tuoiGio)}h — máy đo hộp thư Zalo (zalo-cau-noi-do) đang đứng`, cho: cho.length }, { status: 500 });
  }

  const { data: users } = await sb.from("users").select("id, full_name").eq("active", true);
  const ten: Record<string, string> = {};
  for (const u of users || []) ten[u.id] = u.full_name || "";
  let tgMap: Record<string, string> = {};
  try { tgMap = JSON.parse((await sb.from("config").select("value").eq("key", "sale_tg_chat").maybeSingle()).data?.value || "{}") || {}; } catch { }

  const theoSale: Record<string, any[]> = {};
  for (const k of cho) (theoSale[k.sale_id || "?"] ??= []).push(k);

  const tagOf = (uid: string) => {
    const id = String(tgMap[uid] || "").trim();
    const nm = tgEscape(ten[uid] || "sale");
    return /^\d+$/.test(id) ? `<a href="tg://user?id=${id}">${nm}</a>` : `<b>${nm}</b>`;
  };
  const gio = (iso: string) => { try { return new Date(iso).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const ngayVN = (iso: string) => { try { return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }); } catch { return ""; } };
  const homNay = ngayVN(new Date().toISOString());

  const khiNao = (iso: string) => {
    const d = ngayVN(iso);
    if (d === homNay) return `hôm nay ${gio(iso)}`;
    const ngay = Math.round((Date.now() - new Date(iso).getTime()) / 864e5);
    return `${d.slice(8, 10)}/${d.slice(5, 7)} ${gio(iso)} — chờ ${ngay} ngày`;
  };

  const khoi: string[] = [];
  for (const [uid, ds] of Object.entries(theoSale).sort((a, b) => b[1].length - a[1].length)) {
    const dong = ds
      .sort((a, b) => String(a.khachNhanLuc).localeCompare(String(b.khachNhanLuc)))
      .slice(0, 12)
      .map((k) => `   - ${tgEscape(k.ten || k.phone || "khách")}${k.phone ? ` (${tgEscape(k.phone)})` : ""} — nhắn ${khiNao(k.khachNhanLuc)}`);
    khoi.push(`${tagOf(uid)}: <b>${ds.length}</b> khách đang chờ trả lời\n${dong.join("\n")}${ds.length > dong.length ? `\n   - … còn ${ds.length - dong.length} khách nữa` : ""}`);
  }

  const dinhChinh = url.searchParams.get("dinhchinh") === "1";
  const text = [
    `\u{1F4AC} <b>KHÁCH ZALO ĐANG CHỜ TRẢ LỜI</b> — đo từ tin nhắn thật trong Zalo`,
    dinhChinh
      ? `\n<i>Đính chính: các tin "LEAD NÓNG" trước đây đếm theo nút bấm trong app, mà anh chị làm việc thẳng trên Zalo nên gần như không ai bấm — máy hiểu nhầm thành "chưa liên hệ" và gọi nhầm cả những khách đã tư vấn xong. Nay máy đã đọc lại tin nhắn thật trong Salework: toàn bộ khách Zalo đều đã được chăm, không ai bị bỏ sót. Xin lỗi vì đã làm phiền. Từ nay chỉ nhắc đúng những khách nhắn câu cuối mà chưa có ai đáp, và khách của ai thì nhắc đúng người đó.</i>`
      : "",
    "",
    khoi.length ? khoi.join("\n\n") : "\u{2705} Không còn khách nào chờ trả lời — cả nhà đã đáp hết.",
    "",

    (() => { const k = raw.khongKetLuan || {}; const n = Number(k.truocMocNghe || 0) + Number(k.nickMatPhien || 0);
      return n ? `<i>Còn ${n} hội thoại máy chưa kết luận được (${k.truocMocNghe || 0} từ trước lúc máy nghe được tin sale gửi, ${k.nickMatPhien || 0} ở nick đang mất phiên) — không tính vào danh sách trên.</i>` : ""; })(),
    `<i>Số liệu lúc ${gio(raw.at)}. Khách của ai người đó chăm — máy không đẩy sang sale khác.</i>`,
  ].filter((x) => x !== "").join("\n");

  if (url.searchParams.get("dry") === "1") {
    return NextResponse.json({ ok: true, dry: true, cho: cho.length, sale: Object.keys(theoSale).length, text });
  }
  if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "telegram chưa cấu hình" }, { status: 500 });

  const chat = (process.env.TELEGRAM_SALES_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "").trim() || undefined;
  const r: any = await sendTelegram(text, chat);

  await ghiViecMay({
    agent: "zalo-nhac", agentTen: "Máy nhắc khách chờ trên Zalo",
    viec: `Nhắc ${Object.keys(theoSale).length} sale về khách đang chờ trả lời`,
    trangThai: !r?.ok ? "hong" : (cho.length ? "xong" : "khong_co_gi"),
    soLuong: cho.length, donVi: "khách chờ",
    chiTiet: r?.ok ? null : (r?.error || "gửi hụt"),
    link: "/cham-soc-kh", giay: (Date.now() - t0) / 1000,
  });

  if (!r?.ok) return NextResponse.json({ ok: false, error: r?.error || "gửi hụt" }, { status: 500 });
  return NextResponse.json({ ok: true, cho: cho.length, sale: Object.keys(theoSale).length });
}
