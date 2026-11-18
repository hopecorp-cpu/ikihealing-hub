import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { taoTokenLive } from "@/lib/gemini-live";
import { dungSetupDich, TRAN_PHIEN_NGAY } from "@/lib/dich-hop";

export const dynamic = "force-dynamic";

const KHOA_DEM = "dich_hop_su_dung";

async function demPhien(email: string): Promise<number> {
  const ngay = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  let so: { ngay: string; dem: Record<string, number> } = { ngay, dem: {} };
  try {
    const cu = JSON.parse((await getConfigValue(KHOA_DEM)) || "{}");
    if (cu.ngay === ngay && cu.dem && typeof cu.dem === "object") so = cu;
  } catch {}
  so.dem[email] = (so.dem[email] || 0) + 1;
  await setConfigValue(KHOA_DEM, JSON.stringify(so), "Dịch họp: số phiên Gemini Live mỗi người trong ngày (giờ VN)");
  return so.dem[email];
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return NextResponse.json({ error: "Công cụ dịch họp chỉ dành cho quản lý trở lên" }, { status: 403 });

  let lan: number;
  try { lan = await demPhien(user.email || user.id); }
  catch { return NextResponse.json({ error: "Không ghi được số phiên dùng" }, { status: 500 }); }
  if (lan > TRAN_PHIEN_NGAY) return NextResponse.json({ error: `Hôm nay bạn đã mở ${TRAN_PHIEN_NGAY} phiên dịch, chạm trần trong ngày` }, { status: 429 });

  const b = await req.json().catch(() => ({}));
  const { setup } = dungSetupDich(b);
  const tk = await taoTokenLive(setup);
  if (!tk.ok) return NextResponse.json({ error: "Chưa mở được phiên Gemini Live", chiTiet: tk.error }, { status: 502 });
  return NextResponse.json({ token: tk.token, setup: { model: setup.model } });
}
