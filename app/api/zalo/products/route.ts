import { NextResponse } from "next/server";
import { SAN_PHAM_V4, type MaSanPham } from "@/lib/gia-v4";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const NHOM: Record<MaSanPham, string> = { "dam": "dinhduong", "dam-hu-500": "dinhduong", "san-pham-b": "tra", "san-pham-c": "tra" };

export async function GET() {
  const products = SAN_PHAM_V4
    .filter((s) => s.trangThai === "hieu_luc" && s.niemYet != null)
    .map((s) => ({
      sku: s.ma, name: s.ten, price: s.niemYet as number,
      unit: s.quyCach.split(" ")[0].replace(/^./, (c) => c.toUpperCase()),
      cat: NHOM[s.ma], desc: s.quyCach,
    }));
  return NextResponse.json({ ok: true, products, count: products.length, nguon: "gia-v4" }, { headers: CORS });
}
