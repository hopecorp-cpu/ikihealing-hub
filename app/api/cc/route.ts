import { NextResponse } from "next/server";
import { listApproved, report, progress, claim, addTask, capNhatTienDo } from "@/lib/cc-queue";
import { sendBrainTelegram, tgEscape } from "@/lib/telegram";
import { getConfigValue } from "@/lib/app-config";

export const dynamic = "force-dynamic";

async function authed(req: Request): Promise<boolean> {
  const url = new URL(req.url);
  const secret = (process.env.CC_RUNNER_SECRET || "").trim();
  const key = url.searchParams.get("key");
  if (secret && (key === secret || req.headers.get("authorization") === `Bearer ${secret}`)) return true;
  const tok = ((await getConfigValue("ads_report_token").catch(() => "")) || "").trim();
  const prov = (req.headers.get("x-report-token") || "").trim();
  return !!tok && prov === tok;
}

export async function GET(req: Request) {
  if (!(await authed(req))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (new URL(req.url).searchParams.get("so_lieu")) {

    const { buildLiveContext } = await import("@/lib/acme-brain");
    return NextResponse.json({ ok: true, text: await buildLiveContext() });
  }
  return NextResponse.json({ ok: true, tasks: await listApproved() });
}

export async function POST(req: Request) {
  if (!(await authed(req))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b?.tao?.task) {
    const task = String(b.tao.task).slice(0, 2000);

    const tag = task.match(/^([A-Z][A-Z0-9-]{2,}):/)?.[1];
    const t = await addTask(task, String(b.tao.project || ""), "", String(b.tao.by || "Claude (làm thay Grok)"), { thayTheTag: tag });
    return NextResponse.json({ ok: true, id: t.id });
  }
  if (typeof b?.thong_bao === "string" && b.thong_bao.trim()) {
    const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
    if (!ceo) return NextResponse.json({ ok: false, error: "thiếu TELEGRAM_CHAT_ID" }, { status: 500 });
    await sendBrainTelegram(ceo, tgEscape(b.thong_bao.trim().slice(0, 3500)));
    return NextResponse.json({ ok: true });
  }
  if (!b?.id) return NextResponse.json({ ok: false, error: "thiếu id" }, { status: 400 });
  if (b.claim === true) {
    const t = await claim(String(b.id));
    return NextResponse.json({ ok: !!t, task: t });
  }
  if (typeof b.tienDo === "number" && isFinite(b.tienDo)) {
    const done = await capNhatTienDo(String(b.id), b.tienDo, typeof b.buoc === "string" ? b.buoc : undefined);
    return NextResponse.json({ ok: done });
  }
  if (typeof b.progress === "string") {
    const done = await progress(String(b.id), b.progress);
    return NextResponse.json({ ok: done });
  }
  const done = await report(String(b.id), String(b.result || ""), b.ok !== false, !!b.needsDeploy);
  return NextResponse.json({ ok: done });
}
