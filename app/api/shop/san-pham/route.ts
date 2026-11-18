import { NextResponse } from "next/server";
import { docCuaHang, banCongKhai } from "@/lib/cua-hang";

export const dynamic = "force-dynamic";

const ORIGINS = ["https://example.com", "https://www.example.com"];

function cors(origin: string | null) {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",

    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    Vary: "Origin",
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
    const sanPham = banCongKhai(await docCuaHang());
    return NextResponse.json({ sanPham }, { headers });
  } catch (e: any) {
    return NextResponse.json({ sanPham: [], error: String(e?.message || e) }, { status: 500, headers: { ...headers, "Cache-Control": "no-store" } });
  }
}
