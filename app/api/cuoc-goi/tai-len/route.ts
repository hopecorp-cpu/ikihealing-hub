import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue } from "@/lib/app-config";
import { BUCKET_GHI_AM, bienTheSdt, duongDanFile, kiemDauVao, timMay } from "@/lib/cuoc-goi";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const cfg = await getConfigValue("ghi_am_may");
  if (!cfg) return NextResponse.json({ ok: false, loi: "máy chủ chưa cấu hình ghi_am_may" }, { status: 503 });
  const may = timMay(token, cfg);
  if (!may) return NextResponse.json({ ok: false, loi: "mã máy sai hoặc đã bị thu hồi" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const kt = kiemDauVao(body);
  if (!kt.ok) return NextResponse.json({ ok: false, loi: kt.loi }, { status: 400 });
  const v = kt.v;
  const sb = getServiceClient();

  const { data: daCo, error: loiDoc } = await sb.from("cuoc_goi").select("file_path")
    .eq("may_ma", may.ma).eq("ma_tren_may", v.ma_tren_may).maybeSingle();
  if (loiDoc) return NextResponse.json({ ok: false, loi: "đọc DB lỗi: " + loiDoc.message }, { status: 500 });
  if (daCo) {

    const thuMuc = daCo.file_path.slice(0, daCo.file_path.lastIndexOf("/"));
    const ten = daCo.file_path.slice(daCo.file_path.lastIndexOf("/") + 1);
    const { data: ds } = await sb.storage.from(BUCKET_GHI_AM).list(thuMuc, { search: ten, limit: 1 });
    if (ds?.some((f) => f.name === ten)) return NextResponse.json({ ok: true, da_co: true });
    const { data: ky2, error: loiKy2 } = await sb.storage.from(BUCKET_GHI_AM).createSignedUploadUrl(daCo.file_path, { upsert: true });
    if (loiKy2 || !ky2) return NextResponse.json({ ok: false, loi: "không cấp được chỗ lưu: " + (loiKy2?.message || "") }, { status: 500 });
    return NextResponse.json({ ok: true, url: ky2.signedUrl });
  }

  if ((await getConfigValue("ghi_am_loc")) !== "tat_ca") {
    const bt = bienTheSdt(v.sdt);
    const [a, b, c] = await Promise.all([
      sb.from("leads").select("id").in("phone", bt).limit(1),
      sb.from("tg_orders").select("id").in("sdt", bt).limit(1),
      sb.from("zalo_bridge_contacts").select("zalo_uid").in("phone_norm", bt).limit(1),
    ]);
    const loi = a.error || b.error || c.error;

    if (loi) return NextResponse.json({ ok: false, loi: "đọc DB lỗi: " + loi.message }, { status: 500 });
    if (!a.data?.length && !b.data?.length && !c.data?.length) return NextResponse.json({ ok: true, bo_qua: true });
  }

  const path = duongDanFile(may.ma, v);
  const { data: ky, error: loiKy } = await sb.storage.from(BUCKET_GHI_AM).createSignedUploadUrl(path, { upsert: true });
  if (loiKy || !ky) return NextResponse.json({ ok: false, loi: "không cấp được chỗ lưu: " + (loiKy?.message || "") }, { status: 500 });

  const { error: loiGhi } = await sb.from("cuoc_goi").insert({
    may_ma: may.ma, sale: may.sale || null, ma_tren_may: v.ma_tren_may, sdt: v.sdt, chieu: v.chieu,
    bat_dau: v.bat_dau, thoi_luong_giay: v.thoi_luong_giay, file_path: path, file_bytes: v.file_bytes,
  });
  if (loiGhi && !/duplicate key/i.test(loiGhi.message)) {
    return NextResponse.json({ ok: false, loi: "ghi DB lỗi: " + loiGhi.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: ky.signedUrl });
}
