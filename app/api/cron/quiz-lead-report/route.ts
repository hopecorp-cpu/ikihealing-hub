import { NextResponse } from "next/server";
import { setConfigValue } from "@/lib/app-config";
import { sendTelegram, sendTelegramMay, telegramConfigured } from "@/lib/telegram";
import { buildQuizLeadReport } from "@/lib/quiz-lead-report";
import { chanMay, khoaBaoCao, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KHOA_ROUTE = [khoaCron({ bearer: true, query: ["secret"] }), khoaBaoCao({ headers: ["x-report-token"], query: ["token"] })];

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, KHOA_ROUTE); if (chanKhoa) return chanKhoa;
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  try {
    const r = await buildQuizLeadReport();
    let sent: any = null;
    if (!dry && r.tong > 0 && telegramConfigured()) {

      const khuc: string[] = [];
      let dem = "";
      for (const dong of r.text.split("\n")) {
        if ((dem + "\n" + dong).length > 3800) { khuc.push(dem); dem = dong; }
        else dem = dem ? dem + "\n" + dong : dong;
      }
      if (dem) khuc.push(dem);
      let nhomOk = true, ceoOk = true;
      for (let i = 0; i < khuc.length; i++) {
        const phan = khuc.length > 1 ? `(${i + 1}/${khuc.length})\n${khuc[i]}` : khuc[i];
        const a = await sendTelegramMay("lead-nong", phan);
        const b = await sendTelegram(phan);
        if (a?.ok === false) nhomOk = false;
        if (b?.ok === false) ceoOk = false;
      }
      sent = { nhom: nhomOk, ceo: ceoOk, soKhuc: khuc.length };
      if (!nhomOk && !ceoOk) throw new Error("Telegram gửi hỏng cả hai đích");
    }
    if (!dry) await setConfigValue("quiz_lead_report_last", JSON.stringify({ at: new Date().toISOString(), tong: r.tong, theoSale: r.theoSale }), "Nhịp tim báo cáo khách quiz chưa chạm");
    return NextResponse.json({ ok: true, dry, tong: r.tong, theoSale: r.theoSale, sent, text: r.text });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
