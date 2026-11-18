import { NextResponse } from "next/server";
import { shopeeChuaSan, shopeeConfig } from "@/lib/shopee/config";
import { linkUyQuyenShopee, timestampShopee } from "@/lib/shopee/sign";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const chua = shopeeChuaSan();
  if (chua) return new NextResponse(`${chua}.`, { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  const c = shopeeConfig();
  return NextResponse.redirect(linkUyQuyenShopee({ host: c.host, partnerId: c.partnerId, partnerKey: c.partnerKey, redirect: c.redirect, timestamp: timestampShopee() }));
}
