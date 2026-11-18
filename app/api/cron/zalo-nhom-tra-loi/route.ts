import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { handleInboundMessage } from "@/lib/zalo-agent";
import { findBanned } from "@/lib/banned-words";
import { docCaiDatNhom } from "@/lib/zalo-nhom-cai-dat";
import { chuaSdtHoacMaDon } from "@/lib/tra-don-kenh";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const KHOA_CHO = "zalo_nhom_bot_cho";
const KHOA_GUI = "zalo_gui_cho";
const KHOA_SO = "zalo_nhom_bot_so";
const TRAN_GIO = 6;
const QUA_HAN_PHUT = 30;

type TinCho = {
  own: string; gid: string; ten?: string;
  hoi: string; cuaAi?: string; msgId?: string; luc: string;
};

async function cfg(sb: any, key: string): Promise<any> {
  const { data } = await sb.from("config").select("value").eq("key", key).maybeSingle();
  try { return JSON.parse(data?.value || "{}"); } catch { return {}; }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const thu = url.searchParams.get("dry") === "1";

  try {
    const sb = getServiceClient();
    const cho: Record<string, TinCho> = await cfg(sb, KHOA_CHO);
    const items = Object.entries(cho);
    if (!items.length) return NextResponse.json({ ok: true, cho: 0, soan: 0 });

    const caiDat = await docCaiDatNhom();
    const so: Record<string, number[]> = await cfg(sb, KHOA_SO);
    const bayGio = Date.now();

    const xong: string[] = [];
    const guiThem: Record<string, any> = {};
    let soan = 0, boTuCam = 0, boTat = 0, boQuaHan = 0, boTran = 0, boPii = 0, hong = 0;

    for (const [id, t] of items.slice(0, 10)) {
      const ma = `${t.own}|${t.gid}`;
      const tuoiPhut = (bayGio - new Date(t.luc).getTime()) / 60000;

      if (!caiDat[ma]?.chatbot) { xong.push(id); boTat++; continue; }
      if (!(tuoiPhut < QUA_HAN_PHUT)) { xong.push(id); boQuaHan++; continue; }

      const gioQua = (so[ma] || []).filter((x) => bayGio - x < 3600_000);
      if (gioQua.length >= TRAN_GIO) { xong.push(id); boTran++; continue; }

      try {
        const r = await handleInboundMessage(String(t.hoi || "").slice(0, 400), [], "", "zalo", { kenh: "zalo_nhom" });
        const traLoi = String(r?.reply || "").trim();
        if (!traLoi) { xong.push(id); hong++; continue; }
        if (findBanned(traLoi).length) { xong.push(id); boTuCam++; continue; }
        if (chuaSdtHoacMaDon(traLoi)) {

          console.warn(`[zalo-nhom-tra-loi] bỏ câu ${id}: chứa SĐT hoặc mẫu mã đơn`);
          xong.push(id); boPii++; continue;
        }

        if (!thu) {
          guiThem[`nhom-${id}`] = {
            own: t.own, uid: t.gid, kieu: "group", noiDung: traLoi,
            nguon: "bot-nhom", luc: new Date().toISOString(),
          };
          so[ma] = [...gioQua, bayGio];
        }
        xong.push(id);
        soan++;
      } catch { xong.push(id); hong++; }
    }

    if (!thu && (xong.length || Object.keys(guiThem).length)) {

      const choMoi: Record<string, TinCho> = await cfg(sb, KHOA_CHO);
      for (const id of xong) delete choMoi[id];
      const guiMoi: Record<string, any> = await cfg(sb, KHOA_GUI);
      Object.assign(guiMoi, guiThem);

      for (const [k, v, mo] of [
        [KHOA_CHO, JSON.stringify(choMoi), "Tin nhóm Zalo đang chờ máy soạn câu trả lời"],
        [KHOA_GUI, JSON.stringify(guiMoi), null],
        [KHOA_SO, JSON.stringify(so), "Sổ đếm câu bot đã nói trong từng nhóm Zalo (chặn trần giờ)"],
      ] as const) {
        const { error } = await sb.from("config").upsert(
          { key: k, value: v, ...(mo ? { description: mo } : {}) }, { onConflict: "key" },
        );
        if (error) throw new Error(`ghi ${k}: ${error.message}`);
      }
    }

    return NextResponse.json({ ok: true, cho: items.length, soan, boTuCam, boTat, boQuaHan, boTran, boPii, hong, thu });
  } catch (e: any) {
    return NextResponse.json({ loi: e?.message || "Lỗi không rõ" }, { status: 500 });
  }
}
