import { NextResponse } from "next/server";
import { ghiBam, linkDich } from "@/lib/kenh-dan-duong";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { ma: string } }) {
  const ma = String(params.ma || "").slice(0, 12);
  let dich = "https://example.com/blog/";
  try {
    const l = await ghiBam(ma);
    if (l) dich = linkDich(l);
  } catch {  }
  return NextResponse.redirect(dich, { status: 302 });
}
