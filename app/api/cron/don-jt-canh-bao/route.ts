import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { sendTelegramMay, telegramConfigured } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { layDonJt, dungBanTinDonCanXuLy } from "@/lib/don-hang-jt";
import { dongBoViec, tomTat } from "@/lib/viec-tu-may";
import { chanMay, khoaBaoCao, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KHOA_ROUTE = [khoaCron({ bearer: true, query: ["key", "secret"] }), khoaBaoCao({ headers: ["x-report-token"], query: ["token"] })];

type DaNhac = { at: string; keys: Record<string, string> };

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, KHOA_ROUTE); if (chanKhoa) return chanKhoa;
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const sb = getServiceClient();

  try {
    const { rows, tuoiKho, soiTheoDoi } = await layDonJt(sb, { ngay: 30 });

    const treGio = tuoiKho ? (Date.now() - new Date(tuoiKho).getTime()) / 36e5 : Infinity;
    if (treGio > 36) {
      await setConfigValue("jt_canh_bao_last", new Date().toISOString(), "Nhịp tim cảnh báo đơn J&T");
      return NextResponse.json({ ok: false, skipped: "nguon_jt_cu", treGio: Math.round(treGio) }, { status: 500 });
    }

    let da: DaNhac = { at: "", keys: {} };
    try { da = JSON.parse((await getConfigValue("jt_canh_bao_da_nhac")) || "") || da; } catch {  }
    const moc30 = Date.now() - 30 * 864e5;
    const keys: Record<string, string> = {};
    for (const [k, v] of Object.entries(da.keys || {})) if (Date.parse(v) >= moc30) keys[k] = v;

    const { text, khoa, soMoi } = dungBanTinDonCanXuLy(rows, new Set(Object.keys(keys)), {
      link: appLink("/don-hang-jt"), tuoiKho,
    });

    let sent: any = null;
    if (!dry && soMoi > 0 && telegramConfigured()) {
      const a = await sendTelegramMay("doc-viec-sale", text);
      sent = a.ok ? "đã gửi nhóm Sale" : a;
      if (a.ok) {
        const now = new Date().toISOString();
        for (const k of khoa) keys[k] = now;
        await setConfigValue("jt_canh_bao_da_nhac", JSON.stringify({ at: now, keys }), "Đơn J&T đã nhắc (dedup 30 ngày)");
      }
    }

    let soViec: string | null = null;
    if (!dry) {
      const treo = rows.filter((r) => r.canXuLy);
      soViec = tomTat(await dongBoViec(sb, {
        the: "don-jt",
        ngayLeoThang: 3,
        lyDoDong: "J&T đã cập nhật xong trạng thái đơn này — không còn nằm trong danh sách cần xử lý.",
        cans: treo.map((r) => ({
          khoa: r.waybill,
          tieuDe: `[Đơn J&T] ${r.khach || "khách"} · ${r.trangThai}`,
          moTa: [
            `Vận đơn ${r.waybill} · COD ${r.cod ?? 0} · tạo ${r.ngayTao || "?"}`,
            `Khách: ${r.khach || "?"} · ${r.sdtKhach || "chưa có SĐT"}`,
            `J&T: ${r.trangThai}${r.lyDo ? ` — ${r.lyDo}` : ""}`,
            `Shipper: ${r.shipper || "chưa rõ"}${r.sdtShipper ? ` · ${r.sdtShipper}` : ""}`,
            ``,
            `Việc cần làm: gọi khách xác nhận còn nhận hàng không; khách nói chưa ai liên hệ thì gọi shipper.`,
            `Đơn hoàn thì báo lại nhóm để lên đơn mới hoặc đóng. Chi tiết: ${appLink("/don-hang-jt")}`,
          ].join("\n"),
          nguoi: r.sale || undefined,
          uuTien: "high",
        })),
      }));
    }

    await setConfigValue("jt_canh_bao_last", new Date().toISOString(), "Nhịp tim cảnh báo đơn J&T");

    return NextResponse.json({
      ok: true, dry, soMoi, dangTreo: rows.filter(r => r.canXuLy).length, vanDon: rows.length,
      hanhTrinh: soiTheoDoi, telegram: sent, soViec, text: dry ? text : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
