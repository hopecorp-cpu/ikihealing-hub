import { NextResponse } from "next/server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";

export const dynamic = "force-dynamic";

const KEY = "quiz_codia_answers";
const CAP = 20000;

function cors() {
  return {
    "Access-Control-Allow-Origin": "https://example.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: cors() }); }

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch {  }

  const pattern = String(b.pattern || "").trim().slice(0, 24);
  const locale = String(b.locale || "vi").trim().slice(0, 5);
  const answers = Array.isArray(b.answers)
    ? b.answers.slice(0, 20).map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
    : [];
  if (!pattern || answers.length < 5) {
    return NextResponse.json({ ok: false }, { status: 400, headers: cors() });
  }

  const rec = {
    ts: Date.now(),
    loc: locale,
    pattern,
    answers,
    han: Number(b.han),
    hu: Number(b.hu),
    src: String(b.source || "").slice(0, 40),
  };

  try {
    let list: any[] = [];
    try { list = JSON.parse((await getConfigValue(KEY)) || "[]"); } catch { list = []; }
    list.push(rec);
    await setConfigValue(KEY, JSON.stringify(list.slice(-CAP)), "Câu trả lời ẩn danh quiz cơ địa example.com");
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: cors() });
  }
  return NextResponse.json({ ok: true }, { headers: cors() });
}
