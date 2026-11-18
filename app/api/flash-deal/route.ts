import { NextResponse } from "next/server";
import { getFlashDeal, toPublic, claimSlot } from "@/lib/flash-deal";

export const dynamic = "force-dynamic";

const ORIGINS = ["https://example.com", "https://www.example.com"];

function cors(origin: string | null) {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
  if (origin && ORIGINS.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

export async function GET(req: Request) {
  const headers = cors(req.headers.get("origin"));
  try {
    return NextResponse.json(toPublic(await getFlashDeal()), { headers });
  } catch (e: any) {
    return NextResponse.json({ active: false, error: String(e?.message || e) }, { status: 500, headers });
  }
}

export async function POST(req: Request) {
  const headers = cors(req.headers.get("origin"));
  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.claim) return NextResponse.json({ ok: false, error: "thiếu claim" }, { status: 400, headers });
    return NextResponse.json(await claimSlot(), { headers });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500, headers });
  }
}
