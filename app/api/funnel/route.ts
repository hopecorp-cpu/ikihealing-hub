import { NextResponse } from "next/server";
import { recordFunnel } from "@/lib/funnel";
import { chuanKenh, chuanTrang, ghiBamChat } from "@/lib/bam-chat";

export const dynamic = "force-dynamic";

const MIEN_CHO_PHEP = ["example.com", "example.com", "ops-hub.example.com"];

function originChoPhep(origin: string | null): string | null {
  if (!origin) return null;
  let host: string;
  try { host = new URL(origin).hostname; } catch { return null; }
  if (host === "localhost" || host === "127.0.0.1") return origin;

  return MIEN_CHO_PHEP.some((m) => host === m || host.endsWith("." + m)) ? origin : null;
}

function cors(req: Request) {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",

    Vary: "Origin",
  };
  const ok = originChoPhep(req.headers.get("origin"));
  if (ok) {
    h["Access-Control-Allow-Origin"] = ok;
    h["Access-Control-Allow-Credentials"] = "true";
  }
  return h;
}

export function OPTIONS(req: Request) { return new NextResponse(null, { status: 204, headers: cors(req) }); }

function vnDay(): string {

  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch {  }
  const page = String(b.page || "").trim();
  const step = String(b.step || "").trim();

  if (step === "bam_zalo" || step === "bam_goi") {
    const trang = chuanTrang(page);
    if (!trang) return NextResponse.json({ ok: false }, { status: 400, headers: cors(req) });
    try { await ghiBamChat(trang, chuanKenh(b.kenh), step === "bam_zalo" ? "zalo" : "goi", vnDay()); } catch {  }
    return NextResponse.json({ ok: true }, { headers: cors(req) });
  }
  if (!page || !step) return NextResponse.json({ ok: false }, { status: 400, headers: cors(req) });
  try { await recordFunnel(page, step, vnDay()); } catch {  }
  return NextResponse.json({ ok: true }, { headers: cors(req) });
}
