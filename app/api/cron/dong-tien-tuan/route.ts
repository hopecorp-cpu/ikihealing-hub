import { NextResponse } from "next/server";
import { getConfigValue } from "@/lib/app-config";
import { sendTelegramMay, tgEscape } from "@/lib/telegram";
import { computeCashFlow, type Tx } from "@/lib/cashflow";
import { dongTienThang, CHUA_PHAN_LOAI } from "@/lib/phan-loai-chi";
import { vnDateStr } from "@/lib/payroll";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fmt = (n: number) => Math.round(n || 0).toLocaleString("vi-VN") + "đ";
const read = async (k: string): Promise<any> => { try { return JSON.parse((await getConfigValue(k)) || "null"); } catch { return null; } };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const chan = await chanMay(req, [khoaCron()]);
  if (chan) return chan;

  const [cf, mb, tcb, cod] = await Promise.all([
    computeCashFlow(), read("mb_transactions"), read("tcb_transactions"), read("jt_cod_statements"),
  ]);
  const today = vnDateStr();
  const L: string[] = [`<b>DÒNG TIỀN ĐỊNH KỲ</b> — ${today}`, ``];

  if (!cf) {
    L.push(`Chưa bóc được sổ phụ nào (mb_transactions / tcb_transactions trống) — kiểm scripts/bank-statements.mjs.`);
  } else {
    L.push(`Số dư ngân hàng: <b>${fmt(cf.totals.closing)}</b> (MB ${fmt(cf.banks.mb || 0)} · TCB ${fmt(cf.banks.tcb || 0)})`,
      `Sổ phụ có tới ${cf.window.to || "?"}${(cf.staleDays || 0) > 35 ? ` — TRỄ ${cf.staleDays} ngày, kiểm máy bóc sổ phụ` : ""}`);
  }

  if (Array.isArray(cod) && cod.length) {
    const tu = new Date(Date.parse(today + "T00:00:00Z") - 7 * 864e5).toISOString().slice(0, 10);
    const tuan = cod.filter((x: any) => { const d = String(x.date || x.ngay || "").slice(0, 10); return d >= tu && d <= today; });
    const tong = tuan.reduce((s: number, x: any) => s + (Number(x.amount ?? x.soTien) || 0), 0);
    L.push(`COD J&T đối soát 7 ngày qua: ${tuan.length ? `<b>${fmt(tong)}</b> / ${tuan.length} phiên` : "chưa thấy phiên nào"}`);
  }

  const mbTx: Tx[] = Array.isArray(mb) ? mb : [], tcbTx: Tx[] = Array.isArray(tcb) ? tcb : [];
  const partial = new Set(cf?.partial || []);
  const thangDu = (cf?.months || []).map((m) => m.month).filter((m) => !partial.has(m)).sort();
  const thang = thangDu[thangDu.length - 1];

  if (thang) {
    const nay = dongTienThang(mbTx, tcbTx, thang);
    const truoc = thangDu.length > 1 ? dongTienThang(mbTx, tcbTx, thangDu[thangDu.length - 2]) : null;
    const vay = cf?.months.find((m) => m.month === thang)?.finIn || 0;
    L.push(``, `<b>Tháng ${thang.slice(5)}/${thang.slice(0, 4)} (sổ phụ đầy đủ gần nhất)</b>`,
      `Tiền vào: <b>${fmt(nay.vao)}</b>${vay ? ` (trong đó vay/góp vốn ${fmt(vay)})` : ""} · COD J&T ${fmt(nay.vaoJt)} (${nay.vao ? Math.round((nay.vaoJt / nay.vao) * 100) : 0}%)`,
      `Tiền ra: <b>${fmt(nay.ra)}</b>`,
      `Ròng: <b>${nay.vao - nay.ra >= 0 ? "+" : "−"}${fmt(Math.abs(nay.vao - nay.ra))}</b>${vay ? ` · bỏ tiền vay ra thì ${nay.vao - vay - nay.ra >= 0 ? "+" : "−"}${fmt(Math.abs(nay.vao - vay - nay.ra))}` : ""}`);
    if (nay.noiBo) L.push(`(Đã loại ${fmt(nay.noiBo)} chuyển qua lại giữa MB và TCB — không phải thu/chi.)`);

    L.push(``, `<b>Tiền tiêu vào đâu:</b>`);
    for (const g of nay.theoNhom) {
      const cu = truoc?.theoNhom.find((x) => x.nhom === g.nhom)?.tien || 0;
      const phinh = truoc && g.nhom !== CHUA_PHAN_LOAI && g.tien - cu > 5_000_000 && g.tien > cu * 1.3;
      L.push(`• ${tgEscape(g.nhom)}: ${fmt(g.tien)} (${nay.ra ? Math.round((g.tien / nay.ra) * 100) : 0}%)${phinh ? ` — TĂNG từ ${fmt(cu)}` : ""}`);
    }
    if (nay.chuaPhanLoaiLon.length) {
      L.push(``, `Khoản chưa phân loại lớn nhất (nhắn em nhóm đúng để máy học):`);
      for (const c of nay.chuaPhanLoaiLon) L.push(`• ${c.ngay.slice(8, 10)}/${c.ngay.slice(5, 7)} ${fmt(c.tien)} — ${tgEscape(c.noiDung)}`);
    }
  } else if (cf) {
    L.push(``, `Chưa có tháng nào sổ phụ phủ đủ để chia nhóm chi.`);
  }

  L.push(``, `Nhắc: ngân hàng gửi sổ phụ hằng tháng nên tiền ra chỉ có tới tháng trước. Tiền về đầu tháng phần lớn là COD đơn cuối tháng trước (lệch pha 3-7 ngày). Phân nhóm theo từ khoá nội dung CK — để thấy nhóm nào phình, không thay sổ kế toán.`);

  const text = L.join("\n");
  if (dry) return NextResponse.json({ ok: true, dry: true, thang, text });
  const t = await sendTelegramMay("tai-chinh", text);
  return NextResponse.json({ ok: t.ok, thang, telegram: t });
}
