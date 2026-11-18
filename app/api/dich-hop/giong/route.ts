import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { giongDichHopLe, KHOA_GIONG_TAI_KHOAN } from "@/lib/dich-hop";

export const dynamic = "force-dynamic";

async function docBang(): Promise<Record<string, string>> {
  try {
    const j = JSON.parse((await getConfigValue(KHOA_GIONG_TAI_KHOAN)) || "{}");
    return j && typeof j === "object" ? j : {};
  } catch { return {}; }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  const g = (await docBang())[user.id];
  return NextResponse.json({ giong: giongDichHopLe(g) ? g : null });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!giongDichHopLe(b.giong)) return NextResponse.json({ error: "Giọng không hợp lệ" }, { status: 400 });
  const bang = await docBang();
  bang[user.id] = String(b.giong);
  try { await setConfigValue(KHOA_GIONG_TAI_KHOAN, JSON.stringify(bang), "Dịch họp: giọng phần Tôi mỗi tài khoản tự chọn ({user_id: tên giọng})"); }
  catch { return NextResponse.json({ error: "Không lưu được" }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
