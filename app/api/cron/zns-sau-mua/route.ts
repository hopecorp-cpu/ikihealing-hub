import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { sdtDaiLy } from "@/lib/doanh-thu";
import { layTuChoi, chuanSdt } from "@/lib/du-lieu-ca-nhan";
import { docTokenOa } from "@/lib/zalo-oa-token";
import { sendZNS } from "@/lib/zalo";
import { chonTinZns, coTheGui, docCauHinh, type DonZns, type TinZns } from "@/lib/zns-sau-mua";
import type { VanDon } from "@/lib/affiliate-don";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function layHet<T>(q: (tu: number, den: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const ra: T[] = [];
  for (let tu = 0; ; tu += 1000) {
    const { data, error } = await q(tu, tu + 999);
    if (error) throw new Error(error.message);
    ra.push(...(data || []));
    if (!data || data.length < 1000) return ra;
  }
}

type MucSo = { luc: string; sdt: string; ok: boolean | null; loi?: string };
const che = (s: string) => s.slice(0, 3) + "****" + s.slice(-3);

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}` && url.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const chiThu = url.searchParams.get("thu") === "1";
  const ghiNhip = async (v: Record<string, unknown>) => chiThu ? undefined :
    setConfigValue("zns_nhip", JSON.stringify({ at: new Date().toISOString(), ...v }), "Lượt chạy máy ZBS sau mua gần nhất (watchdog đọc)");

  try {
    const sb = getServiceClient();
    const cauHinh = docCauHinh(await getConfigValue("zns_cau_hinh"));
    let lichSu: Record<string, MucSo> = {};
    try { lichSu = JSON.parse((await getConfigValue("zns_lich_su")) || "{}") || {}; } catch { lichSu = {}; }

    const bayGio = new Date();
    const homNay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(bayGio);
    const gioVN = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }).format(bayGio)) % 24;
    const tuNgay = new Date(Date.parse(homNay) - 20 * 864e5).toISOString().slice(0, 10);

    const don = await layHet<DonZns>((a, b) => sb.from("tg_orders")
      .select("chat_id, message_id, ngay, sdt, khach, khach_tra, san_pham").gte("ngay", tuNgay).order("id").range(a, b));
    const vanDon = await layHet<VanDon>((a, b) => sb.from("jt_waybills")
      .select("receiver_phone, status_group, order_create_time, updated_at, is_void")
      .gte("order_create_time", new Date(Date.parse(tuNgay) - 864e5).toISOString()).order("waybill_no").range(a, b));

    if (!don.length) throw new Error("tg_orders 20 ngày qua rỗng — máy bóc đơn Telegram có thể đang chết");

    const ds = await layTuChoi(sb);
    const tuChoi = new Set(Object.keys(ds.sdt).map((s) => chuanSdt(s)).filter(Boolean) as string[]);
    const moc24h = bayGio.getTime() - 24 * 3600e3;
    const sdt24h = new Set(Object.values(lichSu).filter((m) => Date.parse(m.luc) >= moc24h && m.ok !== false).map((m) => m.sdt));

    const { tin, boQua } = chonTinZns(don, vanDon, {
      cauHinh, daGui: new Set(Object.keys(lichSu)), tuChoi, daiLy: await sdtDaiLy(sb), sdt24h, homNay, gioVN,
    });
    const demLuong = (xs: TinZns[]) => xs.reduce<Record<string, number>>((m, t) => ({ ...m, [t.luong]: (m[t.luong] || 0) + 1 }), {});

    if (chiThu) {
      return NextResponse.json({
        ok: true, chiThu: true, cheDo: cauHinh.cheDo, gioVN, don: don.length, vanDon: vanDon.length,
        chon: tin.length, theoLuong: demLuong(tin), boQua,
        mau3: tin.slice(0, 3).map((t) => ({ luong: t.luong, sdt: che(t.sdt), oDien: Object.keys(t.params) })),
      });
    }

    const guiDuoc = tin.filter((t) => coTheGui(cauHinh, t.luong));
    const nhap = tin.filter((t) => !coTheGui(cauHinh, t.luong));
    if (nhap.length) {
      await setConfigValue("zns_nhap", JSON.stringify({ at: bayGio.toISOString(), cheDo: cauHinh.cheDo, tin: nhap }),
        "Tin ZBS sau mua máy đã chọn nhưng CHƯA gửi (chế độ nháp hoặc thiếu mã mẫu)");
    }

    let daGui = 0, loi = 0;
    if (guiDuoc.length) {
      const token = (await docTokenOa()).access_token;
      if (!token) throw new Error("cheDo tu_gui nhưng chưa có token OA (config zalo_oa_token) — chưa gửi tin nào");
      for (const t of guiDuoc) {
        lichSu[t.khoa] = { luc: new Date().toISOString(), sdt: t.sdt, ok: null };
        await setConfigValue("zns_lich_su", JSON.stringify(lichSu), "Sổ tin ZBS sau mua đã gửi (chống trùng, 1 tin/SĐT/24h)");
        const r = await sendZNS({ phone: t.sdt, templateId: t.templateId, params: t.params, accessToken: token });
        lichSu[t.khoa] = { ...lichSu[t.khoa], ok: r.success, ...(r.success ? {} : { loi: String(r.error || "?").slice(0, 120) }) };
        if (r.success) daGui++; else loi++;
      }
    }

    const moc60 = bayGio.getTime() - 60 * 864e5;
    for (const [k, m] of Object.entries(lichSu)) if (Date.parse(m.luc) < moc60) delete lichSu[k];
    if (guiDuoc.length) await setConfigValue("zns_lich_su", JSON.stringify(lichSu), "Sổ tin ZBS sau mua đã gửi (chống trùng, 1 tin/SĐT/24h)");

    const ok = loi === 0 || daGui > 0;
    await ghiNhip({ ok, cheDo: cauHinh.cheDo, chon: tin.length, nhap: nhap.length, daGui, loi, theoLuong: demLuong(tin), boQua });
    return NextResponse.json({ ok, cheDo: cauHinh.cheDo, chon: tin.length, nhap: nhap.length, daGui, loi, boQua }, { status: ok ? 200 : 500 });
  } catch (e: any) {
    const loi = String(e?.message || e);
    await ghiNhip({ ok: false, loi }).catch(() => {});
    return NextResponse.json({ ok: false, error: loi }, { status: 500 });
  }
}
