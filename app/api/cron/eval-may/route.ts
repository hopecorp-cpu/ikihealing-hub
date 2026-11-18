import { NextResponse } from "next/server";
import { CAC_MAY, TEN_MAY, runEvalMay, type EvalKetQuaMay } from "@/lib/evals/run";
import type { MaMay } from "@/lib/evals/chung";
import { covanSendCEO, covanTelegramConfigured } from "@/lib/covan/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

function authorized(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

function soLanTruoc(kq: EvalKetQuaMay): string {
  if (kq.lanTruoc == null) return "lần chấm đầu tiên";
  const lech = kq.diem - kq.lanTruoc;
  return lech > 0 ? `tăng ${lech} so với lần trước (${kq.lanTruoc})`
    : lech < 0 ? `GIẢM ${-lech} so với lần trước (${kq.lanTruoc})` : `giữ nguyên (${kq.lanTruoc})`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chon = new URL(req.url).searchParams.get("may");
  const cacMay: MaMay[] = chon ? CAC_MAY.filter((m) => m === chon) : CAC_MAY;
  if (!cacMay.length) return NextResponse.json({ error: `máy không hợp lệ: ${chon}` }, { status: 400 });

  const ketQua: EvalKetQuaMay[] = [];
  const hong: string[] = [];
  for (const may of cacMay) {
    try {
      const kq = await runEvalMay(may);
      ketQua.push(kq);
      if (kq.lichSuLoi) hong.push(`${may}: ghi lịch sử hỏng — ${kq.lichSuLoi}`);
      if (kq.tong && kq.chiTiet.every((c) => c.ghiChu.includes("lỗi khi chạy ca"))) hong.push(`${may}: mọi ca đều lỗi khi chạy`);
    } catch (e) {
      hong.push(`${may}: ${String(e instanceof Error ? e.message : e).slice(0, 150)}`);
    }
  }

  const canhBao = ketQua.some((k) => k.diem < Math.ceil(k.tong * 0.8)) || hong.length > 0;
  const parts: string[] = [`${canhBao ? "CẢNH BÁO: " : ""}EVAL TUẦN 3 MÁY AI`];
  for (const k of ketQua) {
    const truot = k.chiTiet.filter((c) => !c.dat);
    parts.push(
      `${TEN_MAY[k.may]}: đạt ${k.diem}/${k.tong} — ${soLanTruoc(k)}` +
      (truot.length ? "\n" + truot.map((c) => `- ${c.id}: ${c.ghiChu.slice(0, 260)}`).join("\n") : ""),
    );
  }
  if (hong.length) parts.push("MÁY EVAL HỎNG:\n" + hong.map((h) => `- ${h}`).join("\n"));

  let sent: { ok: boolean; error?: string } = { ok: false, error: "Chưa cấu hình Telegram" };
  if (covanTelegramConfigured()) sent = await covanSendCEO(parts.join("\n\n"));

  return NextResponse.json(
    {
      ok: hong.length === 0,
      may: ketQua.map((k) => ({ may: k.may, diem: k.diem, tong: k.tong, truot: k.chiTiet.filter((c) => !c.dat).length, lanTruoc: k.lanTruoc })),
      hong,
      telegram: sent,
    },
    { status: hong.length ? 500 : 200 },
  );
}
