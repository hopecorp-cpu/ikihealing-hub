import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { docLocV2, guiTomTatNhom } from "@/lib/telegram";
import { soanTomTat, soanTomTatMay, taoDongViec, ngayGioVN, type MucGom, type DongViec } from "@/lib/tg-loc-v2";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const thu = url.searchParams.get("thu") === "1";
  const ep = url.searchParams.get("ep") === "1";
  const ngay = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("ngay") || "") ? url.searchParams.get("ngay")! : ngayGioVN().ngay;
  const cfg = await docLocV2();
  if (!cfg.bat && !thu && !ep) return NextResponse.json({ ok: true, boQua: "luật v2 đang tắt (tg_loc_v2.bat)" });

  const sb = getServiceClient();
  const doc = async (k: string) => { const v = (await sb.from("config").select("value").eq("key", k).maybeSingle()).data?.value; try { return v ? JSON.parse(v) : null; } catch { return null; } };
  try {
    const daGui: Record<string, string[]> = (await doc("tg_tom_tat_da_gui")) || {};
    if (!thu && daGui[ngay]?.length) return NextResponse.json({ ok: true, boQua: "đã gửi tóm tắt ngày này", ngay, soNhom: daGui[ngay].length });
    const muc: MucGom[] = (await doc(`tg_gom_${ngay}`)) || [];
    const dinhTuyen = (await doc("tg_dinh_tuyen")) || {};
    const idCua = (k: string) => { const x = dinhTuyen?.[k]; const id = x?.chat || x; return typeof id === "string" ? id : undefined; };
    const mayHong = idCua("may-hong");
    const thay: any[] = (await doc("tg_nhom_thay")) || [];
    const ten = (id: string) => thay.find((x) => String(x.id) === id)?.ten || "nhóm";

    const theoNhom = new Map<string, MucGom[]>();
    for (const m of muc) if (m.hd === "gom" && m.dich !== mayHong) { const a = theoNhom.get(m.dich) || []; a.push(m); theoNhom.set(m.dich, a); }
    const ban: Array<{ dich: string; text: string; so: number }> = [];
    for (const [dich, a] of theoNhom) { const t = soanTomTat(ten(dich), ngay, a, cfg.dongToiDa); if (t) ban.push({ dich, text: t, so: a.length }); }
    if (mayHong) { const t = soanTomTatMay(ngay, muc, cfg.dongToiDa); if (t) ban.push({ dich: mayHong, text: t, so: muc.length }); }

    const cap = new Map<string, MucGom>();
    for (const [dich, a] of theoNhom) for (const m of a) cap.set(`${dich}|${m.nguon}`, m);
    const choBaoNgay: any[] = ((await doc("tn_viec_cho")) || []).filter((x: any) => x.ngay === ngay);
    const viecMoi = [
      ...[...cap.values()].map((m) => ({ phong: m.phong, han: m.han, nguon: m.nguon, nhom: ten(m.dich), ngay, tom_tat: m.dong1 })),
      ...choBaoNgay.map((x) => ({ phong: x.phong, han: x.han, nguon: x.nguon, nhom: ten(x.dich), ngay, tom_tat: x.tom_tat })),
    ];
    const bangCu: DongViec[] = (await doc("tn_bang_viec")) || [];
    const dongViec = taoDongViec(bangCu, viecMoi);

    const ketQua = { ngay, thu, soMuc: muc.length, soBan: ban.length, theoNhom: ban.map((b) => ({ nhom: ten(b.dich), tin: b.so, dong: b.text.split("\n").length })), dongViec: dongViec.length };
    if (thu) return NextResponse.json({ ok: true, ...ketQua });

    const gui: string[] = []; const loi: string[] = [];
    for (const b of ban) { const r = await guiTomTatNhom(b.dich, b.text); (r.ok ? gui : loi).push(ten(b.dich)); }
    daGui[ngay] = gui;
    for (const k of Object.keys(daGui)) if (k < ngayGioVN(new Date(Date.now() - 30 * 864e5)).ngay) delete daGui[k];
    await sb.from("config").upsert({ key: "tg_tom_tat_da_gui", value: JSON.stringify(daGui), description: "Ngày → nhóm đã nhận tóm tắt 17:00 (chống gửi trùng, KT-TNLOC)" }, { onConflict: "key" });
    await sb.from("config").upsert({ key: "tn_bang_viec", value: JSON.stringify([...bangCu, ...dongViec].slice(-1000)), description: "Việc TN-<phòng>-NN sinh từ tóm tắt/tin báo ngay Trợ lý AI (luat-loc.md mục 3)" }, { onConflict: "key" });
    const conCho = ((await doc("tn_viec_cho")) || []).filter((x: any) => x.ngay !== ngay);
    await sb.from("config").upsert({ key: "tn_viec_cho", value: JSON.stringify(conCho), description: "Việc từ tin báo ngay chờ cron tom-tat-nhom đánh mã TN-<phòng>-NN (KT-TNLOC)" }, { onConflict: "key" });

    const moc = ngayGioVN(new Date(Date.now() - 90 * 864e5)).ngay;
    await sb.from("config").delete().like("key", "tg_ban_du_%").lt("key", `tg_ban_du_${moc}`);
    await sb.from("config").delete().like("key", "tg_gom_%").lt("key", `tg_gom_${moc}`);
    if (loi.length) return NextResponse.json({ ok: false, ...ketQua, gui: gui.length, loi }, { status: 500 });
    return NextResponse.json({ ok: true, ...ketQua, gui: gui.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
