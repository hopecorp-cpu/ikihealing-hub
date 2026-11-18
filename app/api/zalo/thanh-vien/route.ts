import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { chanMay } from "@/lib/kiem-cron";
import { sdtDaiLy } from "@/lib/doanh-thu";
import { chuanSdt } from "@/lib/du-lieu-ca-nhan";
import { exchangePhone } from "@/lib/zalo-miniapp";
import { sendTelegramMay } from "@/lib/telegram";
import { docCauHinh, docThe, kiemDoi, taoThe, tinhThe, type DonTV, type YeuCauDoi } from "@/lib/thanh-vien";
import type { VanDon } from "@/lib/affiliate-don";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-leads-token",
};
const tra = (j: unknown, status = 200) => NextResponse.json(j, { status, headers: CORS });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function layDoi(sb: any, sdt: string | null): Promise<{ ds: YeuCauDoi[]; noi: "bang" | "config" }> {
  try {
    let q = sb.from("thanh_vien_doi_qua").select("id, sdt, qua_id, diem, luc, trang_thai");
    if (sdt) q = q.eq("sdt", sdt);
    const { data, error } = await q.limit(1000);
    if (error) throw error;
    return { noi: "bang", ds: (data || []).map((r: any) => ({ id: r.id, sdt: r.sdt, quaId: r.qua_id, diem: r.diem, luc: r.luc, trangThai: r.trang_thai })) };
  } catch {
    const ds = await doiTrongConfig();
    return { noi: "config", ds: sdt ? ds.filter((d) => d.sdt === sdt) : ds };
  }
}

async function doiTrongConfig(): Promise<YeuCauDoi[]> {
  try { return JSON.parse((await getConfigValue("doi_qua_yeu_cau")) || "[]") || []; } catch { return []; }
}

async function ghiDoi(sb: any, yc: YeuCauDoi, noi: "bang" | "config"): Promise<void> {
  if (noi === "bang") {
    const { error } = await sb.from("thanh_vien_doi_qua").insert({ id: yc.id, sdt: yc.sdt, qua_id: yc.quaId, diem: yc.diem, luc: yc.luc, trang_thai: yc.trangThai });
    if (!error) return;
  }
  const ds = await doiTrongConfig();
  ds.push(yc);
  await setConfigValue("doi_qua_yeu_cau", JSON.stringify(ds), "Yêu cầu đổi quà thẻ thành viên Mini App (fallback khi chưa dán migration 076)");
}

async function the(sb: any, sdt: string) {
  const ch = docCauHinh(await getConfigValue("thanh_vien_cau_hinh"));
  if (!ch.mo) return { ch, kq: { mo: false as const } };
  const duoi = sdt.slice(-3);
  const { data: don, error: e1 } = await sb.from("tg_orders").select("chat_id, message_id, ngay, sdt, khach_tra")
    .gte("ngay", ch.tinhTu).ilike("sdt", `%${duoi}%`).limit(1000);
  if (e1) throw new Error(e1.message);
  const { data: vd, error: e2 } = await sb.from("jt_waybills").select("receiver_phone, status_group, order_create_time, updated_at, is_void")
    .gte("order_create_time", new Date(Date.parse(ch.tinhTu) - 864e5).toISOString()).ilike("receiver_phone", `%${duoi}%`).limit(1000);
  if (e2) throw new Error(e2.message);
  const { ds, noi } = await layDoi(sb, sdt);
  const t = tinhThe(sdt, (don || []) as DonTV[], (vd || []) as VanDon[], ds, ch, await sdtDaiLy(sb));
  return {
    ch, ds, noi, t,
    kq: { mo: true as const, ...t, qua: ch.qua, hangDs: ch.hang.map((h) => h.ten), choXuLy: ds.filter((d) => d.trangThai === "cho_xu_ly").length },
  };
}

export async function POST(req: Request) {
  const chan = await chanMay(req, [{ env: "LEADS_TOKEN", query: ["token"], headers: ["x-leads-token"] }], { headers: CORS });
  if (chan) return chan;
  const khoa = (process.env.THANH_VIEN_KEY || process.env.ZALO_MINIAPP_SECRET || "").trim();
  if (!khoa) return tra({ ok: false, error: "chưa cấu hình khoá thẻ thành viên" }, 503);
  let body: any = {};
  try { body = JSON.parse(await req.text()); } catch { }
  const hanhDong = String(body.hanhDong || "");

  if (hanhDong === "mo") {
    try { return tra({ ok: true, mo: docCauHinh(await getConfigValue("thanh_vien_cau_hinh")).mo }); }
    catch { return tra({ ok: false, mo: false }, 500); }
  }

  try {
    const sb = getServiceClient();
    let sdt: string | null = null;
    let theMoi: string | undefined;
    if (hanhDong === "xac-thuc") {
      sdt = chuanSdt(await exchangePhone(String(body.phone_token || ""), String(body.access_token || "")));
      if (!sdt) return tra({ ok: false, error: "chưa lấy được số Zalo đã xác thực" });
      theMoi = taoThe(sdt, khoa);
    } else {
      sdt = docThe(String(body.the || ""), khoa);
      if (!sdt) return tra({ ok: false, error: "the-het-han" }, 401);
    }

    const r = await the(sb, sdt);
    if (hanhDong !== "doi") return tra({ ok: true, ...(theMoi ? { the: theMoi } : {}), ...r.kq });

    if (!("t" in r) || !r.t) return tra({ ok: false, ly: "chua-mo" });
    const qua = r.ch.qua.find((q) => q.id === String(body.quaId || ""));
    const k = kiemDoi(r.t, qua, r.ch);
    if (!k.ok) return tra({ ok: false, ly: k.ly });
    const yc: YeuCauDoi = { id: randomUUID(), sdt, quaId: qua!.id, diem: qua!.diem, luc: new Date().toISOString(), trangThai: "cho_xu_ly" };
    await ghiDoi(sb, yc, r.noi!);

    await sendTelegramMay("doi-qua", `Đổi quà Mini App: ${qua!.ten} (${qua!.diem} điểm) · khách ***${sdt.slice(-3)} · mã ${yc.id.slice(0, 8)} · gửi kèm đơn kế tiếp của khách`).catch(() => {});
    return tra({ ok: true, daDoi: qua!.id, khaDung: r.t.khaDung - qua!.diem });
  } catch (e: any) {
    console.error("[thanh-vien]", e?.message);
    return tra({ ok: false, error: "loi-may" }, 500);
  }
}
