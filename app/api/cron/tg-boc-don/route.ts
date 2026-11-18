import { NextResponse } from "next/server";
import { layModel } from "@/lib/ai-model";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";
import { getServiceClient } from "@/lib/supabase-server";
import { setConfigValue } from "@/lib/app-config";
import { ganSaleTheoMay, nhomDon } from "@/lib/tg-orderbook";
import { locDonNhomTrungWeb } from "@/lib/don-web";
import { ghiViecMay } from "@/lib/viec-may";
import { CHAT_DAI_LY, chuanMa } from "@/lib/affiliate-don";
import { sdtDaiLy } from "@/lib/doanh-thu";
import { xetDonSo, type KetQuaXet } from "@/lib/gia-v4";
import { giaVonQua } from "@/lib/gia-v4-von";
import { sendTelegramMay } from "@/lib/telegram";
import { chanMay, khoaCron } from "@/lib/kiem-cron";
import { bocNguonDon } from "@/lib/nguon-don";
import { guiDonMuaCapi } from "@/lib/meta-capi";
import { soatDonMoi, dungTinSoat } from "@/lib/canh-bao-don";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LO = 8;
const TOI_DA = 48;
const HAN_MS = 200e3;

const KHOA = "tg_boc_don_khoa";
const KHOA_MO = "1970-01-01T00:00:00.000Z";

async function giuKhoa(sb: any): Promise<boolean> {
  const bayGio = new Date().toISOString();
  const hetHan = new Date(Date.now() - 330e3).toISOString();
  const thu = () => sb.from("config").update({ value: bayGio }).eq("key", KHOA).lt("value", hetHan).select("key");
  try {
    let { data, error } = await thu();
    if (error) return true;
    if (data?.length) return true;
    const { data: co, error: e2 } = await sb.from("config").select("key").eq("key", KHOA).maybeSingle();
    if (e2) return true;
    if (co) return false;

    await sb.from("config").insert({ key: KHOA, value: KHOA_MO, description: "Khoá một lượt của máy bóc đơn Telegram (tự hết hạn sau 330s)" });
    ({ data, error } = await thu());
    return !!error || !!data?.length;
  } catch { return true; }
}

async function nhaKhoa(sb: any) {
  try { await sb.from("config").update({ value: KHOA_MO }).eq("key", KHOA); } catch {  }
}

const SCHEMA = `Trả về DUY NHẤT một mảng JSON, mỗi phần tử ứng với một tin theo đúng thứ tự đã cho:
{
 "la_don": true|false,          // false nếu tin không phải đơn hàng (trao đổi, hỏi han, ảnh...)
 "sale": "Sơn"|"Đào"|"Cúc"|"Lan"|"Hoa"|"Ngân"|"chưa rõ",
 "khach": "tên khách",
 "sdt": "số điện thoại",
 "dia_chi": "địa chỉ đầy đủ",
 "tinh": "tỉnh/thành",
 "san_pham": [{"ten":"tên hàng","sl":1,"thanh_tien":668000}],
 "qua": [{"ten":"tên quà","sl":1}],
 "gia_goc": 668000,             // tổng giá niêm yết TRƯỚC khi giảm
 "giam_gia": 0,
 "khach_tra": 668000,           // số tiền khách thực trả
 "kieu_ship": "cod"|"freeship"|"khach_tra_ship"|"ck_truoc",
 "phi_ship": 0,
 "ghi_chu": "",
 "ma_ctv": ""                   // mã cộng tác viên giới thiệu, nếu tin có
}`;

const LUAT = `Bạn bóc đơn hàng từ tin nhắn nội bộ của nhân viên bán hàng công ty thực phẩm bổ sung.

GÁN SALE THEO CHỮ KÝ TRONG TIN, KHÔNG theo người gõ — nhiều người dùng chung một máy hotline:
  "zalo 551" hoặc "551" -> Sơn
  "(zalo)mai" hoặc "zalo mai" -> Đào
  Có tên riêng trong tin thì lấy tên đó. Không có dấu hiệu nào -> "chưa rõ".

Tiền: bỏ dấu chấm/phẩy, trả số nguyên đồng. "1tr336" = 1336000. "668k" = 668000.
Hàng TẶNG đưa vào "qua", không đưa vào "san_pham" và không cộng vào tiền.
MÃ CỘNG TÁC VIÊN: tin ghi "mã: X", "mã CTV X", "mã giới thiệu X", "ref X", "CTV X" -> "ma_ctv": "X"
  viết HOA, bỏ dấu, bỏ khoảng trắng ("mã: minh anh" -> "MINHANH"). Không có thì để rỗng.
  KHÔNG lấy mã vận đơn, mã đơn hàng, mã giảm giá, số điện thoại làm ma_ctv.
Tin không phải đơn (hỏi đáp, nhắc việc, ảnh, cảm ơn) -> {"la_don": false} và bỏ trống phần còn lại.
Không bịa. Trường nào tin không nói thì để rỗng hoặc 0.`;

