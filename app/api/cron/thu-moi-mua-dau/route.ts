import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { guiEmailNuoi, markSent } from "@/lib/blog-nurture";
import { thuMoiMuaDau, TIEU_DE, layNguoiNhan, MA_CHIEN_DICH } from "@/lib/thu-moi-mua-dau";
import { findBanned } from "@/lib/banned-words";
import { chanMay, khoaBaoCao, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const cho = { query: ["key"], headers: ["x-report-token"] };
  const chanKhoa = await chanMay(req, [khoaCron(cho), khoaBaoCao(cho)]);
  if (chanKhoa) return chanKhoa;

  const dry = u.searchParams.get("dry") === "1";
  const test = u.searchParams.get("test") || "";
  const tran = Math.max(1, Math.min(300, Number(u.searchParams.get("tran")) || 120));
  const KHOA_SO = "thu_moi_mua_dau_so";

  const mauThu = thuMoiMuaDau("kiem", 21);
  const dinh = findBanned(TIEU_DE + " " + mauThu.replace(/<[^>]+>/g, " "));
  if (dinh.length) {
    return NextResponse.json({ ok: false, error: "thư dính TỪ CẤM", tu: dinh }, { status: 500 });
  }

  const sb = getServiceClient();
  const sdtDaMua = new Set<string>();
  for (let off = 0; ; off += 1000) {
    const { data } = await sb.from("tg_orders").select("sdt").order("id", { ascending: true }).range(off, off + 999);
    for (const r of data || []) {
      const s = String(r.sdt || "").replace(/\D/g, "").replace(/^84/, "0");
      if (/^0\d{9}$/.test(s)) sdtDaMua.add(s);
    }
    if (!data || data.length < 1000) break;
  }
  let so: Record<string, any> = {};
  try { so = JSON.parse((await getConfigValue(KHOA_SO)) || "{}"); } catch { so = {}; }
  const nhan = await layNguoiNhan(sdtDaMua, new Set(Object.keys(so)));

  if (dry) return NextResponse.json({ ok: true, dry: true, daMua: sdtDaMua.size, daGui: Object.keys(so).length, conLai: nhan.length, tieuDe: TIEU_DE });

  if (test) {
    const r = await guiEmailNuoi(test, TIEU_DE, thuMoiMuaDau("test", 21), { quangCao: true, replyTo: "contact@example.com", nhip: { luong: "thu-moi-mua-dau", mau: "moi-mua-dau", neuSanPham: true } });
    return NextResponse.json({ ok: r.ok, test, ketQua: r });
  }

  const lo = nhan.slice(0, tran);
  let ok = 0, boQua = 0, loi = 0;
  const hanChot = Date.now() + 260_000;
  for (const { lead, soNgay } of lo) {
    if (Date.now() > hanChot) break;
    const r = await guiEmailNuoi(lead.email, TIEU_DE, thuMoiMuaDau(lead.id, soNgay), { quangCao: true, replyTo: "contact@example.com", nhip: { luong: "thu-moi-mua-dau", mau: "moi-mua-dau", neuSanPham: true } });
    if (r.ok) {
      ok++;
      so[lead.email] = { at: new Date().toISOString(), soNgay };

      await setConfigValue(KHOA_SO, JSON.stringify(so), `Đã gửi thư ${MA_CHIEN_DICH} (khoá theo email)`);
      await markSent(lead.email, 900);
    } else if (r.skipped) boQua++;
    else loi++;
    if (loi >= 3) break;
    await new Promise((res) => setTimeout(res, 600));
  }
  await setConfigValue("thu_moi_mua_dau_trang_thai",
    JSON.stringify({ at: new Date().toISOString(), ok, boQua, loi, conLai: nhan.length - ok }),
    "Lượt gửi thư mời đơn đầu gần nhất");
  return NextResponse.json({ ok: loi < 3, guiOk: ok, boQua, loi, conLai: nhan.length - ok });
}
