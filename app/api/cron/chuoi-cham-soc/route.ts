import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { soanTinChoLuot, CHUOI_MAC_DINH, KHOI_MAC_DINH, TRAN, type Chuoi, type Khoi } from "@/lib/chuoi-cham-soc";
import type { KetQuaCham } from "@/lib/cham-diem-zalo";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const chiThu = url.searchParams.get("thu") === "1";
  const sb = getServiceClient();

  const doc = async <T,>(k: string, md: T): Promise<T> => {
    try { const r = await getConfigValue(k); return r ? JSON.parse(r) : md; } catch { return md; }
  };

  const goi = await doc<any>("zalo_diem_khach", null);

  if (!goi?.top?.length) return NextResponse.json({ ok: false, loi: "chưa có kết quả chấm điểm (chạy cron cham-diem-zalo trước)" });

  const chuois = await doc<Chuoi[]>("zalo_chuoi", CHUOI_MAC_DINH);
  const khois = await doc<Khoi[]>("zalo_khoi", KHOI_MAC_DINH);
  const lichSuRaw = await doc<Record<string, { chuoi: string; buoc: number; luc: string }[]>>("zalo_chuoi_lich_su", {});
  const lichSu = new Map(Object.entries(lichSuRaw));

  const khachs: KetQuaCham[] = goi.top || [];
  const uids = khachs.map((k) => k.zalo_uid);

  const lanChamKhachNhan = new Map<string, string | null>();
  const ownTheoKhach = new Map<string, string>();
  for (let i = 0; i < uids.length; i += 200) {
    const { data } = await sb.from("zalo_bridge_contacts").select("zalo_uid,own_id,last_in_at,phone_norm").in("zalo_uid", uids.slice(i, i + 200));
    for (const c of (data ?? []) as any[]) { lanChamKhachNhan.set(c.zalo_uid, c.last_in_at); ownTheoKhach.set(c.zalo_uid, c.own_id); }
  }

  const daTuChoi = new Set<string>();
  try {
    const { daTuChoi: kiem } = await import("@/lib/du-lieu-ca-nhan");
    for (const k of khachs) if (await kiem(sb, { zaloUid: k.zalo_uid, phone: k.sdt || undefined })) daTuChoi.add(k.zalo_uid);
  } catch {  }

  const homNay = new Date().toISOString().slice(0, 10);
  const daGuiHomNay = [...lichSu.values()].flat().filter((x) => String(x.luc).slice(0, 10) === homNay).length;
  const gioVN = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }));

  const kq = soanTinChoLuot(khachs, { chuois, khois, lichSu, daGuiHomNay, gioHienTai: gioVN, lanChamKhachNhan, daTuChoi, ownTheoKhach });

  if (chiThu) {
    return NextResponse.json({
      ok: true, chiThu: true, gioVN, daGuiHomNay,
      soanDuoc: kq.soan.length, boQua: kq.boQua, loi: kq.loi,
      mau3: kq.soan.slice(0, 3).map((t) => `${t.ten}: ${t.noiDung}`),
    });
  }

  const batTuGui = new Set(chuois.filter((c) => c.tuGui).map((c) => c.ma));
  const choNguoiBam = kq.soan.filter((t) => !batTuGui.has(t.chuoi));
  const tuGui = kq.soan.filter((t) => batTuGui.has(t.chuoi));

  if (choNguoiBam.length) {
    await setConfigValue("zalo_tin_soan", JSON.stringify({ at: new Date().toISOString(), tin: choNguoiBam }),
      "Tin chuỗi chăm sóc máy soạn sẵn, chờ người bấm gửi");
  }

  let daXep = 0;
  if (tuGui.length) {
    const hang = await doc<Record<string, any>>("zalo_gui_cho", {});
    const luc = new Date().toISOString();
    for (const t of tuGui) {
      if (!t.own_id) continue;
      const id = randomUUID();
      const { error } = await sb.from("zalo_bridge_messages").insert({
        msg_id: `app-cho:${id}`, own_id: t.own_id, thread_id: t.zalo_uid, thread_type: "user",
        direction: "out", content: t.noiDung, sent_at: luc,
      });
      if (error) { kq.loi.push(`ghi tin hỏng cho ${t.ten}: ${error.message}`); continue; }
      hang[id] = { own: t.own_id, uid: t.zalo_uid, kieu: "user", noiDung: t.noiDung, boi: `máy: chuỗi ${t.chuoi}`, luc };
      daXep++;
      const ds = lichSu.get(t.zalo_uid) || [];
      ds.push({ chuoi: t.chuoi, buoc: t.buoc, luc });
      lichSu.set(t.zalo_uid, ds);
    }
    await setConfigValue("zalo_gui_cho", JSON.stringify(hang), "Hàng đợi gửi Zalo");
    await setConfigValue("zalo_chuoi_lich_su", JSON.stringify(Object.fromEntries(lichSu)), "Lịch sử chuỗi chăm sóc đã gửi");
  }

  return NextResponse.json({
    ok: true, gioVN, soanDuoc: kq.soan.length,
    choNguoiBam: choNguoiBam.length, daXepHangDoi: daXep,
    boQua: kq.boQua, loi: kq.loi,
  });
}
