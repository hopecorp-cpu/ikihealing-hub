import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { setConfigValue } from "@/lib/app-config";
import { chamMotKhach, locBroadcast, giaiThich, type TinNhan, type LienHe } from "@/lib/cham-diem-zalo";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const chiThu = url.searchParams.get("thu") === "1";
  const sb = getServiceClient();

  const layHet = async (bang: string, sel: string, sap: string) => {
    let ra: any[] = [], off = 0;
    for (;;) {
      const { data, error } = await sb.from(bang).select(sel).order(sap, { ascending: true }).range(off, off + 999);
      if (error) return { ra, loi: `${bang}: ${error.message}` };
      if (!data?.length) break;
      ra = ra.concat(data);
      if (data.length < 1000) break;
      off += 1000;
      if (off > 200000) break;
    }
    return { ra, loi: null as string | null };
  };

  const tinRes = await layHet("zalo_bridge_messages", "direction,content,sent_at,created_at,thread_id,zalo_uid", "created_at");
  const lhRes = await layHet("zalo_bridge_contacts", "zalo_uid,display_name,phone_norm,last_in_at,last_out_at,msg_count,unreplied,nhan_sale,thread_type", "created_at");

  if (tinRes.loi || lhRes.loi) return NextResponse.json({ ok: false, loi: tinRes.loi || lhRes.loi }, { status: 200 });

  const tins = tinRes.ra as (TinNhan & { zalo_uid?: string })[];
  const lhs = lhRes.ra as LienHe[];

  const { data: donRows } = await sb.from("tg_orders").select("sdt").limit(5000);
  const soLanMua = new Map<string, number>();
  for (const d of (donRows ?? []) as any[]) {
    const p = String(d.sdt || "").replace(/\D/g, "").replace(/^84/, "0");
    if (p.length >= 9) soLanMua.set(p, (soLanMua.get(p) || 0) + 1);
  }

  const boQua = locBroadcast(tins);

  const theoUid = new Map<string, TinNhan[]>();
  for (const t of tins) {
    const uid = (t as any).zalo_uid;
    if (!uid) continue;
    if (!theoUid.has(uid)) theoUid.set(uid, []);
    theoUid.get(uid)!.push(t);
  }

  const kq = lhs.filter((lh) => (lh.thread_type || "user") !== "group").map((lh) => {
    const sdt = String(lh.phone_norm || "").replace(/\D/g, "").replace(/^84/, "0");
    return chamMotKhach(lh, theoUid.get(lh.zalo_uid) || [], { boQua, soLanMua: soLanMua.get(sdt) || 0 });
  }).filter((k) => k.tinHieu.length > 0)
    .sort((a, b) => b.diem - a.diem);

  const theoBac = { nong: 0, am: 0, nguoi: 0, lanh: 0 } as Record<string, number>;
  for (const k of kq) theoBac[k.bac]++;
  const boRoi = kq.filter((k) => k.loiCuaMinh);

  const goi = {
    at: new Date().toISOString(),
    tongTin: tins.length, tongLienHe: lhs.length, boQuaBroadcast: boQua.size,
    theoBac, soBoRoi: boRoi.length,
    top: kq.slice(0, 200),
    dangNo: boRoi.slice(0, 300),
  };
  if (!chiThu) await setConfigValue("zalo_diem_khach", JSON.stringify(goi), "Điểm khách Zalo (máy chấm hằng ngày)");

  return NextResponse.json({
    ok: true, chiThu,
    daQuet: { tin: tins.length, lienHe: lhs.length, mauBroadcastLoc: boQua.size },
    theoBac, khachChoMinhQua24h: boRoi.length,
    top10: kq.slice(0, 10).map(giaiThich),
    boRoi5: boRoi.slice(0, 5).map(giaiThich),
  });
}