async function bocLo(tins: { i: number; noi_dung: string; from_name: string }[]): Promise<any[] | null> {
  const key = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!key) return null;
  const dau = tins.map((t, k) => `--- TIN ${k + 1} (người gõ: ${t.from_name || "?"}) ---\n${t.noi_dung}`).join("\n\n");
  try {
    const model = await layModel("thuong");
    const t0 = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        system: `${LUAT}\n\n${SCHEMA}\n\nChỉ in mảng JSON, không giải thích, không rào đầu rào cuối.`,
        messages: [{ role: "user", content: dau }],
      }),
      cache: "no-store",
    });
    const j: any = await res.json().catch(() => ({}));
    ghiNhatKyAI({ noi: "cron/tg-boc-don", model, inTok: j?.usage?.input_tokens, outTok: j?.usage?.output_tokens, ms: Date.now() - t0, ok: res.ok });
    if (j?.stop_reason === "max_tokens") return null;
    const raw = ((j?.content || []).find((c: any) => c?.type === "text")?.text || "").trim();
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return null;
    const arr = JSON.parse(m[0]);
    return Array.isArray(arr) && arr.length === tins.length ? arr : null;
  } catch { return null; }
}

const so = (v: any) => { const n = Math.round(Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0); return Number.isFinite(n) ? n : 0; };
const chu = (v: any) => (v == null ? null : String(v).trim().slice(0, 300) || null);
const sdtChuan = (p: any) => String(p || "").replace(/\D/g, "").replace(/^84/, "0");

function gacSanGia(rows: any[], sdtSi: Set<string>): { row: any; kq: KetQuaXet }[] {
  const ra: { row: any; kq: KetQuaXet }[] = [];
  for (const r of rows) {
    const daiLy = String(r.chat_id) === CHAT_DAI_LY || (r.sdt && sdtSi.has(sdtChuan(r.sdt)));

    const quaVon = giaVonQua(Array.isArray(r.qua) ? r.qua : []);
    const kq = xetDonSo({ san_pham: r.san_pham, khach_tra: r.khach_tra, kenh: daiLy ? "dai_ly" : "le", quaGiaVon: quaVon.tong });
    if (kq.muc === "ok") continue;
    r.ghi_chu = [`[GIÁ ${kq.muc === "chan" ? "DƯỚI SÀN" : "CẢNH BÁO"} v4: ${kq.lyDo}]`, r.ghi_chu].filter(Boolean).join(" · ").slice(0, 300);
    ra.push({ row: r, kq });
  }
  return ra;
}

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const sb = getServiceClient();
  if (!(await giuKhoa(sb))) return NextResponse.json({ ok: true, boQua: "đang có lượt bóc khác chạy" });
  try {
    return await bocHet(sb);
  } finally {
    await nhaKhoa(sb);
  }
}

