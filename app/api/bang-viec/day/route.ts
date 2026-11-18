import { NextResponse } from "next/server";
import { chanMay } from "@/lib/kiem-cron";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { sendTelegramMay } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { KHOA_CONFIG, chuanHoaDauVao, docLuu, soanTin, tinhCanBao, type BangViecLuu } from "@/lib/bang-viec";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const chan = await chanMay(req, [{ env: "BANG_VIEC_SECRET", bearer: true }]);
  if (chan) return chan;

  const body = await req.json().catch(() => null);
  const kq = chuanHoaDauVao(body);
  if (!kq.ok) return NextResponse.json({ ok: false, error: kq.error }, { status: 400 });

  const cu = docLuu(await getConfigValue(KHOA_CONFIG));
  const { canBao, daBao } = tinhCanBao(cu, kq.viec, Date.now());

  let daGui = 0;
  const choGui: string[] = [];
  if (canBao.length) {
    const r: any = await sendTelegramMay("may-hong", soanTin(canBao, appLink("/admin/bang-viec")));
    if (r?.ok) daGui = canBao.length;
    else for (const v of canBao) {
      if (cu?.da_bao?.[v.ma]) daBao[v.ma] = cu.da_bao[v.ma]; else delete daBao[v.ma];
      choGui.push(v.ma);
    }
  }

  const luu: BangViecLuu = { cap_nhat: new Date().toISOString(), viec: kq.viec, da_bao: daBao, cho_gui: choGui };
  await setConfigValue(KHOA_CONFIG, JSON.stringify(luu), "Bảng việc iMac đẩy lên (/admin/bang-viec) — {cap_nhat, viec, da_bao}");
  return NextResponse.json({
    ok: true, so_viec: kq.viec.length, bo_qua: kq.bo_qua, seed: !cu, can_bao: canBao.length, da_gui: daGui,
    ...(canBao.length && !daGui ? { loi_gui: true } : {}),
  }, { status: canBao.length && !daGui ? 502 : 200 });
}
