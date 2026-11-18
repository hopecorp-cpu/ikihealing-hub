import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { GIA_V4_HIEU_LUC_TU, GIA_V4_PHIEN_BAN, NHAN_TRANG_THAI, bangGiaV4 } from "@/lib/gia-v4";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const o = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const dong = [
    ["San pham", "Quy cach", "Kenh", "Bac", "Chiet khau %", "Gia (VND, gom VAT)", "Trang thai", "Ghi chu"].map(o).join(","),
    ...bangGiaV4().map((d) => [d.sanPham, d.quyCach, d.kenh, d.bac, d.chietKhauPct ?? "", d.gia ?? "", NHAN_TRANG_THAI[d.trangThai], d.ghiChu].map(o).join(",")),
  ];
  const body = "﻿" + dong.join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bang-gia-${GIA_V4_PHIEN_BAN}-${GIA_V4_HIEU_LUC_TU}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