async function bocHet(sb: any) {
  const t0 = Date.now();

  const nhom = await nhomDon();
  const layTin = () => sb.from("tg_messages")
    .select("id, chat_id, message_id, noi_dung, from_name, sent_at")
    .eq("da_boc", false).in("chat_id", nhom).order("sent_at").limit(TOI_DA);
  const { data: dau, error } = await layTin();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  let tins: any[] = dau || [];

  if (!tins?.length) {
    await setConfigValue("nguon_boc_don_tele",
      JSON.stringify({ at: new Date().toISOString(), tin: 0, don: 0, loHong: 0, ok: true }),
      "Lần bóc đơn Telegram gần nhất (watchdog đọc khoá này)");
    return NextResponse.json({ ok: true, tin: 0, don: 0, ghiChu: "không có tin mới" });
  }

  let don = 0, khongPhaiDon = 0, trungWeb = 0;
  const loHong: number[] = [];
  const sdtSi = await sdtDaiLy(sb);
  const coGia: { row: any; kq: KetQuaXet }[] = [];
  const coSoat: Awaited<ReturnType<typeof soatDonMoi>> = [];

  const daThu = new Set<any>();
  let tongTin = 0;
  while (tins.length) {
    for (let i = 0; i < tins.length; i += LO) {
      const lo = tins.slice(i, i + LO);
      const kq = await bocLo(lo.map((t, k) => ({ i: k, noi_dung: t.noi_dung || "", from_name: t.from_name || "" })));
      if (!kq) { loHong.push(i / LO + 1); continue; }

      const rows: any[] = [];
      for (let k = 0; k < lo.length; k++) {
        const t = lo[k], d = kq[k] || {};
        if (!d.la_don) { khongPhaiDon++; continue; }
        const ngayVN = new Date(new Date(t.sent_at).getTime() + 7 * 3600e3).toISOString().slice(0, 10);

        let sale = chu(d.sale) || "chưa rõ";
        if (sale === "chưa rõ") sale = (await ganSaleTheoMay(t.from_name || "", ngayVN)) || "chưa rõ";
        rows.push({
          chat_id: t.chat_id, message_id: t.message_id,
          sale, khach: chu(d.khach), sdt: chu(d.sdt),
          dia_chi: chu(d.dia_chi), tinh: chu(d.tinh),
          san_pham: Array.isArray(d.san_pham) ? d.san_pham : [],
          qua: Array.isArray(d.qua) ? d.qua : [],
          gia_goc: so(d.gia_goc), giam_gia: so(d.giam_gia), khach_tra: so(d.khach_tra),
          kieu_ship: chu(d.kieu_ship), phi_ship: so(d.phi_ship), ghi_chu: chu(d.ghi_chu),
          ngay: ngayVN, sent_at: t.sent_at, nguoi_gui: chu(t.from_name),
          ma_ctv: chuanMa(d.ma_ctv) || null,

          ...(() => { const ng = bocNguonDon(t.noi_dung); return ng ? { nguon: ng } : {}; })(),
        });
      }
      if (rows.length) {
        coGia.push(...gacSanGia(rows, sdtSi));

        let ghi = rows;
        try {
          const loc = await locDonNhomTrungWeb(sb, rows);
          ghi = loc.giu; trungWeb += loc.boQua.length;
        } catch {  }

        try { coSoat.push(...await soatDonMoi(sb, ghi)); } catch {  }
        if (ghi.length) {
          let { error: e2 } = await sb.from("tg_orders").upsert(ghi, { onConflict: "chat_id,message_id" });

          if (e2 && /nguon/.test(String(e2.message || ""))) {
            ({ error: e2 } = await sb.from("tg_orders").upsert(ghi.map(({ nguon: _bo, ...r }: any) => r), { onConflict: "chat_id,message_id" }));
          }
          if (e2) { loHong.push(i / LO + 1); continue; }
          don += ghi.length;

          await guiDonMuaCapi(ghi).catch(() => { });
        }
      }
      await sb.from("tg_messages").update({ da_boc: true }).in("id", lo.map((t) => t.id));
    }
    for (const t of tins) daThu.add(t.id);
    tongTin += tins.length;
    if (Date.now() - t0 > HAN_MS) break;
    const { data: them } = await layTin();
    tins = (them || []).filter((t: any) => !daThu.has(t.id));
  }

  if (coGia.length) {
    const text = ["ĐƠN NHÓM TELEGRAM LỆCH SÀN GIÁ v4 — " + coGia.length + " đơn (đã gắn cờ vào ghi chú, KHÔNG xoá đơn)",
      ...coGia.slice(0, 10).map(({ row, kq }) =>
        `• ${row.ngay} · ${row.sale} · ${row.khach || "-"} · ${row.sdt ? "*******" + String(row.sdt).slice(-3) : "-"} · ${kq.muc === "chan" ? "DƯỚI SÀN" : "cảnh báo"}: ${kq.lyDo}`),
      coGia.length > 10 ? `… và ${coGia.length - 10} đơn nữa (xem /gan-don).` : null,
      "Quản lý kiểm với sale: đúng là bán dưới sàn thì xử lý theo chính sách; đơn đại lý/B2B thì ghi rõ vào sổ đại lý để máy khỏi báo lại.",
    ].filter(Boolean).join("\n");
    await sendTelegramMay("gia-duoi-san", text).catch(() => { });
  }

  if (coSoat.length) await sendTelegramMay("don-soat-truoc-gui", dungTinSoat(coSoat)).catch(() => { });

  const ok = loHong.length === 0;
  await setConfigValue("nguon_boc_don_tele",
    JSON.stringify({ at: new Date().toISOString(), tin: tongTin, don, trungWeb, lechSan: coGia.length, soat: coSoat.length, loHong: loHong.length, ok }),
    "Lần bóc đơn Telegram gần nhất (watchdog đọc khoá này)");

  await ghiViecMay({
    agent: "tg-boc-don", agentTen: "Máy bóc đơn nhóm Telegram",
    viec: `Bóc ${tongTin} tin trong nhóm Đơn Hàng`,
    trangThai: (!don && !khongPhaiDon) ? "hong" : (don ? "xong" : "khong_co_gi"),
    soLuong: don, donVi: "đơn",
    chiTiet: loHong.length ? `${loHong.length} lô bóc lỗi` : (khongPhaiDon ? `${khongPhaiDon} tin không phải đơn` : null),
    link: "/gan-don", giay: (Date.now() - t0) / 1000,
  });

  if (!don && !khongPhaiDon) {
    return NextResponse.json({ ok: false, error: "bóc ra 0 đơn dù có tin — nghi LLM hỏng hoặc thiếu ANTHROPIC_API_KEY", tin: tongTin }, { status: 500 });
  }
  return NextResponse.json({ ok, tin: tongTin, don, khongPhaiDon, lechSan: coGia.length, soat: coSoat.length, loHong: loHong.length });
}
