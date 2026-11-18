import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { checkAllSources, checkNumberAnomalies } from "@/lib/watchdog";
import { dongBoViecNguonChet, gomNguyenNhan, tomTatDongBo } from "@/lib/nguon-chet-viec";
import { sendTelegramMay, telegramConfigured, tgEscape, sendBrainTelegram, brainBotConfigured } from "@/lib/telegram";
import { vnDateStr } from "@/lib/payroll";
import { APP_URL } from "@/lib/app-url";
import { ghiViecMay } from "@/lib/viec-may";
import { nhacNickZaloChet } from "@/lib/nhac-nick-zalo";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

async function notify(text: string) {

  if (telegramConfigured()) return sendTelegramMay("may-hong", text);
  return { ok: false, error: "no telegram" };
}

const NGUON_CHINH = new Set([
  "so_don_tele", "boc_don_tele", "jt_waybills_moi",
  "nhom_don_hang_cam_tin", "so_don_ngay_trong", "nhip_don_tut_sau",
  "orders_zero", "orders_drop", "rev_drop",
  "zalo_bridge_status", "zalo_nick_song", "zalo_nick_phien", "zalo_cau_noi_do_status",
]);

export async function GET(req: Request) {
  const t0 = Date.now();
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const force = url.searchParams.get("force") === "1";
  const sb = getServiceClient();

  const [sources, anomalies] = await Promise.all([checkAllSources(), checkNumberAnomalies()]);

  const { sources: daGom, keoTheo } = gomNguyenNhan(sources);
  const dead = daGom.filter((s) => !s.ok && !s.chiThamKhao);
  const sig = [...dead.map((d) => d.key), ...anomalies.map((a) => `anom:${a.key}`)].sort().join(",");
  const today = vnDateStr();

  const daGiao = await dongBoViecNguonChet(sources);

  let prev: any = {}; try { prev = JSON.parse((await sb.from("config").select("value").eq("key", "watchdog_state").maybeSingle()).data?.value || "{}"); } catch { }
  const changed = sig !== (prev.sig || "");
  const newDay = prev.date !== today;

  let sent = false;
  if ((dead.length || anomalies.length) && (force || changed || newDay)) {
    const lines: string[] = [];
    if (dead.length) {
      lines.push(`\u{1F6A8} <b>CẢNH BÁO — ${dead.length} nguồn dữ liệu đang NGỦ/CHẾT</b> (${today})`);
      lines.push(`Số liệu có thể đang lệch. Cần chạy lại trên máy:`);
      lines.push(``);
      lines.push(...dead.map((d) => `• <b>${tgEscape(d.label)}</b> — ${tgEscape(d.note)}\n   → ${tgEscape(d.fix)}` + (keoTheo[d.key]?.length ? `\n   ↳ kéo theo ${keoTheo[d.key].length} nguồn: ${tgEscape(keoTheo[d.key].join(" · "))}` : "")));
      const tomTat = tomTatDongBo(daGiao);

      if (tomTat) lines.push(``, `\u{1F4CB} ${tgEscape(tomTat)} Mở: ${APP_URL}/tasks`);
    }
    if (anomalies.length) {
      if (lines.length) lines.push(``);
      lines.push(`<b>SỐ LIỆU BẤT THƯỜNG — ${anomalies.length} mục</b> (${today}), đối chiếu trước khi kết luận:`);
      lines.push(...anomalies.map((a) => `• <b>${tgEscape(a.label)}</b> — ${tgEscape(a.note)}\n   → ${tgEscape(a.fix)}`));
    }
    const r = await notify(lines.join("\n"));
    sent = (r as any).ok;
  } else if (!dead.length && !anomalies.length && prev.sig && (prev.sig !== "")) {
    await notify(`\u{2705} <b>Nguồn dữ liệu + số liệu đã bình thường trở lại</b> (${today}).`);
    sent = true;
  }

  const dtDead = dead.filter((d) => NGUON_CHINH.has(d.key));
  const dtAnom = anomalies.filter((a) => NGUON_CHINH.has(a.key));
  const sigDt = [...dtDead.map((d) => d.key), ...dtAnom.map((a) => `anom:${a.key}`)].sort().join(",");
  let guiCeo = false;
  const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if ((dtDead.length || dtAnom.length) && (force || sigDt !== (prev.sigDt || "") || newDay) && ceo && brainBotConfigured()) {
    const dong = [
      `\u{1F6A8} <b>NGUỒN CHÍNH ĐANG HỎNG</b> (${today}) — doanh thu hoặc tin khách Zalo trên hub có thể đang thiếu:`,
      ...dtDead.map((d) => `• <b>${tgEscape(d.label)}</b> — ${tgEscape(d.note)}\n   → ${tgEscape(d.fix)}`),
      ...dtAnom.map((a) => `• <b>${tgEscape(a.label)}</b> — ${tgEscape(a.note)}\n   → ${tgEscape(a.fix)}`),
    ];
    guiCeo = !!(await sendBrainTelegram(ceo, dong.join("\n"))).ok;
  }

  await sb.from("config").upsert({ key: "watchdog_state", value: JSON.stringify({ sig, sigDt, date: today, at: new Date().toISOString(), dead: dead.map((d) => d.key) }) }, { onConflict: "key" });

  const nickZalo = await nhacNickZaloChet()
    .catch((e) => ({ ok: false, chet: [], daNhac: [], boQua: [], loi: String(e) }));

  await ghiViecMay({
    agent: "watchdog", agentTen: "Cowork — Tự động hoá",
    viec: `Soi ${sources.length} nguồn dữ liệu + ${anomalies.length} phép đo số`,
    trangThai: "xong",
    soLuong: dead.length, donVi: "nguồn đang kêu",
    chiTiet: dead.length ? dead.map((d) => d.key).join(" · ") : null,
    link: "/may-chay-ngam", giay: (Date.now() - t0) / 1000,
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true, checked: sources.length, dead: dead.length, deadKeys: dead.map((d) => d.key), sent, guiCeo,
    nickZalo: { ok: nickZalo.ok, chet: nickZalo.chet.length, daNhac: nickZalo.daNhac, boQua: nickZalo.boQua, loi: (nickZalo as any).loi },
    viec: { taoMoi: daGiao.taoMoi, dong: daGiao.dong, leoThang: daGiao.leoThang, loi: daGiao.loi },
    sources: force ? sources : undefined,
  });
}
