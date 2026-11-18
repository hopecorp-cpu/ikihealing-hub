import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { setConfigValue } from "@/lib/app-config";
import { chanMay, khoaCron } from "@/lib/kiem-cron";
import { chamHoiThoaiSale } from "@/lib/cham-chat-sale.mjs";
import { chepLoiCuocGoi } from "@/lib/cuoc-goi-chep";
import { BUCKET_GHI_AM, BYTE_TOI_DA_CHEP, GIAY_TOI_THIEU, MIME_AM_THANH } from "@/lib/cuoc-goi";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MOI_LUOT = 12;
const SONG_SONG = 4;
const THU_TOI_DA = 3;

export async function GET(req: Request) {
  const chan = await chanMay(req, [khoaCron()]);
  if (chan) return chan;
  const anthropicKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!anthropicKey) return NextResponse.json({ ok: false, loi: "thiếu ANTHROPIC_API_KEY" }, { status: 500 });

  const sb = getServiceClient();
  const { data: hang, error } = await sb.from("cuoc_goi")
    .select("id,sale,chieu,thoi_luong_giay,file_path,file_bytes,so_lan_thu,tao_luc")
    .eq("trang_thai", "cho_chep").order("bat_dau", { ascending: true }).limit(MOI_LUOT * 5);

  if (error) return NextResponse.json({ ok: false, loi: error.message }, { status: 500 });

  const dem = { cham: 0, qua_ngan: 0, cho_file: 0, loi: 0, thu_lai: 0 };
  const loiMau: string[] = [];

  const motCuoc = async (c: any) => {
    const capNhat = (v: Record<string, any>) => sb.from("cuoc_goi").update(v).eq("id", c.id);
    if (c.thoi_luong_giay < GIAY_TOI_THIEU) { await capNhat({ trang_thai: "qua_ngan" }); dem.qua_ngan++; return; }
    if ((c.file_bytes || 0) > BYTE_TOI_DA_CHEP) {
      await capNhat({ trang_thai: "loi", loi: "file quá lớn để chép (trên 14MB)" }); dem.loi++; return;
    }
    const thatBai = async (loi: string) => {
      const lan = (c.so_lan_thu || 0) + 1;
      await capNhat(lan >= THU_TOI_DA ? { trang_thai: "loi", loi, so_lan_thu: lan } : { so_lan_thu: lan, loi });
      if (lan >= THU_TOI_DA) dem.loi++; else dem.thu_lai++;
      if (loiMau.length < 3) loiMau.push(loi.slice(0, 160));
    };

    const { data: blob, error: loiTai } = await sb.storage.from(BUCKET_GHI_AM).download(c.file_path);
    if (loiTai || !blob) {

      if (Date.now() - new Date(c.tao_luc).getTime() > 2 * 86400e3) {
        await capNhat({ trang_thai: "loi", loi: "app chưa đẩy file lên sau 2 ngày" }); dem.loi++;
      } else dem.cho_file++;
      return;
    }
    const duoi = c.file_path.split(".").pop() || "m4a";
    const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const chep = await chepLoiCuocGoi(b64, MIME_AM_THANH[duoi] || "audio/mp4");
    if (!chep.ok) return thatBai("chép lời: " + chep.error);
    if (chep.text.includes("[không có lời]")) { await capNhat({ trang_thai: "qua_ngan", ban_chep: chep.text }); dem.qua_ngan++; return; }

    try {
      const dau = `[CUỘC GỌI ĐIỆN THOẠI — ${c.chieu === "den" ? "khách gọi đến" : "sale gọi đi"}, ${Math.round(c.thoi_luong_giay / 60)} phút. Bản chép lời từ ghi âm, có thể sai vài chữ.]\n`;
      const kq: any = await chamHoiThoaiSale(dau + chep.text, anthropicKey);
      const diem = Number.isFinite(Number(kq?.diem)) ? Math.round(Number(kq.diem)) : null;
      await capNhat({ trang_thai: "da_cham", ban_chep: chep.text, cham: kq, diem, cham_luc: new Date().toISOString(), loi: null });
      dem.cham++;
    } catch (e: any) {

      await thatBai("chấm điểm: " + String(e?.message || e));
    }
  };

  const ds = hang || [];
  const daLam = () => dem.cham + dem.qua_ngan + dem.loi + dem.thu_lai;
  for (let i = 0; i < ds.length && daLam() < MOI_LUOT; i += SONG_SONG) await Promise.all(ds.slice(i, i + SONG_SONG).map(motCuoc));

  const { count: conLai } = await sb.from("cuoc_goi").select("id", { count: "exact", head: true }).eq("trang_thai", "cho_chep");
  const tt = { at: new Date().toISOString(), ...dem, conLai: conLai ?? null, loiMau };
  await setConfigValue("cham_cuoc_goi_status", JSON.stringify(tt), "Nhịp máy chép lời + chấm cuộc gọi (cron cham-cuoc-goi)");
  return NextResponse.json({ ok: true, ...tt });
}
